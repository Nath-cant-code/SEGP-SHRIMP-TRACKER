from pathlib import Path

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.db.models import AnalysisJob, VideoResult
from app.schemas.response_schemas import ResultsListResponse

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


@router.get("/results/{job_id}/{video_id}/csv")
def download_csv(job_id: str, video_id: str, db: Session = Depends(get_db)):
    stmt = select(VideoResult).where(VideoResult.job_id == job_id, VideoResult.video_id == video_id)
    record = db.scalar(stmt)

    if not record:
        raise HTTPException(status_code=404, detail="CSV not found")

    csv_path = Path(record.csv_path)

    if not csv_path.exists():
        raise HTTPException(status_code=404, detail="CSV file missing on disk")

    return FileResponse(path=csv_path, filename=csv_path.name, media_type="text/csv")