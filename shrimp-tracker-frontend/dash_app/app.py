import os
import base64

import dash
from dash import html, dash_table
import pandas as pd

# Create the Dash app
app = dash.Dash(__name__)
server = app.server  # for deployment later if needed

# Base directory of this file
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


# ---------- VIDEO COMPONENT (with sound) ----------

def get_video_component():
    """
    Returns an HTML5 video component.
    Looks for 'sample_video.mp4' in the same folder as this app.py.
    If not found, shows a warning message instead of crashing.
    """
    video_path = os.path.join(BASE_DIR, "sample_video.mp4")

    if not os.path.exists(video_path):
        return html.Div(
            "⚠ sample_video.mp4 not found in dash_app folder. "
            "Upload a video file named 'sample_video.mp4' to enable playback.",
            style={"color": "red", "marginTop": "20px", "textAlign": "center"},
        )

    # Read and base64-encode video so it can play with sound in the browser
    with open(video_path, "rb") as f:
        encoded = base64.b64encode(f.read()).decode()

    return html.Video(
        controls=True,           # shows play/pause/volume bar
        src="data:video/mp4;base64," + encoded,
        style={
            "width": "70%",
            "borderRadius": "12px",
            "marginTop": "20px",
            "boxShadow": "0 4px 12px rgba(0,0,0,0.2)",
            "display": "block",
            "marginLeft": "auto",
            "marginRight": "auto",
        },
    )


# ---------- TABLE / EXCEL COMPONENT ----------

def get_table_component():
    """
    Tries to load 'sample_data.xlsx' from the same folder.
    If it doesn't exist, shows a small dummy table instead.
    """
    excel_path = os.path.join(BASE_DIR, "sample_data.xlsx")

    if os.path.exists(excel_path):
        try:
            df = pd.read_excel(excel_path)
        except Exception as e:
            df = pd.DataFrame(
                {"Error": [f"Could not read sample_data.xlsx: {e}"]}
            )
    else:
        # Fallback dummy data if Excel file is missing
        df = pd.DataFrame(
            {
                "Shrimp ID": [1, 2, 3],
                "Speed (cm/s)": [1.2, 0.8, 1.6],
                "Zone": ["Left", "Center", "Right"],
            }
        )

    return dash_table.DataTable(
        data=df.to_dict("records"),
        columns=[{"name": c, "id": c} for c in df.columns],
        style_table={"width": "80%", "margin": "20px auto"},
        style_cell={"textAlign": "center", "padding": "6px"},
        style_header={
            "fontWeight": "bold",
            "borderBottom": "1px solid #aaa",
        },
        page_size=10,
    )


# ---------- BUILD COMPONENTS ----------

video_player = get_video_component()
data_table = get_table_component()


# ---------- PAGE LAYOUT ----------

app.layout = html.Div(
    [
        html.H1(
            "Shrimp Tracker – Dash Frontend Prototype",
            style={"textAlign": "center", "marginTop": "20px"},
        ),

        html.Hr(),

        html.H2(
            "Video Playback (with sound)",
            style={"textAlign": "center"},
        ),
        html.P(
            "This video will play with audio if your browser volume and system sound are on, "
            "and the file contains an audio track.",
            style={"textAlign": "center", "fontSize": "14px"},
        ),
        video_player,

        html.Hr(style={"marginTop": "40px"}),

        html.H2(
            "Sample Behaviour Data (Excel / Table)",
            style={"textAlign": "center"},
        ),
        html.P(
            "If 'sample_data.xlsx' exists in this folder, it will be displayed below. "
            "Otherwise, a small dummy table is shown.",
            style={"textAlign": "center", "fontSize": "14px"},
        ),
        data_table,
    ],
    style={"fontFamily": "Arial, sans-serif"},
)


if __name__ == "__main__":
    # When you run this locally: python app.py
    app.run(debug=True)
