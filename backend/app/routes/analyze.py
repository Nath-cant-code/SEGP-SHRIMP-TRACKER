"""
backend/app/routes/analyze.py

POST /analyze  — accepts 1-3 video uploads, runs the real shrimp_ai
analysis pipeline (velocity + clustering), saves results to SQLite,
and returns the standard JSON contract.

BUG FIX (2026-04-21)
---------------------
ultralytics model.predict() saves label .txt files to:
    {project}/{name}/labels/*.txt

Previously we set:
    project = label_dir.parent   (…/video_1/)
    name     = label_dir.name    (labels)
→ ultralytics wrote to  …/video_1/labels/labels/*.txt   (double-nested)
→ _real_analysis() looked in  …/video_1/labels/   and found nothing
→ fell back to dummy data every time.

Fix: use job_dir (…/analysis_xxx/video_1/) as the project root and
"labels" as the name.  ultralytics then writes to:
    job_dir/labels/labels/*.txt
… wait, that still nests.  The real solution: set project=job_dir.parent
and name=video_id so output lands at job_dir/predict/  — but that is
confusing.  Simplest approach that actually works:

  project = UPLOAD_DIR / job_id          (e.g. uploads/analysis_xxx/)
  name    = f"{video_id}_labels"         (e.g. video_1_labels)

ultralytics writes labels to:
    UPLOAD_DIR/job_id/video_1_labels/labels/*.txt

We then point label_dir at that exact path.
"""

from __future__ import annotations

import os
import sys
import traceback
from pathlib import Path
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AnalysisJob, VideoResult
from app.schemas.response_schemas import AnalyzeResponse

router = APIRouter(tags=["analyze"])

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
BACKEND_DIR = Path(__file__).resolve().parents[2]          # …/backend/
PROJECT_ROOT = BACKEND_DIR.parent                           # …/SEGP-SHRIMP-TRACKER/
SHRIMP_AI_DIR = PROJECT_ROOT / "shrimp_ai"

UPLOAD_DIR = BACKEND_DIR / "uploads"
EXPORT_DIR = BACKEND_DIR / "exports"
ALLOWED_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv"}

# Make sure the shrimp_ai package is importable
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# ---------------------------------------------------------------------------
# YOLO model registry
# ---------------------------------------------------------------------------
MODEL_PATHS: dict[str, Path] = {
    "best":      BACKEND_DIR / "models" / "best.pt",
    "yolov8n":   BACKEND_DIR / "models" / "yolov8n.pt",
    "custom_v2": BACKEND_DIR / "models" / "other_model.pt",
}


# ---------------------------------------------------------------------------
# Real analysis helpers
# ---------------------------------------------------------------------------

def _run_yolo_inference(video_path: Path, model_path: Path, job_dir: Path, video_id: str) -> Path | None:
    """
    Run YOLO detect on *video_path*.

    Returns the Path to the folder that contains the *.txt label files,
    or None on failure.

    ultralytics writes label files to:
        {project}/{name}/labels/*.txt

    We set:
        project = job_dir          (e.g. uploads/analysis_xxx/)
        name    = f"{video_id}_pred"   (e.g. video_1_pred)

    So label files end up at:
        uploads/analysis_xxx/video_1_pred/labels/*.txt
    """
    try:
        from ultralytics import YOLO  # type: ignore
    except ImportError:
        return None

    if not model_path.exists():
        return None

    predict_name = f"{video_id}_pred"
    expected_label_dir = job_dir / predict_name / "labels"

    try:
        job_dir.mkdir(parents=True, exist_ok=True)
        model = YOLO(str(model_path))
        model.predict(
            source=str(video_path),
            save=False,
            save_txt=True,
            project=str(job_dir),
            name=predict_name,
            exist_ok=True,
            verbose=False,
            conf=0.25,
        )
        # Verify labels actually appeared
        if expected_label_dir.exists() and any(expected_label_dir.glob("*.txt")):
            return expected_label_dir
        return None
    except Exception:
        traceback.print_exc()
        return None


