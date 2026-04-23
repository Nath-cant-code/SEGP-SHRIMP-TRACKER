/**
 * ShrimpDashboard.jsx
 *
 * Changes vs previous version
 * ----------------------------
 * 1. On mount, fetches GET /results to find the most recent job, then calls
 *    GET /results/{job_id} to restore timeseries + summary so charts survive
 *    a page reload.
 * 2. Stores the last job_id in sessionStorage so a hard-refresh within the
 *    same tab also restores cleanly.
 * 3. Shows a small "⚠ dummy data" badge on cards when the backend fell back
 *    to generated data (real inference unavailable).
 */

import { useState, useEffect, useRef, useCallback, createContext, useContext } from 'react'

const BASE_URL = ''
const MAX_VIDEOS = 3
const ALLOWED_TYPES = ['video/mp4', 'video/avi', 'video/quicktime', 'video/x-msvideo', 'video/x-matroska']
const SMOOTHING_WINDOW = 7

const ThemeContext = createContext({ dark: true, toggle: () => {} })
const useTheme = () => useContext(ThemeContext)

const DARK = {
  '--bg': '#090d16', '--surface': '#0f1623', '--card': '#131c2e',
  '--border': '#1a2740', '--border-hi': '#243553',
  '--text-pri': '#e2e8f0', '--text-sec': '#8fa3c0', '--text-muted': '#45607a',
  '--accent': '#14b8a6', '--accent-dim': '#0d9488', '--accent-faint': 'rgba(20,184,166,0.10)',
  '--amber': '#f59e0b', '--amber-faint': 'rgba(245,158,11,0.09)',
  '--coral': '#f87171', '--coral-faint': 'rgba(248,113,113,0.09)',
  '--blue': '#60a5fa', '--blue-faint': 'rgba(96,165,250,0.09)',
  '--success': '#34d399', '--warn': '#fbbf24', '--err': '#f87171',
  '--scrollbar': '#1a2740',
}

const LIGHT = {
  '--bg': '#f0f4f9', '--surface': '#ffffff', '--card': '#ffffff',
  '--border': '#d8e3ef', '--border-hi': '#b8cce0',
  '--text-pri': '#0f1f35', '--text-sec': '#4a6484', '--text-muted': '#8fa3c0',
  '--accent': '#0d9488', '--accent-dim': '#0f766e', '--accent-faint': 'rgba(13,148,136,0.08)',
  '--amber': '#b45309', '--amber-faint': 'rgba(180,83,9,0.07)',
  '--coral': '#dc2626', '--coral-faint': 'rgba(220,38,38,0.07)',
  '--blue': '#2563eb', '--blue-faint': 'rgba(37,99,235,0.07)',
  '--success': '#059669', '--warn': '#d97706', '--err': '#dc2626',
  '--scrollbar': '#c5d5e8',
}

function applyTheme(tokens) {
  const root = document.documentElement
  Object.entries(tokens).forEach(([k, v]) => root.style.setProperty(k, v))
}

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
    xhr.ontimeout = () => reject(new Error('Request timed out after 5 minutes'))
    xhr.timeout = 300_000

    if (signal) signal.addEventListener('abort', () => xhr.abort())
    xhr.send(formData)
  })
}

const SERIES_COLORS = [
  { line: '#14b8a6', dash: false },
  { line: '#f59e0b', dash: true  },
  { line: '#f87171', dash: true  },
]

// ─── Sub-components (unchanged from previous version) ────────────────────────

