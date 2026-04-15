// ============================================
// VIDEO STORAGE & MANAGEMENT
// ============================================

// Using localStorage to store video information
const VIDEO_STORAGE_KEY = 'shrimp_tracker_videos';

// Get stored videos
function getStoredVideos() {
    const stored = localStorage.getItem(VIDEO_STORAGE_KEY);
    return stored ? JSON.parse(stored) : [];
}

// Save video to storage
function saveVideoToStorage(fileName, fileData) {
    const videos = getStoredVideos();
    const existingIndex = videos.findIndex(v => v.name === fileName);

    if (existingIndex >= 0) {
        videos[existingIndex] = { name: fileName, data: fileData, uploadDate: new Date().toISOString() };
    } else {
        videos.push({ name: fileName, data: fileData, uploadDate: new Date().toISOString() });
    }

    localStorage.setItem(VIDEO_STORAGE_KEY, JSON.stringify(videos));
    updateVideoList();
}

// Update video dropdown list
function updateVideoList() {
    const videos = getStoredVideos();
    const select = document.getElementById('videoSelect');

    // Clear existing options
    select.innerHTML = '';

    if (videos.length === 0) {
        select.innerHTML = '<option value="">-- No videos available --</option>';
    } else {
        videos.forEach(video => {
            const option = document.createElement('option');
            option.value = video.name;
            option.textContent = video.name;
            select.appendChild(option);
        });

        // Auto-select first video
        if (videos.length > 0) {
            select.value = videos[0].name;
            loadVideo(videos[0].name);
        }
    }
}

// Load and display video
function loadVideo(fileName) {
    const videos = getStoredVideos();
    const video = videos.find(v => v.name === fileName);

    const videoPlayer = document.getElementById('videoPlayer');
    const videoSource = document.getElementById('videoSource');
    const videoPlaceholder = document.getElementById('videoPlaceholder');

    if (video) {
        videoSource.src = video.data;
        videoPlayer.load();
        videoPlayer.style.display = 'block';
        if (videoPlaceholder) {
            videoPlaceholder.style.display = 'none';
        }
    } else {
        videoPlayer.style.display = 'none';
        if (videoPlaceholder) {
            videoPlaceholder.style.display = 'flex';
        }
    }
}

// ============================================
// VIDEO UPLOAD FUNCTIONALITY
// ============================================

const uploadZone = document.getElementById('uploadZone');
const videoUpload = document.getElementById('videoUpload');
const uploadStatus = document.getElementById('uploadStatus');

// File input change handler
videoUpload.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (file) {
        handleVideoUpload(file);
    }
});

// Drag and drop handlers
uploadZone.addEventListener('dragover', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.add('dragging');
});

uploadZone.addEventListener('dragleave', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragging');
});

uploadZone.addEventListener('drop', function(e) {
    e.preventDefault();
    e.stopPropagation();
    uploadZone.classList.remove('dragging');

    const file = e.dataTransfer.files[0];
    if (file && file.type === 'video/mp4') {
        handleVideoUpload(file);
    } else {
        showUploadStatus('error', 'Please upload an MP4 video file');
    }
});

// Handle video upload
function handleVideoUpload(file) {
    if (file.type !== 'video/mp4') {
        showUploadStatus('error', 'Only MP4 files are supported');
        return;
    }

    // Check file size (limit to 100MB for localStorage constraints)
    const maxSize = 100 * 1024 * 1024; // 100MB
    if (file.size > maxSize) {
        showUploadStatus('error', 'File size exceeds 100MB limit');
        return;
    }

    showUploadStatus('info', 'Uploading video...');

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            saveVideoToStorage(file.name, e.target.result);
            showUploadStatus('success', `✅ ${file.name} uploaded successfully!`);

            // Select the newly uploaded video
            document.getElementById('videoSelect').value = file.name;
            loadVideo(file.name);
        } catch (error) {
            if (error.name === 'QuotaExceededError') {
                showUploadStatus('error', 'Storage quota exceeded. Please delete some videos first.');
            } else {
                showUploadStatus('error', 'Error uploading video: ' + error.message);
            }
        }
    };

    reader.onerror = function() {
        showUploadStatus('error', 'Error reading video file');
    };

    reader.readAsDataURL(file);
}

// Show upload status message
function showUploadStatus(type, message) {
    uploadStatus.innerHTML = `<div class="status-message ${type}">${message}</div>`;

    // Auto-hide after 5 seconds
    setTimeout(() => {
        uploadStatus.innerHTML = '';
    }, 5000);
}

// ============================================
// VIDEO CONTROLS
// ============================================

const videoPlayer = document.getElementById('videoPlayer');

function playVideo() {
    if (videoPlayer.src) {
        videoPlayer.play();
    } else {
        alert('No video loaded. Please upload or select a video first.');
    }
}

function pauseVideo() {
    if (videoPlayer.src) {
        videoPlayer.pause();
    }
}

function previousVideo() {
    const videos = getStoredVideos();
    const select = document.getElementById('videoSelect');
    const currentIndex = videos.findIndex(v => v.name === select.value);

    if (currentIndex > 0) {
        const prevVideo = videos[currentIndex - 1];
        select.value = prevVideo.name;
        loadVideo(prevVideo.name);
    } else {
        alert('Already at the first video');
    }
}

