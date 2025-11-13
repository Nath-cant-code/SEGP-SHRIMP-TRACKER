import streamlit as st
import pandas as pd
import plotly.express as px

st.title("Shrimp activity video samples")

# dropdown menu to select video for display
video_list = ["20_Oct_2025_9-06pm_1.mp4", "20_Oct_2025_9-06pm_2.mp4"]
# video_choice = st.selectbox("Choose a video", video_list)
video_choice = st.sidebar.selectbox("Choose a video", video_list)

# creates a section to display/show the video selected
video_source = f"assets/video_samples/{video_choice}"
st.video(video_source)

st.header("Shrimp Activity Metrics")

# df = pd.read_csv("data/spreadsheet_files/")
# st.dataframe(df)

# fig = px.line(df, x="time", y="movement_distance", color="shrimp_id")
# st.plotly_chart(fig)