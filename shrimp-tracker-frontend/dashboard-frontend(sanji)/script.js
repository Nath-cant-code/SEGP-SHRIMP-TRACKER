/* ============================================================
   SEGP SHRIMP MONITOR — DASHBOARD SCRIPT
   ============================================================ */

'use strict';

// ---- STATE ----
const state = {
  lastScore: null,
  currentScore: null,
  analysisRun: false,
  filename: null,
  videoSrc: null,
};

// ---- DOM REFS ----
const $ = id => document.getElementById(id);

const uploadZone      = $('uploadZone');
const fileInput       = $('fileInput');
const fileNameEl      = $('fileName');
const thresholdSlider = $('thresholdSlider');
const thresholdValue  = $('thresholdValue');
const runBtn          = $('runBtn');
const sideStatus      = $('sideStatus');

const clockTime  = $('clockTime');
const clockDate  = $('clockDate');
const statusPill = $('statusPill');
const statusDot  = $('statusDot');
const statusText = $('statusText');
const srcTag     = $('srcTag');

const originalPlaceholder = $('originalPlaceholder');
const videoPlayer         = $('videoPlayer');
const videoPlayer2        = $('videoPlayer2');
const trackingPlaceholder = $('trackingPlaceholder');
const trackingOverlay     = $('trackingOverlay');

const statShrimp = $('statShrimp');
const statSpeed  = $('statSpeed');
const statTime   = $('statTime');

const insightBar  = $('insightBar');
const insightIcon = $('insightIcon');
const insightMsg  = $('insightMsg');

const expandBtn     = $('expandBtn');
const expandArrow   = $('expandArrow');
const detailedSection = $('detailedSection');

const scoreNum   = $('scoreNum');
const scoreFill  = $('scoreFill');
const levelBadge = $('levelBadge');
const trendVal   = $('trendVal');
const envDO      = $('envDO');
const envTemp    = $('envTemp');
const envPh      = $('envPh');
const envSal     = $('envSal');
const exportBtn  = $('exportBtn');

// ---- CLOCK ----
function updateClock() {
  const now = new Date();
  clockTime.textContent = now.toLocaleTimeString('en-GB');
  clockDate.textContent = now.toLocaleDateString('en-GB', {
    weekday: 'short', day: '2-digit', month: 'short', year: 'numeric'
  });
}
updateClock();
setInterval(updateClock, 1000);

// ---- SLIDER ----
thresholdSlider.addEventListener('input', () => {
  thresholdValue.textContent = thresholdSlider.value;
});

// ---- FILE UPLOAD ----
uploadZone.addEventListener('click', () => fileInput.click());

uploadZone.addEventListener('dragover', e => {
  e.preventDefault();
  uploadZone.style.borderColor = '#2dd4bf';
});

uploadZone.addEventListener('dragleave', () => {
  uploadZone.style.borderColor = '';
});

uploadZone.addEventListener('drop', e => {
  e.preventDefault();
  uploadZone.style.borderColor = '';
  const file = e.dataTransfer.files[0];
  if (file) handleFile(file);
});

fileInput.addEventListener('change', () => {
  if (fileInput.files[0]) handleFile(fileInput.files[0]);
});

function handleFile(file) {
  if (!file.type.startsWith('video/')) {
    alert('Please upload a valid video file.');
    return;
  }

  state.filename = file.name;
  const shortName = file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name;
  fileNameEl.textContent = shortName;

  const url = URL.createObjectURL(file);
  state.videoSrc = url;

  // Show video in original panel
  originalPlaceholder.style.display = 'none';
  videoPlayer.src = url;
  videoPlayer.style.display = 'block';
  videoPlayer.play().catch(() => {});

  // Tracking panel — same video, YOLO placeholder
  trackingPlaceholder.style.display = 'none';
  videoPlayer2.src = url;
  videoPlayer2.style.display = 'block';
  videoPlayer2.play().catch(() => {});
  trackingOverlay.style.display = 'flex';

  srcTag.textContent = shortName;
  updateStatus('ready');
}

