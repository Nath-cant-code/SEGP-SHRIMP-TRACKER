/* ============================================================
   SEGP SHRIMP MONITOR — DASHBOARD SCRIPT
   ============================================================ */

'use strict';

// ---- STATE ----
const state = {
  lastScore:    null,
  currentScore: null,
  analysisRun:  false,
  filename:     null,
  mediaSrc:     null,   // unified src (replaces videoSrc)
  fileType:     null,   // 'video' | 'image'
  isProcessing: false,
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
const metaMode        = $('metaMode');

const clockTime  = $('clockTime');
const clockDate  = $('clockDate');
const statusPill = $('statusPill');
const statusDot  = $('statusDot');
const statusText = $('statusText');
const srcTag     = $('srcTag');
const modeBadge  = $('modeBadge');

const originalPlaceholder = $('originalPlaceholder');
const videoPlayer         = $('videoPlayer');
const imageDisplay        = $('imageDisplay');
const videoPlayer2        = $('videoPlayer2');
const imageDisplay2       = $('imageDisplay2');
const trackingPlaceholder = $('trackingPlaceholder');
const trackingOverlay     = $('trackingOverlay');
const overlayLabel        = $('overlayLabel');
const loadingOverlay      = $('loadingOverlay');
const loadingText         = $('loadingText');
const loadingSub          = $('loadingSub');
const trackingTag         = $('trackingTag');

const statShrimp = $('statShrimp');
const statSpeed  = $('statSpeed');
const statTime   = $('statTime');

const insightBar  = $('insightBar');
const insightIcon = $('insightIcon');
const insightMsg  = $('insightMsg');

const expandBtn       = $('expandBtn');
const expandArrow     = $('expandArrow');
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

// ---- FILE TYPE DETECTION ----
function detectFileType(file) {
  if (file.type.startsWith('video/')) return 'video';
  if (file.type.startsWith('image/')) return 'image';
  return null;
}

// ---- RESET MEDIA PANELS ----
// Hides all media elements in both panels, resets to clean slate.
function resetMediaPanels() {
  videoPlayer.style.display    = 'none';
  videoPlayer.src              = '';
  imageDisplay.style.display   = 'none';
  imageDisplay.src             = '';

  videoPlayer2.style.display   = 'none';
  videoPlayer2.src             = '';
  imageDisplay2.style.display  = 'none';
  imageDisplay2.src            = '';

  trackingOverlay.style.display = 'none';
  loadingOverlay.style.display  = 'none';

  originalPlaceholder.style.display = 'flex';
  trackingPlaceholder.style.display = 'flex';
}

// ---- SHOW ORIGINAL MEDIA ----
function showOriginalMedia(src, type) {
  originalPlaceholder.style.display = 'none';

  if (type === 'video') {
    imageDisplay.style.display  = 'none';
    videoPlayer.src             = src;
    videoPlayer.style.display   = 'block';
    videoPlayer.play().catch(() => {});
  } else {
    videoPlayer.style.display   = 'none';
    imageDisplay.src            = src;
    imageDisplay.style.display  = 'block';
  }
}

// ---- SHOW TRACKING MEDIA ----
function showTrackingMedia(src, type) {
  loadingOverlay.style.display  = 'none';
  trackingPlaceholder.style.display = 'none';

  if (type === 'video') {
    imageDisplay2.style.display  = 'none';
    videoPlayer2.src             = src;
    videoPlayer2.style.display   = 'block';
    videoPlayer2.play().catch(() => {});
  } else {
    videoPlayer2.style.display   = 'none';
    imageDisplay2.src            = src;
    imageDisplay2.style.display  = 'block';
  }

  trackingOverlay.style.display = 'flex';
}

// ---- UPDATE MODE BADGE & META ----
function applyModeUI(type) {
  if (type === 'video') {
    modeBadge.textContent    = 'VIDEO MODE';
    modeBadge.style.display  = 'inline-flex';
    modeBadge.style.background = 'rgba(45,212,191,0.15)';
    modeBadge.style.color    = '#2dd4bf';
    metaMode.textContent     = 'Video / Upload';
    overlayLabel.textContent = 'TRACKING ACTIVE — YOLO PLACEHOLDER';
    trackingTag.textContent  = 'YOLO Ready';
    loadingText.textContent  = 'Analyzing video…';
    loadingSub.textContent   = 'Running AquaVision model';
  } else {
    modeBadge.textContent    = 'IMAGE MODE';
    modeBadge.style.display  = 'inline-flex';
    modeBadge.style.background = 'rgba(139,92,246,0.15)';
    modeBadge.style.color    = '#a78bfa';
    metaMode.textContent     = 'Image / Upload';
    overlayLabel.textContent = 'ANALYSIS COMPLETE — YOLO PLACEHOLDER';
    trackingTag.textContent  = 'Frame Scan';
    loadingText.textContent  = 'Analyzing image…';
    loadingSub.textContent   = 'Running AquaVision model';
  }
}

// ---- HANDLE FILE ----
function handleFile(file) {
  const type = detectFileType(file);

  if (!type) {
    alert('Please upload a valid video (MP4, MOV, AVI) or image (JPG, PNG) file.');
    return;
  }

  // Revoke previous object URL to avoid memory leaks
  if (state.mediaSrc) {
    URL.revokeObjectURL(state.mediaSrc);
  }

  state.filename = file.name;
  state.fileType = type;

  const shortName = file.name.length > 24 ? file.name.slice(0, 22) + '…' : file.name;
  fileNameEl.textContent = shortName;

  const url = URL.createObjectURL(file);
  state.mediaSrc = url;

  // Reset panels to clean state before showing new media
  resetMediaPanels();

  // Show the uploaded media in the original panel
  showOriginalMedia(url, type);

  // Apply mode-specific UI labels and badges
  applyModeUI(type);

  srcTag.textContent = shortName;
  updateStatus('ready');

  // AUTO RUN: kick off analysis immediately after upload
  runAnalysis();
}

// ---- STATUS ----
function updateStatus(mode) {
  statusDot.className = 'status-dot';
  const label = state.fileType === 'image' ? 'image' : 'video';

  if (mode === 'active') {
    statusDot.classList.add('green');
    statusText.textContent = 'Monitoring Active';
    sideStatus.textContent = 'Running';
  } else if (mode === 'low') {
    statusDot.classList.add('red');
    statusText.textContent = 'Low Activity';
    sideStatus.textContent = 'Low Activity';
  } else if (mode === 'ready') {
    statusDot.classList.add('amber');
    statusText.textContent = 'Ready — Run Analysis';
    sideStatus.textContent = 'Standby';
  } else if (mode === 'processing') {
    statusDot.classList.add('amber');
    statusText.textContent = `Analyzing ${label}…`;
    sideStatus.textContent = 'Processing';
  } else {
    statusText.textContent = 'Awaiting Input';
    sideStatus.textContent = 'Idle';
  }
}

// ---- LOADING STATE ----
function setLoadingUI(isLoading) {
  state.isProcessing = isLoading;

  if (isLoading) {
    runBtn.disabled      = true;
    runBtn.textContent   = '⏳  Processing…';
    runBtn.style.opacity = '0.6';
    runBtn.style.cursor  = 'not-allowed';

    // Hide any tracking media, show loading overlay
    trackingPlaceholder.style.display = 'none';
    videoPlayer2.style.display        = 'none';
    imageDisplay2.style.display       = 'none';
    trackingOverlay.style.display     = 'none';
    loadingOverlay.style.display      = 'flex';

    updateStatus('processing');
  } else {
    runBtn.disabled      = false;
    runBtn.innerHTML     = '▶ &nbsp; Run Analysis';
    runBtn.style.opacity = '';
    runBtn.style.cursor  = '';

    // Hide loading overlay; show tracking result
    loadingOverlay.style.display = 'none';
    if (state.mediaSrc) {
      showTrackingMedia(state.mediaSrc, state.fileType);
    }
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
  const score        = rand(10, 100);
  const shrimpCount  = rand(8, 60);
  const avgSpeed     = randFloat(0.5, 8.5);
  const activeTime   = rand(30, 95);
  const level        = score < 35 ? 'Low' : score < 65 ? 'Moderate' : 'High';

  const envData = {
    do:       randFloat(4.5, 9.0) + ' mg/L',
    temp:     randFloat(26, 32) + ' °C',
    ph:       randFloat(7.0, 8.5, 2),
    salinity: rand(10, 28) + ' ppt',
  };

  return { score, shrimpCount, avgSpeed, activeTime, level, envData };
}

// ---- INSIGHT MESSAGES ----
function getInsight(level, score, threshold, shrimpCount, avgSpeed) {
  if (score < 20) {
    return {
      msg: `Critical: Activity score is very low at ${score}/100 with only ${shrimpCount} shrimp detected. Immediately check dissolved oxygen and water temperature — this level of inactivity may indicate stress.`,
      icon: '🚨',
    };
  }

  if (score < threshold) {
    const messages = [
      `Activity score of ${score}/100 is below your threshold of ${threshold}. Average speed is ${avgSpeed} px/s — consider checking dissolved oxygen levels and aeration systems.`,
      `Score ${score}/100 falls short of target (${threshold}). With ${shrimpCount} shrimp at ${avgSpeed} px/s avg speed, a water quality inspection is recommended.`,
      `Below-threshold activity at ${score}/100. Reduced movement detected across ${shrimpCount} shrimp — review feeding schedule and water circulation.`,
    ];
    return { msg: messages[rand(0, messages.length - 1)], icon: '⚠️' };
  }

  if (level === 'High') {
    const messages = [
      `Excellent — activity score of ${score}/100 indicates healthy behaviour. ${shrimpCount} shrimp detected at ${avgSpeed} px/s avg speed. Pond conditions appear optimal.`,
      `Strong result: ${score}/100 with vigorous movement across ${shrimpCount} shrimp. Above-threshold activity suggests a good feeding response and stable water quality.`,
      `High activity confirmed at ${score}/100. Your ${shrimpCount} shrimp colony is moving well — no intervention required at this time.`,
    ];
    return { msg: messages[rand(0, messages.length - 1)], icon: '✅' };
  }

  const messages = [
    `Moderate activity at ${score}/100 — within acceptable range. ${shrimpCount} shrimp averaging ${avgSpeed} px/s. Continue routine monitoring; no immediate action needed.`,
    `Score ${score}/100 is stable. Movement patterns across ${shrimpCount} shrimp are normal. Keep an eye on environmental signals and re-run analysis after feeding.`,
    `Activity is steady at ${score}/100 with ${shrimpCount} shrimp detected. Conditions appear normal — consider re-analysing after 30 minutes to confirm the trend.`,
  ];
  return { msg: messages[rand(0, messages.length - 1)], icon: '💡' };
}

// ---- TREND ----
function getTrend(prev, current) {
  if (prev === null) return { symbol: '→', label: 'Baseline' };
  const diff = current - prev;
  if (diff > 5)  return { symbol: '↑', label: 'Improving' };
  if (diff < -5) return { symbol: '↓', label: 'Declining' };
  return { symbol: '→', label: 'Stable' };
}

// ---- CHART OPTIONS (shared base) ----
const baseChartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  layout: {
    padding: { top: 8, bottom: 4, left: 4, right: 8 },
  },
  plugins: {
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
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        color: '#94a3b8',
        font: { family: "'SF Mono', 'Fira Code', monospace", size: 9 },
        maxRotation: 0,
      },
      border: { color: '#e2e8f0' },
    },
    y: {
      grid: { color: '#f1f5f9' },
      ticks: {
        color: '#94a3b8',
        font: { family: "'SF Mono', 'Fira Code', monospace", size: 9 },
        maxTicksLimit: 5,
      },
      border: { color: '#e2e8f0' },
    },
  },
  animation: { duration: 400 },
};

