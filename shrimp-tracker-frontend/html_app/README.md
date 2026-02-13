# Shrimp Tracker - HTML/CSS/JS Frontend

## Overview
A pure HTML/CSS/JavaScript application for monitoring and analyzing shrimp activity. No server-side dependencies required - runs entirely in the browser with localStorage for video management.

## Features
- 📤 **Drag & Drop Upload**: Upload MP4 videos via drag-and-drop or file browser
- 💾 **Browser Storage**: Videos stored in browser's localStorage (no database needed)
- 📹 **Video Player**: Full-featured video player with controls
- 📊 **Interactive Charts**: Beautiful visualizations using Chart.js
- 📈 **Real-time Dashboard**: Live metrics and activity heatmaps
- ⚙️ **Customizable Settings**: Configure all aspects of the application
- 📱 **Responsive Design**: Works on desktop, tablet, and mobile devices
- 🎨 **Modern UI**: Professional gradient design with smooth animations

## Installation

### No Installation Required!
This is a pure frontend application. Simply open `index.html` in your browser.

### For Local Development (Recommended)

Since browsers restrict local file access for security reasons, it's best to run a local web server:

#### Option 1: Python (macOS / Linux / Windows)

```bash
# Navigate to the html_app directory
cd shrimp-tracker-frontend/html_app

# Python 3
python3 -m http.server 8000

# Or Python 2
python -m SimpleHTTPServer 8000
```

Then open: `http://localhost:8000`

#### Option 2: Node.js (if installed)

```bash
# Install http-server globally (one-time)
npm install -g http-server

# Navigate to html_app directory
cd shrimp-tracker-frontend/html_app

# Run server
http-server -p 8000
```

Then open: `http://localhost:8000`

#### Option 3: VS Code Live Server Extension

1. Install "Live Server" extension in VS Code
2. Right-click on `index.html`
3. Select "Open with Live Server"

#### Option 4: Direct File Access (Limited)

You can open `index.html` directly in your browser, but some features may be limited due to CORS restrictions:

```bash
# macOS
open index.html

# Windows
start index.html

# Linux
xdg-open index.html
```

## File Structure

```
html_app/
├── index.html           # Main HTML structure
├── css/
│   └── styles.css       # All styling and layout
├── js/
│   └── app.js          # Application logic and functionality
└── README.md           # This file
```

## Usage Guide

### Uploading Videos

#### Method 1: Drag & Drop
1. Drag an MP4 file from your file explorer
2. Drop it on the **"Upload Video"** area in the sidebar
3. The video will be processed and stored automatically

#### Method 2: File Browser
1. Click the **"Browse Files"** button in the Upload Video section
2. Select an MP4 file from your computer
3. The video will be uploaded automatically

**Important Notes:**
- Only MP4 format is supported
- Maximum file size: 100MB (browser localStorage limitation)
- Videos are stored in your browser's localStorage
- Clearing browser data will delete stored videos

### Viewing Videos
1. After upload, the video appears in the **"Select Video"** dropdown
2. Select any video from the dropdown to play it
3. Use the video player controls or the buttons below to control playback

### Navigating Videos
- **Previous**: View the previous video in the list
- **Pause**: Pause the current video
- **Play**: Resume or start video playback
- **Next**: View the next video in the list

### Exploring Features

#### 📹 Video Monitor Tab
- Main video player
- Quick statistics panel
- Real-time alerts

#### 📊 Analytics Tab
- Movement distance charts over time
- Speed distribution analysis
- Zone distribution visualization
- Raw data table

#### 📈 Live Metrics Tab
- Real-time monitoring metrics
- Activity heatmap
- Individual shrimp tracking table

#### ⚙️ Settings Tab
- Video quality settings
- Data retention preferences
- Notification configuration
- Display customization

## Browser Compatibility

### Fully Supported
- ✅ Chrome 90+ (macOS, Windows, Linux)
- ✅ Edge 90+
- ✅ Firefox 88+
- ✅ Safari 14+ (macOS, iOS)

### Partial Support
- ⚠️ Older browsers may have limited functionality
- ⚠️ Internet Explorer is not supported

## Storage Limitations

### localStorage Limits
- **Chrome/Edge**: ~10MB
- **Firefox**: ~10MB
- **Safari**: ~5MB on older versions, ~10MB on newer

### Video Guidelines
- Keep videos under 100MB for best performance
- Smaller videos = more videos can be stored
- Consider compressing videos before upload
- Delete old videos if you run out of storage

