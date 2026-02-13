# Shrimp Tracker - Streamlit Frontend

## Overview
A professional web application for monitoring and analyzing shrimp activity using Streamlit. Features real-time video monitoring, analytics dashboards, and AI-powered health tracking.

## Features
- 📤 **Video Upload**: Upload MP4 videos directly through the web interface
- 📹 **Video Monitoring**: Play and analyze shrimp activity videos
- 📊 **Analytics Dashboard**: View movement patterns, speed distributions, and zone analysis
- 📈 **Live Metrics**: Real-time monitoring with heatmaps and health scores
- ⚙️ **Settings Panel**: Customize notifications, data retention, and display preferences
- 🎨 **Professional UI**: Clean, modern interface with interactive visualizations

## Installation

### Prerequisites
- Python 3.8 or higher
- pip package manager

### Setup Instructions

#### macOS / Linux

1. **Navigate to the streamlit_app directory**
   ```bash
   cd shrimp-tracker-frontend/streamlit_app
   ```

2. **Create a virtual environment**
   ```bash
   python3 -m venv venv
   ```

3. **Activate the virtual environment**
   ```bash
   source venv/bin/activate
   ```

4. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

#### Windows

1. **Navigate to the streamlit_app directory**
   ```cmd
   cd shrimp-tracker-frontend\streamlit_app
   ```

2. **Create a virtual environment**
   ```cmd
   python -m venv venv
   ```

3. **Activate the virtual environment**
   ```cmd
   venv\Scripts\activate
   ```

4. **Install dependencies**
   ```cmd
   pip install -r requirements.txt
   ```

## Running the Application

### macOS / Linux
```bash
cd shrimp-tracker-frontend/streamlit_app
source venv/bin/activate
streamlit run app.py
```

### Windows
```cmd
cd shrimp-tracker-frontend\streamlit_app
venv\Scripts\activate
streamlit run app.py
```

The application will open in your default browser at `http://localhost:8501`

## Stopping the Application

Press `CTRL + C` in the terminal where the app is running. You should see:
```
Stopping...
```

## Usage Guide

### Uploading Videos
1. Click the **"Upload Video"** section in the sidebar
2. Click **"Browse files"** or drag and drop an MP4 file
3. Click **"💾 Save Video"** to upload
4. The video will appear in the video selector dropdown

### Viewing Videos
1. Select a video from the **"🎥 Select Video"** dropdown
2. The video will load automatically in the Video Monitor tab
3. Use the video controls to play, pause, or navigate

### Analyzing Data
1. Navigate to the **📊 Analytics** tab
2. View movement patterns, speed distributions, and zone analysis
3. Scroll down to see raw data in table format

### Live Monitoring
1. Go to the **📈 Live Metrics** tab
2. View real-time metrics and activity heatmaps
3. Track individual shrimp health scores

### Adjusting Settings
1. Open the **⚙️ Settings** tab
2. Configure video quality, notifications, and display preferences
3. Click **"💾 Save Settings"** to apply changes

## File Structure
```
streamlit_app/
├── app.py                 # Main application file
├── requirements.txt       # Python dependencies
├── SETUP.md              # Detailed setup instructions
└── README.md             # This file
```

## Troubleshooting

### Video not loading
- Ensure the video is in MP4 format
- Check that the video file exists in `../assets/video_samples/`
- Try uploading the video again

### Application won't start
- Verify virtual environment is activated (you should see `(venv)` in terminal)
- Reinstall dependencies: `pip install -r requirements.txt`
- Check Python version: `python --version` (should be 3.8+)

### Import errors
- Make sure you're in the correct directory
- Ensure all dependencies are installed: `pip install -r requirements.txt`

### Port already in use
- If port 8501 is busy, Streamlit will automatically use the next available port
- Or specify a different port: `streamlit run app.py --server.port 8502`

## Dependencies
- streamlit >= 1.51.0
- pandas >= 2.2.0
- plotly >= 6.4.0
- numpy < 2.0
- pillow >= 12.0.0

See `requirements.txt` for complete list.

## Platform Support
- ✅ macOS (Intel & Apple Silicon M1/M2/M3)
- ✅ Windows 10/11
- ✅ Linux (Ubuntu, Debian, etc.)

## Updates

To update dependencies:
```bash
pip install -r requirements.txt --upgrade
```

## Support
For issues or questions:
1. Check the troubleshooting section above
2. Review the SETUP.md file for detailed instructions
3. Ensure all dependencies are correctly installed

## Version
v2.0 - February 2026

---
**Note**: This is the Streamlit version of the Shrimp Tracker frontend. For the HTML/CSS/JS version, see `../html_app/README.md`