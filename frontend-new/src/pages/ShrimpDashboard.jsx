/**
 * ShrimpDashboard.jsx — Floating Island Glassmorphism Redesign
 *
 * UI rebuilt with the 'Floating Island' aesthetic:
 * - Each functional area is a standalone glassmorphism island
 * - High-blur frosted glass panels floating over a background
 * - IBM Plex Mono for data, Satoshi/DM Sans for labels
 * - All original logic preserved intact
 */

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = ''
const MAX_VIDEOS = 3
const ALLOWED_TYPES = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const SMOOTHING_WINDOW = 7
const SERIES_COLORS = [
  { line: '#2dd4bf', dash: false },
  { line: '#f59e0b', dash: true },
  { line: '#f87171', dash: true },
]

// ─── Theme ────────────────────────────────────────────────────────────────────
const ThemeContext = createContext({ dark: true, toggle: () => {} })
const useTheme = () => useContext(ThemeContext)

// Glass panel style generator
const glass = (opacity = 0.08, blur = 40) => ({
  background: `rgba(10, 20, 35, ${opacity})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border: '1px solid rgba(255,255,255,0.10)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.08)',
})

const glassLight = (opacity = 0.55, blur = 40) => ({
  background: `rgba(240, 248, 255, ${opacity})`,
  backdropFilter: `blur(${blur}px)`,
  WebkitBackdropFilter: `blur(${blur}px)`,
  border: '1px solid rgba(255,255,255,0.6)',
  boxShadow: '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.8)',
})

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rollingAvg(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}

function shortName(name, max = 22) {
  return name.length > max ? name.slice(0, max - 1) + '…' : name
}

function uploadWithProgress(formData, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/analyze`)
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try { resolve(JSON.parse(xhr.responseText)) }
        catch { reject(new Error('Server returned invalid JSON')) }
      } else {
        let msg = `Server error ${xhr.status}`
        try { msg = JSON.parse(xhr.responseText)?.detail || msg } catch {}
        reject(new Error(msg))
      }
    }
    xhr.onerror = () => reject(new Error('Network error — is the backend running on port 8000?'))
    xhr.ontimeout = () => reject(new Error('Request timed out'))
    xhr.timeout = 1200_000
    if (signal) signal.addEventListener('abort', () => xhr.abort())
    xhr.send(formData)
  })
}

function computeThresholdAlerts(videos, threshold) {
  if (!threshold || threshold <= 0) return []
  const alerts = []
  videos.forEach((v, i) => {
    const velPoints = v.timeseries.map(p => p.avg_velocity).filter(x => x > 0)
    if (!velPoints.length) return
    const below = velPoints.filter(x => x < threshold)
    if (below.length === 0) return
    alerts.push({
      videoIndex: i,
      videoName: v.video_name,
      threshold,
      pctBelow: (below.length / velPoints.length) * 100,
      avgVelocity: velPoints.reduce((a, b) => a + b, 0) / velPoints.length,
    })
  })
  return alerts
}

// ─── SVG Icons ────────────────────────────────────────────────────────────────
const Icons = {
  Activity: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
    </svg>
  ),
  Upload: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  ),
  Play: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <polygon points="5 3 19 12 5 21 5 3" />
    </svg>
  ),
  X: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Download: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  ),
  History: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10" />
      <path d="M3.51 15a9 9 0 1 0 .49-3.51" />
    </svg>
  ),
  Terminal: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  AlertTriangle: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Check: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  ),
  Maximize: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3" />
    </svg>
  ),
  Sun: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  ),
  Moon: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  ),
  Film: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" /><line x1="2" y1="7" x2="7" y2="7" />
      <line x1="2" y1="17" x2="7" y2="17" /><line x1="17" y1="17" x2="22" y2="17" />
      <line x1="17" y1="7" x2="22" y2="7" />
    </svg>
  ),
  Cpu: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="4" y="4" width="16" height="16" rx="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  BarChart: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  RefreshCw: ({ size = 14, color = 'currentColor' }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
    </svg>
  ),
}