function LineChart({ datasets, field, unit, smoothing }) {
  const { dark } = useTheme()
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)

  const W = 560, H = 190
  const PAD = { t: 14, r: 12, b: 34, l: 50 }
  const IW = W - PAD.l - PAD.r
  const IH = H - PAD.t - PAD.b

  const processed = datasets.map((ds, di) => {
    const raw = ds.timeseries.map(p => p[field])
    const vals = smoothing ? rollingAvg(raw, SMOOTHING_WINDOW) : raw
    return { ...ds, vals, color: SERIES_COLORS[di % SERIES_COLORS.length] }
  })

  const allVals = processed.flatMap(p => p.vals).filter(v => v != null)
  const allTimes = processed.flatMap(p => p.timeseries.map(x => x.time_sec))

  if (!allVals.length || !allTimes.length) {
    return (
      <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: 13 }}>
        No data
      </div>
    )
  }

  const minV = Math.min(...allVals), maxV = Math.max(...allVals)
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

  const Y_TICKS = 5, X_TICKS = 5
  const gridVals = Array.from({ length: Y_TICKS + 1 }, (_, i) => minV + (rangeV * i / Y_TICKS))
  const gridTimes = Array.from({ length: X_TICKS + 1 }, (_, i) => minT + (rangeT * i / X_TICKS))
  const textFill = dark ? '#45607a' : '#8fa3c0'
  const gridStroke = dark ? '#1a2740' : '#e2eaf4'

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
      }
    })
    setHover(hoverData)
  }, [processed, minT, rangeT, IW, PAD.l])

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg ref={svgRef} viewBox={`0 0 ${W} ${H}`}
        style={{ width: '100%', display: 'block', cursor: 'crosshair' }}
        onMouseMove={onMouseMove} onMouseLeave={() => setHover(null)}>
        <defs>
          {processed.map((ds, di) => (
            <linearGradient key={di} id={`grad-${field}-${di}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ds.color.line} stopOpacity={ds.color.dash ? 0.08 : 0.15} />
              <stop offset="100%" stopColor={ds.color.line} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>
        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={ty(v)} x2={W - PAD.r} y2={ty(v)} stroke={gridStroke} strokeWidth="0.6" />
            <text x={PAD.l - 6} y={ty(v) + 4} textAnchor="end" fill={textFill} fontSize="10" fontFamily="monospace">
              {v.toFixed(0)}
            </text>
          </g>
        ))}
        {gridTimes.map((t, i) => (
          <text key={i} x={tx(t)} y={H - PAD.b + 13} textAnchor="middle" fill={textFill} fontSize="10" fontFamily="monospace">
            {t.toFixed(1)}s
          </text>
        ))}
        <text x={-H / 2} y={15} transform="rotate(-90)" textAnchor="middle" fill={textFill} fontSize="10" fontFamily="monospace">
          {unit}
        </text>
        {processed.map((ds, di) => {
          const path = buildPath(ds)
          const lastPt = ds.timeseries[ds.timeseries.length - 1]
          const firstPt = ds.timeseries[0]
          return (
            <g key={di}>
              <path d={`${path} L${tx(lastPt.time_sec)},${PAD.t + IH} L${tx(firstPt.time_sec)},${PAD.t + IH} Z`}
                fill={`url(#grad-${field}-${di})`} />
              <path d={path} fill="none" stroke={ds.color.line} strokeWidth="1.8"
                strokeDasharray={ds.color.dash ? '6 3' : undefined}
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}
        {hover && (
          <>
            <line x1={hover[0].x} y1={PAD.t} x2={hover[0].x} y2={PAD.t + IH}
              stroke={textFill} strokeWidth="0.8" strokeDasharray="3 2" />
            {hover.map((h, i) => h.val != null && (
              <circle key={i} cx={h.x} cy={h.y} r="4" fill={h.color}
                stroke={dark ? '#090d16' : '#ffffff'} strokeWidth="1.5" />
            ))}
          </>
        )}
      </svg>
      {hover && (
        <div style={{
          position: 'absolute', top: 6, right: 8,
          background: 'var(--surface)', border: '1px solid var(--border-hi)',
          borderRadius: 8, padding: '8px 12px', fontSize: 11.5, lineHeight: 1.8,
          pointerEvents: 'none', fontFamily: 'monospace', color: 'var(--text-sec)',
          minWidth: 170, boxShadow: '0 4px 16px rgba(0,0,0,0.2)',
        }}>
          <div style={{ color: 'var(--text-muted)', marginBottom: 3, fontSize: 10 }}>
            t = {hover[0]?.time.toFixed(2)}s
          </div>
          {hover.map((h, i) => h.val != null && (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: h.color, display: 'inline-block', flexShrink: 0 }} />
              <span style={{ color: 'var(--text-pri)', fontWeight: 500 }}>{h.val.toFixed(2)}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10 }}>{unit}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, marginLeft: 'auto', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {shortName(h.label, 14)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function MetricCard({ label, value, unit, accent }) {
  return (
    <div style={{
      background: 'var(--card)', border: '1px solid var(--border)',
      borderRadius: 10, padding: '14px 16px', flex: 1, minWidth: 0,
      transition: 'border-color 0.2s',
    }}
      onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
      onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}
    >
      <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 6, letterSpacing: '0.08em', textTransform: 'uppercase' }}>{label}</div>
      <div style={{ fontSize: 21, fontWeight: 600, color: accent || 'var(--text-pri)', letterSpacing: '-0.02em', fontFamily: 'monospace', lineHeight: 1 }}>
        {value}
        {unit && <span style={{ fontSize: 11, fontWeight: 400, color: 'var(--text-muted)', marginLeft: 4 }}>{unit}</span>}
      </div>
    </div>
  )
}

function AlertLog({ entries }) {
  const ref = useRef(null)
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [entries])
  const colorMap = { info: 'var(--text-sec)', ok: 'var(--success)', warn: 'var(--warn)', err: 'var(--err)' }
  return (
    <div ref={ref} style={{ height: 180, overflowY: 'auto', fontFamily: 'monospace', fontSize: 11.5, lineHeight: 1.9 }}>
      {entries.length === 0 && (
        <div style={{ color: 'var(--text-muted)', padding: '8px 0' }}>No activity yet — upload videos and run analysis to begin.</div>
      )}
      {entries.map((e, i) => (
        <div key={i} style={{ display: 'flex', gap: 10, padding: '2px 0', borderBottom: '1px solid var(--border)', color: colorMap[e.type] || 'var(--text-sec)' }}>
          <span style={{ color: 'var(--text-muted)', flexShrink: 0, fontSize: 10 }}>{e.ts}</span>
          <span style={{ wordBreak: 'break-word' }}>{e.msg}</span>
          {e.code && <span style={{ marginLeft: 'auto', flexShrink: 0, color: 'var(--text-muted)', fontSize: 10 }}>[{e.code}]</span>}
        </div>
      ))}
    </div>
  )
}

function UploadZone({ files, onFiles }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const validate = (fileList) => {
    const arr = Array.from(fileList)
    const valid = arr.filter(f => ALLOWED_TYPES.includes(f.type) || f.name.match(/\.(mp4|avi|mov|mkv)$/i))
    if (valid.length !== arr.length) alert('Some files were skipped — only MP4, AVI, MOV, MKV are supported.')
    const slots = MAX_VIDEOS - files.length
    if (valid.length > slots) {
      alert(`Maximum ${MAX_VIDEOS} videos allowed. Only the first ${slots} will be added.`)
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
          border: `1.5px dashed ${dragging ? 'var(--accent)' : 'var(--border)'}`,
          borderRadius: 8, padding: '16px 12px', textAlign: 'center', cursor: 'pointer',
          background: dragging ? 'var(--accent-faint)' : 'transparent',
          transition: 'all 0.15s',
        }}>
        <div style={{ fontSize: 22, marginBottom: 6 }}>📂</div>
        <div style={{ fontSize: 12, color: 'var(--text-sec)', fontWeight: 500 }}>Click or drag videos here</div>
        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 3 }}>MP4 · AVI · MOV · MKV — up to {MAX_VIDEOS} files</div>
        <input ref={inputRef} type="file" accept="video/*" multiple hidden onChange={onPick} />
      </div>
      {files.length > 0 && (
        <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}>
          {files.map((f, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'var(--surface)', borderRadius: 6, padding: '6px 10px', border: '1px solid var(--border)', fontSize: 12 }}>
              <span style={{ color: 'var(--accent)', fontFamily: 'monospace', fontSize: 10 }}>V{i + 1}</span>
              <span style={{ color: 'var(--text-sec)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.name}</span>
              <span style={{ color: 'var(--text-muted)', fontSize: 10, flexShrink: 0 }}>{(f.size / 1e6).toFixed(1)}MB</span>
              <button onClick={(e) => { e.stopPropagation(); onFiles(files.filter((_, idx) => idx !== i)) }}
                style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14, lineHeight: 1, padding: 0 }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function ProgressBar({ value, label, color }) {
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)', marginBottom: 5 }}>
        <span>{label}</span>
        <span style={{ fontFamily: 'monospace' }}>{value}%</span>
      </div>
      <div style={{ height: 5, background: 'var(--border)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${value}%`, background: color || 'var(--accent)', borderRadius: 3, transition: 'width 0.25s ease' }} />
      </div>
    </div>
  )
}

function VideoSummaryCards({ video, accent }) {
  const s = video.summary
  const isDummy = video.used_dummy_data ?? video._used_dummy_data ?? false
  return (
    <div>
      <div style={{ fontSize: 11, color: accent, fontWeight: 600, letterSpacing: '0.07em', textTransform: 'uppercase', marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>
        {video.video_name}
        {isDummy && (
          <span style={{ fontSize: 9, background: 'var(--amber-faint)', color: 'var(--amber)', border: '1px solid var(--amber)', borderRadius: 4, padding: '1px 6px', fontWeight: 600, letterSpacing: '0.08em' }}>
            ⚠ DUMMY DATA — no model available
          </span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <MetricCard label="Avg Velocity" value={s.avg_velocity.toFixed(1)} unit="px/s" accent={accent} />
        <MetricCard label="Peak Velocity" value={s.max_velocity.toFixed(1)} unit="px/s" />
        <MetricCard label="Avg Clustering" value={s.avg_clustering_percent.toFixed(1)} unit="%" />
        <MetricCard label="Frames" value={s.frames_processed} />
        <MetricCard label="Est. Shrimp" value={s.shrimp_count_estimate} />
      </div>
    </div>
  )
}

function Sel({ value, onChange, options, disabled, style }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6,
        color: disabled ? 'var(--text-muted)' : 'var(--text-pri)', fontSize: 13,
        padding: '7px 28px 7px 10px', appearance: 'none',
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='%238fa3c0'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat', backgroundPosition: 'calc(100% - 10px) center',
        cursor: disabled ? 'not-allowed' : 'pointer', outline: 'none',
        transition: 'border-color 0.15s',
        ...style,
      }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border)'}
    >
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  )
}

function Toggle({ value, onChange, label }) {
  return (
    <button onClick={() => onChange(!value)} style={{ display: 'flex', alignItems: 'center', gap: 8, background: 'none', border: 'none', cursor: 'pointer', color: value ? 'var(--accent)' : 'var(--text-muted)', fontSize: 12.5, padding: '5px 0', transition: 'color 0.15s' }}>
      <span style={{ width: 32, height: 17, borderRadius: 9, background: value ? 'var(--accent)' : 'var(--border)', position: 'relative', display: 'inline-block', transition: 'background 0.2s', flexShrink: 0 }}>
        <span style={{ position: 'absolute', top: 2, left: value ? 17 : 2, width: 13, height: 13, borderRadius: '50%', background: '#fff', transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.3)' }} />
      </span>
      {label}
    </button>
  )
}

function SideSection({ label, children }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: 10 }}>{label}</div>
      {children}
    </div>
  )
}

function TabBar({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
      {tabs.map(t => (
        <button key={t.id} onClick={() => onChange(t.id)} style={{
          background: 'none', border: 'none',
          borderBottom: active === t.id ? '2px solid var(--accent)' : '2px solid transparent',
          color: active === t.id ? 'var(--accent)' : 'var(--text-muted)',
          fontSize: 12.5, fontWeight: 500, padding: '8px 14px', cursor: 'pointer',
          marginBottom: -1, transition: 'color 0.15s', fontFamily: 'inherit',
        }}>{t.label}</button>
      ))}
    </div>
  )
}

function PastJobsTable({ jobs, onRestore }) {
  if (!jobs.length) return (
    <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '16px 0' }}>
      No past analyses found. Run your first analysis above.
    </div>
  )
  const cellSty = { padding: '10px 12px', borderBottom: '1px solid var(--border)', fontSize: 12.5, color: 'var(--text-sec)' }
  const hdSty = { ...cellSty, color: 'var(--text-muted)', fontSize: 10.5, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Job ID', 'Created', 'Model', 'Videos', ''].map(h => <th key={h} style={hdSty}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <tr key={j.job_id}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--surface)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}>
              <td style={{ ...cellSty, fontFamily: 'monospace', color: 'var(--accent)', fontSize: 11 }}>{j.job_id}</td>
              <td style={cellSty}>{new Date(j.created_at).toLocaleString()}</td>
              <td style={cellSty}>{j.selected_model}</td>
              <td style={cellSty}>{j.video_count}</td>
              <td style={cellSty}>
                <button onClick={() => onRestore(j.job_id)} style={{
                  background: 'none', border: '1px solid var(--border)', borderRadius: 5,
                  color: 'var(--accent)', fontSize: 11, padding: '4px 10px', cursor: 'pointer',
                  fontFamily: 'inherit', transition: 'border-color 0.15s',
                }}>↩ Restore</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function ChartCard({ title, subtitle, children }) {
  return (
    <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 16px 12px' }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-pri)' }}>{title}</div>
        {subtitle && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{subtitle}</div>}
      </div>
      {children}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    idle:      { label: 'IDLE',      bg: 'rgba(69,96,122,0.25)', c: 'var(--text-muted)' },
    uploading: { label: 'UPLOADING', bg: 'var(--amber-faint)',    c: 'var(--amber)' },
    analyzing: { label: 'ANALYZING', bg: 'var(--accent-faint)',   c: 'var(--accent)' },
    done:      { label: 'READY',     bg: 'rgba(52,211,153,0.12)', c: 'var(--success)' },
    error:     { label: 'ERROR',     bg: 'var(--coral-faint)',    c: 'var(--err)' },
    restoring: { label: 'RESTORING', bg: 'var(--blue-faint)',     c: 'var(--blue)' },
  }
  const { label, bg, c } = map[status] || map.idle
  return (
    <span style={{ background: bg, color: c, fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', padding: '3px 10px', borderRadius: 4, fontFamily: 'monospace', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
      {(status === 'analyzing' || status === 'restoring') && <span style={{ display: 'inline-block', width: 6, height: 6, borderRadius: '50%', background: c, animation: 'shrimpPulse 1.1s ease-in-out infinite' }} />}
      {label}
    </span>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function ShrimpDashboard() {
  const [dark, setDark] = useState(true)
  useEffect(() => { applyTheme(dark ? DARK : LIGHT) }, [dark])

  const [models, setModels] = useState([])
  const [modelsLoading, setModelsLoading] = useState(true)
  const [selectedModel, setSelectedModel] = useState('')

  const [files, setFiles] = useState([])
  const [uploadPct, setUploadPct] = useState(0)
  const [analyzePct, setAnalyzePct] = useState(0)
  const [status, setStatus] = useState('idle')
  const [result, setResult] = useState(null)
  const [error, setError] = useState('')

  const [pastJobs, setPastJobs] = useState([])
  const [pastLoading, setPastLoading] = useState(false)

  const [smoothing, setSmoothing] = useState(false)
  const [activeTab, setActiveTab] = useState('graphs')
  const [alerts, setAlerts] = useState([])

  const abortRef = useRef(null)

  const log = useCallback((msg, type = 'info', code) => {
    const ts = new Date().toLocaleTimeString('en-GB', { hour12: false })
    setAlerts(a => [...a.slice(-99), { ts, msg, type, code }])
  }, [])

  // ── Restore last job from sessionStorage on mount ──────────────────────────
  const restoreJob = useCallback(async (jobId) => {
    if (!jobId) return
    setStatus('restoring')
    log(`Restoring previous session: ${jobId}`, 'info')
    try {
      const res = await fetch(`${BASE_URL}/results/${jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data)
      setStatus('done')
      log(`Session restored: ${data.videos.length} video(s) from job ${jobId}`, 'ok')
    } catch (e) {
      setStatus('idle')
      log(`Could not restore session: ${e.message}`, 'warn')
      sessionStorage.removeItem('lastJobId')
    }
  }, [log])

  // Fetch models on mount, then try to restore last session
  useEffect(() => {
    ;(async () => {
      try {
        const res = await fetch(`${BASE_URL}/models`)
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const data = await res.json()
        setModels(data.models || [])
        if (data.models?.length) {
          setSelectedModel(data.models[0].id)
        } else {
          setSelectedModel('')
          log('Backend is running, but no .pt model files were found in backend/models.', 'warn')
        }
        log(`Loaded ${data.models.length} model(s) from server`, 'ok', 200)
      } catch (e) {
        log(`Could not reach backend: ${e.message}. Is it running on port 8000?`, 'err')
        const fallback = [
          { id: 'best', label: 'Best Trained Model' },
          { id: 'yolov8n', label: 'YOLOv8 Nano' },
        ]
        setModels(fallback)
        setSelectedModel(fallback[0].id)
      } finally {
        setModelsLoading(false)
      }

      // Try to restore last session
      const lastJobId = sessionStorage.getItem('lastJobId')
      if (lastJobId) {
        await restoreJob(lastJobId)
      }
    })()
  }, [log, restoreJob])

  const fetchPastJobs = useCallback(async () => {
    setPastLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/results`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPastJobs(data.results || [])
      log(`Fetched ${data.results.length} past job(s)`, 'info', 200)
    } catch (e) {
      log(`Could not load history: ${e.message}`, 'warn')
    } finally {
      setPastLoading(false)
    }
  }, [log])

  useEffect(() => { fetchPastJobs() }, [fetchPastJobs])

  const runAnalysis = useCallback(async () => {
    if (!files.length) { log('Please select at least one video file.', 'warn'); return }
    if (!selectedModel) { log('Please select a YOLO model.', 'warn'); return }
    if (status === 'uploading' || status === 'analyzing') return

    setError(''); setResult(null); setUploadPct(0); setAnalyzePct(0)
    setStatus('uploading')
    log(`Starting analysis: model=${selectedModel}, videos=${files.map(f => f.name).join(', ')}`, 'info')

    const ctrl = new AbortController()
    abortRef.current = ctrl

    const fd = new FormData()
    fd.append('model_id', selectedModel)
    files.forEach(f => fd.append('videos', f, f.name))

    try {
      log('Uploading video(s) to server…', 'info')

      const data = await uploadWithProgress(fd, (pct) => {
        setUploadPct(pct)
        if (pct === 100) {
          log('Upload complete — running YOLO inference…', 'ok')
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
      setAnalyzePct(100)
      setStatus('done')
      setResult(data)

      // Persist job id so page reload can restore it
      sessionStorage.setItem('lastJobId', data.job_id)

      const dummyVideos = data.videos.filter(v => v.used_dummy_data ?? v._used_dummy_data)
      const dummyCount = dummyVideos.length
      if (dummyVideos.length > 0) {
        dummyVideos.forEach(v => {
          log(`Fallback reason for ${v.video_name}: ${v.warning || 'backend returned generated dummy metrics.'}`, 'warn')
        })
        log(`⚠ ${dummyCount} video(s) used dummy data — no YOLO model found at backend/models/. Place a .pt file there and uncomment ultralytics in requirements.txt.`, 'warn')
      }

      log(`Analysis complete. Job ID: ${data.job_id}`, 'ok', 200)
      data.videos.forEach(v => {
        log(`  → ${v.video_name}: avg vel=${v.summary.avg_velocity} px/s, avg cluster=${v.summary.avg_clustering_percent}%`, 'info')
      })
      fetchPastJobs()
    } catch (e) {
      if (abortRef.current?._inferIv) clearInterval(abortRef.current._inferIv)
      if (e.name === 'AbortError') {
        setStatus('idle'); log('Analysis cancelled.', 'warn')
      } else {
        setStatus('error'); setError(e.message)
        log(`Error: ${e.message}`, 'err')
      }
    }
  }, [files, selectedModel, status, log, fetchPastJobs])

  const cancelAnalysis = () => {
    if (abortRef.current) {
      abortRef.current.abort()
      if (abortRef.current._inferIv) clearInterval(abortRef.current._inferIv)
    }
  }

  const downloadCsv = (jobId, videoId) => {
    window.open(`${BASE_URL}/results/${jobId}/${videoId}/csv`, '_blank')
    log(`Downloading CSV for ${videoId} (job ${jobId})`, 'info')
  }

  const handleRestore = useCallback(async (jobId) => {
    sessionStorage.setItem('lastJobId', jobId)
    await restoreJob(jobId)
    setActiveTab('graphs')
  }, [restoreJob])

  const legend = result?.videos?.map((v, i) => ({
    label: v.video_name,
    color: SERIES_COLORS[i % SERIES_COLORS.length].line,
    dash: SERIES_COLORS[i % SERIES_COLORS.length].dash,
  })) || []

  const isRunning = status === 'uploading' || status === 'analyzing'
  const hasDummy = result?.videos?.some(v => v.used_dummy_data ?? v._used_dummy_data)
  const fallbackWarnings = result?.videos
    ?.filter(v => v.used_dummy_data ?? v._used_dummy_data)
    .map(v => v.warning)
    .filter(Boolean) || []

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      <style>{`
        *, *::before, *::after { box-sizing: border-box; }
        body { background: var(--bg); color: var(--text-pri); font-family: system-ui, sans-serif; line-height: 1.6; -webkit-font-smoothing: antialiased; }
        select option { background: var(--surface); }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: var(--scrollbar); border-radius: 3px; }
        @keyframes shrimpPulse { 0%,100%{opacity:1}50%{opacity:0.3} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(8px)} to{opacity:1;transform:none} }
        .fade-up { animation: fadeUp 0.35s ease both; }
      `}</style>

      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

        {/* Header */}
        <header style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 54, flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{ width: 30, height: 30, borderRadius: 7, background: 'var(--accent-faint)', border: '1px solid var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 14 }}>🦐</div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, letterSpacing: '-0.01em' }}>ShrimpTracker</div>
              <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>Activity Detection System</div>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <StatusBadge status={status} />
            <button onClick={() => setDark(d => !d)} title="Toggle theme" style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-sec)', cursor: 'pointer', fontSize: 14, padding: '5px 9px', lineHeight: 1, transition: 'border-color 0.15s' }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--accent)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              {dark ? '☀' : '◐'}
            </button>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
              {new Date().toLocaleDateString('en-MY', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}
            </div>
          </div>
        </header>

        <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>

          {/* Sidebar */}
          <aside style={{ width: 268, flexShrink: 0, background: 'var(--surface)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflowY: 'auto', padding: '20px 16px' }}>

            <SideSection label="YOLO Model">
              <Sel value={selectedModel} onChange={setSelectedModel}
                options={modelsLoading
                  ? [{ value: '', label: 'Loading…' }]
                  : models.map(m => ({ value: m.id, label: m.label }))}
                disabled={isRunning || modelsLoading}
                style={{ width: '100%' }} />
            </SideSection>

            <SideSection label="Upload Videos (1–3)">
              <UploadZone files={files} onFiles={setFiles} />
            </SideSection>

            <SideSection label="Display">
              <Toggle value={smoothing} onChange={setSmoothing} label={`Rolling average (${SMOOTHING_WINDOW}-frame)`} />
            </SideSection>

            {isRunning && (
              <div style={{ marginBottom: 16 }}>
                {status === 'uploading' && <ProgressBar value={uploadPct} label="Uploading…" color="var(--amber)" />}
                {status === 'analyzing' && <ProgressBar value={analyzePct} label="Inference in progress…" color="var(--accent)" />}
              </div>
            )}

            {error && (
              <div style={{ background: 'var(--coral-faint)', border: '1px solid var(--err)', borderRadius: 6, padding: '8px 10px', fontSize: 11.5, color: 'var(--err)', marginBottom: 14, wordBreak: 'break-word' }}>
                ⚠ {error}
              </div>
            )}

            {/* Dummy data warning */}
            {hasDummy && (
              <div style={{ background: 'var(--amber-faint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '8px 10px', fontSize: 11, color: 'var(--amber)', marginBottom: 14 }}>
                <strong>Backend fallback active.</strong> Charts show generated dummy data.
                {fallbackWarnings.length > 0 && (
                  <span> {fallbackWarnings[0]}</span>
                )}
              </div>
            )}

            <div style={{ marginTop: 'auto', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <button onClick={runAnalysis} disabled={isRunning || !files.length} style={{
                width: '100%', padding: '12px 0',
                background: isRunning || !files.length ? 'var(--border)' : 'var(--accent)',
                color: isRunning || !files.length ? 'var(--text-muted)' : '#051c1a',
                border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 600,
                cursor: isRunning || !files.length ? 'not-allowed' : 'pointer',
                transition: 'background 0.15s, transform 0.1s', fontFamily: 'inherit',
              }}
                onMouseEnter={e => { if (!isRunning && files.length) e.currentTarget.style.transform = 'scale(1.01)' }}
                onMouseLeave={e => e.currentTarget.style.transform = 'scale(1)'}>
                {isRunning ? '⏳  Processing…' : '▶  Run Analysis'}
              </button>
              {isRunning && (
                <button onClick={cancelAnalysis} style={{ width: '100%', padding: '7px 0', background: 'none', border: '1px solid var(--err)', borderRadius: 6, color: 'var(--err)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  ✕ Cancel
                </button>
              )}
            </div>
          </aside>

          {/* Main */}
          <main style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>

            <TabBar
              tabs={[
                { id: 'graphs',  label: 'Analytics' },
                { id: 'metrics', label: 'Summary Metrics' },
                { id: 'history', label: 'History' },
                { id: 'log',     label: 'System Log' },
              ]}
              active={activeTab}
              onChange={setActiveTab}
            />

            {/* Analytics */}
            {activeTab === 'graphs' && (
              <div className="fade-up">
                {!result ? (
                  <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14 }}>
                    <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
                    <div>Upload videos and run analysis to see charts here.</div>
                    <div style={{ fontSize: 12, marginTop: 8 }}>Or restore a past job from the <strong>History</strong> tab.</div>
                  </div>
                ) : (
                  <>
                    {legend.length > 1 && (
                      <div style={{ display: 'flex', gap: 16, fontSize: 12, color: 'var(--text-sec)' }}>
                        {legend.map((l, i) => (
                          <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <span style={{ width: 22, height: 3, background: l.color, borderRadius: 2, display: 'inline-block' }} />
                            {shortName(l.label, 28)}
                          </span>
                        ))}
                      </div>
                    )}
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
                      <ChartCard title="Shrimp Velocity Over Time" subtitle={`Average movement speed (px/s)${smoothing ? ' — smoothed' : ''}`}>
                        <LineChart datasets={result.videos} field="avg_velocity" unit="px/s" smoothing={smoothing} />
                      </ChartCard>
                      <ChartCard title="Shrimp Clustering Over Time" subtitle={`Spatial clustering score (%)${smoothing ? ' — smoothed' : ''}`}>
                        <LineChart datasets={result.videos} field="clustering_percent" unit="%" smoothing={smoothing} />
                      </ChartCard>
                    </div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                      {result.videos.map((v, i) => (
                        <button key={i} onClick={() => downloadCsv(result.job_id, v.video_id)} style={{
                          background: 'none', border: '1px solid var(--border)', borderRadius: 6,
                          color: 'var(--text-sec)', fontSize: 12, padding: '7px 14px', cursor: 'pointer',
                          display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'inherit',
                          transition: 'border-color 0.15s, color 0.15s',
                        }}
                          onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.color = 'var(--accent)' }}
                          onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-sec)' }}>
                          ⬇ CSV — {shortName(v.video_name, 20)}
                        </button>
                      ))}
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                      Job: {result.job_id} · Model: {result.selected_model}
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Summary Metrics */}
            {activeTab === 'metrics' && (
              <div className="fade-up">
                {!result ? (
                  <div style={{ color: 'var(--text-muted)', fontSize: 13, padding: '24px 0' }}>Run analysis to populate metrics.</div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                    {result.videos.map((v, i) => (
                      <VideoSummaryCards key={i} video={v} accent={SERIES_COLORS[i % SERIES_COLORS.length].line} />
                    ))}
                    {result.videos.length === 2 && (
                      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 10, padding: '14px 18px' }}>
                        <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>Comparison delta (video 2 − video 1)</div>
                        <div style={{ display: 'flex', gap: 28 }}>
                          {[
                            { label: 'Velocity Δ', val: (result.videos[1].summary.avg_velocity - result.videos[0].summary.avg_velocity).toFixed(2), unit: 'px/s' },
                            { label: 'Clustering Δ', val: (result.videos[1].summary.avg_clustering_percent - result.videos[0].summary.avg_clustering_percent).toFixed(2), unit: '%' },
                            { label: 'Peak Vel. Δ', val: (result.videos[1].summary.max_velocity - result.videos[0].summary.max_velocity).toFixed(2), unit: 'px/s' },
                          ].map(d => (
                            <div key={d.label}>
                              <div style={{ fontSize: 10, color: 'var(--text-muted)', marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.07em' }}>{d.label}</div>
                              <div style={{ fontSize: 20, fontWeight: 600, color: parseFloat(d.val) >= 0 ? 'var(--success)' : 'var(--err)', fontFamily: 'monospace' }}>
                                {parseFloat(d.val) >= 0 ? '+' : ''}{d.val}
                                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginLeft: 3 }}>{d.unit}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {activeTab === 'history' && (
              <div className="fade-up">
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                  <div style={{ fontSize: 13, color: 'var(--text-sec)' }}>Previous analysis jobs saved in the database.</div>
                  <button onClick={fetchPastJobs} disabled={pastLoading} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 6, color: 'var(--text-sec)', fontSize: 12, padding: '6px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
                    {pastLoading ? 'Loading…' : '↺ Refresh'}
                  </button>
                </div>
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
                  <PastJobsTable jobs={pastJobs} onRestore={handleRestore} />
                </div>
              </div>
            )}

            {/* Log */}
            {activeTab === 'log' && (
              <div className="fade-up">
                <div style={{ background: 'var(--card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', letterSpacing: '0.07em', textTransform: 'uppercase', fontWeight: 600 }}>System & Backend Log</div>
                    {alerts.length > 0 && (
                      <button onClick={() => setAlerts([])} style={{ background: 'none', border: '1px solid var(--border)', borderRadius: 5, color: 'var(--text-muted)', fontSize: 11, padding: '4px 10px', cursor: 'pointer', fontFamily: 'inherit' }}>Clear</button>
                    )}
                  </div>
                  <AlertLog entries={alerts} />
                </div>
              </div>
            )}

          </main>
        </div>
      </div>
    </ThemeContext.Provider>
  )
}
