from fastapi import APIRouter

router = APIRouter(tags=["models"])

AVAILABLE_MODELS = [
    {"id": "best", "label": "Best Trained Model"},
    {"id": "yolov8n", "label": "YOLOv8 Nano"},
    {"id": "custom_v2", "label": "Custom Model V2"},
]


@router.get("/models")
def get_models():
    return {"models": AVAILABLE_MODELS}