// ─── Line Chart ───────────────────────────────────────────────────────────────
function LineChart({ datasets, field, unit, smoothing, velocityThreshold, expanded }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const W = expanded ? 880 : 520
  const H = expanded ? 300 : 170
  const PAD = { t: 12, r: 14, b: 32, l: 46 }
  const IW = W - PAD.l - PAD.r
  const IH = H - PAD.t - PAD.b
  const showThreshold = field === 'avg_velocity' && velocityThreshold > 0

  const processed = datasets.map((ds, di) => {
    const raw = ds.timeseries.map(p => p[field])
    const vals = smoothing ? rollingAvg(raw, SMOOTHING_WINDOW) : raw
    return { ...ds, vals, color: SERIES_COLORS[di % SERIES_COLORS.length] }
  })

  const allVals = processed.flatMap(p => p.vals).filter(v => v != null)
  const allTimes = processed.flatMap(p => p.timeseries.map(x => x.time_sec))

  if (!allVals.length || !allTimes.length) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }}>no data</span>
      </div>
    )
  }

  const minV = Math.min(...allVals, showThreshold ? velocityThreshold : Infinity)
  const maxV = Math.max(...allVals, showThreshold ? velocityThreshold : -Infinity)
  const minT = Math.min(...allTimes), maxT = Math.max(...allTimes)
  const rangeV = maxV - minV || 1, rangeT = maxT - minT || 1

  const tx = t => PAD.l + ((t - minT) / rangeT) * IW
  const ty = v => PAD.t + (1 - (v - minV) / rangeV) * IH

  const buildPath = (ds) =>
    ds.timeseries.map((p, i) => {
      const v = ds.vals[i]
      if (v == null) return null
      const first = i === 0 || ds.vals.slice(0, i).every(x => x == null)
      return `${first ? 'M' : 'L'}${tx(p.time_sec).toFixed(1)},${ty(v).toFixed(1)}`
    }).filter(Boolean).join(' ')

  const Y_TICKS = 4, X_TICKS = expanded ? 7 : 4
  const gridVals = Array.from({ length: Y_TICKS + 1 }, (_, i) => minV + (rangeV * i / Y_TICKS))
  const gridTimes = Array.from({ length: X_TICKS + 1 }, (_, i) => minT + (rangeT * i / X_TICKS))
  const dim = 'rgba(255,255,255,0.15)'
  const gridLine = 'rgba(255,255,255,0.05)'
  const thresholdY = showThreshold ? ty(velocityThreshold) : null

  const onMouseMove = useCallback((e) => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD.l) / IW))
    const tVal = minT + ratio * rangeT
    const hoverData = processed.map(ds => {
      const idx = ds.timeseries.reduce((best, p, i) =>
        Math.abs(p.time_sec - tVal) < Math.abs(ds.timeseries[best].time_sec - tVal) ? i : best, 0)
      return {
        label: ds.video_name,
        val: ds.vals[idx],
        time: ds.timeseries[idx].time_sec,
        x: tx(ds.timeseries[idx].time_sec),
        y: ty(ds.vals[idx] ?? 0),
        color: ds.color.line,
        belowThreshold: showThreshold && ds.vals[idx] != null && ds.vals[idx] < velocityThreshold,
      }
    })
    setHover(hoverData)
  }, [processed, minT, rangeT, IW])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {processed.map((ds, di) => (
            <linearGradient key={di} id={`g-${field}-${di}-${expanded ? 'e' : 's'}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ds.color.line} stopOpacity="0.18" />
              <stop offset="100%" stopColor={ds.color.line} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={ty(v)} x2={W - PAD.r} y2={ty(v)} stroke={gridLine} strokeWidth="0.8" />
            <text x={PAD.l - 5} y={ty(v) + 3.5} textAnchor="end" fill={dim} fontSize="9" fontFamily="IBM Plex Mono, monospace">{v.toFixed(0)}</text>
          </g>
        ))}
        {gridTimes.map((t, i) => (
          <text key={i} x={tx(t)} y={H - PAD.b + 12} textAnchor="middle" fill={dim} fontSize="9" fontFamily="IBM Plex Mono, monospace">{t.toFixed(1)}s</text>
        ))}
        <text x={-H / 2} y={13} transform="rotate(-90)" textAnchor="middle" fill={dim} fontSize="9" fontFamily="IBM Plex Mono, monospace">{unit}</text>

        {showThreshold && thresholdY != null && (
          <g>
            <line x1={PAD.l} y1={thresholdY} x2={W - PAD.r} y2={thresholdY}
              stroke="#f87171" strokeWidth="1.2" strokeDasharray="4 3" opacity="0.7" />
            <rect x={W - PAD.r - 62} y={thresholdY - 12} width={60} height={12} rx={2}
              fill="rgba(248,113,113,0.12)" />
            <text x={W - PAD.r - 32} y={thresholdY - 3} textAnchor="middle"
              fill="#f87171" fontSize="8" fontFamily="IBM Plex Mono, monospace">thr:{velocityThreshold}</text>
            <rect x={PAD.l} y={thresholdY} width={IW} height={Math.max(0, PAD.t + IH - thresholdY)}
              fill="rgba(248,113,113,0.03)" />
          </g>
        )}

        {processed.map((ds, di) => {
          const path = buildPath(ds)
          const lastPt = ds.timeseries[ds.timeseries.length - 1]
          const firstPt = ds.timeseries[0]
          return (
            <g key={di}>
              <path d={`${path} L${tx(lastPt.time_sec)},${PAD.t + IH} L${tx(firstPt.time_sec)},${PAD.t + IH} Z`}
                fill={`url(#g-${field}-${di}-${expanded ? 'e' : 's'})`} />
              <path d={path} fill="none" stroke={ds.color.line} strokeWidth="1.6"
                strokeDasharray={ds.color.dash ? '5 3' : undefined}
                strokeLinejoin="round" strokeLinecap="round" />
              {showThreshold && ds.timeseries.map((p, i) => {
                const v = ds.vals[i]
                if (v == null || v >= velocityThreshold) return null
                return <circle key={i} cx={tx(p.time_sec)} cy={ty(v)} r={expanded ? 2.5 : 1.8}
                  fill="#f87171" opacity="0.6" />
              })}
            </g>
          )
        })}

        {hover && (
          <>
            <line x1={hover[0].x} y1={PAD.t} x2={hover[0].x} y2={PAD.t + IH}
              stroke="rgba(255,255,255,0.2)" strokeWidth="0.8" strokeDasharray="3 2" />
            {hover.map((h, i) => h.val != null && (
              <circle key={i} cx={h.x} cy={h.y} r={4}
                fill={h.belowThreshold ? '#f87171' : h.color}
                stroke="rgba(10,20,35,0.8)" strokeWidth="1.5" />
            ))}
          </>
        )}
      </svg>

      {hover && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          ...glass(0.85, 20),
          borderRadius: 8, padding: '8px 12px', fontSize: 11,
          lineHeight: 1.9, pointerEvents: 'none',
          fontFamily: 'IBM Plex Mono, monospace',
          color: 'rgba(255,255,255,0.7)',
          minWidth: 160,
        }}>
          <div style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9, marginBottom: 3 }}>
            t = {hover[0]?.time.toFixed(2)}s
          </div>
          {hover.map((h, i) => h.val != null && (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 7, height: 7, borderRadius: 2, background: h.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: h.belowThreshold ? '#f87171' : 'rgba(255,255,255,0.9)', fontWeight: 600 }}>
                {h.val.toFixed(2)}
              </span>
              <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: 9 }}>{unit}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Graph Modal ──────────────────────────────────────────────────────────────
function GraphModal({ title, subtitle, children, onClose }) {
  useEffect(() => {
    const h = (e) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', h)
    return () => document.removeEventListener('keydown', h)
  }, [onClose])

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(8px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        ...glass(0.12, 60),
        borderRadius: 16, width: '100%', maxWidth: 1060,
        maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
      }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 20px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0,
        }}>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'rgba(255,255,255,0.9)', fontFamily: 'DM Sans, sans-serif' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.35)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>{subtitle}</div>}
          </div>
          <button onClick={onClose} style={{
            ...glass(0.1, 20), borderRadius: 8, color: 'rgba(255,255,255,0.5)',
            cursor: 'pointer', fontSize: 12, padding: '5px 12px',
            fontFamily: 'DM Sans, sans-serif', display: 'flex', alignItems: 'center', gap: 5,
            border: '1px solid rgba(255,255,255,0.1)',
          }}>
            <Icons.X size={11} /> Close
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '18px 22px 22px' }}>{children}</div>
      </div>
    </div>
  )
}

