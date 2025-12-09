import os
import base64

import dash
from dash import html, dcc, dash_table
import pandas as pd

# --- Setup Dash ---
app = dash.Dash(__name__)
server = app.server

# --- Path Setup ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VIDEO_FOLDER = os.path.abspath(
    os.path.join(BASE_DIR, "../assets/video_samples")
)

# Automatically read all .mp4 files inside video_samples folder
def get_available_videos():
    if not os.path.exists(VIDEO_FOLDER):
        return []

    return [
        f for f in os.listdir(VIDEO_FOLDER)
        if f.lower().endswith(".mp4")
    ]

VIDEO_LIST = get_available_videos()


# Encode video for playback
def encode_video(video_filename):
    path = os.path.join(VIDEO_FOLDER, video_filename)

    if not os.path.exists(path):
        return None

    with open(path, "rb") as f:
        return base64.b64encode(f.read()).decode()


# Build video component from filename
def build_video_player(video_filename):
    encoded = encode_video(video_filename)

    if encoded is None:
        return html.Div(
            f"⚠ Video not found: {video_filename}",
            style={"color": "red", "textAlign": "center", "marginTop": "20px"},
        )

    return html.Video(
        controls=True,
        src="data:video/mp4;base64," + encoded,
        style={
            "width": "70%",
            "margin": "20px auto",
            "display": "block",
            "borderRadius": "12px",
            "boxShadow": "0 4px 12px rgba(0,0,0,0.25)",
        },
    )


# --- Table / Excel Section ---
EXCEL_PATH = os.path.join(BASE_DIR, "sample_data.xlsx")

def load_excel():
    if os.path.exists(EXCEL_PATH):
        try:
            return pd.read_excel(EXCEL_PATH)
        except Exception as e:
            return pd.DataFrame({"Error": [str(e)]})

    # Fallback if no Excel file exists
    return pd.DataFrame({
        "Shrimp ID": [1, 2, 3],
        "Speed (cm/s)": [1.2, 0.8, 1.6],
        "Zone": ["Left", "Center", "Right"],
    })


df = load_excel()

table_component = dash_table.DataTable(
    data=df.to_dict("records"),
    columns=[{"name": c, "id": c} for c in df.columns],
    style_table={"width": "80%", "margin": "20px auto"},
    style_cell={"textAlign": "center", "padding": "6px"},
    style_header={"fontWeight": "bold", "borderBottom": "1px solid #aaa"},
    page_size=10,
)


# --- Layout ---
app.layout = html.Div(
    style={"fontFamily": "Arial, sans-serif"},
    children=[
        html.H1(
            "Shrimp Tracker – Dash Frontend Prototype",
            style={"textAlign": "center", "marginTop": "20px"},
        ),

        html.Hr(),

        html.H2("Video Playback (with sound)", style={"textAlign": "center"}),

        # Video dropdown
        html.Div(
            [
                html.Label("Choose a video:", style={"fontSize": "16px"}),
                dcc.Dropdown(
                    id="video-dropdown",
                    options=[{"label": v, "value": v} for v in VIDEO_LIST],
                    value=VIDEO_LIST[0] if VIDEO_LIST else None,
                    style={"width": "50%", "margin": "0 auto"},
                ),
            ],
            style={"textAlign": "center"},
        ),

        html.Div(id="video-player-container"),

        html.Hr(style={"marginTop": "40px"}),

        html.H2("Sample Behaviour Data", style={"textAlign": "center"}),

        table_component,
    ],
)


# --- Callbacks (update video when dropdown changes) ---
@app.callback(
    dash.Output("video-player-container", "children"),
    dash.Input("video-dropdown", "value"),
)
def update_video(selected_video):
    if selected_video is None:
        return html.Div("No video files found.", style={"textAlign": "center"})
    return build_video_player(selected_video)


# --- Run App ---
if __name__ == "__main__":
    app.run(debug=True)