### Checking Storage Usage
Open browser console (F12) and type:
```javascript
// Check used storage
console.log('Storage used:', (JSON.stringify(localStorage).length / 1024 / 1024).toFixed(2), 'MB');
```

### Clearing Storage
If you need to clear all stored videos:
```javascript
// WARNING: This deletes all stored videos
localStorage.removeItem('shrimp_tracker_videos');
```

## Technical Details

### Technologies Used
- **HTML5**: Semantic markup and video player
- **CSS3**: Modern styling with flexbox and grid
- **JavaScript (ES6+)**: Application logic
- **Chart.js**: Data visualization
- **Font Awesome**: Icons
- **localStorage API**: Client-side video storage

### Key Features
- **No Backend Required**: Runs entirely in the browser
- **Offline Capable**: Works without internet (after initial load)
- **Cross-Platform**: Works on all major operating systems
- **Mobile Responsive**: Adapts to different screen sizes
- **Fast Loading**: No server round trips needed

## Customization

### Changing Colors
Edit `css/styles.css` and modify the CSS variables:
```css
:root {
    --primary-color: #1f77b4;  /* Main theme color */
    --success-color: #2ecc71;  /* Success indicators */
    --warning-color: #f39c12;  /* Warning alerts */
    /* ... etc */
}
```

### Adding Features
Modify `js/app.js` to add new functionality. The code is well-commented and organized into sections:
- Video Storage & Management
- Video Upload Functionality
- Video Controls
- Tab Switching
- Charts Initialization
- Settings Functions

## Troubleshooting

### Videos not uploading
- **Check file size**: Must be under 100MB
- **Check format**: Only MP4 is supported
- **Check storage**: Browser may be out of storage space
- **Try incognito mode**: To rule out extension conflicts

### Video not playing
- **Check console**: Press F12 and look for errors
- **Try re-uploading**: The file may be corrupted
- **Check format**: Ensure it's a valid MP4 file
- **Update browser**: Use the latest browser version

### Charts not displaying
- **Check internet connection**: Chart.js loads from CDN
- **Open Analytics tab**: Charts load when tab is clicked
- **Refresh page**: Sometimes a refresh helps
- **Check console**: Look for JavaScript errors (F12)

### Page not loading properly
- **Use a local server**: Don't open HTML file directly
- **Clear cache**: Try hard refresh (Ctrl+Shift+R or Cmd+Shift+R)
- **Check console**: Look for errors in developer tools
- **Try different browser**: Rule out browser-specific issues

### Out of storage space
```javascript
// In browser console, check storage usage
console.log((JSON.stringify(localStorage).length / 1024 / 1024).toFixed(2) + ' MB used');

// Clear old videos if needed
localStorage.removeItem('shrimp_tracker_videos');
```

## Performance Tips

### For Better Performance
1. **Compress videos** before uploading (use ffmpeg or online tools)
2. **Delete old videos** you no longer need
3. **Use smaller resolution** for videos when possible
4. **Close unused tabs** to free up browser memory
5. **Use modern browser** (latest Chrome, Firefox, or Edge)

### Recommended Video Settings
```bash
# Example ffmpeg command to compress video
ffmpeg -i input.mp4 -vcodec libx264 -crf 28 output.mp4
```

## Security & Privacy

### Data Privacy
- ✅ All data stored locally in your browser
- ✅ No data sent to external servers
- ✅ Videos never leave your computer
- ✅ No tracking or analytics

### Storage Location
Videos are stored in your browser's localStorage, which is specific to:
- The browser you're using
- The domain/port you're accessing
- Your user profile

## Deployment

### Hosting Options
This app can be deployed to:
- **GitHub Pages**: Free static hosting
- **Netlify**: Free with automatic deployments
- **Vercel**: Free tier available
- **AWS S3**: Static website hosting
- **Any web server**: Apache, Nginx, etc.

### Example: GitHub Pages Deployment
```bash
# 1. Create a new repository on GitHub
# 2. Add files to repository
git add html_app/
git commit -m "Deploy Shrimp Tracker"
git push

# 3. Enable GitHub Pages in repository settings
# 4. Access at: https://yourusername.github.io/repository-name/html_app/
```

## Version
v2.0 - February 2026

## Support
For issues or questions:
1. Check browser console (F12) for error messages
2. Review troubleshooting section above
3. Ensure you're using a supported browser
4. Try clearing browser cache and localStorage

---

**Note**: This is the HTML/CSS/JS version of the Shrimp Tracker frontend. For the Streamlit version with backend integration, see `../streamlit_app/README.md`