from datetime import datetime
from pydantic import BaseModel


class TimeSeriesPoint(BaseModel):
    frame: int
    time_sec: float
    avg_velocity: float
    clustering_percent: float


class VideoSummary(BaseModel):
    avg_velocity: float
    max_velocity: float
    avg_clustering_percent: float
    frames_processed: int
    shrimp_count_estimate: int


class VideoAnalysisResponse(BaseModel):
    video_id: str
    video_name: str
    summary: VideoSummary
    timeseries: list[TimeSeriesPoint]
    csv_download_url: str


class AnalyzeResponse(BaseModel):
    job_id: str
    selected_model: str
    videos: list[VideoAnalysisResponse]


class ResultListItem(BaseModel):
    job_id: str
    created_at: datetime
    selected_model: str
    video_count: int


class ResultsListResponse(BaseModel):
    results: list[ResultListItem]