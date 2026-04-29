/**
 * ShrimpDashboard.jsx — Apple Spatial UI / "Living Glass" Edition
 *
 * Aesthetic: Apple visionOS-inspired "Floating Islands" over an ambient
 * background video. Light-first with dark-mode support.
 *
 * Stack additions (install if missing):
 *   npm install framer-motion
 *
 * All original business logic preserved intact.
 */

import {
  useState, useEffect, useRef, useCallback,
  createContext, useContext,
} from 'react'
import { motion, AnimatePresence } from 'framer-motion'

// ─── Constants ────────────────────────────────────────────────────────────────
const BASE_URL = ''
const MAX_VIDEOS = 3
const ALLOWED_TYPES = [
  'video/mp4', 'video/avi', 'video/quicktime',
  'video/x-msvideo', 'video/x-matroska',
]
const SMOOTHING_WINDOW = 7
const SERIES_COLORS = [
  { line: '#0A84FF', dash: false },
  { line: '#FF9F0A', dash: true },
  { line: '#FF453A', dash: true },
]

// ─── Theme Context ─────────────────────────────────────────────────────────────
const ThemeContext = createContext({ dark: false, toggle: () => {} })
const useTheme = () => useContext(ThemeContext)

// ─── Glass style generators ────────────────────────────────────────────────────
function glassLight() {
  return {
    background: 'rgba(255,255,255,0.62)',
    backdropFilter: 'blur(40px) saturate(180%)',
    WebkitBackdropFilter: 'blur(40px) saturate(180%)',
    border: '1px solid rgba(255,255,255,0.5)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.10), inset 0 1px 0 rgba(255,255,255,0.8)',
  }
}
function glassDark() {
  return {
    background: 'rgba(18,18,22,0.55)',
    backdropFilter: 'blur(40px) saturate(160%)',
    WebkitBackdropFilter: 'blur(40px) saturate(160%)',
    border: '1px solid rgba(255,255,255,0.10)',
    boxShadow: '0 20px 60px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)',
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function rollingAvg(arr, w) {
  return arr.map((_, i) => {
    const slice = arr.slice(Math.max(0, i - w + 1), i + 1).filter(v => v != null)
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null
  })
}
function shortName(name, max = 24) {
  return name && name.length > max ? name.slice(0, max - 1) + '…' : (name || '')
}
function uploadWithProgress(formData, onProgress, signal) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('POST', `${BASE_URL}/analyze`)
    xhr.upload.onprogress = e => {
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
    xhr.timeout = 1_200_000
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

// ─── SF-Symbol–style SVG Icons ────────────────────────────────────────────────
const Icon = {
  Waveform: ({ s = 15, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <path d="M2 12h2M6 6v12M10 9v6M14 4v16M18 7v10M22 12h-2" />
    </svg>
  ),
  Upload: ({ s = 15, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M17 8l-5-5-5 5M12 3v12" />
    </svg>
  ),
  Play: ({ s = 15, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill={c}><polygon points="5,3 19,12 5,21" /></svg>
  ),
  X: ({ s = 13, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.8" strokeLinecap="round">
      <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  ),
  Download: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4M7 10l5 5 5-5M12 15V3" />
    </svg>
  ),
  Clock: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" />
    </svg>
  ),
  Terminal: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="4 17 10 11 4 5" /><line x1="12" y1="19" x2="20" y2="19" />
    </svg>
  ),
  Alert: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  ),
  Expand: ({ s = 13, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M8 3H5a2 2 0 00-2 2v3m18 0V5a2 2 0 00-2-2h-3m0 18h3a2 2 0 002-2v-3M3 16v3a2 2 0 002 2h3" />
    </svg>
  ),
  Sun: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M2 12h2M20 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  ),
  Moon: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  ),
  Film: ({ s = 13, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="2" width="20" height="20" rx="2.18" />
      <line x1="7" y1="2" x2="7" y2="22" /><line x1="17" y1="2" x2="17" y2="22" />
      <line x1="2" y1="12" x2="22" y2="12" />
    </svg>
  ),
  Refresh: ({ s = 13, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
      <path d="M3.51 9a9 9 0 0114.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0020.49 15" />
    </svg>
  ),
  Chart: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" />
      <line x1="6" y1="20" x2="6" y2="14" /><line x1="2" y1="20" x2="22" y2="20" />
    </svg>
  ),
  Metrics: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <path d="M8 12h8M8 8h8M8 16h5" />
    </svg>
  ),
  Cpu: ({ s = 14, c = 'currentColor' }) => (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="1.5" strokeLinecap="round">
      <rect x="4" y="4" width="16" height="16" rx="2" /><rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" /><line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" /><line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" /><line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" /><line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
}

// ─── Motion variants ───────────────────────────────────────────────────────────
const islandVariants = {
  hidden: { opacity: 0, y: 24, scale: 0.97 },
  visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 90, damping: 18 } },
}
const stagger = { visible: { transition: { staggerChildren: 0.07 } } }
const tabContent = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 120, damping: 20 } },
  exit: { opacity: 0, y: -8, transition: { duration: 0.15 } },
}

