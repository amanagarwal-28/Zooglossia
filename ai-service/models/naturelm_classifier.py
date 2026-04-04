import os
import tempfile
from pathlib import Path

import numpy as np
import soundfile as sf
import torch
from dotenv import load_dotenv
from huggingface_hub import login
from NatureLM.infer import Pipeline
from NatureLM.models import NatureLM

load_dotenv()

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
MODEL_ID = "EarthSpeciesProject/NatureLM-audio"
DEFAULT_CFG_PATH = Path(__file__).with_name("inference.yml")

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


def _load_model() -> None:
    global _model, _pipeline
    if _model is not None:
        return

    token = os.getenv("HF_TOKEN")
    if token:
        login(token=token)

    _model = NatureLM.from_pretrained(MODEL_ID)
    _model = _model.eval().to(DEVICE)

    if not DEFAULT_CFG_PATH.exists():
        raise FileNotFoundError(f"NatureLM config not found: {DEFAULT_CFG_PATH}")

    _pipeline = Pipeline(model=_model, cfg_path=str(DEFAULT_CFG_PATH))


def _get_audio_embedding(audio_path: str) -> np.ndarray:
    _load_model()
    audio_np, sr = sf.read(audio_path)
    if audio_np.ndim > 1:
        audio_np = np.mean(audio_np, axis=1)

    # run_on_clean_audio writes at 16kHz; keep this strict to avoid unexpected embeddings
    if sr != 16000:
        raise ValueError(f"Expected 16kHz audio, got {sr}Hz")

    raw_wav = torch.from_numpy(audio_np).float().unsqueeze(0).to(_model.device)
    padding_mask = torch.zeros_like(raw_wav, dtype=torch.bool).to(_model.device)

    with torch.no_grad():
        audio_embeds, _ = _model.encode_audio(raw_wav, audio_padding_mask=padding_mask)

    # pool time axis to a stable fixed-length vector for downstream fusion
    embedding = audio_embeds.mean(dim=1).squeeze(0)
    return embedding.float().cpu().numpy()


def classify_intent(audio_path: str):
    _load_model()

    # CPU generation with Llama-3.1 can be extremely slow; allow fast-path for development.
    if os.getenv("NATURELM_FAST_MODE", "0") == "1":
        embedding = _get_audio_embedding(audio_path)
        return {
            "intent_label": "unknown (fast mode)",
            "raw_model_output": "generation_skipped_fast_mode",
            "intent_embedding": embedding,
            "embedding_shape": embedding.shape,
        }

    options_str = ", ".join(PET_INTENTS)
    query = (
        "Which of the following best describes the vocalization intent? "
        f"{options_str}. Reply with exactly one option from the list and nothing else."
    )

    results = _pipeline(
        [audio_path],
        [query],
        window_length_seconds=10.0,
        hop_length_seconds=10.0,
    )

    raw_output = results[0].strip().lower() if results else "unknown"
    matched = next((intent for intent in PET_INTENTS if intent in raw_output), raw_output)

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
