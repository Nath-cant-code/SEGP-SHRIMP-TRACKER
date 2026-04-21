from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AnalysisJob, VideoResult
from app.schemas.response_schemas import ResultsListResponse, JobDetailResponse

router = APIRouter(tags=["results"])


@router.get("/results", response_model=ResultsListResponse)
def get_results(db: Session = Depends(get_db)):
    stmt = (
        select(
            AnalysisJob.job_id,
            AnalysisJob.created_at,
            AnalysisJob.selected_model,
            func.count(VideoResult.id).label("video_count"),
        )
        .join(VideoResult, VideoResult.job_id == AnalysisJob.job_id)
        .group_by(AnalysisJob.job_id, AnalysisJob.created_at, AnalysisJob.selected_model)
        .order_by(AnalysisJob.created_at.desc())
    )

    rows = db.execute(stmt).all()

    return {
        "results": [
            {
                "job_id": row.job_id,
                "created_at": row.created_at,
                "selected_model": row.selected_model,
                "video_count": row.video_count,
            }
            for row in rows
        ]
    }


@router.get("/results/{job_id}", response_model=JobDetailResponse)
def get_job_detail(job_id: str, db: Session = Depends(get_db)):
    """
    Return the full summary metrics for every video in a job.
    The frontend calls this on page load to restore the last session.
    """
    job = db.scalar(select(AnalysisJob).where(AnalysisJob.job_id == job_id))
    if not job:
        raise HTTPException(status_code=404, detail=f"Job '{job_id}' not found.")

    video_rows = db.scalars(
        select(VideoResult).where(VideoResult.job_id == job_id)
    ).all()

    videos = []
    for vr in video_rows:
        # Rebuild timeseries from the saved CSV so the frontend can render charts
        timeseries = _load_timeseries_from_csv(vr.csv_path)
        videos.append({
            "video_id": vr.video_id,
            "video_name": vr.video_name,
            "summary": {
                "avg_velocity": vr.avg_velocity,
                "max_velocity": vr.max_velocity,
                "avg_clustering_percent": vr.avg_clustering_percent,
                "frames_processed": vr.frames_processed,
                "shrimp_count_estimate": vr.shrimp_count_estimate,
            },
            "timeseries": timeseries,
            "csv_download_url": f"/results/{job_id}/{vr.video_id}/csv",
        })

    return {
        "job_id": job_id,
        "selected_model": job.selected_model,
        "videos": videos,
    }


def _load_timeseries_from_csv(csv_path: str) -> list[dict]:
    """Read the exported CSV back into the timeseries format the frontend expects."""
    path = Path(csv_path)
    if not path.exists():
        return []
    rows = []
    try:
        with path.open(encoding="utf-8") as f:
            header = f.readline()  # skip header
            for line in f:
                parts = line.strip().split(",")
                if len(parts) < 4:
                    continue
                rows.append({
                    "frame": int(parts[0]),
                    "time_sec": float(parts[1]),
                    "avg_velocity": float(parts[2]),
                    "clustering_percent": float(parts[3]),
                })
    except Exception:
        pass
    return rows


@router.get("/results/{job_id}/{video_id}/csv")
def download_csv(job_id: str, video_id: str, db: Session = Depends(get_db)):
    stmt = select(VideoResult).where(
        VideoResult.job_id == job_id,
        VideoResult.video_id == video_id,
    )
    record = db.scalar(stmt)

    if not record:
        raise HTTPException(
            status_code=404,
            detail="No CSV record found for this job/video combination."
        )

    csv_path = Path(record.csv_path)
    if not csv_path.exists():
        raise HTTPException(
            status_code=404,
            detail="CSV file is missing from disk. Re-run the analysis."
        )

    return FileResponse(path=csv_path, filename=csv_path.name, media_type="text/csv")