// ---- STATUS ----
function updateStatus(mode) {
  const dot = statusDot;
  const text = statusText;

  dot.className = 'status-dot';
  if (mode === 'active') {
    dot.classList.add('green');
    text.textContent = 'Monitoring Active';
    sideStatus.textContent = 'Running';
  } else if (mode === 'low') {
    dot.classList.add('red');
    text.textContent = 'Low Activity';
    sideStatus.textContent = 'Low Activity';
  } else if (mode === 'ready') {
    dot.classList.add('amber');
    text.textContent = 'Ready — Run Analysis';
    sideStatus.textContent = 'Standby';
  } else {
    text.textContent = 'Awaiting Input';
    sideStatus.textContent = 'Idle';
  }
}

// ---- RANDOM DATA ----
function rand(min, max) {
  return Math.round(Math.random() * (max - min) + min);
}

function randFloat(min, max, dec = 1) {
  return parseFloat((Math.random() * (max - min) + min).toFixed(dec));
}

function generateAnalysisData(threshold) {
  const score = rand(10, 100);
  const shrimpCount = rand(8, 60);
  const avgSpeed = randFloat(0.5, 8.5);
  const activeTime = rand(30, 95);

  const level = score < 35 ? 'Low' : score < 65 ? 'Moderate' : 'High';

  const envData = {
    do: randFloat(4.5, 9.0) + ' mg/L',
    temp: randFloat(26, 32) + ' °C',
    ph: randFloat(7.0, 8.5, 2),
    salinity: rand(10, 28) + ' ppt',
  };

  return { score, shrimpCount, avgSpeed, activeTime, level, envData };
}

// ---- INSIGHT MESSAGES ----
function getInsight(level, score, threshold) {
  if (score < threshold) {
    const messages = [
      'Low activity detected — check dissolved oxygen levels.',
      'Activity below threshold — consider water quality inspection.',
      'Reduced movement observed — monitor feeding schedule.',
      'Below-threshold activity — review aeration systems.',
    ];
    return { msg: messages[rand(0, messages.length - 1)], icon: '⚠' };
  }

  if (level === 'High') {
    const messages = [
      'High activity detected — shrimp behaviour is healthy.',
      'Strong movement patterns — optimal feeding response likely.',
      'Above-threshold activity — pond conditions appear favourable.',
    ];
    return { msg: messages[rand(0, messages.length - 1)], icon: '✓' };
  }

  const messages = [
    'Moderate activity — conditions within normal range.',
    'Steady movement patterns — no immediate action required.',
    'Activity is within acceptable parameters.',
  ];
  return { msg: messages[rand(0, messages.length - 1)], icon: '💡' };
}

// ---- TREND ----
function getTrend(prev, current) {
  if (prev === null) return { symbol: '→', label: 'Baseline' };
  const diff = current - prev;
  if (diff > 5) return { symbol: '↑', label: 'Improving' };
  if (diff < -5) return { symbol: '↓', label: 'Declining' };
  return { symbol: '→', label: 'Stable' };
}

// ---- CHARTS ----
let lineChart = null;
let barChart = null;

const baseScaleConfig = {
  x: {
    grid: { display: false },
    ticks: {
      color: '#94a3b8',
      font: { family: 'IBM Plex Mono', size: 9 },
      maxRotation: 0,
    },
    border: { color: '#e2e8f0' },
  },
  y: {
    grid: { color: '#f1f5f9', lineWidth: 1 },
    ticks: {
      color: '#94a3b8',
      font: { family: 'IBM Plex Mono', size: 9 },
      maxTicksLimit: 5,
    },
    border: { color: '#e2e8f0' },
  },
};

const basePlugins = {
  legend: { display: false },
  tooltip: {
    enabled: true,
    backgroundColor: '#0f172a',
    titleColor: '#94a3b8',
    bodyColor: '#f1f5f9',
    padding: 8,
    cornerRadius: 4,
    displayColors: false,
  },
};

