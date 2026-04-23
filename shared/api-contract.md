# SEGP Shrimp Tracker — API Contract

This file is the single source of truth for the frontend ↔ backend interface.
**Do not change field names without updating both sides.**

---

## Base URL

| Environment | URL |
|-------------|-----|
| Development (via Vite proxy) | `http://localhost:5173` (Vite forwards to backend) |
| Backend directly | `http://127.0.0.1:8000` |

---

## Endpoints

### GET /health

Health check.

**Response**
```json
{ "status": "ok" }
```

---

### GET /models

Returns the list of available YOLO models.

**Response**
```json
{
  "models": [
    { "id": "best",      "label": "Best Trained Model" },
    { "id": "yolov8n",   "label": "YOLOv8 Nano" },
    { "id": "custom_v2", "label": "Custom Model V2" }
  ]
}
```

---

### POST /analyze

Upload 1–3 videos and run analysis.

**Request** — `multipart/form-data`

| Field | Type | Notes |
|-------|------|-------|
| `model_id` | string | Must match an `id` from `/models` |
| `videos` | file (repeated) | 1–3 files. Accepted: `.mp4`, `.avi`, `.mov`, `.mkv` |

**Response**
```json
{
  "job_id": "analysis_a1b2c3d4",
  "selected_model": "best",
  "videos": [
    {
      "video_id": "video_1",
      "video_name": "sample.mp4",
      "summary": {
        "avg_velocity": 3.42,
        "max_velocity": 7.91,
        "avg_clustering_percent": 62.4,
        "frames_processed": 300,
        "shrimp_count_estimate": 48
      },
      "timeseries": [
        {
          "frame": 1,
          "time_sec": 0.03,
          "avg_velocity": 2.1,
          "clustering_percent": 61.0
        }
      ],
      "csv_download_url": "/results/analysis_a1b2c3d4/video_1/csv"
    }
  ]
}
```

**Error response**
```json
{ "detail": "Human-readable error message here" }
```

---

### GET /results

Returns a list of past analysis jobs from the database, newest first.

**Response**
```json
{
  "results": [
    {
      "job_id": "analysis_a1b2c3d4",
      "created_at": "2026-04-20T10:30:00",
      "selected_model": "best",
      "video_count": 2
    }
  ]
}
```

---

### GET /results/{job_id}/{video_id}/csv

Downloads the CSV file for a specific video in a job.

**Response** — `text/csv` file download.

CSV columns: `frame`, `time_sec`, `avg_velocity`, `clustering_percent`

---

## Field name rules

These names are frozen. Do not use camelCase variants.

| Field | Type | Unit |
|-------|------|------|
| `avg_velocity` | float | px/s |
| `max_velocity` | float | px/s |
| `avg_clustering_percent` | float | % (0–100) |
| `frames_processed` | int | count |
| `shrimp_count_estimate` | int | count |
| `frame` | int | frame number |
| `time_sec` | float | seconds |
| `clustering_percent` | float | % (0–100) |

---

## CORS

In development, CORS is handled by the **Vite proxy** (`vite.config.js`).
The browser never makes a direct cross-origin request.

In production, configure your reverse proxy (Nginx/Caddy) to forward
`/analyze`, `/models`, `/results`, and `/health` to the FastAPI process.