// ─── Chart Island ─────────────────────────────────────────────────────────────
function ChartIsland({ title, subtitle, children, expandContent }) {
  const [expanded, setExpanded] = useState(false)
  return (
    <>
      <div style={{ ...glass(), borderRadius: 14, padding: '14px 16px 12px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize: 11.5, fontWeight: 600, color: 'rgba(255,255,255,0.85)', fontFamily: 'DM Sans, sans-serif', letterSpacing: '0.01em' }}>{title}</div>
            {subtitle && <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.3)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>{subtitle}</div>}
          </div>
          <button onClick={() => setExpanded(true)} style={{
            background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
            borderRadius: 6, color: 'rgba(255,255,255,0.35)', cursor: 'pointer',
            padding: '4px 8px', display: 'flex', alignItems: 'center', gap: 4,
            fontSize: 10, fontFamily: 'DM Sans, sans-serif', flexShrink: 0, marginLeft: 8,
            transition: 'all 0.15s',
          }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.4)'; e.currentTarget.style.color = '#2dd4bf' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}>
            <Icons.Maximize size={10} /> Expand
          </button>
        </div>
        {children}
      </div>
      {expanded && (
        <GraphModal title={title} subtitle={subtitle} onClose={() => setExpanded(false)}>
          {expandContent}
        </GraphModal>
      )}
    </>
  )
}

// ─── Metric Chip ──────────────────────────────────────────────────────────────
function MetricChip({ label, value, unit, accent }) {
  return (
    <div style={{
      ...glass(0.06, 20),
      borderRadius: 10, padding: '10px 14px', flex: 1, minWidth: 0,
      transition: 'border-color 0.2s',
    }}>
      <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 5, letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif' }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 700, color: accent || 'rgba(255,255,255,0.9)', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 10, fontWeight: 400, color: 'rgba(255,255,255,0.3)', marginLeft: 3 }}>{unit}</span>}
      </div>
    </div>
  )
}

// ─── Alert Log ────────────────────────────────────────────────────────────────
function AlertLog({ entries }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [entries])
  const colorMap = { info: 'rgba(255,255,255,0.45)', ok: '#2dd4bf', warn: '#f59e0b', err: '#f87171' }
  return (
    <div ref={ref} style={{ height: 160, overflowY: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: 10.5, lineHeight: 2 }}>
      {entries.length === 0 && (
        <div style={{ color: 'rgba(255,255,255,0.2)', padding: '8px 0' }}>// no activity yet</div>
      )}
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, borderBottom: '1px solid rgba(255,255,255,0.04)', color: colorMap[e.type] || colorMap.info }}>
          <span style={{ color: 'rgba(255,255,255,0.2)', flexShrink: 0, fontSize: 9 }}>{e.ts}</span>
          <span style={{ wordBreak: 'break-word', flex: 1 }}>{e.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Upload Zone ─────────────────────────────────────────────────────────────
function UploadZone({ files, onFiles }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const validate = (fileList) => {
    const arr = Array.from(fileList)
    const valid = arr.filter(f => ALLOWED_TYPES.includes(f.type) || f.name.match(/\.(mp4|avi|mov|mkv)$/i))
    if (valid.length !== arr.length) alert('Some files skipped — only MP4, AVI, MOV, MKV supported.')
    const slots = MAX_VIDEOS - files.length
    if (valid.length > slots) {
      alert(`Max ${MAX_VIDEOS} videos. Only first ${slots} added.`)
      return valid.slice(0, slots)
    }
    return valid
  }

  const onDrop = (e) => {
    e.preventDefault(); setDragging(false)
    const added = validate(e.dataTransfer.files)
    if (added.length) onFiles([...files, ...added])
  }

  const onPick = (e) => {
    const added = validate(e.target.files)
    if (added.length) onFiles([...files, ...added])
    e.target.value = ''
  }

  return (
    <div>
      <div onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          border: `1px dashed ${dragging ? 'rgba(45,212,191,0.6)' : 'rgba(255,255,255,0.12)'}`,
          borderRadius: 10, padding: '14px 10px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'rgba(45,212,191,0.06)' : 'rgba(255,255,255,0.03)',
          transition: 'all 0.15s',
        }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 6, opacity: 0.5 }}>
          <Icons.Upload size={18} color="rgba(45,212,191,0.8)" />
        </div>
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'DM Sans, sans-serif', fontWeight: 500 }}>Click or drag videos</div>
        <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.25)', marginTop: 2, fontFamily: 'IBM Plex Mono, monospace' }}>mp4 · avi · mov · mkv — up to {MAX_VIDEOS}</div>
        <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={onPick} />
      </div>

      {files.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {files.map((f, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 7,
              background: 'rgba(255,255,255,0.04)', borderRadius: 7, padding: '5px 9px',
              border: '1px solid rgba(255,255,255,0.07)', fontSize: 11,
            }}>
              <Icons.Film size={10} color="#2dd4bf" />
              <span style={{ color: 'rgba(255,255,255,0.6)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'DM Sans, sans-serif' }}>{f.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.25)', fontSize: 9, flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace' }}>{(f.size / 1e6).toFixed(1)}MB</span>
              <button onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, idx) => idx !== i)) }}
                style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.3)', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <Icons.X size={11} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressBar({ value, label, color }) {
  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 10, color: 'rgba(255,255,255,0.35)', marginBottom: 4, fontFamily: 'IBM Plex Mono, monospace' }}>
        <span>{label}</span><span>{value}%</span>
      </div>
      <div style={{ height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color || '#2dd4bf', borderRadius: 2, transition: 'width 0.25s ease' }} />
      </div>
    </div>
  )
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusDot({ status }) {
  const map = {
    idle:      { label: 'IDLE',      c: 'rgba(255,255,255,0.3)' },
    uploading: { label: 'UPLOADING', c: '#f59e0b' },
    analyzing: { label: 'ANALYZING', c: '#2dd4bf' },
    done:      { label: 'READY',     c: '#2dd4bf' },
    error:     { label: 'ERROR',     c: '#f87171' },
    restoring: { label: 'RESTORING', c: '#60a5fa' },
  }
  const { label, c } = map[status] || map.idle
  const pulse = status === 'analyzing' || status === 'uploading' || status === 'restoring'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      <span style={{
        width: 6, height: 6, borderRadius: '50%', background: c, display: 'inline-block', flexShrink: 0,
        animation: pulse ? 'pulse 1.2s ease-in-out infinite' : 'none',
      }} />
      <span style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', color: c, fontFamily: 'IBM Plex Mono, monospace' }}>{label}</span>
    </div>
  )
}