function buildCharts(score) {
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  const barCtx  = document.getElementById('barChart').getContext('2d');

  const timeLabels = ['0s', '10s', '20s', '30s', '40s', '50s', '60s'];
  const speedData  = timeLabels.map(() => randFloat(0.5, 9));
  const distLabels = ['0–2', '2–4', '4–6', '6–8', '8–10'];
  // Ensure no zero values — minimum bar of 1 so no empty gaps
  const distData = distLabels.map(() => Math.max(1, rand(1, 20)));

  if (lineChart) lineChart.destroy();
  if (barChart)  barChart.destroy();

  lineChart = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        data: speedData,
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45,212,191,0.07)',
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: '#2dd4bf',
        fill: true,
        tension: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      layout: {
        padding: { top: 8, bottom: 4, left: 4, right: 8 },
      },
      plugins: { ...basePlugins },
      scales: { ...baseScaleConfig },
    },
  });

  barChart = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: distLabels,
      datasets: [{
        data: distData,
        backgroundColor: 'rgba(45,212,191,0.45)',
        borderColor: '#14b8a6',
        borderWidth: 1,
        borderRadius: 2,
        barPercentage: 0.7,
        categoryPercentage: 0.8,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 400 },
      layout: {
        padding: { top: 8, bottom: 4, left: 4, right: 8 },
      },
      plugins: { ...basePlugins },
      scales: {
        ...baseScaleConfig,
        y: {
          ...baseScaleConfig.y,
          beginAtZero: true,
        },
      },
    },
  });
}

// ---- RUN ANALYSIS ----
runBtn.addEventListener('click', () => {
  if (!state.videoSrc) {
    alert('Please upload a video file before running analysis.');
    return;
  }

  const threshold = parseInt(thresholdSlider.value, 10);
  const data = generateAnalysisData(threshold);

  state.lastScore = state.currentScore;
  state.currentScore = data.score;
  state.analysisRun = true;

  // Status
  const mode = data.score < threshold ? 'low' : 'active';
  updateStatus(mode);

  // Stats row
  statShrimp.textContent = data.shrimpCount;
  statSpeed.textContent  = data.avgSpeed + ' px/s';
  statTime.textContent   = data.activeTime + '%';

  // Insight
  const insight = getInsight(data.level, data.score, threshold);
  insightIcon.textContent = insight.icon;
  insightMsg.textContent  = insight.msg;

  // Detailed
  scoreNum.textContent = data.score;
  scoreFill.style.width = data.score + '%';

  levelBadge.textContent = data.level;
  levelBadge.className = 'level-badge ' + data.level.toLowerCase();

  const trend = getTrend(state.lastScore, state.currentScore);
  trendVal.textContent = trend.symbol + ' ' + trend.label;

  envDO.textContent   = data.envData.do;
  envTemp.textContent = data.envData.temp;
  envPh.textContent   = data.envData.ph;
  envSal.textContent  = data.envData.salinity;

  buildCharts(data.score);

  // Store for CSV export
  runBtn._lastData = data;
  runBtn._threshold = threshold;
});

// ---- EXPAND TOGGLE ----
expandBtn.addEventListener('click', () => {
  const isOpen = detailedSection.classList.contains('open');
  if (isOpen) {
    detailedSection.classList.remove('open');
    expandArrow.classList.remove('open');
  } else {
    detailedSection.classList.add('open');
    expandArrow.classList.add('open');
  }
});

// ---- CSV EXPORT ----
exportBtn.addEventListener('click', () => {
  const data = runBtn._lastData;
  if (!data) {
    alert('Run an analysis first before downloading the report.');
    return;
  }

  const threshold = runBtn._threshold ?? 40;
  const now = new Date().toISOString();
  const trend = getTrend(state.lastScore, state.currentScore);

  const rows = [
    ['Field', 'Value'],
    ['Timestamp', now],
    ['File', state.filename ?? '—'],
    ['Activity Score', data.score],
    ['Activity Level', data.level],
    ['Trend', trend.label],
    ['Total Shrimp', data.shrimpCount],
    ['Avg Speed (px/s)', data.avgSpeed],
    ['Active Time (%)', data.activeTime],
    ['Threshold', threshold],
    ['DO Level', data.envData.do],
    ['Temperature', data.envData.temp],
    ['pH', data.envData.ph],
    ['Salinity', data.envData.salinity],
    ['Disclaimer', 'AI-generated — validate before operational use'],
  ];

  const csv = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `shrimp_report_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});