import logging
import os
import tempfile
from typing import Annotated, Optional

import sentry_sdk
import structlog
import numpy as np
from dotenv import load_dotenv
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sentry_sdk.integrations.fastapi import FastApiIntegration
from sentry_sdk.integrations.starlette import StarletteIntegration

from models.fusion_transformer import FusionTransformer, IoTContext
from preprocessing.audio_pipeline import run_pipeline

load_dotenv()

# ─── Structured logging ──────────────────────────────────────────────────────
structlog.configure(
    processors=[
        structlog.stdlib.add_log_level,
        structlog.stdlib.add_logger_name,
        structlog.processors.TimeStamper(fmt="iso"),
        structlog.processors.StackInfoRenderer(),
        structlog.processors.format_exc_info,
        structlog.processors.JSONRenderer() if os.getenv("NODE_ENV") == "production"
        else structlog.dev.ConsoleRenderer(),
    ],
    wrapper_class=structlog.make_filtering_bound_logger(logging.INFO),
    context_class=dict,
    logger_factory=structlog.PrintLoggerFactory(),
)
logger = structlog.get_logger("zooglossia")

# ─── Sentry ──────────────────────────────────────────────────────────────────
_sentry_dsn = os.getenv("SENTRY_DSN_AI")
if _sentry_dsn:
    sentry_sdk.init(
        dsn=_sentry_dsn,
        environment=os.getenv("NODE_ENV", "development"),
        traces_sample_rate=0.2,
        integrations=[StarletteIntegration(), FastApiIntegration()],
    )

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

_allowed_origins = [o.strip() for o in os.getenv("ALLOWED_ORIGINS", "").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins or ["http://localhost:5000"],
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

    logger.info("audio upload saved", path=tmp_path, size=len(contents), suffix=suffix)

    # Check if in demo mode (skip heavy ML models)
    if os.getenv("DEMO_MODE") == "1":
        logger.info("demo mode active, returning mock analysis")
        os.unlink(tmp_path)
        return AnalyzeResponse(
            intent_label="play or excitement",
            intent_confidence=0.87,
            intent_probs={
                "play or excitement": 0.87,
                "hunger or food request": 0.06,
                "contentment or relaxation": 0.04,
                "attention seeking": 0.02,
                "other": 0.01,
            },
            fused_embedding_shape=[768],
            audio_features=AudioFeatures(
                duration_seconds=3.5,
                mel_shape=[80, 87],
                centroid_shape=[87],
            ),
            naturelm_raw_output="Pet is playful and energetic",
            naturelm_intent="play or excitement",
            rvc_enhancement_applied=False,
        )

    try:
        # Step 1: Preprocessing (denoise + RVC v3 enhancement + features)
        logger.info("running preprocessing", filename=filename)
        features, clean_audio, rvc_applied = run_pipeline(tmp_path)
        logger.info("preprocessing complete", rvc_applied=rvc_applied)

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
