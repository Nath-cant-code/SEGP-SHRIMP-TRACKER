# SEGP Shrimp Tracker — Backend

FastAPI backend for the shrimp activity analysis app.

## Quick start

```bash
# 1. Navigate to backend folder
cd backend

# 2. Create and activate virtual environment
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows:
.venv\Scripts\activate

# 3. Install dependencies
pip install -r requirements.txt

# 4. Copy and configure environment file
cp .env.example .env
# The defaults in .env.example work out of the box for local dev.
# No changes needed unless you want a different database or port.

# 5. Run the dev server
uvicorn app.main:app --reload --port 8000
```

The API docs are at: http://127.0.0.1:8000/docs

## Project layout

```
backend/
├── app/
│   ├── db/
│   │   ├── database.py   ← SQLAlchemy engine + session
│   │   └── models.py     ← ORM table definitions
│   ├── routes/
│   │   ├── analyze.py    ← POST /analyze
│   │   ├── models.py     ← GET /models
│   │   └── results.py    ← GET /results, GET /results/{job}/{video}/csv
│   ├── schemas/
│   │   └── response_schemas.py  ← Pydantic response models
│   └── main.py           ← App factory, CORS, lifespan
├── models/               ← Put your .pt YOLO weights here
├── uploads/              ← Auto-created on startup
├── exports/              ← Auto-created on startup
├── .env.example
├── requirements.txt
└── README.md
```

## Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | /health | Health check |
| GET | /models | List available YOLO models |
| POST | /analyze | Upload videos and run analysis |
| GET | /results | List past analysis jobs |
| GET | /results/{job_id}/{video_id}/csv | Download CSV for a video |

## Adding real YOLO inference

Find the `generate_dummy_timeseries()` function in `app/routes/analyze.py` and
replace it with your real detection pipeline from `shrimp-ai/analysis/analysis.py`.
The response shape must stay the same.****