// ─── Toggle ───────────────────────────────────────────────────────────────────
function Toggle({ value, onChange, label }) {
  return (
    <button onClick={() => onChange(!value)} style={{
      display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none',
      cursor: 'pointer', color: value ? '#2dd4bf' : 'rgba(255,255,255,0.4)',
      fontSize: 11, padding: '4px 0', transition: 'color 0.15s', fontFamily: 'DM Sans, sans-serif',
    }}>
      <span style={{
        width: 28, height: 15, borderRadius: 8,
        background: value ? 'rgba(45,212,191,0.8)' : 'rgba(255,255,255,0.12)',
        position: 'relative', display: 'inline-block', transition: 'background 0.2s', flexShrink: 0,
      }}>
        <span style={{
          position: 'absolute', top: 2, left: value ? 15 : 2, width: 11, height: 11,
          borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)',
        }} />
      </span>
      {label}
    </button>
  )
}

// ─── Threshold Alert Banner ───────────────────────────────────────────────────
function ThresholdAlertBanner({ alerts, onDismiss, isRestored }) {
  if (!alerts || alerts.length === 0) return null
  return (
    <div style={{
      background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.3)',
      borderRadius: 12, padding: '12px 16px', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#f87171', marginBottom: 6, display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'DM Sans, sans-serif' }}>
            <Icons.AlertTriangle size={12} color="#f87171" />
            Lethargic Shrimp Detected — Velocity Below Threshold
            {isRestored && <span style={{ fontSize: 8.5, background: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 3, padding: '1px 6px', fontWeight: 600, letterSpacing: '0.08em', marginLeft: 4, fontFamily: 'IBM Plex Mono, monospace' }}>RESTORED</span>}
          </div>
          {alerts.map((a, i) => (
            <div key={i} style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.55)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
              <span style={{ width: 6, height: 6, borderRadius: 1, background: SERIES_COLORS[a.videoIndex % SERIES_COLORS.length].line, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'rgba(255,255,255,0.8)', fontWeight: 600 }}>{shortName(a.videoName, 28)}</span>
              <span style={{ color: '#f87171' }}>{a.pctBelow.toFixed(1)}% below {a.threshold}px/s</span>
              <span style={{ color: 'rgba(255,255,255,0.25)' }}>avg:{a.avgVelocity.toFixed(1)}</span>
            </div>
          ))}
        </div>
        <button onClick={onDismiss} style={{ background: 'none', border: 'none', color: 'rgba(248,113,113,0.6)', cursor: 'pointer', padding: 2, display: 'flex' }}>
          <Icons.X size={13} />
        </button>
      </div>
    </div>
  )
}

