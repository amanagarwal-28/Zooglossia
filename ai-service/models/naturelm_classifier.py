import os
import torch
import numpy as np
import soundfile as sf
import tempfile
from dotenv import load_dotenv
from huggingface_hub import login
from NatureLM.models import NatureLM
from NatureLM.infer import Pipeline

load_dotenv()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_ID = "EarthSpeciesProject/NatureLM-audio"

PET_INTENTS = [
    "hunger or food request",
    "play or excitement",
    "fear or anxiety",
    "pain or discomfort",
    "attention seeking",
    "greeting or affection",
    "territorial or aggression",
    "contentment or relaxation",
]

_model = None
_pipeline = None


def _load_model():
    global _model, _pipeline
    if _model is not None:
        return

    token = os.getenv("HF_TOKEN")
    if token:
        login(token=token)

    _model = NatureLM.from_pretrained(MODEL_ID)
    _model = _model.eval().to(DEVICE)
    _pipeline = Pipeline(model=_model)


def _get_audio_embedding(audio_path: str):
    _load_model()
    # pull the BEATs encoder output as our intent embedding vector
    with torch.no_grad():
        emb = _model.encode_audio(audio_path)
    return emb.squeeze().cpu().numpy()


def classify_intent(audio_path: str):
    _load_model()

    options_str = ", ".join(PET_INTENTS)
    query = (
        f"Which of the following best describes the vocalization intent? "
        f"{options_str}. Answer with the single best match."
    )

    results = _pipeline(
        [audio_path],
        [query],
        window_length_seconds=10.0,
        hop_length_seconds=10.0,
    )

    raw_output = results[0].strip().lower() if results else "unknown"

    matched = next((i for i in PET_INTENTS if i in raw_output), raw_output)

    embedding = _get_audio_embedding(audio_path)

    return {
        "intent_label": matched,
        "raw_model_output": raw_output,
        "intent_embedding": embedding,
        "embedding_shape": embedding.shape,
    }


def run_on_clean_audio(audio_np: np.ndarray, sr: int = 16000):
    tmp = tempfile.NamedTemporaryFile(suffix=".wav", delete=False)
    try:
        sf.write(tmp.name, audio_np, sr)
        tmp.close()
        return classify_intent(tmp.name)
    finally:
        os.unlink(tmp.name)
