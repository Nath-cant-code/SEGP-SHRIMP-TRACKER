import streamlit as st
import pandas as pd
import plotly.express as px
import plotly.graph_objects as go
from datetime import datetime, timedelta
import os

# Page config
st.set_page_config(
    page_title="Shrimp Tracker Pro",
    page_icon="🦐",
    layout="wide",
    initial_sidebar_state="expanded"
)

# Custom CSS for better UI
st.markdown("""
    <style>
    .main-header {
        font-size: 2.5rem;
        font-weight: bold;
        color: #1f77b4;
        text-align: center;
        margin-bottom: 1rem;
    }
    .metric-card {
        background-color: #f0f2f6;
        padding: 1rem;
        border-radius: 10px;
        border-left: 4px solid #1f77b4;
    }
    .stTabs [data-baseweb="tab-list"] {
        gap: 2rem;
    }
    .stTabs [data-baseweb="tab"] {
        height: 3rem;
        padding: 0 2rem;
    }
    </style>
""", unsafe_allow_html=True)

# Header
st.markdown('<p class="main-header">🦐 Shrimp Tracker Pro</p>', unsafe_allow_html=True)

# Sidebar configuration
with st.sidebar:
    st.image("https://via.placeholder.com/150x100/1f77b4/ffffff?text=Shrimp+Logo", use_container_width=True)
    st.markdown("### 📊 Dashboard Controls")

    # Video selection
    video_list = ["20_Oct_2025_9-06pm_1.mp4", "20_Oct_2025_9-06pm_2.mp4"]
    video_choice = st.selectbox("🎥 Select Video", video_list, index=0)

    # Date range filter
    st.markdown("### 📅 Date Range")
    date_range = st.date_input(
        "Select date range",
        value=(datetime.now() - timedelta(days=7), datetime.now()),
        max_value=datetime.now()
    )

    # Shrimp filter
    st.markdown("### 🦐 Shrimp Filter")
    shrimp_ids = st.multiselect(
        "Filter by Shrimp ID",
        options=["All", "Shrimp-001", "Shrimp-002", "Shrimp-003", "Shrimp-004"],
        default=["All"]
    )

    # Activity threshold
    st.markdown("### ⚡ Activity Threshold")
    activity_threshold = st.slider("Minimum activity level", 0.0, 10.0, 2.0, 0.1)

    st.markdown("---")
    st.markdown("### 🔄 Auto-refresh")
    auto_refresh = st.checkbox("Enable auto-refresh", value=False)
    if auto_refresh:
        refresh_interval = st.number_input("Interval (seconds)", min_value=5, value=30)

# Main content area with tabs
tab1, tab2, tab3, tab4 = st.tabs(["📹 Video Monitor", "📊 Analytics", "📈 Live Metrics", "⚙️ Settings"])

# Tab 1: Video Monitor
with tab1:
    col1, col2 = st.columns([2, 1])

    with col1:
        st.markdown("### Current Video Feed")
        video_source = f"assets/video_samples/{video_choice}"
        if os.path.exists(video_source):
            st.video(video_source)
        else:
            st.warning("⚠️ Video file not found. Please ensure videos are in the assets/video_samples directory.")

        # Video controls
        st.markdown("#### 🎮 Video Controls")
        vcol1, vcol2, vcol3, vcol4 = st.columns(4)
        with vcol1:
            if st.button("⏮️ Previous", use_container_width=True):
                st.info("Previous video feature coming soon!")
        with vcol2:
            if st.button("⏸️ Pause", use_container_width=True):
                st.info("Pause control available in video player")
        with vcol3:
            if st.button("▶️ Play", use_container_width=True):
                st.info("Play control available in video player")
        with vcol4:
            if st.button("⏭️ Next", use_container_width=True):
                st.info("Next video feature coming soon!")

    with col2:
        st.markdown("### 📋 Quick Stats")

        # Sample metrics
        st.metric("Active Shrimp", "24/30", delta="2")
        st.metric("Avg Speed", "1.4 cm/s", delta="0.2 cm/s")
        st.metric("Health Score", "87%", delta="5%")
        st.metric("Water Quality", "Good", delta="Stable")

        st.markdown("---")
        st.markdown("### 🚨 Alerts")
        st.warning("⚠️ Shrimp-003: Low activity detected")
        st.info("ℹ️ Feeding time in 30 minutes")
        st.success("✅ All systems operational")

