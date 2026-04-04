import numpy as np
import torch
import torch.nn as nn
import torch.nn.functional as F
from dataclasses import dataclass
from typing import Optional

# --------------------------------------------------------------------------- #
# Dimensions                                                                   #
# --------------------------------------------------------------------------- #
AUDIO_DIM = 4096       # NatureLM BEATs encoder output (pooled)
IOT_INPUT_DIM = 5      # must match IoTContext.to_tensor() length
FUSION_DIM = 256       # internal projected dimension
NUM_ATTN_HEADS = 4
NUM_INTENTS = 8

INTENT_LABELS = [
    "hunger or food request",
    "play or excitement",
    "fear or anxiety",
    "pain or discomfort",
    "attention seeking",
    "greeting or affection",
    "territorial or aggression",
    "contentment or relaxation",
]

# --------------------------------------------------------------------------- #
# IoT context                                                                  #
# --------------------------------------------------------------------------- #
_MOTION_LEVELS = {"low": 0, "medium": 1, "high": 2}
_ACTIVITY_LEVELS = {"sleeping": 0, "resting": 1, "active": 2, "excited": 3}


@dataclass
class IoTContext:
    """Mockable IoT sensor snapshot.  All fields have safe defaults."""
    time_of_day: float = 12.0        # 0–24 hour
    last_meal_hours_ago: float = 4.0 # hours since last feed
    motion_level: str = "medium"     # low / medium / high
    room_temp_c: float = 22.0        # Celsius
    activity_level: str = "resting"  # sleeping / resting / active / excited

    @classmethod
    def from_dict(cls, d: dict) -> "IoTContext":
        return cls(
            time_of_day=float(d.get("time_of_day", 12.0)),
            last_meal_hours_ago=float(d.get("last_meal_hours_ago", 4.0)),
            motion_level=str(d.get("motion_level", "medium")).lower(),
            room_temp_c=float(d.get("room_temp_c", 22.0)),
            activity_level=str(d.get("activity_level", "resting")).lower(),
        )

    def to_tensor(self, device: torch.device) -> torch.Tensor:
        """Encode all fields as a normalised 5-dim float tensor."""
        motion_idx = _MOTION_LEVELS.get(self.motion_level, 1)
        activity_idx = _ACTIVITY_LEVELS.get(self.activity_level, 1)
        return torch.tensor(
            [
                self.time_of_day / 24.0,
                self.last_meal_hours_ago / 24.0,
                motion_idx / 2.0,
                (self.room_temp_c - 20.0) / 15.0,
                activity_idx / 3.0,
            ],
            dtype=torch.float32,
            device=device,
        )


# --------------------------------------------------------------------------- #
# Sub-modules                                                                  #
# --------------------------------------------------------------------------- #
class _AudioProjection(nn.Module):
    def __init__(self, in_dim: int = AUDIO_DIM, out_dim: int = FUSION_DIM):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 512),
            nn.ReLU(),
            nn.Linear(512, out_dim),
            nn.LayerNorm(out_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class _IoTProjection(nn.Module):
    def __init__(self, in_dim: int = IOT_INPUT_DIM, out_dim: int = FUSION_DIM):
        super().__init__()
        self.net = nn.Sequential(
            nn.Linear(in_dim, 64),
            nn.ReLU(),
            nn.Linear(64, out_dim),
            nn.LayerNorm(out_dim),
        )

    def forward(self, x: torch.Tensor) -> torch.Tensor:
        return self.net(x)


class _CrossModalAttention(nn.Module):
    """Audio queries attend to IoT keys/values; residual + feed-forward."""

    def __init__(self, dim: int = FUSION_DIM, num_heads: int = NUM_ATTN_HEADS):
        super().__init__()
        self.attn = nn.MultiheadAttention(dim, num_heads, batch_first=True)
        self.norm1 = nn.LayerNorm(dim)
        self.norm2 = nn.LayerNorm(dim)
        self.ff = nn.Sequential(
            nn.Linear(dim, dim * 4),
            nn.GELU(),
            nn.Linear(dim * 4, dim),
        )

    def forward(self, audio: torch.Tensor, iot: torch.Tensor) -> torch.Tensor:
        # audio: (B, 1, D)   iot: (B, 1, D)
        attended, _ = self.attn(audio, iot, iot)
        x = self.norm1(audio + attended)
        x = self.norm2(x + self.ff(x))
        return x  # (B, 1, D)


# --------------------------------------------------------------------------- #
# Main model                                                                   #
# --------------------------------------------------------------------------- #
class FusionTransformer(nn.Module):
    """Cross-modal fusion of NatureLM audio embedding + IoT context.

    Forward pass:
        audio_embedding  (B, AUDIO_DIM)   – BEATs output from NatureLM
        iot_tensor       (B, IOT_INPUT_DIM) – normalised IoT features

    Returns dict with:
        fused_embedding  (B, FUSION_DIM)
        intent_logits    (B, NUM_INTENTS)
        intent_probs     (B, NUM_INTENTS)
    """

    def __init__(
        self,
        audio_dim: int = AUDIO_DIM,
        iot_input_dim: int = IOT_INPUT_DIM,
        fusion_dim: int = FUSION_DIM,
        num_intents: int = NUM_INTENTS,
        num_heads: int = NUM_ATTN_HEADS,
    ):
        super().__init__()
        self.audio_proj = _AudioProjection(audio_dim, fusion_dim)
        self.iot_proj = _IoTProjection(iot_input_dim, fusion_dim)
        self.fusion = _CrossModalAttention(fusion_dim, num_heads)
        self.classifier = nn.Linear(fusion_dim, num_intents)

    def forward(
        self,
        audio_embedding: torch.Tensor,
        iot_tensor: torch.Tensor,
    ) -> dict:
        audio_feat = self.audio_proj(audio_embedding).unsqueeze(1)  # (B, 1, D)
        iot_feat = self.iot_proj(iot_tensor).unsqueeze(1)            # (B, 1, D)

        fused = self.fusion(audio_feat, iot_feat)  # (B, 1, D)
        fused_vec = fused.squeeze(1)               # (B, D)

        logits = self.classifier(fused_vec)        # (B, num_intents)
        probs = F.softmax(logits, dim=-1)

        return {
            "fused_embedding": fused_vec,
            "intent_logits": logits,
            "intent_probs": probs,
        }

    def predict(
        self,
        audio_embedding: np.ndarray,
        iot_context: IoTContext,
        device: Optional[torch.device] = None,
    ) -> dict:
        """Accepts numpy embedding + IoTContext; returns plain-Python results."""
        if device is None:
            device = next(self.parameters()).device

        audio_t = torch.from_numpy(audio_embedding).float().unsqueeze(0).to(device)
        iot_t = iot_context.to_tensor(device).unsqueeze(0)

        self.eval()
        with torch.no_grad():
            out = self.forward(audio_t, iot_t)

        probs_np = out["intent_probs"].squeeze(0).cpu().numpy()
        fused_np = out["fused_embedding"].squeeze(0).cpu().numpy()
        top_idx = int(probs_np.argmax())

        return {
            "intent_label": INTENT_LABELS[top_idx],
            "intent_confidence": float(probs_np[top_idx]),
            "intent_probs": {
                label: float(p) for label, p in zip(INTENT_LABELS, probs_np)
            },
            "fused_embedding": fused_np,
            "fused_embedding_shape": fused_np.shape,
        }
