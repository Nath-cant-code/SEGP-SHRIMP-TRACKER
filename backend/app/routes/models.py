from pathlib import Path

from fastapi import APIRouter

router = APIRouter(tags=["models"])

BACKEND_DIR = Path(__file__).resolve().parents[2]
MODEL_DIR = BACKEND_DIR / "models"
MODEL_CANDIDATES = {
    "best": {
        "label": "Best Trained Model",
        "path": MODEL_DIR / "best.pt",
    },
    "yolov8n": {
        "label": "YOLOv8 Nano",
        "path": MODEL_DIR / "yolov8n.pt",
    },
    "custom_v2": {
        "label": "Custom Model V2",
        "path": MODEL_DIR / "other_model.pt",
    },
}


def get_model_paths() -> dict[str, Path]:
    return {
        model_id: config["path"]
        for model_id, config in MODEL_CANDIDATES.items()
    }


def get_available_models() -> list[dict[str, str]]:
    return [
        {"id": model_id, "label": config["label"]}
        for model_id, config in MODEL_CANDIDATES.items()
        if config["path"].exists()
    ]


@router.get("/models")
def get_models():
    return {"models": get_available_models()}