# Tab 2: Analytics
with tab2:
    st.markdown("### 📊 Shrimp Activity Analytics")

    # Generate sample data
    sample_data = pd.DataFrame({
        'time': pd.date_range(start='2025-01-01', periods=100, freq='H'),
        'shrimp_id': ['Shrimp-001'] * 25 + ['Shrimp-002'] * 25 + ['Shrimp-003'] * 25 + ['Shrimp-004'] * 25,
        'movement_distance': [abs(x) for x in range(100)],
        'speed': [1.2 + (i % 10) * 0.1 for i in range(100)],
        'zone': ['Left', 'Center', 'Right', 'Top'] * 25
    })

    # Movement distance over time
    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### Movement Distance Over Time")
        fig1 = px.line(
            sample_data,
            x="time",
            y="movement_distance",
            color="shrimp_id",
            title="Movement Patterns"
        )
        fig1.update_layout(height=400)
        st.plotly_chart(fig1, use_container_width=True)

    with col2:
        st.markdown("#### Speed Distribution")
        fig2 = px.box(
            sample_data,
            x="shrimp_id",
            y="speed",
            color="shrimp_id",
            title="Speed Analysis by Shrimp"
        )
        fig2.update_layout(height=400)
        st.plotly_chart(fig2, use_container_width=True)

    # Zone distribution
    st.markdown("#### Zone Distribution")
    zone_data = sample_data.groupby(['zone', 'shrimp_id']).size().reset_index(name='count')
    fig3 = px.bar(
        zone_data,
        x="zone",
        y="count",
        color="shrimp_id",
        title="Shrimp Distribution by Zone",
        barmode="group"
    )
    st.plotly_chart(fig3, use_container_width=True)

    # Data table
    st.markdown("#### 📋 Raw Data")
    st.dataframe(
        sample_data.tail(20),
        use_container_width=True,
        hide_index=True
    )

# Tab 3: Live Metrics
with tab3:
    st.markdown("### 📈 Real-time Monitoring")

    # Key metrics in columns
    metric_col1, metric_col2, metric_col3, metric_col4 = st.columns(4)

    with metric_col1:
        st.metric("Total Shrimp", "30", delta="0")
    with metric_col2:
        st.metric("Active Now", "24", delta="2")
    with metric_col3:
        st.metric("Avg Temperature", "28.5°C", delta="0.3°C")
    with metric_col4:
        st.metric("Oxygen Level", "6.2 mg/L", delta="-0.1 mg/L")

    # Real-time chart placeholder
    st.markdown("#### Activity Heatmap")

    # Sample heatmap data
    import numpy as np

    heatmap_data = np.random.rand(10, 10) * 100

    fig_heatmap = go.Figure(data=go.Heatmap(
        z=heatmap_data,
        colorscale='Blues',
        text=heatmap_data.round(1),
        texttemplate='%{text}',
        textfont={"size": 10}
    ))
    fig_heatmap.update_layout(
        title="Tank Activity Heatmap (% occupancy)",
        xaxis_title="X Position",
        yaxis_title="Y Position",
        height=500
    )
    st.plotly_chart(fig_heatmap, use_container_width=True)

    # Individual shrimp tracking
    st.markdown("#### 🦐 Individual Shrimp Tracking")

    tracking_data = pd.DataFrame({
        'Shrimp ID': ['Shrimp-001', 'Shrimp-002', 'Shrimp-003', 'Shrimp-004'],
        'Status': ['Active', 'Active', 'Low Activity', 'Active'],
        'Speed (cm/s)': [1.4, 1.2, 0.8, 1.6],
        'Last Seen': ['2 min ago', '1 min ago', '5 min ago', '3 min ago'],
        'Health Score': [92, 88, 75, 95]
    })

    st.dataframe(
        tracking_data,
        use_container_width=True,
        hide_index=True,
        column_config={
            "Health Score": st.column_config.ProgressColumn(
                "Health Score",
                help="Health score of the shrimp",
                format="%d%%",
                min_value=0,
                max_value=100,
            ),
        }
    )

# Tab 4: Settings
with tab4:
    st.markdown("### ⚙️ Application Settings")

    col1, col2 = st.columns(2)

    with col1:
        st.markdown("#### 🎥 Video Settings")
        video_quality = st.selectbox("Video Quality", ["High", "Medium", "Low"])
        show_timestamps = st.checkbox("Show timestamps on video", value=True)
        enable_annotations = st.checkbox("Enable AI annotations", value=False)

        st.markdown("#### 📊 Data Settings")
        data_retention = st.number_input("Data retention (days)", min_value=1, max_value=365, value=30)
        export_format = st.selectbox("Export format", ["CSV", "Excel", "JSON"])

    with col2:
        st.markdown("#### 🔔 Notification Settings")
        enable_alerts = st.checkbox("Enable alerts", value=True)

        if enable_alerts:
            alert_low_activity = st.checkbox("Alert on low activity", value=True)
            alert_health = st.checkbox("Alert on health issues", value=True)
            alert_water = st.checkbox("Alert on water quality", value=True)

            notification_method = st.multiselect(
                "Notification methods",
                ["Email", "SMS", "In-app"],
                default=["In-app"]
            )

        st.markdown("#### 🎨 Display Settings")
        theme = st.selectbox("Theme", ["Light", "Dark", "Auto"])
        chart_style = st.selectbox("Chart style", ["Modern", "Classic", "Minimal"])

    st.markdown("---")

    col_save, col_reset = st.columns(2)
    with col_save:
        if st.button("💾 Save Settings", use_container_width=True, type="primary"):
            st.success("✅ Settings saved successfully!")
    with col_reset:
        if st.button("🔄 Reset to Defaults", use_container_width=True):
            st.info("Settings reset to defaults")

# Footer
st.markdown("---")
st.markdown(
    """
    <div style='text-align: center; color: #888; padding: 1rem;'>
        <p>🦐 Shrimp Tracker Pro v2.0 | Last updated: {} | Status: 🟢 Online</p>
    </div>
    """.format(datetime.now().strftime("%Y-%m-%d %H:%M")),
    unsafe_allow_html=True
)