# SEGP Shrimp Tracker — Frontend

React + Vite dashboard for the shrimp activity analysis app.

## Quick start

```bash
# 1. Navigate to frontend folder
cd frontend-new

# 2. Install dependencies (first time only)
npm install

# 3. Start the dev server
npm run dev
```

The app opens at: http://localhost:5173

> **The backend must be running on port 8000 first.**
> Vite proxies all API calls (see `vite.config.js`), so there are no CORS errors.

## Build for production

```bash
npm run build
# Output is in the dist/ folder
```

## Project layout

```
frontend-new/
├── src/
│   ├── pages/
│   │   └── ShrimpDashboard.jsx  ← The whole dashboard
│   ├── App.jsx                  ← Root component
│   ├── main.jsx                 ← React entry point
│   └── index.css                ← Global reset only
├── index.html
├── vite.config.js               ← Dev proxy config
└── package.json
```

## How the proxy works

`vite.config.js` forwards `/analyze`, `/models`, `/results`, and `/health`
to `http://127.0.0.1:8000`. This means the browser only ever talks to
`localhost:5173` — no cross-origin requests, no CORS headers needed.

In production, configure Nginx/Caddy to do the same proxying.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| Upload stuck at 0% | Check the backend is running: open http://127.0.0.1:8000/docs |
| "Network error" in log | Backend not running or wrong port |
| CORS error in console | You bypassed the proxy — make sure `BASE_URL = ''` in ShrimpDashboard.jsx |
| Models dropdown empty | Backend /models endpoint failed — check backend log |