function nextVideo() {
    const videos = getStoredVideos();
    const select = document.getElementById('videoSelect');
    const currentIndex = videos.findIndex(v => v.name === select.value);

    if (currentIndex < videos.length - 1) {
        const nextVideo = videos[currentIndex + 1];
        select.value = nextVideo.name;
        loadVideo(nextVideo.name);
    } else {
        alert('Already at the last video');
    }
}

// Video selector change handler
document.getElementById('videoSelect').addEventListener('change', function(e) {
    if (e.target.value) {
        loadVideo(e.target.value);
    }
});

// ============================================
// TIME UPDATE
// ============================================

function updateTime() {
    const now = new Date();
    document.getElementById('currentTime').textContent = now.toLocaleTimeString();
    document.getElementById('lastUpdate').textContent = now.toLocaleString();
}

updateTime();
setInterval(updateTime, 1000);

// ============================================
// TAB SWITCHING
// ============================================

function switchTab(index) {
    const buttons = document.querySelectorAll('.tab-button');
    const contents = document.querySelectorAll('.tab-content');

    buttons.forEach((btn, i) => {
        btn.classList.toggle('active', i === index);
    });

    contents.forEach((content, i) => {
        content.classList.toggle('active', i === index);
    });
}

// ============================================
// ACTIVITY RANGE SLIDER
// ============================================

document.getElementById('activityRange').addEventListener('input', function(e) {
    document.getElementById('activityValue').textContent = e.target.value;
});

// ============================================
// DATA TABLE GENERATION
// ============================================

function populateDataTable() {
    const tbody = document.getElementById('dataTableBody');
    const shrimps = ['Shrimp-001', 'Shrimp-002', 'Shrimp-003', 'Shrimp-004'];
    const zones = ['Left', 'Center', 'Right', 'Top'];

    for (let i = 0; i < 20; i++) {
        const row = tbody.insertRow();
        const time = new Date(Date.now() - i * 3600000);

        row.innerHTML = `
            <td>${time.toLocaleTimeString()}</td>
            <td>${shrimps[i % 4]}</td>
            <td>${(Math.random() * 100).toFixed(1)}</td>
            <td>${(1 + Math.random() * 0.8).toFixed(2)}</td>
            <td>${zones[i % 4]}</td>
        `;
    }
}

// ============================================
// CHARTS INITIALIZATION
// ============================================

function initCharts() {
    // Movement chart
    const movementCtx = document.getElementById('movementChart');
    if (movementCtx && !movementCtx.chartInstance) {
        movementCtx.chartInstance = new Chart(movementCtx, {
            type: 'line',
            data: {
                labels: Array.from({length: 24}, (_, i) => `${i}:00`),
                datasets: [{
                    label: 'Shrimp-001',
                    data: Array.from({length: 24}, () => Math.random() * 100),
                    borderColor: '#1f77b4',
                    tension: 0.4
                }, {
                    label: 'Shrimp-002',
                    data: Array.from({length: 24}, () => Math.random() * 100),
                    borderColor: '#ff7f0e',
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }

    // Speed chart
    const speedCtx = document.getElementById('speedChart');
    if (speedCtx && !speedCtx.chartInstance) {
        speedCtx.chartInstance = new Chart(speedCtx, {
            type: 'bar',
            data: {
                labels: ['Shrimp-001', 'Shrimp-002', 'Shrimp-003', 'Shrimp-004'],
                datasets: [{
                    label: 'Average Speed (cm/s)',
                    data: [1.4, 1.2, 0.8, 1.6],
                    backgroundColor: ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728']
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { display: false }
                }
            }
        });
    }

    // Zone chart
    const zoneCtx = document.getElementById('zoneChart');
    if (zoneCtx && !zoneCtx.chartInstance) {
        zoneCtx.chartInstance = new Chart(zoneCtx, {
            type: 'bar',
            data: {
                labels: ['Left', 'Center', 'Right', 'Top'],
                datasets: [{
                    label: 'Shrimp-001',
                    data: [15, 25, 20, 10],
                    backgroundColor: '#1f77b4'
                }, {
                    label: 'Shrimp-002',
                    data: [20, 15, 25, 15],
                    backgroundColor: '#ff7f0e'
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: { position: 'top' }
                }
            }
        });
    }
}

// Initialize charts when analytics tab is opened
document.querySelectorAll('.tab-button')[1].addEventListener('click', function() {
    setTimeout(initCharts, 100);
}, { once: true });

// ============================================
// SETTINGS FUNCTIONS
// ============================================

function saveSettings() {
    alert('✅ Settings saved successfully!');
}

function resetSettings() {
    if (confirm('Reset all settings to defaults?')) {
        alert('Settings reset to defaults');
    }
}

// ============================================
// INITIALIZATION
// ============================================

document.addEventListener('DOMContentLoaded', function() {
    // Load existing videos
    updateVideoList();

    // Populate data table
    populateDataTable();

    // Set default dates
    const today = new Date();
    const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);

    document.getElementById('dateTo').valueAsDate = today;
    document.getElementById('dateFrom').valueAsDate = weekAgo;
});