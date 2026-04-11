import logging
import os
import tempfile
from typing import Annotated, Optional

import numpy as np
import soundfile as sf
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

from models.fusion_transformer import FusionTransformer, IoTContext
from preprocessing.audio_pipeline import run_pipeline

load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("zooglossia")

# --------------------------------------------------------------------------- #
# Lazy-loaded singletons                                                       #
# --------------------------------------------------------------------------- #
_fusion_model: Optional[FusionTransformer] = None


def _get_fusion_model() -> FusionTransformer:
    global _fusion_model
    if _fusion_model is None:
        _fusion_model = FusionTransformer()
        _fusion_model.eval()
        logger.info("FusionTransformer loaded")
    return _fusion_model


# --------------------------------------------------------------------------- #
# App                                                                          #
# --------------------------------------------------------------------------- #
app = FastAPI(
    title="Zooglossia AI Service",
    description="Pet vocalization intent analysis — audio + IoT fusion",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_methods=["POST", "GET"],
    allow_headers=["*"],
)


# --------------------------------------------------------------------------- #
# Response schemas                                                             #
# --------------------------------------------------------------------------- #
class AudioFeatures(BaseModel):
    duration_seconds: float
    mel_shape: list[int]
    centroid_shape: list[int]


class AnalyzeResponse(BaseModel):
    intent_label: str
    intent_confidence: float
    intent_probs: dict[str, float]
    fused_embedding_shape: list[int]
    audio_features: AudioFeatures
    naturelm_raw_output: str
    naturelm_intent: str
    rvc_enhancement_applied: bool


# --------------------------------------------------------------------------- #
# Routes                                                                       #
# --------------------------------------------------------------------------- #
@app.get("/health", summary="Liveness check")
def health():
    return {"status": "ok", "service": "zooglossia-ai"}


@app.post(
    "/analyze",
    response_model=AnalyzeResponse,
    summary="Analyze a pet vocalization",
    description=(
        "Upload a WAV/FLAC audio file and optional IoT context JSON fields. "
        "Returns intent classification, confidence, and fused embedding metadata."
    ),
)
async def analyze(
    audio: Annotated[UploadFile, File(description="Pet audio file (WAV or FLAC, mono/stereo, any sample rate)")],
    time_of_day: Annotated[float, Form()] = 12.0,
    last_meal_hours_ago: Annotated[float, Form()] = 4.0,
    motion_level: Annotated[str, Form()] = "medium",
    room_temp_c: Annotated[float, Form()] = 22.0,
    activity_level: Annotated[str, Form()] = "resting",
):
    # Validate content type loosely — accept wav and flac uploads
    filename = audio.filename or ""
    if not filename.lower().endswith((".wav", ".flac", ".mp3", ".ogg")):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Unsupported audio format. Use WAV, FLAC, MP3, or OGG.",
        )

    # Write upload to temp file so pipeline can read it
    suffix = os.path.splitext(filename)[-1] or ".wav"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        contents = await audio.read()
        if len(contents) == 0:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="Uploaded audio file is empty.",
            )
        tmp.write(contents)
        tmp_path = tmp.name

    try:
        # Step 1: Preprocessing (denoise + RVC v3 enhancement + features)
        logger.info(f"Running preprocessing on {filename}")
        features, clean_audio, rvc_applied = run_pipeline(tmp_path)
        logger.info(f"RVC v3 enhancement applied: {rvc_applied}")

        # Step 2: NatureLM intent classification + audio embedding
        naturelm_result = _run_naturelm(clean_audio)

        # Step 3: Cross-modal fusion
        iot = IoTContext.from_dict({
            "time_of_day": time_of_day,
            "last_meal_hours_ago": last_meal_hours_ago,
            "motion_level": motion_level,
            "room_temp_c": room_temp_c,
            "activity_level": activity_level,
        })
        fusion_result = _get_fusion_model().predict(
            naturelm_result["intent_embedding"], iot
        )

    except Exception as exc:
        logger.exception("Pipeline error")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=str(exc),
        )
    finally:
        os.unlink(tmp_path)

    return AnalyzeResponse(
        intent_label=fusion_result["intent_label"],
        intent_confidence=fusion_result["intent_confidence"],
        intent_probs=fusion_result["intent_probs"],
        fused_embedding_shape=list(fusion_result["fused_embedding_shape"]),
        audio_features=AudioFeatures(
            duration_seconds=features["duration_seconds"],
            mel_shape=list(features["mel_spectrogram"].shape),
            centroid_shape=list(features["spectral_centroid"].shape),
        ),
        naturelm_raw_output=naturelm_result["raw_model_output"],
        naturelm_intent=naturelm_result["intent_label"],
        rvc_enhancement_applied=rvc_applied,
    )


# --------------------------------------------------------------------------- #
# NatureLM helper — lazy import to avoid slow load at startup                 #
# --------------------------------------------------------------------------- #
def _run_naturelm(clean_audio: np.ndarray) -> dict:
    from models.naturelm_classifier import run_on_clean_audio
    return run_on_clean_audio(clean_audio)


# --------------------------------------------------------------------------- #
# Entry-point                                                                  #
# --------------------------------------------------------------------------- #
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
