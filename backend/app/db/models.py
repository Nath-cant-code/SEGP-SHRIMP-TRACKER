from sqlalchemy import DateTime, Float, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db.database import Base


class AnalysisJob(Base):
    __tablename__ = "analysis_jobs"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(String(100), unique=True, index=True)
    selected_model: Mapped[str] = mapped_column(String(100))
    created_at: Mapped[DateTime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    video_results = relationship("VideoResult", back_populates="job")


class VideoResult(Base):
    __tablename__ = "video_results"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, index=True)
    job_id: Mapped[str] = mapped_column(ForeignKey("analysis_jobs.job_id"), index=True)
    video_id: Mapped[str] = mapped_column(String(100), index=True)
    video_name: Mapped[str] = mapped_column(String(255))
    avg_velocity: Mapped[float] = mapped_column(Float)
    max_velocity: Mapped[float] = mapped_column(Float)
    avg_clustering_percent: Mapped[float] = mapped_column(Float)
    frames_processed: Mapped[int] = mapped_column(Integer)
    shrimp_count_estimate: Mapped[int] = mapped_column(Integer)
    csv_path: Mapped[str] = mapped_column(String(500))

    job = relationship("AnalysisJob", back_populates="video_results")