def _real_analysis(video_path: Path, label_dir: Path) -> dict | None:
    """
    Call the real shrimp_ai analysis functions.
    Returns a dict with keys: timeseries, summary, or None on failure.
    """
    try:
        from shrimp_ai.analysis.analysis import (  # type: ignore
            analyze_shrimp_velocity,
            analyze_saved_yolo_labels,
        )
    except ImportError:
        return None

    if not label_dir.exists() or not any(label_dir.glob("*.txt")):
        return None

    try:
        vel_summary = analyze_shrimp_velocity(
            video_path=video_path,
            label_folder=label_dir,
            confidence_threshold=0.0,
            max_match_distance_ratio=0.10,
        )
        clust_summary = analyze_saved_yolo_labels(
            video_path=video_path,
            label_folder=label_dir,
            confidence_threshold=0.0,
            min_shrimp=2,
        )
    except Exception:
        traceback.print_exc()
        return None

    # Merge the two frame-level result lists by frame_index
    vel_by_frame: dict[int, dict] = {
        r["frame_index"]: r for r in vel_summary["frame_results"]
    }
    clust_by_frame: dict[int, dict] = {
        r["frame_index"]: r for r in clust_summary["frame_results"]
    }

    all_frame_indices = sorted(
        set(vel_by_frame.keys()) | set(clust_by_frame.keys())
    )

    fps = vel_summary["fps"] or 30.0
    timeseries: list[dict] = []
    for fi in all_frame_indices:
        v = vel_by_frame.get(fi, {})
        c = clust_by_frame.get(fi, {})
        timeseries.append({
            "frame": fi + 1,
            "time_sec": round(fi / fps, 4),
            "avg_velocity": round(v.get("average_velocity_px_per_sec") or 0.0, 4),
            "clustering_percent": round(c.get("clustering_percentage") or 0.0, 4),
        })

    # Build summary
    velocities  = [t["avg_velocity"]       for t in timeseries if t["avg_velocity"] > 0]
    clusterings = [t["clustering_percent"] for t in timeseries if t["clustering_percent"] > 0]
    shrimp_counts = [
        clust_by_frame[fi]["shrimp_count"]
        for fi in all_frame_indices
        if fi in clust_by_frame
    ]

    avg_vel   = round(sum(velocities)  / len(velocities),  2) if velocities  else 0.0
    max_vel   = round(max(velocities),                      2) if velocities  else 0.0
    avg_clust = round(sum(clusterings) / len(clusterings),  2) if clusterings else 0.0
    frames_processed = len(timeseries)
    shrimp_est = round(sum(shrimp_counts) / len(shrimp_counts)) if shrimp_counts else 0

    return {
        "timeseries": timeseries,
        "summary": {
            "avg_velocity":            avg_vel,
            "max_velocity":            max_vel,
            "avg_clustering_percent":  avg_clust,
            "frames_processed":        frames_processed,
            "shrimp_count_estimate":   shrimp_est,
        },
    }


# ---------------------------------------------------------------------------
# Fallback dummy generator
# ---------------------------------------------------------------------------

def _dummy_timeseries(video_index: int, points: int = 20) -> list[dict]:
    ts = []
    for i in range(points):
        ts.append({
            "frame": i + 1,
            "time_sec": round(i * 0.5, 2),
            "avg_velocity": round(2.0 + video_index * 0.4 + i * 0.08, 2),
            "clustering_percent": round(55.0 + video_index * 2.5 + (i % 5) * 1.3, 2),
        })
    return ts


def _build_summary(timeseries: list[dict]) -> dict:
    vels  = [x["avg_velocity"]       for x in timeseries]
    clust = [x["clustering_percent"] for x in timeseries]
    return {
        "avg_velocity":           round(sum(vels)  / len(vels),  2),
        "max_velocity":           round(max(vels),               2),
        "avg_clustering_percent": round(sum(clust) / len(clust), 2),
        "frames_processed":       len(timeseries),
        "shrimp_count_estimate":  40,
    }


# ---------------------------------------------------------------------------
# Route
# ---------------------------------------------------------------------------

