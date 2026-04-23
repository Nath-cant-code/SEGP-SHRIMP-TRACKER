# SEGP Shrimp Tracker

AI-powered shrimp activity monitoring system.
Detects and measures **velocity** and **clustering percentage** from aquaculture pond videos.

---

## Recommended project structure

```
SEGP-SHRIMP-TRACKER/
├── backend/                 ← FastAPI server
│   ├── app/
│   │   ├── db/
│   │   ├── routes/
│   │   ├── schemas/
│   │   └── main.py
│   ├── models/              ← Put YOLO .pt weights here
│   ├── uploads/             ← Auto-created
│   ├── exports/             ← Auto-created
│   ├── .env.example
│   ├── requirements.txt
│   └── README.md
│
├── frontend-new/            ← React + Vite dashboard (THE active frontend)
│   ├── src/
│   │   ├── pages/
│   │   │   └── ShrimpDashboard.jsx
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── package.json
│   └── README.md
│
├── shrimp-ai/               ← ML training + analysis scripts
│   ├── analysis/
│   │   └── analysis.py      ← Real velocity + clustering code
│   ├── dataset/
│   └── shrimp.yaml
│
├── shared/
│   └── api-contract.md      ← The agreed JSON contract
│
└── README.md                ← This file
```

> The `shrimp-tracker-frontend/` directory is **deprecated**. Do not use it.

---

## Setup order (do this every time you start working)

### Terminal 1 — Backend
```bash
cd backend
source .venv/bin/activate        # Windows: .venv\Scripts\activate
uvicorn app.main:app --reload --port 8000
```

Verify it works: open http://127.0.0.1:8000/docs

### Terminal 2 — Frontend
```bash
cd frontend-new
npm run dev
```

Open the app: http://localhost:5173

---

## First-time setup

### Backend
```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
# No edits needed for local development
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend-new
npm install
npm run dev
```

---

## Connecting real YOLO inference

The backend currently returns **dummy data** so the UI works before the ML
pipeline is integrated. To use real detections:

1. Open `backend/app/routes/analyze.py`
2. Find `generate_dummy_timeseries()`
3. Replace it with a call to the real pipeline in `shrimp-ai/analysis/analysis.py`
4. Keep the response shape identical — the frontend depends on it

The agreed API contract is in `shared/api-contract.md`.