// ---- CHARTS ----
let lineChartInst = null;
let barChartInst  = null;

function buildCharts(score) {
  const lineCtx = document.getElementById('lineChart').getContext('2d');
  const barCtx  = document.getElementById('barChart').getContext('2d');

  const timeLabels = ['0s', '10s', '20s', '30s', '40s', '50s', '60s'];
  const speedData = (() => {
    let v = randFloat(2, 6);
    return timeLabels.map(() => {
      v = Math.max(0.5, Math.min(9, v + randFloat(-1.2, 1.2)));
      return parseFloat(v.toFixed(1));
    });
  })();

  const distLabels = ['0–2', '2–4', '4–6', '6–8', '8–10'];
  const distData   = distLabels.map(() => Math.max(1, rand(1, 20)));

  if (lineChartInst) lineChartInst.destroy();
  if (barChartInst)  barChartInst.destroy();

  lineChartInst = new Chart(lineCtx, {
    type: 'line',
    data: {
      labels: timeLabels,
      datasets: [{
        data: speedData,
        label: 'Speed (px/s)',
        borderColor: '#2dd4bf',
        backgroundColor: 'rgba(45,212,191,0.06)',
        borderWidth: 1.5,
        pointRadius: 2,
        pointHoverRadius: 4,
        pointBackgroundColor: '#2dd4bf',
        pointBorderColor: 'transparent',
        fill: true,
        tension: 0.4,
      }],
    },
    options: { ...baseChartOptions },
  });

  barChartInst = new Chart(barCtx, {
    type: 'bar',
    data: {
      labels: distLabels,
      datasets: [{
        data: distData,
        label: 'Count',
        backgroundColor: 'rgba(45,212,191,0.45)',
        borderColor: '#14b8a6',
        borderWidth: 1,
        borderRadius: 3,
        minBarLength: 4,
      }],
    },
    options: {
      ...baseChartOptions,
      scales: {
        ...baseChartOptions.scales,
        x: {
          ...baseChartOptions.scales.x,
          ticks: { ...baseChartOptions.scales.x.ticks, display: true, autoSkip: false },
        },
        y: { ...baseChartOptions.scales.y, beginAtZero: true },
      },
    },
  });
}

