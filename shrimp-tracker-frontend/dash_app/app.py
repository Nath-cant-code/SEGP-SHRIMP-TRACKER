import os
import base64

import dash
from dash import html, dcc, dash_table
import pandas as pd

app = dash.Dash(__name__)
server = app.server

# --- PATH SETUP ---
BASE_DIR = os.path.dirname(os.path.abspath(__file__))

VIDEO_FOLDER = os.path.abspath(
    os.path.join(BASE_DIR, "../assets/video_samples")
)

def get_available_videos():
    if not os.path.exists(VIDEO_FOLDER):
        return []
    return [f for f in os.listdir(VIDEO_FOLDER) if f.lower().endswith(".mp4")]

VIDEO_LIST = get_available_videos()


def encode_video(filename):
    full_path = os.path.join(VIDEO_FOLDER, filename)
    if not os.path.exists(full_path):
        return None
    with open(full_path, "rb") as f:
        return base64.b64encode(f.read()).decode()


def build_video_player(filename):
    encoded = encode_video(filename)
    if encoded is None:
        return html.Div(
            f"⚠ Video not found: {filename}",
            style={"color": "red", "textAlign": "center", "marginTop": "20px"}
        )

    return html.Video(
        controls=True,
        src="data:video/mp4;base64," + encoded,
        style={
            "width": "100%",
            "borderRadius": "10px",
            "boxShadow": "0 4px 10px rgba(0,0,0,0.25)",
            "marginTop": "15px",
        }
    )


# --- TABLE LOADING ---
EXCEL_PATH = os.path.join(BASE_DIR, "sample_data.xlsx")

def load_excel():
    if os.path.exists(EXCEL_PATH):
        try:
            return pd.read_excel(EXCEL_PATH)
        except Exception as e:
            return pd.DataFrame({"Error": [str(e)]})

    return pd.DataFrame({
        "Shrimp ID": [1, 2, 3],
        "Speed (cm/s)": [1.2, 0.8, 1.6],
        "Zone": ["Left", "Center", "Right"]
    })

df = load_excel()

table_component = dash_table.DataTable(
    data=df.to_dict("records"),
    columns=[{"name": c, "id": c} for c in df.columns],
    style_table={"width": "100%", "marginTop": "15px"},
    style_cell={"textAlign": "center", "padding": "8px"},
    style_header={"fontWeight": "bold", "borderBottom": "1px solid #888"},
    page_size=10,
)


# --- PAGE LAYOUT ---
app.layout = html.Div(
    style={
        "fontFamily": "Arial",
        "padding": "20px"
    },
    children=[

        # Top title
        html.H1(
            "Shrimp Tracker",
            style={"textAlign": "center", "marginBottom": "40px"}
        ),

        # Main horizontal row (Video left — Table right)
        html.Div(
            style={
                "display": "flex",
                "flexDirection": "row",
                "justifyContent": "space-between",
                "gap": "40px"
            },
            children=[

                # LEFT PANEL — video selector + player
                html.Div(
                    style={
                        "flex": "1",
                        "border": "1px solid #ccc",
                        "padding": "20px",
                        "borderRadius": "12px"
                    },
                    children=[
                        html.H3("Video Selector", style={"textAlign": "center"}),

                        dcc.Dropdown(
                            id="video-dropdown",
                            options=[{"label": v, "value": v} for v in VIDEO_LIST],
                            value=VIDEO_LIST[0] if VIDEO_LIST else None,
                            style={"margin": "10px auto", "width": "80%"}
                        ),

                        html.Div(
                            id="video-player-container",
                            style={"marginTop": "20px"}
                        )
                    ]
                ),

                # RIGHT PANEL — table
                html.Div(
                    style={
                        "flex": "1",
                        "border": "1px solid #ccc",
                        "padding": "20px",
                        "borderRadius": "12px"
                    },
                    children=[
                        html.H3("Table Headers", style={"textAlign": "center"}),

                        html.Div(
                            "Data metrics for current video sample",
                            style={"textAlign": "center", "marginBottom": "10px"}
                        ),

                        table_component
                    ]
                ),
            ]
        )
    ]
)


# --- CALLBACK FOR VIDEO SWITCHING ---
@app.callback(
    dash.Output("video-player-container", "children"),
    dash.Input("video-dropdown", "value")
)
def update_video(selected_video):
    if not selected_video:
        return html.Div("No video available.", style={"textAlign": "center"})
    return build_video_player(selected_video)


if __name__ == "__main__":
    app.run(debug=True)
