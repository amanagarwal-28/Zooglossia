"""
RVC v3 voice enhancement for pet vocalization preprocessing.

Usage
-----
from voice.rvc_enhancer import enhance_vocalization

clean_audio, applied = enhance_vocalization(audio_np, sample_rate=16000)
# applied == True  → RVC model was loaded and ran
# applied == False → model unavailable, clean_audio == original audio_np

Model checkpoint
----------------
Place a pre-trained RVC v3 generator checkpoint at the path specified by
the environment variable RVC_MODEL_PATH (default: voice/checkpoints/rvcv3.pth).

The checkpoint must be a TorchScript-traced or state-dict file whose model
accepts (source: Tensor[1, T]) and returns (converted: Tensor[1, T]).

If the checkpoint file does not exist the enhancer silently skips and returns
the original audio unchanged so the rest of the pipeline is unaffected.
"""

import logging
import os
from typing import Optional, Tuple

import numpy as np
import torch

logger = logging.getLogger("zooglossia.rvc")

DEFAULT_CHECKPOINT = os.path.join(
    os.path.dirname(__file__), "checkpoints", "rvcv3.pth"
)

_rvc_model: Optional[torch.nn.Module] = None
_rvc_loaded: bool = False          # True once we've attempted a load
_rvc_available: bool = False       # True only if load succeeded


def _try_load_model() -> bool:
    """Attempt to load the RVC model once; cache the result."""
    global _rvc_model, _rvc_loaded, _rvc_available

    if _rvc_loaded:
        return _rvc_available

    _rvc_loaded = True
    checkpoint_path = os.environ.get("RVC_MODEL_PATH", DEFAULT_CHECKPOINT)

    if not os.path.exists(checkpoint_path):
        logger.info(
            "RVC v3 checkpoint not found at '%s'. "
            "Enhancement will be skipped. "
            "Set RVC_MODEL_PATH env var or place the checkpoint at the default path.",
            checkpoint_path,
        )
        return False

    try:
        logger.info("Loading RVC v3 checkpoint from '%s'…", checkpoint_path)
        device = "cuda" if torch.cuda.is_available() else "cpu"
        checkpoint = torch.load(checkpoint_path, map_location=device, weights_only=False)

        if isinstance(checkpoint, torch.nn.Module):
            # TorchScript or already-instantiated model
            _rvc_model = checkpoint.eval().to(device)
        elif isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            # State-dict bundle — caller must supply architecture
            # We skip state-dict-only checkpoints unless a model class is registered.
            logger.warning(
                "RVC checkpoint is a state-dict bundle. "
                "Automatic loading not supported without matching architecture. "
                "Skipping."
            )
            return False
        else:
            logger.warning(
                "Unrecognised RVC checkpoint format. Skipping."
            )
            return False

        _rvc_available = True
        logger.info("RVC v3 model loaded on %s.", device)
        return True

    except Exception as exc:
        logger.warning("Failed to load RVC v3 checkpoint: %s. Skipping.", exc)
        return False


def _run_model(audio: np.ndarray, sample_rate: int) -> np.ndarray:
    """Run the loaded RVC model on a 1-D float32 audio array."""
    device = next(_rvc_model.parameters()).device  # type: ignore[union-attr]

    tensor = torch.from_numpy(audio.astype(np.float32)).unsqueeze(0).to(device)

    with torch.no_grad():
        output = _rvc_model(tensor)  # type: ignore[misc]

    if isinstance(output, tuple):
        output = output[0]

    return output.squeeze().cpu().numpy().astype(np.float32)


def enhance_vocalization(
    audio: np.ndarray,
    sample_rate: int = 16000,
) -> Tuple[np.ndarray, bool]:
    """
    Apply RVC v3 voice enhancement to a mono float32 audio array.

    Parameters
    ----------
    audio : np.ndarray  shape (T,) float32
    sample_rate : int   expected sample rate (informational, model handles internally)

    Returns
    -------
    enhanced : np.ndarray  — enhanced audio, or original if model unavailable
    applied  : bool        — True if RVC ran, False otherwise
    """
    if not _try_load_model():
        return audio, False

    try:
        enhanced = _run_model(audio, sample_rate)
        # Safety: preserve length by trimming/padding to original length
        T = len(audio)
        if len(enhanced) > T:
            enhanced = enhanced[:T]
        elif len(enhanced) < T:
            pad = np.zeros(T - len(enhanced), dtype=np.float32)
            enhanced = np.concatenate([enhanced, pad])
        logger.info("RVC v3 enhancement applied (T=%d samples).", T)
        return enhanced, True
    except Exception as exc:
        logger.warning("RVC v3 inference failed: %s. Using original audio.", exc)
        return audio, False