// ---- CORE ANALYSIS LOGIC ----
function runAnalysis() {
  if (!state.mediaSrc) {
    alert('Please upload a video or image file before running analysis.');
    return;
  }

  if (state.isProcessing) return; // prevent double-trigger

  const threshold = parseInt(thresholdSlider.value, 10);

  setLoadingUI(true);

  // Images resolve faster than videos (feel more instant)
  const delay = state.fileType === 'image' ? rand(800, 1400) : rand(1500, 2000);

  setTimeout(() => {
    const data = generateAnalysisData(threshold);

    state.lastScore    = state.currentScore;
    state.currentScore = data.score;
    state.analysisRun  = true;

    setLoadingUI(false); // shows tracking media + overlay

    const mode = data.score < threshold ? 'low' : 'active';
    updateStatus(mode);

    statShrimp.textContent = data.shrimpCount;
    statSpeed.textContent  = data.avgSpeed + ' px/s';
    statTime.textContent   = data.activeTime + '%';

    const insight = getInsight(data.level, data.score, threshold, data.shrimpCount, data.avgSpeed);
    insightIcon.textContent = insight.icon;
    insightMsg.textContent  = insight.msg;

    scoreNum.textContent  = data.score;
    scoreFill.style.width = data.score + '%';

    levelBadge.textContent = data.level;
    levelBadge.className   = 'level-badge ' + data.level.toLowerCase();

    const trend = getTrend(state.lastScore, state.currentScore);
    trendVal.textContent = trend.symbol + ' ' + trend.label;

    envDO.textContent   = data.envData.do;
    envTemp.textContent = data.envData.temp;
    envPh.textContent   = data.envData.ph;
    envSal.textContent  = data.envData.salinity;

    buildCharts(data.score);

    // Store for CSV export
    runBtn._lastData  = data;
    runBtn._threshold = threshold;
  }, delay);
}

// ---- RUN BUTTON (manual re-run) ----
runBtn.addEventListener('click', runAnalysis);

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
  const now       = new Date().toISOString();
  const trend     = getTrend(state.lastScore, state.currentScore);

  const rows = [
    ['Field',             'Value'],
    ['Timestamp',         now],
    ['File',              state.filename ?? '—'],
    ['File Type',         state.fileType ?? '—'],
    ['Activity Score',    data.score],
    ['Activity Level',    data.level],
    ['Trend',             trend.label],
    ['Total Shrimp',      data.shrimpCount],
    ['Avg Speed (px/s)',  data.avgSpeed],
    ['Active Time (%)',   data.activeTime],
    ['Threshold',         threshold],
    ['DO Level',          data.envData.do],
    ['Temperature',       data.envData.temp],
    ['pH',                data.envData.ph],
    ['Salinity',          data.envData.salinity],
    ['Disclaimer',        'AI-generated — validate before operational use'],
  ];

  const csv  = rows.map(r => r.map(v => `"${v}"`).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `shrimp_report_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
});