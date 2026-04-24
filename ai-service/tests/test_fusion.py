import numpy as np
import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.fusion_transformer import FusionTransformer, IoTContext, AUDIO_DIM, INTENT_LABELS

MOCK_IOT = {
    "time_of_day": 18.5,
    "last_meal_hours_ago": 5.0,
    "motion_level": "high",
    "room_temp_c": 22.0,
    "activity_level": "active",
}


@pytest.fixture(scope="module")
def model():
    return FusionTransformer()


def test_model_has_parameters(model):
    param_count = sum(p.numel() for p in model.parameters())
    assert param_count > 0, "FusionTransformer should have trainable parameters"


def test_iot_context_from_dict():
    iot = IoTContext.from_dict(MOCK_IOT)
    assert iot is not None


def test_predict_returns_expected_keys(model):
    embedding = np.random.randn(AUDIO_DIM).astype(np.float32)
    iot = IoTContext.from_dict(MOCK_IOT)
    result = model.predict(embedding, iot)

    assert "intent_label" in result
    assert "intent_confidence" in result
    assert "intent_probs" in result
    assert "fused_embedding_shape" in result


def test_predict_intent_label_is_valid(model):
    embedding = np.random.randn(AUDIO_DIM).astype(np.float32)
    iot = IoTContext.from_dict(MOCK_IOT)
    result = model.predict(embedding, iot)

    assert result["intent_label"] in INTENT_LABELS


def test_predict_confidence_in_range(model):
    embedding = np.random.randn(AUDIO_DIM).astype(np.float32)
    iot = IoTContext.from_dict(MOCK_IOT)
    result = model.predict(embedding, iot)

    assert 0.0 <= result["intent_confidence"] <= 1.0


def test_predict_probs_sum_to_one(model):
    embedding = np.random.randn(AUDIO_DIM).astype(np.float32)
    iot = IoTContext.from_dict(MOCK_IOT)
    result = model.predict(embedding, iot)

    total = sum(result["intent_probs"].values())
    assert abs(total - 1.0) < 1e-4, f"Probabilities should sum to 1.0, got {total}"
