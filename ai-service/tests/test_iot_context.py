import pytest
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))

from models.fusion_transformer import IoTContext

VALID_IOT = {
    "time_of_day": 12.0,
    "last_meal_hours_ago": 4.0,
    "motion_level": "medium",
    "room_temp_c": 22.0,
    "activity_level": "resting",
}


def test_iot_context_from_dict_valid():
    iot = IoTContext.from_dict(VALID_IOT)
    assert iot is not None


def test_iot_context_motion_levels():
    for level in ("low", "medium", "high"):
        ctx = IoTContext.from_dict({**VALID_IOT, "motion_level": level})
        assert ctx is not None


def test_iot_context_activity_levels():
    for level in ("sleeping", "resting", "active", "excited"):
        ctx = IoTContext.from_dict({**VALID_IOT, "activity_level": level})
        assert ctx is not None


def test_iot_context_boundary_time():
    ctx_midnight = IoTContext.from_dict({**VALID_IOT, "time_of_day": 0.0})
    ctx_night = IoTContext.from_dict({**VALID_IOT, "time_of_day": 23.99})
    assert ctx_midnight is not None
    assert ctx_night is not None
