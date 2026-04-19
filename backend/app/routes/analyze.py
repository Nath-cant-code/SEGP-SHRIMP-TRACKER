from typing import Annotated
from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AnalysisJob, VideoResult
from app.schemas.response_schemas import AnalyzeResponse

router = APIRouter(tags=["analyze"])

MODEL_PATHS = {
    "best": "models/best.pt",
    "yolov8n": "models/yolov8n.pt",
    "custom_v2": "models/other_model.pt",
}

UPLOAD_DIR = Path("uploads")
EXPORT_DIR = Path("exports")
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov"}


def generate_dummy_timeseries(video_index: int, points: int = 20) -> list[dict]:
    timeseries = []
    for i in range(points):
        frame = i + 1
        time_sec = round(i * 0.5, 2)
        avg_velocity = round(2.0 + (video_index * 0.4) + (i * 0.08), 2)
        clustering_percent = round(55.0 + (video_index * 2.5) + ((i % 5) * 1.3), 2)

        timeseries.append(
            {
                "frame": frame,
                "time_sec": time_sec,
                "avg_velocity": avg_velocity,
                "clustering_percent": clustering_percent,
            }
        )
    return timeseries


def build_summary(timeseries: list[dict]) -> dict:
    avg_velocity = round(sum(x["avg_velocity"] for x in timeseries) / len(timeseries), 2)
    max_velocity = round(max(x["avg_velocity"] for x in timeseries), 2)
    avg_clustering_percent = round(sum(x["clustering_percent"] for x in timeseries) / len(timeseries), 2)

    return {
        "avg_velocity": avg_velocity,
        "max_velocity": max_velocity,
        "avg_clustering_percent": avg_clustering_percent,
        "frames_processed": len(timeseries),
        "shrimp_count_estimate": 40,
    }


@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_videos(
    model_id: Annotated[str, Form(...)],
    videos: Annotated[list[UploadFile], File(...)],
    db: Session = Depends(get_db),
):
    if model_id not in MODEL_PATHS:
        raise HTTPException(status_code=400, detail="Invalid model_id")

    if not (1 <= len(videos) <= 3):
        raise HTTPException(status_code=400, detail="Only 1 to 3 videos are allowed")

    for video in videos:
        suffix = Path(video.filename).suffix.lower() if video.filename else ""
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(status_code=400, detail=f"Unsupported file type: {video.filename}")

    job_id = f"analysis_{uuid4().hex[:8]}"

    db_job = AnalysisJob(job_id=job_id, selected_model=model_id)
    db.add(db_job)
    db.commit()

    response_videos = []

    for index, upload in enumerate(videos, start=1):
        video_id = f"video_{index}"

        unique_name = f"{uuid4().hex}_{upload.filename}"
        save_path = UPLOAD_DIR / unique_name

        with open(save_path, "wb") as f:
            f.write(upload.file.read())

        timeseries = generate_dummy_timeseries(index)
        summary = build_summary(timeseries)

        csv_path = EXPORT_DIR / f"{job_id}_{video_id}.csv"
        with open(csv_path, "w", encoding="utf-8") as f:
            f.write("frame,time_sec,avg_velocity,clustering_percent\n")
            for row in timeseries:
                f.write(
                    f"{row['frame']},{row['time_sec']},{row['avg_velocity']},{row['clustering_percent']}\n"
                )

        db_result = VideoResult(
            job_id=job_id,
            video_id=video_id,
            video_name=upload.filename,
            avg_velocity=summary["avg_velocity"],
            max_velocity=summary["max_velocity"],
            avg_clustering_percent=summary["avg_clustering_percent"],
            frames_processed=summary["frames_processed"],
            shrimp_count_estimate=summary["shrimp_count_estimate"],
            csv_path=str(csv_path),
        )
        db.add(db_result)
        db.commit()

        response_videos.append(
            {
                "video_id": video_id,
                "video_name": upload.filename,
                "summary": summary,
                "timeseries": timeseries,
                "csv_download_url": f"/results/{job_id}/{video_id}/csv",
            }
        )

    return {
        "job_id": job_id,
        "selected_model": model_id,
        "videos": response_videos,
    }