// ─── Island wrapper ────────────────────────────────────────────────────────────
function Island({ children, style = {}, hover = true, className = '' }) {
  const { dark } = useTheme()
  const glass = dark ? glassDark() : glassLight()
  return (
    <motion.div
      variants={islandVariants}
      whileHover={hover ? { scale: 1.005, transition: { duration: 0.2 } } : {}}
      style={{
        ...glass,
        borderRadius: '2rem',
        ...style,
      }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

// ─── Label ────────────────────────────────────────────────────────────────────
function Label({ children, style = {} }) {
  const { dark } = useTheme()
  return (
    <div style={{
      fontSize: 10,
      fontWeight: 700,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.35)',
      fontFamily: "'SF Pro Display', 'Satoshi', system-ui, sans-serif",
      marginBottom: 7,
      ...style,
    }}>
      {children}
    </div>
  )
}

// ─── iOS Toggle ───────────────────────────────────────────────────────────────
function IOSToggle({ value, onChange, label }) {
  const { dark } = useTheme()
  return (
    <button
      onClick={() => onChange(!value)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'none', border: 'none', cursor: 'pointer',
        padding: '4px 0',
        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        fontSize: 13,
        color: dark ? 'rgba(255,255,255,0.75)' : 'rgba(0,0,0,0.75)',
      }}
    >
      <motion.span
        animate={{ background: value ? '#34C759' : (dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.15)') }}
        transition={{ duration: 0.2 }}
        style={{
          width: 42, height: 25, borderRadius: 13,
          display: 'flex', alignItems: 'center',
          padding: '0 3px', flexShrink: 0, position: 'relative',
        }}
      >
        <motion.span
          animate={{ x: value ? 17 : 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          style={{
            width: 19, height: 19, borderRadius: '50%',
            background: '#fff',
            boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
            display: 'block',
          }}
        />
      </motion.span>
      {label}
    </button>
  )
}

// ─── Squircle Select ──────────────────────────────────────────────────────────
function GlassSelect({ value, onChange, options, disabled }) {
  const { dark } = useTheme()
  return (
    <select
      value={value} onChange={e => onChange(e.target.value)} disabled={disabled}
      style={{
        width: '100%',
        background: dark ? '#1c1c1e' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 12,
        color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
        fontSize: 13,
        padding: '10px 32px 10px 12px',
        appearance: 'none',
        WebkitAppearance: 'none',
        MozAppearance: 'none',
        colorScheme: dark ? 'dark' : 'light',
        cursor: disabled ? 'not-allowed' : 'pointer',
        outline: 'none',
        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M0 0l5 6 5-6z' fill='${dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'}'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'calc(100% - 10px) center',
        transition: 'background 0.2s, border-color 0.15s',
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {options.map(o => (
        <option key={o.value} value={o.value}
          style={{ background: dark ? '#1c1c1e' : '#fff' }}>
          {o.label}
        </option>
      ))}
    </select>
  )
}

// ─── Number Input ─────────────────────────────────────────────────────────────
function GlassInput({ value, onChange, placeholder, disabled }) {
  const { dark } = useTheme()
  return (
    <input
      type="number" min="0" step="0.5"
      value={value || ''}
      onChange={e => onChange(Math.max(0, parseFloat(e.target.value) || 0))}
      placeholder={placeholder}
      disabled={disabled}
      style={{
        flex: 1,
        background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.04)',
        border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.12)'}`,
        borderRadius: 10, color: dark ? 'rgba(255,255,255,0.85)' : 'rgba(0,0,0,0.85)',
        fontSize: 13, padding: '9px 11px', outline: 'none',
        fontFamily: "'IBM Plex Mono', monospace",
        opacity: disabled ? 0.5 : 1,
        transition: 'border-color 0.15s',
      }}
    />
  )
}

// ─── Upload Zone ──────────────────────────────────────────────────────────────
function UploadZone({ files, onFiles }) {
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)
  const { dark } = useTheme()

  const validate = fileList => {
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

  return (
    <div>
      <motion.div
        whileTap={{ scale: 0.98 }}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => {
          e.preventDefault(); setDragging(false)
          const added = validate(e.dataTransfer.files)
          if (added.length) onFiles([...files, ...added])
        }}
        style={{
          border: `1.5px dashed ${dragging
            ? '#0A84FF'
            : dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.18)'}`,
          borderRadius: 16, padding: '16px 12px', textAlign: 'center',
          cursor: 'pointer',
          background: dragging
            ? 'rgba(10,132,255,0.06)'
            : dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.02)',
          transition: 'all 0.15s',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 7, opacity: 0.5 }}>
          <Icon.Upload s={20} c={dragging ? '#0A84FF' : (dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)')} />
        </div>
        <div style={{
          fontSize: 12.5, fontWeight: 500,
          color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)',
          fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        }}>
          Click or drop videos here
        </div>
        <div style={{
          fontSize: 10.5, marginTop: 3,
          color: dark ? 'rgba(255,255,255,0.28)' : 'rgba(0,0,0,0.3)',
          fontFamily: "'IBM Plex Mono', monospace",
        }}>
          mp4 · avi · mov · mkv — up to {MAX_VIDEOS}
        </div>
        <input ref={inputRef} type="file" accept="video/*" multiple hidden
          onChange={e => {
            const added = validate(e.target.files)
            if (added.length) onFiles([...files, ...added])
            e.target.value = ''
          }} />
      </motion.div>

      <AnimatePresence>
        {files.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 5 }}
          >
            {files.map((f, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  background: dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)',
                  borderRadius: 10, padding: '7px 10px',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)'}`,
                }}
              >
                <Icon.Film s={12} c={SERIES_COLORS[i % SERIES_COLORS.length].line} />
                <span style={{
                  flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  fontSize: 12,
                  color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.65)',
                  fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                }}>{f.name}</span>
                <span style={{
                  fontSize: 10, flexShrink: 0,
                  color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                  fontFamily: "'IBM Plex Mono', monospace",
                }}>{(f.size / 1e6).toFixed(1)}MB</span>
                <button
                  onClick={e => { e.stopPropagation(); onFiles(files.filter((_, idx) => idx !== i)) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer', padding: 0,
                    display: 'flex', opacity: 0.5,
                  }}>
                  <Icon.X s={11} c={dark ? '#fff' : '#000'} />
                </button>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Progress Bar ─────────────────────────────────────────────────────────────
function ProgressRing({ value, color = '#0A84FF', size = 48 }) {
  const r = 18, circ = 2 * Math.PI * r
  return (
    <svg width={size} height={size} viewBox="0 0 44 44" style={{ transform: 'rotate(-90deg)' }}>
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(0,0,0,0.06)" strokeWidth="3.5" />
      <motion.circle
        cx="22" cy="22" r={r} fill="none"
        stroke={color} strokeWidth="3.5"
        strokeLinecap="round"
        strokeDasharray={circ}
        animate={{ strokeDashoffset: circ * (1 - value / 100) }}
        transition={{ duration: 0.3 }}
      />
    </svg>
  )
}

// ─── Metric Chip ──────────────────────────────────────────────────────────────
function MetricChip({ label, value, unit, accent }) {
  const { dark } = useTheme()
  return (
    <div style={{
      background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
      border: `1px solid ${dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.07)'}`,
      borderRadius: 14, padding: '11px 14px', flex: 1, minWidth: 0,
    }}>
      <div style={{
        fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
        color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        marginBottom: 6,
      }}>{label}</div>
      <div style={{
        fontSize: 20, fontWeight: 700,
        color: accent || (dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)'),
        fontFamily: "'IBM Plex Mono', monospace",
        lineHeight: 1,
      }}>
        {value}
        {unit && <span style={{
          fontSize: 10, fontWeight: 400,
          color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
          marginLeft: 3,
        }}>{unit}</span>}
      </div>
    </div>
  )
}

// ─── Line Chart (custom SVG, no recharts) ─────────────────────────────────────
function LineChart({ datasets, field, unit, smoothing, velocityThreshold, expanded }) {
  const svgRef = useRef(null)
  const [hover, setHover] = useState(null)
  const { dark } = useTheme()

  const W = expanded ? 820 : 480
  const H = expanded ? 280 : 160
  const PAD = { t: 12, r: 12, b: 30, l: 44 }
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

  if (!allVals.length || !allTimes.length) return (
    <div style={{ height: H, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{
        fontSize: 11, fontFamily: "'IBM Plex Mono', monospace",
        color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      }}>no data</span>
    </div>
  )

  const minV = Math.min(...allVals, showThreshold ? velocityThreshold : Infinity)
  const maxV = Math.max(...allVals, showThreshold ? velocityThreshold : -Infinity)
  const minT = Math.min(...allTimes), maxT = Math.max(...allTimes)
  const rangeV = maxV - minV || 1, rangeT = maxT - minT || 1

  const tx = t => PAD.l + ((t - minT) / rangeT) * IW
  const ty = v => PAD.t + (1 - (v - minV) / rangeV) * IH

  const buildPath = ds =>
    ds.timeseries.map((p, i) => {
      const v = ds.vals[i]; if (v == null) return null
      const first = i === 0 || ds.vals.slice(0, i).every(x => x == null)
      return `${first ? 'M' : 'L'}${tx(p.time_sec).toFixed(1)},${ty(v).toFixed(1)}`
    }).filter(Boolean).join(' ')

  const Y_TICKS = 4, X_TICKS = expanded ? 6 : 3
  const gridVals = Array.from({ length: Y_TICKS + 1 }, (_, i) => minV + (rangeV * i / Y_TICKS))
  const gridTimes = Array.from({ length: X_TICKS + 1 }, (_, i) => minT + (rangeT * i / X_TICKS))
  const dim = dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'
  const gridLine = dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)'
  const thresholdY = showThreshold ? ty(velocityThreshold) : null

  const onMouseMove = useCallback(e => {
    if (!svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left - PAD.l) / IW))
    const tVal = minT + ratio * rangeT
    const hoverData = processed.map(ds => {
      const idx = ds.timeseries.reduce((best, p, i) =>
        Math.abs(p.time_sec - tVal) < Math.abs(ds.timeseries[best].time_sec - tVal) ? i : best, 0)
      return {
        label: ds.video_name, val: ds.vals[idx],
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
            <linearGradient key={di} id={`grad-${field}-${di}-${expanded ? 'e' : 's'}`} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor={ds.color.line} stopOpacity="0.20" />
              <stop offset="100%" stopColor={ds.color.line} stopOpacity="0" />
            </linearGradient>
          ))}
        </defs>

        {gridVals.map((v, i) => (
          <g key={i}>
            <line x1={PAD.l} y1={ty(v)} x2={W - PAD.r} y2={ty(v)} stroke={gridLine} strokeWidth="0.7" />
            <text x={PAD.l - 5} y={ty(v) + 3.5} textAnchor="end" fill={dim} fontSize="9"
              fontFamily="'IBM Plex Mono', monospace">{v.toFixed(0)}</text>
          </g>
        ))}
        {gridTimes.map((t, i) => (
          <text key={i} x={tx(t)} y={H - PAD.b + 12} textAnchor="middle" fill={dim} fontSize="9"
            fontFamily="'IBM Plex Mono', monospace">{t.toFixed(1)}s</text>
        ))}
        <text x={-H / 2} y={14} transform="rotate(-90)" textAnchor="middle" fill={dim} fontSize="9"
          fontFamily="'IBM Plex Mono', monospace">{unit}</text>

        {processed.map((ds, di) => {
          const path = buildPath(ds)
          const lastPt = ds.timeseries[ds.timeseries.length - 1]
          const firstPt = ds.timeseries[0]
          return (
            <g key={di}>
              <path d={`${path} L${tx(lastPt.time_sec)},${PAD.t + IH} L${tx(firstPt.time_sec)},${PAD.t + IH} Z`}
                fill={`url(#grad-${field}-${di}-${expanded ? 'e' : 's'})`} />
              <path d={path} fill="none" stroke={ds.color.line} strokeWidth="1.8"
                strokeDasharray={ds.color.dash ? '5 3' : undefined}
                strokeLinejoin="round" strokeLinecap="round" />
            </g>
          )
        })}

        {showThreshold && thresholdY != null && (
          <>
            <line x1={PAD.l} y1={thresholdY} x2={W - PAD.r} y2={thresholdY}
              stroke="#FF453A" strokeWidth="1.5" strokeDasharray="4 3" opacity="0.9" />
            <rect x={W - PAD.r - 64} y={thresholdY - 13} width={62} height={13} rx={3}
              fill="rgba(255,69,58,0.12)" />
            <text x={W - PAD.r - 33} y={thresholdY - 3} textAnchor="middle"
              fill="#FF453A" fontSize="8" fontFamily="'IBM Plex Mono', monospace">
              thr:{velocityThreshold}
            </text>
            <rect x={PAD.l} y={thresholdY} width={IW} height={Math.max(0, PAD.t + IH - thresholdY)}
              fill="rgba(255,69,58,0.03)" />
          </>
        )}

        {hover && (
          <>
            <line x1={hover[0].x} y1={PAD.t} x2={hover[0].x} y2={PAD.t + IH}
              stroke={dark ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.12)'}
              strokeWidth="0.8" strokeDasharray="3 2" />
            {hover.map((h, i) => h.val != null && (
              <circle key={i} cx={h.x} cy={h.y} r={4.5}
                fill={h.belowThreshold ? '#FF453A' : h.color}
                stroke={dark ? 'rgba(18,18,22,0.8)' : 'rgba(255,255,255,0.9)'} strokeWidth="1.5" />
            ))}
          </>
        )}
      </svg>

      <AnimatePresence>
        {hover && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            style={{
              position: 'absolute', top: 6, right: 6,
              ...(dark ? glassDark() : glassLight()),
              borderRadius: 12, padding: '9px 13px',
              fontSize: 11, lineHeight: 1.9, pointerEvents: 'none',
              fontFamily: "'IBM Plex Mono', monospace",
              color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
              minWidth: 140,
            }}
          >
            <div style={{ fontSize: 9, opacity: 0.5, marginBottom: 2 }}>
              t = {hover[0]?.time.toFixed(2)}s
            </div>
            {hover.map((h, i) => h.val != null && (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                <span style={{ width: 7, height: 7, borderRadius: 2, background: h.color, display: 'inline-block' }} />
                <span style={{ fontWeight: 700, color: h.belowThreshold ? '#FF453A' : (dark ? '#fff' : '#000') }}>
                  {h.val.toFixed(2)}
                </span>
                <span style={{ opacity: 0.4, fontSize: 9 }}>{unit}</span>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Chart Island with expand ──────────────────────────────────────────────────
function ChartIsland({ title, subtitle, children, expandContent }) {
  const [expanded, setExpanded] = useState(false)
  const { dark } = useTheme()
  return (
    <>
      <Island style={{ padding: '15px 17px 13px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 10 }}>
          <div>
            <div style={{
              fontSize: 12.5, fontWeight: 600,
              color: dark ? 'rgba(255,255,255,0.88)' : 'rgba(0,0,0,0.82)',
              fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
              letterSpacing: '-0.01em',
            }}>{title}</div>
            {subtitle && <div style={{
              fontSize: 10, marginTop: 2,
              color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
              fontFamily: "'IBM Plex Mono', monospace",
            }}>{subtitle}</div>}
          </div>
          <motion.button
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={() => setExpanded(true)}
            style={{
              background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.05)',
              border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
              borderRadius: 8, color: dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)',
              cursor: 'pointer', padding: '5px 9px',
              display: 'flex', alignItems: 'center', gap: 4, fontSize: 10,
              fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
              flexShrink: 0, marginLeft: 8,
            }}
          >
            <Icon.Expand s={10} /> Expand
          </motion.button>
        </div>
        {children}
      </Island>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setExpanded(false)}
            style={{
              position: 'fixed', inset: 0, zIndex: 1000,
              background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(10px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 28,
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.88, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.88 }}
              transition={{ type: 'spring', stiffness: 200, damping: 22 }}
              onClick={e => e.stopPropagation()}
              style={{
                ...(dark ? glassDark() : glassLight()),
                borderRadius: '2rem', width: '100%', maxWidth: 1000,
                maxHeight: '88vh', display: 'flex', flexDirection: 'column', overflow: 'hidden',
              }}
            >
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '16px 22px', borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
              }}>
                <div>
                  <div style={{
                    fontSize: 14, fontWeight: 600,
                    color: dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)',
                    fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                  }}>{title}</div>
                  {subtitle && <div style={{
                    fontSize: 10.5, marginTop: 2,
                    color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>{subtitle}</div>}
                </div>
                <motion.button
                  whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.94 }}
                  onClick={() => setExpanded(false)}
                  style={{
                    background: dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                    border: 'none', borderRadius: 10,
                    color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.5)',
                    cursor: 'pointer', fontSize: 12, padding: '6px 14px',
                    fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon.X s={11} /> Close
                </motion.button>
              </div>
              <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px 24px' }}>{expandContent}</div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }) {
  const map = {
    idle:      { label: 'Idle',       color: 'rgba(120,120,128,0.5)', text: '#888' },
    uploading: { label: 'Uploading',  color: 'rgba(255,159,10,0.15)', text: '#FF9F0A' },
    analyzing: { label: 'Analyzing', color: 'rgba(10,132,255,0.15)', text: '#0A84FF' },
    done:      { label: 'Ready',      color: 'rgba(52,199,89,0.15)',  text: '#34C759' },
    error:     { label: 'Error',      color: 'rgba(255,69,58,0.15)',  text: '#FF453A' },
    restoring: { label: 'Restoring', color: 'rgba(10,132,255,0.12)', text: '#0A84FF' },
  }
  const { label, color, text } = map[status] || map.idle
  const pulse = ['uploading', 'analyzing', 'restoring'].includes(status)
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      background: color, borderRadius: 20, padding: '4px 10px',
    }}>
      <motion.span
        animate={pulse ? { opacity: [1, 0.3, 1] } : {}}
        transition={{ repeat: Infinity, duration: 1.2 }}
        style={{ width: 6, height: 6, borderRadius: '50%', background: text, display: 'inline-block' }}
      />
      <span style={{
        fontSize: 11, fontWeight: 600, color: text,
        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        letterSpacing: '0.01em',
      }}>{label}</span>
    </div>
  )
}

// ─── Tab Bar ──────────────────────────────────────────────────────────────────
function TabBar({ tabs, active, onChange }) {
  const { dark } = useTheme()
  return (
    <div style={{
      display: 'flex', gap: 3, padding: 4,
      background: dark ? 'rgba(0,0,0,0.25)' : 'rgba(0,0,0,0.07)',
      borderRadius: 14,
    }}>
      {tabs.map(t => (
        <motion.button
          key={t.id}
          whileTap={{ scale: 0.96 }}
          onClick={() => onChange(t.id)}
          style={{
            position: 'relative', background: 'none', border: 'none', cursor: 'pointer',
            padding: '7px 16px', borderRadius: 11,
            color: active === t.id
              ? (dark ? 'rgba(255,255,255,0.9)' : 'rgba(0,0,0,0.85)')
              : (dark ? 'rgba(255,255,255,0.4)' : 'rgba(0,0,0,0.4)'),
            fontSize: 12.5, fontWeight: 500,
            fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
            transition: 'color 0.15s',
          }}
        >
          {active === t.id && (
            <motion.div
              layoutId="activeTab"
              style={{
                position: 'absolute', inset: 0, borderRadius: 11,
                background: dark ? 'rgba(255,255,255,0.12)' : '#fff',
                boxShadow: '0 2px 8px rgba(0,0,0,0.12)',
              }}
              transition={{ type: 'spring', stiffness: 300, damping: 28 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1 }}>{t.label}</span>
        </motion.button>
      ))}
    </div>
  )
}

// ─── Alert Log ────────────────────────────────────────────────────────────────
function AlertLog({ entries }) {
  const ref = useRef(null)
  const { dark } = useTheme()
  useEffect(() => { if (ref.current) ref.current.scrollTop = ref.current.scrollHeight }, [entries])
  const colorMap = {
    info: dark ? 'rgba(255,255,255,0.45)' : 'rgba(0,0,0,0.45)',
    ok: '#34C759', warn: '#FF9F0A', err: '#FF453A',
  }
  return (
    <div ref={ref} style={{ height: 150, overflowY: 'auto', fontFamily: "'IBM Plex Mono', monospace", fontSize: 11, lineHeight: 2 }}>
      {entries.length === 0 && (
        <div style={{ color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)', padding: '8px 0' }}>
          // no activity yet
        </div>
      )}
      {entries.map((e, i) => (
        <div key={i} style={{
          display: 'flex', gap: 10,
          borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
          color: colorMap[e.type] || colorMap.info,
        }}>
          <span style={{ opacity: 0.4, flexShrink: 0, fontSize: 9 }}>{e.ts}</span>
          <span style={{ wordBreak: 'break-word', flex: 1 }}>{e.msg}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Past Jobs Table ──────────────────────────────────────────────────────────
function PastJobsTable({ jobs, onRestore }) {
  const { dark } = useTheme()
  if (!jobs.length) return (
    <div style={{
      color: dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
      fontSize: 12, padding: '16px 0', fontFamily: "'IBM Plex Mono', monospace",
    }}>// no past analyses found</div>
  )
  const thStyle = {
    padding: '8px 10px',
    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)'}`,
    fontSize: 9.5, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
    color: dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.3)',
    fontFamily: "'SF Pro Display', 'Satoshi', system-ui", textAlign: 'left',
  }
  const tdStyle = {
    padding: '9px 10px',
    borderBottom: `1px solid ${dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)'}`,
    fontSize: 11.5, color: dark ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.6)',
    fontFamily: "'IBM Plex Mono', monospace",
  }
  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>{['Job ID', 'Created', 'Model', 'Videos', ''].map(h => <th key={h} style={thStyle}>{h}</th>)}</tr>
        </thead>
        <tbody>
          {jobs.map(j => (
            <motion.tr key={j.job_id} whileHover={{ background: dark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)' }}>
              <td style={{ ...tdStyle, color: '#0A84FF' }}>{j.job_id}</td>
              <td style={tdStyle}>{new Date(j.created_at).toLocaleString()}</td>
              <td style={tdStyle}>{j.selected_model}</td>
              <td style={tdStyle}>{j.video_count}</td>
              <td style={tdStyle}>
                <motion.button
                  whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                  onClick={() => onRestore(j.job_id)}
                  style={{
                    background: 'rgba(10,132,255,0.10)', border: '1px solid rgba(10,132,255,0.25)',
                    borderRadius: 8, color: '#0A84FF', fontSize: 10.5, padding: '5px 12px',
                    cursor: 'pointer', fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                    display: 'flex', alignItems: 'center', gap: 5,
                  }}
                >
                  <Icon.Clock s={10} c="#0A84FF" /> Restore
                </motion.button>
              </td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ─── Video Summary Cards ──────────────────────────────────────────────────────
function VideoSummaryCards({ video, accent }) {
  const { dark } = useTheme()
  const s = video.summary
  return (
    <div>
      <div style={{
        fontSize: 11, fontWeight: 600,
        letterSpacing: '0.04em', marginBottom: 10,
        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        {/* Colour-coded video swatch */}
        <span style={{
          display: 'inline-flex', alignItems: 'center', gap: 6,
          background: `${accent}18`,
          border: `1.5px solid ${accent}55`,
          borderRadius: 8, padding: '3px 9px 3px 6px',
          color: accent,
        }}>
          <span style={{
            width: 9, height: 9, borderRadius: 3,
            background: accent, display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{ fontSize: 11 }}>{shortName(video.video_name, 36)}</span>
        </span>
        {video._used_dummy_data && (
          <span style={{
            fontSize: 9, background: 'rgba(255,159,10,0.12)', color: '#FF9F0A',
            border: '1px solid rgba(255,159,10,0.3)', borderRadius: 5, padding: '1px 7px',
            fontFamily: "'IBM Plex Mono', monospace",
          }}>DUMMY DATA</span>
        )}
      </div>
      <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
        <MetricChip label="Avg Velocity" value={s.avg_velocity.toFixed(1)} unit="px/s" />
        <MetricChip label="Peak Velocity" value={s.max_velocity.toFixed(1)} unit="px/s" />
        <MetricChip label="Avg Clustering" value={s.avg_clustering_percent.toFixed(1)} unit="%" />
        <MetricChip label="Frames" value={s.frames_processed} />
        <MetricChip label="Est. Shrimp" value={s.shrimp_count_estimate} />
      </div>
    </div>
  )
}

// ─── Threshold Alert Toast ────────────────────────────────────────────────────
function ThresholdToast({ alerts, onDismiss, isRestored }) {
  return (
    <AnimatePresence>
      {alerts && alerts.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: -18 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -18 }}
          transition={{ type: 'spring', stiffness: 250, damping: 22 }}
          style={{
            background: 'rgba(255,69,58,0.09)',
            border: '1px solid rgba(255,69,58,0.3)',
            borderRadius: 16, padding: '11px 16px', marginBottom: 12,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ flex: 1 }}>
              <div style={{
                fontSize: 12, fontWeight: 600, color: '#FF453A', marginBottom: 6,
                display: 'flex', alignItems: 'center', gap: 6,
                fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
              }}>
                <Icon.Alert s={12} c="#FF453A" />
                Lethargic Shrimp Detected — Below Velocity Threshold
                {isRestored && (
                  <span style={{
                    fontSize: 8.5, background: 'rgba(10,132,255,0.12)', color: '#0A84FF',
                    border: '1px solid rgba(10,132,255,0.3)', borderRadius: 4,
                    padding: '1px 7px', fontFamily: "'IBM Plex Mono', monospace",
                  }}>RESTORED</span>
                )}
              </div>
              {alerts.map((a, i) => (
                <div key={i} style={{
                  fontSize: 11, color: 'rgba(255,69,58,0.8)',
                  fontFamily: "'IBM Plex Mono', monospace", display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3,
                }}>
                  <span style={{ width: 6, height: 6, borderRadius: 2, background: SERIES_COLORS[a.videoIndex % SERIES_COLORS.length].line, display: 'inline-block' }} />
                  <span style={{ fontWeight: 600, color: '#FF453A' }}>{shortName(a.videoName, 28)}</span>
                  <span>{a.pctBelow.toFixed(1)}% below {a.threshold}px/s · avg {a.avgVelocity.toFixed(1)}</span>
                </div>
              ))}
            </div>
            <button onClick={onDismiss}
              style={{ background: 'none', border: 'none', color: 'rgba(255,69,58,0.6)', cursor: 'pointer', padding: 2, display: 'flex' }}>
              <Icon.X s={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ═══════════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
export default function ShrimpDashboard() {
  const [dark, setDark] = useState(false)

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

  // ── Restore ─────────────────────────────────────────────────────────────────
  const restoreJob = useCallback(async (jobId) => {
    if (!jobId) return
    setStatus('restoring')
    log(`Restoring session: ${jobId}`, 'info')
    try {
      const res = await fetch(`${BASE_URL}/results/${jobId}`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setResult(data); setIsRestoredResult(true)
      setThresholdAlerts([]); setThresholdAlertDismissed(false)
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
        setModels(fallback); setSelectedModel(fallback[0].id)
      } finally { setModelsLoading(false) }
      const lastJobId = sessionStorage.getItem('lastJobId')
      if (lastJobId) await restoreJob(lastJobId)
    })()
  }, [log, restoreJob])

  // ── Past jobs ────────────────────────────────────────────────────────────────
  const fetchPastJobs = useCallback(async () => {
    setPastLoading(true)
    try {
      const res = await fetch(`${BASE_URL}/results`)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setPastJobs(data.results || [])
    } catch (e) { log(`Could not load history: ${e.message}`, 'warn') }
    finally { setPastLoading(false) }
  }, [log])

  useEffect(() => { fetchPastJobs() }, [fetchPastJobs])

  // ── Run analysis ─────────────────────────────────────────────────────────────
  const runAnalysis = useCallback(async () => {
    if (!files.length) { log('Select at least one video.', 'warn'); return }
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
      const data = await uploadWithProgress(fd, pct => {
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
        } else { log(`All videos passed threshold (${velocityThreshold}px/s)`, 'ok') }
      }

      const dummyCount = data.videos.filter(v => v._used_dummy_data).length
      if (dummyCount > 0) log(`${dummyCount} video(s) used dummy data — no model found`, 'warn')
      log(`Analysis complete. Job: ${data.job_id}`, 'ok')
      data.videos.forEach(v => log(`  ${v.video_name}: vel=${v.summary.avg_velocity}px/s clust=${v.summary.avg_clustering_percent}%`, 'info'))
      fetchPastJobs()
    } catch (e) {
      if (abortRef.current?._inferIv) clearInterval(abortRef.current._inferIv)
      if (e.name === 'AbortError') { setStatus('idle'); log('Analysis cancelled.', 'warn') }
      else { setStatus('error'); setError(e.message); log(`Error: ${e.message}`, 'err') }
    }
  }, [files, selectedModel, status, log, fetchPastJobs, velocityThreshold])

  // ── Threshold calculation ────────────────────────────────────────────────────
  const calculateThresholdOnCurrentResult = useCallback(() => {
    if (!result || !velocityThreshold || velocityThreshold <= 0) return
    log(`Calculating threshold (${velocityThreshold}px/s) on current result...`, 'info')
    const tAlerts = computeThresholdAlerts(result.videos, velocityThreshold)
    setThresholdAlerts(tAlerts); setThresholdAlertDismissed(false)
    if (tAlerts.length > 0) {
      tAlerts.forEach(a => log(`ALERT: ${a.videoName} — ${a.pctBelow.toFixed(1)}% below ${a.threshold}px/s${isRestoredResult ? ' [restored]' : ''}`, 'warn'))
      setActiveTab('analytics')
    } else { log(`All videos passed threshold (${velocityThreshold}px/s)`, 'ok') }
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
    await restoreJob(jobId); setActiveTab('analytics')
  }, [restoreJob])

  // ── Derived ──────────────────────────────────────────────────────────────────
  const isRunning = status === 'uploading' || status === 'analyzing'
  const hasDummy = result?.videos?.some(v => v._used_dummy_data)
  const showThresholdAlerts = thresholdAlerts.length > 0 && !thresholdAlertDismissed
  const canCalcThreshold = !!result && velocityThreshold > 0 && !isRunning
  const activeVelThreshold = velocityThreshold > 0 ? velocityThreshold : 0
  const legend = result?.videos?.map((v, i) => ({ label: v.video_name, color: SERIES_COLORS[i % SERIES_COLORS.length].line })) || []

  const txt = dark ? 'rgba(255,255,255,0.8)' : 'rgba(0,0,0,0.8)'
  const txSub = dark ? 'rgba(255,255,255,0.35)' : 'rgba(0,0,0,0.3)'

  return (
    <ThemeContext.Provider value={{ dark, toggle: () => setDark(d => !d) }}>
      {/* ── Global styles ── */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500;600&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; width: 100%; }
        body {
          font-family: 'SF Pro Display', 'Satoshi', -apple-system, BlinkMacSystemFont, system-ui, sans-serif;
          -webkit-font-smoothing: antialiased;
          overflow: hidden;
          background: ${dark ? '#0a0a0f' : '#e8eaf0'};
        }
        ::-webkit-scrollbar { width: 4px; height: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: ${dark ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.14)'}; border-radius: 2px; }
        select option { background: ${dark ? '#1c1c1e' : '#fff'}; }
        input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>

      {/* ── Root ── */}
      <div style={{
        width: '100vw', height: '100vh', overflow: 'hidden',
        position: 'relative',
      }}>
        {/* Background video / ambient layer */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 0,
          overflow: 'hidden',
        }}>
          {/* Ambient gradient replacing video for compatibility */}
          <div style={{
            position: 'absolute', inset: 0,
//             background: dark
//               ? 'radial-gradient(ellipse at 20% 20%, #0d2137 0%, #090d14 50%, #000 100%)'
//               : 'radial-gradient(ellipse at 20% 20%, #c8e6fa 0%, #dce7f7 50%, #edf2fb 100%)',
            backgroundImage: `url('/shrimp_background2.png')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center',
            backgroundRepeat: 'no-repeat',
          }} />
          {/* Animated orbs for visual depth */}
          <div style={{
            position: 'absolute', top: '8%', left: '12%',
            width: 480, height: 480, borderRadius: '50%',
            background: dark
              ? 'radial-gradient(circle, rgba(10,132,255,0.18) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)',
            filter: 'blur(40px)',
            animation: 'orbFloat 12s ease-in-out infinite',
          }} />
          <div style={{
            position: 'absolute', bottom: '10%', right: '8%',
            width: 560, height: 560, borderRadius: '50%',
            background: dark
              ? 'radial-gradient(circle, rgba(52,199,89,0.12) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(52,199,89,0.10) 0%, transparent 70%)',
            filter: 'blur(48px)',
            animation: 'orbFloat 16s ease-in-out infinite reverse',
          }} />
          <div style={{
            position: 'absolute', top: '45%', left: '40%',
            width: 400, height: 400, borderRadius: '50%',
            background: dark
              ? 'radial-gradient(circle, rgba(255,159,10,0.08) 0%, transparent 70%)'
              : 'radial-gradient(circle, rgba(255,159,10,0.07) 0%, transparent 70%)',
            filter: 'blur(36px)',
            animation: 'orbFloat 20s ease-in-out infinite',
            animationDelay: '4s',
          }} />
          <style>{`
            @keyframes orbFloat {
              0%, 100% { transform: translate(0, 0) scale(1); }
              33% { transform: translate(30px, -20px) scale(1.04); }
              66% { transform: translate(-20px, 25px) scale(0.97); }
            }
          `}</style>
        </div>

        {/* ── Layout grid ── */}
        <div style={{
          position: 'relative', zIndex: 1,
          width: '100%', height: '100%',
          display: 'grid',
          gridTemplateRows: '58px 1fr',
          gridTemplateColumns: '270px 1fr',
          gap: 0,
          padding: 0,
        }}>

          {/* ════ HEADER ISLAND ════ */}
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 120, damping: 18 }}
            style={{
              gridColumn: '1 / -1',
              ...(dark ? glassDark() : glassLight()),
              borderRadius: 0,
              borderTop: 'none', borderLeft: 'none', borderRight: 'none',
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '0 22px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{
                width: 32, height: 32, borderRadius: 10,
                background: 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                boxShadow: '0 4px 12px rgba(10,132,255,0.35)',
              }}>
                <Icon.Waveform s={14} c="#fff" />
              </div>
              <div>
                <div style={{
                  fontSize: 14.5, fontWeight: 700, letterSpacing: '-0.025em',
                  color: dark ? 'rgba(255,255,255,0.92)' : 'rgba(0,0,0,0.85)',
                }}>ShrimpTracker</div>
                <div style={{
                  fontSize: 9.5, letterSpacing: '0.1em', textTransform: 'uppercase',
                  color: txSub, fontFamily: "'IBM Plex Mono', monospace",
                }}>Activity Detection System</div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              {isRestoredResult && result && (
                <span style={{
                  fontSize: 9.5, background: 'rgba(10,132,255,0.10)', color: '#0A84FF',
                  border: '1px solid rgba(10,132,255,0.25)', borderRadius: 6,
                  padding: '3px 9px', fontFamily: "'IBM Plex Mono', monospace", fontWeight: 600,
                }}>
                  RESTORED · {result.job_id}
                </span>
              )}

              <StatusPill status={status} />

              <div style={{ width: 1, height: 20, background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }} />

              <div style={{ fontSize: 11, color: txSub, fontFamily: "'IBM Plex Mono', monospace" }}>
                {new Date().toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' })}
              </div>

              {/* Dark mode toggle */}
              <motion.button
                whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.92 }}
                onClick={() => setDark(d => !d)}
                style={{
                  width: 32, height: 32, borderRadius: 10, cursor: 'pointer',
                  background: dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)',
                  border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.1)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  color: dark ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.6)',
                }}
              >
                {dark ? <Icon.Sun s={13} /> : <Icon.Moon s={13} />}
              </motion.button>
            </div>
          </motion.div>

          {/* ════ LEFT SIDEBAR ════ */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ type: 'spring', stiffness: 100, damping: 18, delay: 0.05 }}
            style={{
              gridColumn: '1', gridRow: '2',
              ...(dark ? glassDark() : glassLight()),
              borderRadius: 0,
              borderTop: 'none', borderLeft: 'none', borderBottom: 'none',
              borderRight: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto', padding: '20px 16px',
              gap: 20,
            }}
          >
            {/* Model selector */}
            <div>
              <Label>YOLO Model</Label>
              <GlassSelect
                value={selectedModel}
                onChange={setSelectedModel}
                options={modelsLoading
                  ? [{ value: '', label: 'Loading…' }]
                  : models.map(m => ({ value: m.id, label: m.label }))}
                disabled={isRunning || modelsLoading}
              />
            </div>

            {/* Upload */}
            <div>
              <Label>Upload Videos</Label>
              <UploadZone files={files} onFiles={setFiles} />
            </div>

            {/* Lethargic detection */}
            <div>
              <Label>Lethargic Detection</Label>
              <div style={{
                fontSize: 11.5, color: txSub, marginBottom: 9, lineHeight: 1.55,
              }}>
                Flag shrimp with velocity below threshold.
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 8 }}>
                <GlassInput
                  value={velocityThreshold}
                  onChange={setVelocityThreshold}
                  placeholder="e.g. 5"
                  disabled={isRunning}
                />
                <span style={{ fontSize: 10.5, color: txSub, flexShrink: 0, fontFamily: "'IBM Plex Mono', monospace" }}>px/s</span>
              </div>

              <motion.button
                whileHover={canCalcThreshold ? { scale: 1.02 } : {}}
                whileTap={canCalcThreshold ? { scale: 0.97 } : {}}
                onClick={calculateThresholdOnCurrentResult}
                disabled={!canCalcThreshold}
                style={{
                  width: '100%', padding: '9px 0', borderRadius: 12,
                  background: canCalcThreshold ? 'rgba(255,69,58,0.10)' : (dark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.04)'),
                  color: canCalcThreshold ? '#FF453A' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)'),
                  border: `1px solid ${canCalcThreshold ? 'rgba(255,69,58,0.3)' : (dark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)')}`,
                  fontSize: 12, fontWeight: 600, cursor: canCalcThreshold ? 'pointer' : 'not-allowed',
                  fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                  transition: 'all 0.15s',
                }}
              >
                <Icon.Alert s={10} c={canCalcThreshold ? '#FF453A' : (dark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)')} />
                Calculate Threshold
              </motion.button>

              {velocityThreshold > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                  <span style={{ fontSize: 10, color: 'rgba(255,69,58,0.7)', fontFamily: "'IBM Plex Mono', monospace" }}>
                    alert &lt; {velocityThreshold}px/s
                  </span>
                  <button onClick={() => { setVelocityThreshold(0); setThresholdAlerts([]); setThresholdAlertDismissed(false) }}
                    style={{ background: 'none', border: 'none', color: txSub, cursor: 'pointer', fontSize: 11 }}>
                    clear
                  </button>
                </div>
              )}
            </div>

            {/* Display options */}
            <div>
              <Label>Display</Label>
              <IOSToggle value={smoothing} onChange={setSmoothing} label={`Rolling avg (${SMOOTHING_WINDOW}-frame)`} />
            </div>

            {/* Progress indicators */}
            <AnimatePresence>
              {isRunning && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  style={{
                    background: dark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)',
                    borderRadius: 14, padding: '12px 14px',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.07)'}`,
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <ProgressRing
                      value={status === 'uploading' ? uploadPct : analyzePct}
                      color={status === 'uploading' ? '#FF9F0A' : '#0A84FF'}
                    />
                    <div>
                      <div style={{ fontSize: 12, fontWeight: 600, color: txt }}>
                        {status === 'uploading' ? 'Uploading…' : 'Analyzing…'}
                      </div>
                      <div style={{
                        fontSize: 10.5, color: txSub, fontFamily: "'IBM Plex Mono', monospace",
                      }}>
                        {status === 'uploading' ? uploadPct : analyzePct}%
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Warnings */}
            <AnimatePresence>
              {error && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    background: 'rgba(255,69,58,0.08)', border: '1px solid rgba(255,69,58,0.25)',
                    borderRadius: 12, padding: '9px 12px', fontSize: 11.5, color: '#FF453A',
                    fontFamily: "'IBM Plex Mono', monospace", wordBreak: 'break-word',
                  }}>
                  {error}
                </motion.div>
              )}
              {hasDummy && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  style={{
                    background: 'rgba(255,159,10,0.08)', border: '1px solid rgba(255,159,10,0.25)',
                    borderRadius: 12, padding: '9px 12px', fontSize: 11.5, color: '#FF9F0A',
                    fontFamily: "'IBM Plex Mono', monospace",
                  }}>
                  No YOLO model found. Charts show dummy data.
                </motion.div>
              )}
            </AnimatePresence>

            {/* Spacer + CTA */}
            <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
              <motion.button
                whileHover={isRunning || !files.length ? {} : { scale: 1.02, y: -1 }}
                whileTap={isRunning || !files.length ? {} : { scale: 0.97 }}
                onClick={runAnalysis}
                disabled={isRunning || !files.length}
                style={{
                  width: '100%', padding: '13px 0', borderRadius: 14,
                  background: isRunning || !files.length
                    ? (dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.06)')
                    : 'linear-gradient(135deg, #0A84FF 0%, #0055CC 100%)',
                  color: isRunning || !files.length
                    ? (dark ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.25)')
                    : '#fff',
                  border: 'none',
                  fontSize: 13.5, fontWeight: 700,
                  cursor: isRunning || !files.length ? 'not-allowed' : 'pointer',
                  fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  boxShadow: isRunning || !files.length ? 'none' : '0 6px 24px rgba(10,132,255,0.35)',
                  transition: 'all 0.15s',
                }}
              >
                {isRunning ? (
                  <>
                    <div style={{
                      width: 13, height: 13,
                      border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin 0.8s linear infinite',
                    }} />
                    Processing…
                  </>
                ) : (
                  <><Icon.Play s={11} c="#fff" /> Run Analysis</>
                )}
              </motion.button>

              <AnimatePresence>
                {isRunning && (
                  <motion.button
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                    onClick={cancelAnalysis}
                    style={{
                      width: '100%', padding: '8px 0', borderRadius: 12, background: 'none',
                      border: '1px solid rgba(255,69,58,0.35)', color: '#FF453A',
                      fontSize: 12, cursor: 'pointer',
                      fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5,
                    }}
                  >
                    <Icon.X s={11} c="#FF453A" /> Cancel
                  </motion.button>
                )}
              </AnimatePresence>
            </div>
          </motion.div>

          {/* ════ MAIN CONTENT ════ */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.1 }}
            style={{
              gridColumn: '2', gridRow: '2',
              overflowY: 'auto',
              padding: '20px 20px 20px 16px',
              display: 'flex', flexDirection: 'column', gap: 14,
            }}
          >
            {/* Tab bar + CSV buttons */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12 }}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
            >
              <TabBar
                tabs={[
                  { id: 'analytics', label: `Analytics${showThresholdAlerts ? ' ·' : ''}` },
                  { id: 'metrics', label: 'Metrics' },
                  { id: 'history', label: 'History' },
                  { id: 'log', label: 'Log' },
                ]}
                active={activeTab}
                onChange={setActiveTab}
              />
              {result && (
                <div style={{ display: 'flex', gap: 6 }}>
                  {result.videos.map((v, i) => (
                    <motion.button
                      key={i}
                      whileHover={{ scale: 1.05, y: -1 }}
                      whileTap={{ scale: 0.95 }}
                      onClick={() => downloadCsv(result.job_id, v.video_id)}
                      style={{
                        ...(dark ? glassDark() : glassLight()),
                        borderRadius: 10, border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                        color: txSub, fontSize: 10.5, padding: '6px 12px', cursor: 'pointer',
                        fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                        display: 'flex', alignItems: 'center', gap: 5,
                        background: 'none',
                      }}
                    >
                      <Icon.Download s={10} /> CSV {i + 1}
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>

            {/* ── Tab Content ── */}
            <AnimatePresence mode="wait">

              {/* ANALYTICS */}
              {activeTab === 'analytics' && (
                <motion.div
                  key="analytics"
                  variants={tabContent} initial="hidden" animate="visible" exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {!result ? (
                    <Island style={{ padding: '60px 30px', textAlign: 'center' }}>
                      <motion.div
                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                        transition={{ repeat: Infinity, duration: 3 }}
                        style={{ display: 'flex', justifyContent: 'center', marginBottom: 16, opacity: 0.25 }}
                      >
                        <Icon.Chart s={44} c={dark ? '#fff' : '#000'} />
                      </motion.div>
                      <div style={{ fontSize: 15, fontWeight: 600, color: txt, marginBottom: 6 }}>
                        No Analysis Loaded
                      </div>
                      <div style={{ fontSize: 12.5, color: txSub }}>
                        Upload videos and run analysis, or restore a past session from History.
                      </div>
                    </Island>
                  ) : (
                    <>
                      {/* Threshold toast */}
                      {showThresholdAlerts && (
                        <ThresholdToast
                          alerts={thresholdAlerts}
                          onDismiss={() => setThresholdAlertDismissed(true)}
                          isRestored={isRestoredResult}
                        />
                      )}

                      {/* Legend */}
                      {legend.length > 1 && (
                        <div style={{
                          display: 'flex', gap: 16, fontSize: 11,
                          color: txSub, fontFamily: "'IBM Plex Mono', monospace",
                        }}>
                          {legend.map((l, i) => (
                            <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                              <span style={{ width: 20, height: 2, background: l.color, borderRadius: 1, display: 'inline-block' }} />
                              {shortName(l.label, 26)}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Charts grid */}
                      <motion.div
                        variants={stagger} initial="hidden" animate="visible"
                        style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}
                      >
                        <ChartIsland
                          title="Shrimp Velocity"
                          subtitle={`avg movement · px/s${smoothing ? ' · smoothed' : ''}${activeVelThreshold > 0 ? ` · thr:${activeVelThreshold}` : ''}`}
                          expandContent={
                            <LineChart datasets={result.videos} field="avg_velocity" unit="px/s"
                              smoothing={smoothing} velocityThreshold={activeVelThreshold} expanded />
                          }
                        >
                          <LineChart datasets={result.videos} field="avg_velocity" unit="px/s"
                            smoothing={smoothing} velocityThreshold={activeVelThreshold} expanded={false} />
                        </ChartIsland>

                        <ChartIsland
                          title="Clustering Score"
                          subtitle={`spatial density · %${smoothing ? ' · smoothed' : ''}`}
                          expandContent={
                            <LineChart datasets={result.videos} field="clustering_percent" unit="%"
                              smoothing={smoothing} velocityThreshold={0} expanded />
                          }
                        >
                          <LineChart datasets={result.videos} field="clustering_percent" unit="%"
                            smoothing={smoothing} velocityThreshold={0} expanded={false} />
                        </ChartIsland>
                      </motion.div>

                      {/* Delta metrics (2 video comparison — preserved exactly) */}
                      {result.videos.length === 2 && (
                        <Island style={{ padding: '15px 18px' }}>
                          <Label>Delta Metrics — V2 vs V1</Label>
                          <div style={{ display: 'flex', gap: 24 }}>
                            {[
                              { label: 'Velocity Δ', val: (result.videos[1].summary.avg_velocity - result.videos[0].summary.avg_velocity).toFixed(2), unit: 'px/s' },
                              { label: 'Clustering Δ', val: (result.videos[1].summary.avg_clustering_percent - result.videos[0].summary.avg_clustering_percent).toFixed(2), unit: '%' },
                              { label: 'Peak Vel Δ', val: (result.videos[1].summary.max_velocity - result.videos[0].summary.max_velocity).toFixed(2), unit: 'px/s' },
                            ].map(d => {
                              const pos = parseFloat(d.val) >= 0
                              return (
                                <div key={d.label}>
                                  <div style={{ fontSize: 9.5, color: txSub, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4, fontFamily: "'SF Pro Display', sans-serif" }}>{d.label}</div>
                                  <div style={{
                                    fontSize: 26, fontWeight: 700,
                                    color: pos ? '#34C759' : '#FF453A',
                                    fontFamily: "'IBM Plex Mono', monospace", lineHeight: 1,
                                  }}>
                                    {pos ? '+' : ''}{d.val}
                                    <span style={{ fontSize: 11, color: txSub, marginLeft: 3, fontWeight: 400 }}>{d.unit}</span>
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        </Island>
                      )}

                      {/* Job info */}
                      <div style={{ fontSize: 10, color: txSub, fontFamily: "'IBM Plex Mono', monospace", display: 'flex', gap: 14 }}>
                        <span>job: {result.job_id}</span>
                        <span>model: {result.selected_model}</span>
                        {isRestoredResult && <span style={{ color: '#0A84FF' }}>↩ restored</span>}
                      </div>
                    </>
                  )}
                </motion.div>
              )}

              {/* METRICS */}
              {activeTab === 'metrics' && (
                <motion.div
                  key="metrics"
                  variants={tabContent} initial="hidden" animate="visible" exit="exit"
                  style={{ display: 'flex', flexDirection: 'column', gap: 12 }}
                >
                  {!result ? (
                    <Island style={{ padding: '30px 20px', textAlign: 'center' }}>
                      <div style={{ color: txSub, fontSize: 12.5, fontFamily: "'IBM Plex Mono', monospace" }}>
                        // run analysis to see metrics
                      </div>
                    </Island>
                  ) : (
                    result.videos.map((v, i) => (
                      <Island key={i} style={{ padding: '16px 18px' }}>
                        <VideoSummaryCards video={v} accent={SERIES_COLORS[i % SERIES_COLORS.length].line} />
                      </Island>
                    ))
                  )}
                </motion.div>
              )}

              {/* HISTORY */}
              {activeTab === 'history' && (
                <motion.div
                  key="history"
                  variants={tabContent} initial="hidden" animate="visible" exit="exit"
                >
                  <Island style={{ padding: '16px 18px', overflow: 'hidden' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
                      <div style={{ fontSize: 12.5, fontWeight: 600, color: txt }}>Past Analyses</div>
                      <motion.button
                        whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={fetchPastJobs}
                        disabled={pastLoading}
                        style={{
                          background: dark ? 'rgba(255,255,255,0.07)' : 'rgba(0,0,0,0.05)',
                          border: `1px solid ${dark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'}`,
                          borderRadius: 9, color: txSub, fontSize: 11.5,
                          padding: '6px 13px', cursor: 'pointer',
                          fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                          display: 'flex', alignItems: 'center', gap: 5,
                        }}
                      >
                        <Icon.Refresh s={11} /> {pastLoading ? 'Loading…' : 'Refresh'}
                      </motion.button>
                    </div>
                    <PastJobsTable jobs={pastJobs} onRestore={handleRestore} />
                  </Island>
                </motion.div>
              )}

              {/* LOG */}
              {activeTab === 'log' && (
                <motion.div
                  key="log"
                  variants={tabContent} initial="hidden" animate="visible" exit="exit"
                >
                  <Island style={{ padding: '14px 18px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                        <Icon.Terminal s={13} c="#0A84FF" />
                        <span style={{ fontSize: 11, fontWeight: 600, color: txt, letterSpacing: '0.01em' }}>System Log</span>
                      </div>
                      {logEntries.length > 0 && (
                        <motion.button
                          whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                          onClick={() => setLogEntries([])}
                          style={{
                            background: dark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.05)',
                            border: `1px solid ${dark ? 'rgba(255,255,255,0.09)' : 'rgba(0,0,0,0.09)'}`,
                            borderRadius: 7, color: txSub, fontSize: 10.5, padding: '4px 10px', cursor: 'pointer',
                            fontFamily: "'SF Pro Display', 'Satoshi', system-ui",
                          }}
                        >
                          Clear
                        </motion.button>
                      )}
                    </div>
                    <AlertLog entries={logEntries} />
                  </Island>
                </motion.div>
              )}

            </AnimatePresence>
          </motion.div>

        </div>
      </div>
    </ThemeContext.Provider>
  )
}