// ─── Video Summary Cards ──────────────────────────────────────────────────────
function VideoSummaryCards({ video, accent }) {
  const s = video.summary
  return (
    <div>
      <div style={{ fontSize: 10, color: accent, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, fontFamily: 'DM Sans, sans-serif' }}>
        {shortName(video.video_name, 36)}
        {video._used_dummy_data && (
          <span style={{ fontSize: 8.5, background: 'rgba(245,158,11,0.12)', color: '#f59e0b', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 3, padding: '1px 6px', fontFamily: 'IBM Plex Mono, monospace' }}>DUMMY DATA</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <MetricChip label="Avg Velocity" value={s.avg_velocity.toFixed(1)} unit="px/s" accent={accent} />
        <MetricChip label="Peak Velocity" value={s.max_velocity.toFixed(1)} unit="px/s" />
        <MetricChip label="Avg Clustering" value={s.avg_clustering_percent.toFixed(1)} unit="%" />
        <MetricChip label="Frames" value={s.frames_processed} />
        <MetricChip label="Est. Shrimp" value={s.shrimp_count_estimate} />
      </div>
    </div>
  )
}

// ─── Past Jobs Table ──────────────────────────────────────────────────────────
function PastJobsTable({ jobs, onRestore }) {
  if (!jobs.length) return (
    <div style={{ color: 'rgba(255,255,255,0.2)', fontSize: 11, padding: '12px 0', fontFamily: 'IBM Plex Mono, monospace' }}>// no past analyses found</div>
  )
  const th = { padding: '7px 10px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontSize: 9.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }
  const td = { padding: '8px 10px', borderBottom: '1px solid rgba(255,255,255,0.04)', fontSize: 11, color: 'rgba(255,255,255,0.55)', fontFamily: 'IBM Plex Mono, monospace' }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead><tr>{['Job ID', 'Created', 'Model', 'Videos', ''].map(h => <th key={h} style={th}>{h}</th>)}</tr></thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.job_id}
              onMouseEnter={e => e.currentTarget.style.background = 'rgba(255,255,255,0.03)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ ...td, color: '#2dd4bf' }}>{j.job_id}</td>
              <td style={td}>{new Date(j.created_at).toLocaleString()}</td>
              <td style={td}>{j.selected_model}</td>
              <td style={td}>{j.video_count}</td>
              <td style={td}>
                <button onClick={() => onRestore(j.job_id)} style={{
                  background: 'rgba(45,212,191,0.08)', border: '1px solid rgba(45,212,191,0.25)',
                  borderRadius: 5, color: '#2dd4bf', fontSize: 10, padding: '4px 10px', cursor: 'pointer',
                  fontFamily: 'IBM Plex Mono, monospace', display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <Icons.History size={9} color="#2dd4bf" /> restore
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background: active === t.id ? 'rgba(45,212,191,0.12)' : 'rgba(255,255,255,0.04)',
          border: `1px solid ${active === t.id ? 'rgba(45,212,191,0.3)' : 'rgba(255,255,255,0.07)'}`,
          borderRadius: 8, color: active === t.id ? '#2dd4bf' : 'rgba(255,255,255,0.4)',
          fontSize: 11, fontWeight: 500, padding: '6px 14px', cursor: 'pointer',
          transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

// ─── Number Input ─────────────────────────────────────────────────────────────
function NumInput({ value, onChange, placeholder, disabled }) {
  return (
    <input type="number" min="0" step="0.5"
      value={value || ''}
      onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        flex: 1, background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 7, color: 'rgba(255,255,255,0.85)', fontSize: 12.5,
        padding: '7px 10px', outline: 'none', fontFamily: 'IBM Plex Mono, monospace',
        transition: 'border-color 0.15s', opacity: disabled ? 0.5 : 1,
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(248,113,113,0.5)'}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
    />
  )
}

// ─── Select ───────────────────────────────────────────────────────────────────
function GlassSelect({ value, onChange, options, disabled }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: 8, color: disabled ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.85)',
        fontSize: 12, padding: '8px 28px 8px 10px', appearance: 'none', cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none', fontFamily: 'DM Sans, sans-serif',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='rgba(255,255,255,0.3)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'calc(100% - 10px) center',
        transition: 'border-color 0.15s',
      }}
      onFocus={e => e.target.style.borderColor = 'rgba(45,212,191,0.4)'}
      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.1)'}
    >
      {options.map(o => <option key={o.value} value={o.value} style={{ background: '#0a1424' }}>{o.label}</option>)}
    </select>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function ShrimpDashboard() {
  const [dark] = useState(true)

  // ── State ───────────────────────────────────────────────────────────────────
  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState('')
  const [files, setFiles] = useState([])
  const [uploadPct, setUploadPct] = useState(0)
  const [analyzePct, setAnalyzePct] = useState(0)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')
  const [isRestoredResult, setIsRestoredResult] = useState(false)
  const [pastJobs, setPastJobs] = useState([])
  const [pastLoading, setPastLoading] = useState(false)
  const [smoothing, setSmoothing] = useState(false)
  const [activeTab, setActiveTab] = useState('analytics')
  const [velocityThreshold, setVelocityThreshold] = useState(0)
  const [thresholdAlerts, setThresholdAlerts] = useState([])
  const [thresholdAlertDismissed, setThresholdAlertDismissed] = useState(false)
  const [logEntries, setLogEntries] = useState([])
  const abortRef = useRef(null)

  const log = useCallback((msg, type = 'info') => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })
    setLogEntries(a => [...a.slice(-99), { ts, msg, type }])
  }, [])

  // ── Restore job ─────────────────────────────────────────────────────────────
  const restoreJob = useCallback(async (jobId) => {
    if (!jobId) return
    setStatus('restoring')
    log(`Restoring session: ${jobId}`, 'info')
    try {
      const res = await fetch(`${BASE_URL}/results/${jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
      setIsRestoredResult(true)
      setThresholdAlerts([])
      setThresholdAlertDismissed(false)
      setStatus('done')
      log(`Session restored: ${data.videos.length} video(s) from ${jobId}`, 'ok')
    } catch (e) {
      setStatus('idle')
      log(`Could not restore: ${e.message}`, 'warn')
      sessionStorage.removeItem('lastJobId')
    }
  }, [log])

  // ── Init ────────────────────────────────────────────────────────────────────
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${BASE_URL}/models`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setModels(data.models || [])
        if (data.models?.length) setSelectedModel(data.models[0].id)
        log(`Loaded ${data.models.length} model(s)`, 'ok')
      } catch (e) {
        log(`Backend unreachable: ${e.message}`, 'err')
        const fallback = [{ id: 'best', label: 'Best Trained Model' }, { id: 'yolov8n', label: 'YOLOv8 Nano' }]
        setModels(fallback)
        setSelectedModel(fallback[0].id)
      } finally {
        setModelsLoading(false)
      }
      const lastJobId = sessionStorage.getItem('lastJobId')
      if (lastJobId) await restoreJob(lastJobId)
    })()
  }, [log, restoreJob])

  // ── Fetch past jobs ─────────────────────────────────────────────────────────
  const fetchPastJobs = useCallback(async () => {
    setPastLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/results`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPastJobs(data.results || [])
    } catch (e) {
      log(`Could not load history: ${e.message}`, 'warn')
    } finally {
      setPastLoading(false)
    }
  }, [log])

  useEffect(() => { fetchPastJobs() }, [fetchPastJobs])

  // ── Run analysis ─────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!files.length) { log('Select at least one video file.', 'warn'); return }
    if (!selectedModel) { log('Select a YOLO model.', 'warn'); return }
    if (status === 'uploading' || status === 'analyzing') return

    setError(''); setResult(null); setUploadPct(0); setAnalyzePct(0)
    setThresholdAlerts([]); setThresholdAlertDismissed(false); setIsRestoredResult(false)
    setStatus('uploading')
    log(`Analysis started: model=${selectedModel}, videos=${files.map(f => f.name).join(', ')}`, 'info')

    const ctrl = new AbortController()
    abortRef.current = ctrl
    const fd = new FormData()
    fd.append('model_id', selectedModel)
    files.forEach(f => fd.append('videos', f, f.name))

    try {
      const data = await uploadWithProgress(fd, (pct) => {
        setUploadPct(pct)
        if (pct === 100) {
          log('Upload complete — running inference...', 'ok')
          setStatus('analyzing')
          let ap = 0
          const iv = setInterval(() => {
            ap = Math.min(ap + Math.random() * 6, 92)
            setAnalyzePct(Math.round(ap))
          }, 400)
          if (abortRef.current) abortRef.current._inferIv = iv
        }
      }, ctrl.signal)

      if (abortRef.current?._inferIv) clearInterval(abortRef.current._inferIv)
      setAnalyzePct(100); setStatus('done'); setResult(data)
      sessionStorage.setItem('lastJobId', data.job_id)

      if (velocityThreshold > 0) {
        const tAlerts = computeThresholdAlerts(data.videos, velocityThreshold)
        setThresholdAlerts(tAlerts)
        if (tAlerts.length > 0) {
          tAlerts.forEach(a => log(`ALERT: ${a.videoName} — ${a.pctBelow.toFixed(1)}% below ${a.threshold}px/s`, 'warn'))
          setActiveTab('analytics')
        } else {
          log(`All videos passed threshold (${velocityThreshold}px/s)`, 'ok')
        }
      }

      const dummyCount = data.videos.filter(v => v._used_dummy_data).length
      if (dummyCount > 0) log(`${dummyCount} video(s) used dummy data — no model found`, 'warn')
      log(`Analysis complete. Job: ${data.job_id}`, 'ok')
      data.videos.forEach(v => log(`  ${v.video_name}: vel=${v.summary.avg_velocity}px/s clust=${v.summary.avg_clustering_percent}%`, 'info'))
      fetchPastJobs()
    } catch (e) {
      if (abortRef.current?._inferIv) clearInterval(abortRef.current._inferIv)
      if (e.name === 'AbortError') {
        setStatus('idle'); log('Analysis cancelled.', 'warn')
      } else {
        setStatus('error'); setError(e.message); log(`Error: ${e.message}`, 'err')
      }
    }
  }, [files, selectedModel, status, log, fetchPastJobs, velocityThreshold])

  // ── Calculate threshold on current result ────────────────────────────────────
  const calculateThresholdOnCurrentResult = useCallback(() => {
    if (!result || !velocityThreshold || velocityThreshold <= 0) return
    log(`Calculating threshold (${velocityThreshold}px/s) on current result...`, 'info')
    const tAlerts = computeThresholdAlerts(result.videos, velocityThreshold)
    setThresholdAlerts(tAlerts)
    setThresholdAlertDismissed(false)
    if (tAlerts.length > 0) {
      tAlerts.forEach(a => log(`ALERT: ${a.videoName} — ${a.pctBelow.toFixed(1)}% below ${a.threshold}px/s${isRestoredResult ? ' [restored]' : ''}`, 'warn'))
      setActiveTab('analytics')
    } else {
      log(`All videos passed threshold (${velocityThreshold}px/s)`, 'ok')
    }
  }, [result, velocityThreshold, isRestoredResult, log])

  const cancelAnalysis = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      if (abortRef.current._inferIv) clearInterval(abortRef.current._inferIv)
    }
  }

  const downloadCsv = (jobId, videoId) => {
    window.open(`${BASE_URL}/results/${jobId}/${videoId}/csv`, '_blank')
    log(`Downloading CSV for ${videoId}`, 'info')
  }

  const handleRestore = useCallback(async (jobId) => {
    sessionStorage.setItem('lastJobId', jobId)
    setThresholdAlerts([]); setThresholdAlertDismissed(false)
    await restoreJob(jobId)
    setActiveTab('analytics')
  }, [restoreJob])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isRunning = status === 'uploading' || status === 'analyzing'
  const hasDummy = result?.videos?.some(v => v._used_dummy_data)
  const showThresholdAlerts = thresholdAlerts.length > 0 && !thresholdAlertDismissed
  const canCalculateThreshold = !!result && velocityThreshold > 0 && !isRunning
  const activeVelocityThreshold = velocityThreshold > 0 ? velocityThreshold : 0
  const legend = result?.videos?.map((v, i) => ({ label: v.video_name, color: SERIES_COLORS[i % SERIES_COLORS.length].line })) || []

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&family=DM+Sans:wght@300;400;500;600;700&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; width: 100%; }
        body { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; overflow: hidden; }
        select option { background: #0a1424; }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:none} }
        @keyframes spin { to { transform: rotate(360deg); } }
        .fade-up { animation: fadeUp 0.3s ease both; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
      `}</style>

      {/* ── Root: background image ── */}
      <div style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        background: 'linear-gradient(135deg, #050d1a 0%, #091525 50%, #060e1c 100%)',
        backgroundImage: `url('https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1920&q=80')`,
        backgroundSize: 'cover', backgroundPosition: 'center',
        position: 'relative',
      }}>
        {/* dark overlay */}
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(5,13,26,0.82)', backdropFilter: 'blur(1px)' }} />

        {/* subtle grid */}
        <div style={{
          position: 'absolute', inset: 0, opacity: 0.04,
          backgroundImage: 'linear-gradient(rgba(45,212,191,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(45,212,191,0.6) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }} />

        {/* ── Layout ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', height: '100%',
          display: 'grid',
          gridTemplateColumns: '260px 1fr',
          gridTemplateRows: '52px 1fr',
          gap: 0,
          padding: 0,
        }}>

          {/* ════ HEADER ISLAND ════ */}
          <div style={{
            gridColumn: '1 / -1',
            ...glass(0.1, 50),
            borderRadius: 0,
            borderBottom: '1px solid rgba(255,255,255,0.08)',
            borderTop: 'none', borderLeft: 'none', borderRight: 'none',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '0 20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: 'rgba(45,212,191,0.12)', border: '1px solid rgba(45,212,191,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Icons.Activity size={13} color="#2dd4bf" />
              </div>
              <div>
                <div style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '-0.02em', fontFamily: 'DM Sans, sans-serif' }}>ShrimpTracker</div>
                <div style={{ fontSize: 8.5, color: 'rgba(255,255,255,0.25)', letterSpacing: '0.12em', textTransform: 'uppercase', fontFamily: 'IBM Plex Mono, monospace' }}>Activity Detection System</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              {isRestoredResult && result && (
                <span style={{ fontSize: 9, background: 'rgba(96,165,250,0.1)', color: '#60a5fa', border: '1px solid rgba(96,165,250,0.25)', borderRadius: 4, padding: '2px 8px', fontFamily: 'IBM Plex Mono, monospace', fontWeight: 600, letterSpacing: '0.07em' }}>
                  RESTORED · {result.job_id}
                </span>
              )}
              <StatusDot status={status} />
              <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />
              <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', fontFamily: 'IBM Plex Mono, monospace' }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
              </div>
            </div>
          </div>

          {/* ════ LEFT SIDEBAR ISLAND ════ */}
          <div style={{
            gridColumn: '1',
            gridRow: '2',
            ...glass(0.07, 50),
            borderRight: '1px solid rgba(255,255,255,0.07)',
            borderTop: 'none', borderLeft: 'none', borderBottom: 'none', borderRadius: 0,
            display: 'flex', flexDirection: 'column',
            overflowY: 'auto', padding: '18px 14px',
          }}>

            {/* Model */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>YOLO Model</div>
              <GlassSelect
                value={selectedModel}
                onChange={setSelectedModel}
                options={modelsLoading ? [{ value: '', label: 'Loading...' }] : models.map(m => ({ value: m.id, label: m.label }))}
                disabled={isRunning || modelsLoading}
              />
            </div>

            {/* Upload */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>Upload Videos</div>
              <UploadZone files={files} onFiles={setFiles} />
            </div>

            {/* Lethargic Detection */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>Lethargic Detection</div>
              <div style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.3)', marginBottom: 8, lineHeight: 1.6, fontFamily: 'DM Sans, sans-serif' }}>
                Set minimum velocity. New analyses calculate automatically; restored analyses require manual trigger.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <NumInput value={velocityThreshold} onChange={setVelocityThreshold} placeholder="e.g. 5" disabled={isRunning} />
                <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.25)', flexShrink: 0, fontFamily: 'IBM Plex Mono, monospace' }}>px/s</span>
              </div>

              <button onClick={calculateThresholdOnCurrentResult} disabled={!canCalculateThreshold} style={{
                width: '100%', padding: '8px 0',
                background: canCalculateThreshold ? 'rgba(248,113,113,0.1)' : 'rgba(255,255,255,0.04)',
                color: canCalculateThreshold ? '#f87171' : 'rgba(255,255,255,0.2)',
                border: `1px solid ${canCalculateThreshold ? 'rgba(248,113,113,0.3)' : 'rgba(255,255,255,0.07)'}`,
                borderRadius: 8, fontSize: 10.5, fontWeight: 600, cursor: canCalculateThreshold ? 'pointer' : 'not-allowed',
                transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
              }}>
                <Icons.AlertTriangle size={10} color={canCalculateThreshold ? '#f87171' : 'rgba(255,255,255,0.2)'} />
                Calculate Threshold
              </button>

              {velocityThreshold > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6 }}>
                  <span style={{ fontSize: 9.5, color: 'rgba(248,113,113,0.7)', fontFamily: 'IBM Plex Mono, monospace' }}>alert &lt; {velocityThreshold}px/s</span>
                  <button onClick={() => { setVelocityThreshold(0); setThresholdAlerts([]); setThresholdAlertDismissed(false) }}
                    style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 10, fontFamily: 'DM Sans, sans-serif' }}>clear</button>
                </div>
              )}
            </div>

            {/* Display */}
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: '0.14em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)', marginBottom: 8, fontFamily: 'DM Sans, sans-serif' }}>Display</div>
              <Toggle value={smoothing} onChange={setSmoothing} label={`Rolling avg (${SMOOTHING_WINDOW}-frame)`} />
            </div>

            {/* Progress */}
            {isRunning && (
              <div style={{ marginBottom: 14 }}>
                {status === 'uploading' && <ProgressBar value={uploadPct} label="Uploading..." color="#f59e0b" />}
                {status === 'analyzing' && <ProgressBar value={analyzePct} label="Inference..." color="#2dd4bf" />}
              </div>
            )}

            {/* Warnings */}
            {error && (
              <div style={{ background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', borderRadius: 8, padding: '8px 10px', fontSize: 10.5, color: '#f87171', marginBottom: 12, fontFamily: 'IBM Plex Mono, monospace', wordBreak: 'break-word' }}>
                {error}
              </div>
            )}
            {hasDummy && (
              <div style={{ background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.25)', borderRadius: 8, padding: '8px 10px', fontSize: 10.5, color: '#f59e0b', marginBottom: 12, fontFamily: 'IBM Plex Mono, monospace' }}>
                No YOLO model found. Charts show dummy data.
              </div>
            )}

            {/* Spacer + CTA */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 7 }}>
              <button onClick={runAnalysis} disabled={isRunning || !files.length} style={{
                width: '100%', padding: '11px 0',
                background: isRunning || !files.length
                  ? 'rgba(255,255,255,0.05)'
                  : 'linear-gradient(135deg, rgba(45,212,191,0.85), rgba(20,184,166,0.9))',
                color: isRunning || !files.length ? 'rgba(255,255,255,0.25)' : '#051c1a',
                border: `1px solid ${isRunning || !files.length ? 'rgba(255,255,255,0.07)' : 'rgba(45,212,191,0.5)'}`,
                borderRadius: 10, fontSize: 12, fontWeight: 700,
                cursor: isRunning || !files.length ? 'not-allowed' : 'pointer',
                transition: 'all 0.15s', fontFamily: 'DM Sans, sans-serif',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
                boxShadow: isRunning || !files.length ? 'none' : '0 4px 20px rgba(45,212,191,0.25)',
              }}>
                {isRunning ? (
                  <><div style={{ width: 11, height: 11, border: '1.5px solid rgba(255,255,255,0.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />Processing...</>
                ) : (
                  <><Icons.Play size={11} color="#051c1a" /> Run Analysis</>
                )}
              </button>
              {isRunning && (
                <button onClick={cancelAnalysis} style={{
                  width: '100%', padding: '7px 0', background: 'none',
                  border: '1px solid rgba(248,113,113,0.3)', borderRadius: 8, color: '#f87171',
                  fontSize: 11, cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                }}>
                  <Icons.X size={10} color="#f87171" /> Cancel
                </button>
              )}
            </div>
          </div>

          {/* ════ MAIN CONTENT ════ */}
          <div style={{
            gridColumn: '2', gridRow: '2',
            overflowY: 'auto', padding: '18px 18px 18px 14px',
            display: 'flex', flexDirection: 'column', gap: 14,
          }}>

            {/* Tab bar island */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <TabBar
                tabs={[
                  { id: 'analytics', label: `Analytics${showThresholdAlerts ? ' ·' : ''}` },
                  { id: 'metrics', label: 'Metrics' },
                  { id: 'history', label: 'History' },
                  { id: 'log', label: 'System Log' },
                ]}
                active={activeTab}
                onChange={setActiveTab}
              />
              {result && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {result.videos.map((v, i) => (
                    <button key={i} onClick={() => downloadCsv(result.job_id, v.video_id)} style={{
                      ...glass(0.06, 20), borderRadius: 7, border: '1px solid rgba(255,255,255,0.08)',
                      color: 'rgba(255,255,255,0.4)', fontSize: 10, padding: '5px 10px', cursor: 'pointer',
                      fontFamily: 'IBM Plex Mono, monospace', display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all 0.15s',
                    }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(45,212,191,0.3)'; e.currentTarget.style.color = '#2dd4bf' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.08)'; e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}>
                      <Icons.Download size={9} /> CSV {i + 1}
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* ── ANALYTICS TAB ── */}
            {activeTab === 'analytics' && (
              <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {!result ? (
                  <div style={{
                    ...glass(), borderRadius: 16,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                    padding: '60px 30px', textAlign: 'center',
                  }}>
                    <div style={{ opacity: 0.2, marginBottom: 16 }}><Icons.BarChart size={40} color="white" /></div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: 'rgba(255,255,255,0.5)', fontFamily: 'DM Sans, sans-serif', marginBottom: 6 }}>No Analysis Loaded</div>
                    <div style={{ fontSize: 11.5, color: 'rgba(255,255,255,0.25)', fontFamily: 'DM Sans, sans-serif' }}>Upload videos and run analysis, or restore a past job from History.</div>
                  </div>
                ) : (
                  <>
                    {showThresholdAlerts && (
                      <ThresholdAlertBanner alerts={thresholdAlerts} onDismiss={() => setThresholdAlertDismissed(true)} isRestored={isRestoredResult} />
                    )}

                    {/* Legend */}
                    {legend.length > 1 && (
                      <div style={{ display: 'flex', gap: 14, fontSize: 10.5, color: 'rgba(255,255,255,0.4)', fontFamily: 'IBM Plex Mono, monospace' }}>
                        {legend.map((l, i) => (
                          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <span style={{ width: 18, height: 2, background: l.color, borderRadius: 1, display: 'inline-block' }} />
                            {shortName(l.label, 24)}
                          </span>
                        ))}
                      </div>
                    )}

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                      <ChartIsland
                        title="Shrimp Velocity"
                        subtitle={`avg movement · px/s${smoothing ? ' · smoothed' : ''}${activeVelocityThreshold > 0 ? ` · thr:${activeVelocityThreshold}` : ''}`}
                        expandContent={<LineChart datasets={result.videos} field="avg_velocity" unit="px/s" smoothing={smoothing} velocityThreshold={activeVelocityThreshold} expanded />}
                      >
                        <LineChart datasets={result.videos} field="avg_velocity" unit="px/s" smoothing={smoothing} velocityThreshold={activeVelocityThreshold} expanded={false} />
                      </ChartIsland>

                      <ChartIsland
                        title="Clustering Score"
                        subtitle={`spatial density · %${smoothing ? ' · smoothed' : ''}`}
                        expandContent={<LineChart datasets={result.videos} field="clustering_percent" unit="%" smoothing={smoothing} velocityThreshold={0} expanded />}
                      >
                        <LineChart datasets={result.videos} field="clustering_percent" unit="%" smoothing={smoothing} velocityThreshold={0} expanded={false} />
                      </ChartIsland>
                    </div>

                    {/* Delta Metrics (2 video comparison) */}
                    {result.videos.length === 2 && (
                      <div style={{ ...glass(), borderRadius: 14, padding: '14px 16px' }}>
                        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 12, fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>Delta Metrics — V2 vs V1</div>
                        <div style={{ display: 'flex', gap: 20 }}>
                          {[
                            { label: 'Velocity Δ', val: (result.videos[1].summary.avg_velocity - result.videos[0].summary.avg_velocity).toFixed(2), unit: 'px/s' },
                            { label: 'Clustering Δ', val: (result.videos[1].summary.avg_clustering_percent - result.videos[0].summary.avg_clustering_percent).toFixed(2), unit: '%' },
                            { label: 'Peak Vel Δ', val: (result.videos[1].summary.max_velocity - result.videos[0].summary.max_velocity).toFixed(2), unit: 'px/s' },
                          ].map(d => {
                            const pos = parseFloat(d.val) >= 0
                            return (
                              <div key={d.label}>
                                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: 'DM Sans, sans-serif' }}>{d.label}</div>
                                <div style={{ fontSize: 22, fontWeight: 700, color: pos ? '#2dd4bf' : '#f87171', fontFamily: 'IBM Plex Mono, monospace', lineHeight: 1 }}>
                                  {pos ? '+' : ''}{d.val}
                                  <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginLeft: 3, fontWeight: 400 }}>{d.unit}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    )}

                    {/* Job info */}
                    <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.2)', fontFamily: 'IBM Plex Mono, monospace', display: 'flex', gap: 12, alignItems: 'center' }}>
                      <span>job: {result.job_id}</span>
                      <span>model: {result.selected_model}</span>
                      {isRestoredResult && <span style={{ color: '#60a5fa' }}>↩ restored</span>}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* ── METRICS TAB ── */}
            {activeTab === 'metrics' && (
              <div className="fade-up" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {!result ? (
                  <div style={{ ...glass(), borderRadius: 14, padding: '30px 20px', textAlign: 'center' }}>
                    <div style={{ color: 'rgba(255,255,255,0.25)', fontSize: 12, fontFamily: 'IBM Plex Mono, monospace' }}>// run analysis to see metrics</div>
                  </div>
                ) : (
                  result.videos.map((v, i) => (
                    <div key={i} style={{ ...glass(), borderRadius: 14, padding: '16px' }}>
                      <VideoSummaryCards video={v} accent={SERIES_COLORS[i % SERIES_COLORS.length].line} />
                    </div>
                  ))
                )}
              </div>
            )}

            {/* ── HISTORY TAB ── */}
            {activeTab === 'history' && (
              <div className="fade-up">
                <div style={{ ...glass(), borderRadius: 14, padding: '16px 18px', overflow: 'hidden' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                    <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', fontFamily: 'DM Sans, sans-serif' }}>Previous analysis sessions</div>
                    <button onClick={fetchPastJobs} disabled={pastLoading} style={{
                      background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                      borderRadius: 7, color: 'rgba(255,255,255,0.5)', fontSize: 10.5, padding: '5px 12px',
                      cursor: 'pointer', fontFamily: 'DM Sans, sans-serif',
                      display: 'flex', alignItems: 'center', gap: 5,
                    }}>
                      <Icons.RefreshCw size={10} /> {pastLoading ? 'Loading...' : 'Refresh'}
                    </button>
                  </div>
                  <PastJobsTable jobs={pastJobs} onRestore={handleRestore} />
                </div>
              </div>
            )}

            {/* ── LOG TAB ── */}
            {activeTab === 'log' && (
              <div className="fade-up">
                <div style={{ ...glass(), borderRadius: 14, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <Icons.Terminal size={12} color="rgba(45,212,191,0.7)" />
                      <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em', textTransform: 'uppercase', fontFamily: 'DM Sans, sans-serif', fontWeight: 600 }}>System Log</span>
                    </div>
                    {logEntries.length > 0 && (
                      <button onClick={() => setLogEntries([])} style={{
                        background: 'none', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5,
                        color: 'rgba(255,255,255,0.3)', fontSize: 10, padding: '3px 9px', cursor: 'pointer',
                        fontFamily: 'DM Sans, sans-serif',
                      }}>Clear</button>
                    )}
                  </div>
                  <AlertLog entries={logEntries} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}