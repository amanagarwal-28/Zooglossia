import os
import sys
import numpy as np
import torch

sys.path.append(os.path.dirname(__file__))

from models.fusion_transformer import FusionTransformer, IoTContext, AUDIO_DIM, INTENT_LABELS

# Mock IoT snapshot — no hardware needed
MOCK_IOT = {
    "time_of_day": 18.5,
    "last_meal_hours_ago": 5.0,
    "motion_level": "high",
    "room_temp_c": 22.0,
    "activity_level": "active",
}

if __name__ == "__main__":
    print("Building FusionTransformer...")
    model = FusionTransformer()
    param_count = sum(p.numel() for p in model.parameters())
    print(f"Parameters: {param_count:,}")

    # Simulate a 4096-dim NatureLM embedding
    mock_embedding = np.random.randn(AUDIO_DIM).astype(np.float32)
    iot = IoTContext.from_dict(MOCK_IOT)

    print(f"\nIoT context: {iot}")
    print(f"Audio embedding: shape={mock_embedding.shape}, mean={mock_embedding.mean():.4f}")

    print("\nRunning fusion inference...")
    result = model.predict(mock_embedding, iot)

    print(f"\nTop intent:   {result['intent_label']}")
    print(f"Confidence:   {result['intent_confidence']:.4f}")
    print(f"Fused embed:  shape={result['fused_embedding_shape']}")

    print("\nAll intent probabilities:")
    for label, prob in result["intent_probs"].items():
        bar = "█" * int(prob * 40)
        print(f"  {label:<35} {prob:.4f}  {bar}")

    print("\nFusion OK")
