# COMP2019 SOFTWARE ENGINEERING GROUP PROJECT
## SHRIMP ACTIVITY DETECTION FROM IMAGES
### AKA ShrimpTracker

AI-powered shrimp activity monitoring system.
Detects and measures **velocity** and **clustering percentage** from aquaculture pond videos.

*Please run dependency installments and upload video samples, there is no stored data in the uploaded zip files
---

## Project structure

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
- macOS / Linux:
```bash
cd backend

source .venv/bin/activate

python -m uvicorn app.main:app --reload --port 8000
```

##

- Windows:
```bash
cd backend

.venv\Scripts\activate

python -m uvicorn app.main:app --reload --port 8000
```

Verify it works: open http://127.0.0.1:8000/docs

##

### Terminal 2 — Frontend
```bash
cd frontend-new

npm run dev
```

Open the app: http://localhost:5173

---

## First-time setup

### Terminal 1 — Backend
- macOS / Linux:
```bash
cd backend
python -m venv .venv

source .venv/bin/activate

pip install -r requirements.txt

cp .env.example .env

# No edits needed for local development
python -m uvicorn app.main:app --reload --port 8000
```

##

- Windows:
```bash
cd backend
python -m venv .venv

.venv\Scripts\activate

pip install -r requirements.txt

copy .env.example .env

# No edits needed for local development
python -m uvicorn app.main:app --reload --port 8000
```

##

### Terminal 2 — Frontend
```bash
cd frontend-new

npm install

npm run dev
```

---

The agreed API contract is in `shared/api-contract.md`.