@router.post("/analyze", response_model=AnalyzeResponse)
def analyze_videos(
    model_id: Annotated[str, Form(...)],
    videos:   Annotated[list[UploadFile], File(...)],
    db: Session = Depends(get_db),
):
    # ── Validate model ──────────────────────────────────────────────────────
    if model_id not in MODEL_PATHS:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid model_id '{model_id}'. Choose from: {list(MODEL_PATHS.keys())}",
        )

    # ── Validate video count ────────────────────────────────────────────────
    if not (1 <= len(videos) <= 3):
        raise HTTPException(status_code=400, detail="Please upload between 1 and 3 videos.")

    # ── Validate extensions ─────────────────────────────────────────────────
    for video in videos:
        suffix = Path(video.filename or "").suffix.lower()
        if suffix not in ALLOWED_EXTENSIONS:
            raise HTTPException(
                status_code=400,
                detail=f"Unsupported file type '{suffix}' for '{video.filename}'. "
                       f"Allowed: {ALLOWED_EXTENSIONS}",
            )

    # ── Create job ──────────────────────────────────────────────────────────
    job_id = f"analysis_{uuid4().hex[:8]}"
    db_job = AnalysisJob(job_id=job_id, selected_model=model_id)
    db.add(db_job)
    db.commit()

    model_path = MODEL_PATHS[model_id]
    # job_dir is the per-job folder under uploads/
    job_dir = UPLOAD_DIR / job_id
    response_videos: list[dict] = []

    for index, upload in enumerate(videos, start=1):
        video_id = f"video_{index}"

        # ── 1. Persist the uploaded video ───────────────────────────────────
        UPLOAD_DIR.mkdir(parents=True, exist_ok=True)
        unique_name = f"{uuid4().hex[:8]}_{upload.filename}"
        video_path  = UPLOAD_DIR / unique_name
        raw_bytes   = upload.file.read()
        video_path.write_bytes(raw_bytes)

        # ── 2. Run YOLO inference ────────────────────────────────────────────
        # _run_yolo_inference returns the path to the labels/ folder
        # (job_dir / f"{video_id}_pred" / "labels") or None.
        used_dummy  = False
        label_dir   = _run_yolo_inference(video_path, model_path, job_dir, video_id)
        real_result = _real_analysis(video_path, label_dir) if label_dir else None

        if real_result:
            timeseries = real_result["timeseries"]
            summary    = real_result["summary"]
        else:
            used_dummy = True
            timeseries = _dummy_timeseries(index)
            summary    = _build_summary(timeseries)

        # ── 3. Write CSV export ──────────────────────────────────────────────
        EXPORT_DIR.mkdir(parents=True, exist_ok=True)
        csv_path = EXPORT_DIR / f"{job_id}_{video_id}.csv"
        with csv_path.open("w", encoding="utf-8") as f:
            f.write("frame,time_sec,avg_velocity,clustering_percent\n")
            for row in timeseries:
                f.write(
                    f"{row['frame']},{row['time_sec']},"
                    f"{row['avg_velocity']},{row['clustering_percent']}\n"
                )

        # ── 4. Persist VideoResult row ───────────────────────────────────────
        db_result = VideoResult(
            job_id                  = job_id,
            video_id                = video_id,
            video_name              = upload.filename,
            avg_velocity            = summary["avg_velocity"],
            max_velocity            = summary["max_velocity"],
            avg_clustering_percent  = summary["avg_clustering_percent"],
            frames_processed        = summary["frames_processed"],
            shrimp_count_estimate   = summary["shrimp_count_estimate"],
            csv_path                = str(csv_path),
        )
        db.add(db_result)
        db.commit()

        response_videos.append({
            "video_id":         video_id,
            "video_name":       upload.filename,
            "summary":          summary,
            "timeseries":       timeseries,
            "csv_download_url": f"/results/{job_id}/{video_id}/csv",
            "_used_dummy_data": used_dummy,
        })

    return {
        "job_id":         job_id,
        "selected_model": model_id,
        "videos":         response_videos,
    }