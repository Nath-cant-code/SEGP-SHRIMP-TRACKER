from __future__ import annotations

import argparse
import csv
import os
import statistics
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_A = SCRIPT_DIR / "video_001_velocity_results.csv"
DEFAULT_INPUT_B = SCRIPT_DIR / "video 002_velocity_results.csv"
DEFAULT_OUTPUT_PNG = SCRIPT_DIR / "velocity_comparison_dashboard.png"


def load_velocity_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open(newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            velocity_text = row["average_velocity_px_per_sec"].strip()
            rows.append(
                {
                    "frame_index": int(row["frame_index"]),
                    "time_seconds": float(row["time_seconds"]),
                    "shrimp_count": int(row["shrimp_count"]),
                    "average_velocity_px_per_sec": float(velocity_text) if velocity_text else None,
                }
            )
    return rows


def rolling_average(values: list[float | None], window_size: int) -> list[float | None]:
    smoothed: list[float | None] = []
    for index in range(len(values)):
        start = max(0, index - window_size + 1)
        window = [value for value in values[start : index + 1] if value is not None]
        smoothed.append(sum(window) / len(window) if window else None)
    return smoothed


def valid_values(rows: list[dict]) -> list[float]:
    return [row["average_velocity_px_per_sec"] for row in rows if row["average_velocity_px_per_sec"] is not None]


def summary_lines(label: str, rows: list[dict]) -> list[str]:
    velocities = valid_values(rows)
    return [
        label,
        f"Frames analysed: {len(rows)}",
        f"Frames with velocity: {len(velocities)}",
        f"Mean velocity: {statistics.mean(velocities):.2f} px/s",
        f"Median velocity: {statistics.median(velocities):.2f} px/s",
        f"Peak velocity: {max(velocities):.2f} px/s",
        f"Average shrimp count: {statistics.mean(row['shrimp_count'] for row in rows):.2f}",
    ]


def create_dashboard(rows_a: list[dict], rows_b: list[dict], output_path: Path) -> None:
    times_a = [row["time_seconds"] for row in rows_a]
    values_a = [row["average_velocity_px_per_sec"] for row in rows_a]
    smooth_a = rolling_average(values_a, window_size=15)

    times_b = [row["time_seconds"] for row in rows_b]
    values_b = [row["average_velocity_px_per_sec"] for row in rows_b]
    smooth_b = rolling_average(values_b, window_size=15)

    fig, axes = plt.subplots(2, 2, figsize=(15, 9))
    fig.patch.set_facecolor("#f7f4ef")
    fig.suptitle("Velocity Comparison: Video 001 vs Video 002", fontsize=18, fontweight="bold")

    compare_ax = axes[0][0]
    compare_ax.plot(times_a, smooth_a, color="#0d5c63", linewidth=2.2, label="Video 001")
    compare_ax.plot(times_b, smooth_b, color="#d1495b", linewidth=2.2, label="Video 002")
    compare_ax.set_title("Rolling Average Velocity Over Time")
    compare_ax.set_xlabel("Time (seconds)")
    compare_ax.set_ylabel("Velocity (px/s)")
    compare_ax.grid(alpha=0.25)
    compare_ax.legend()

    dist_ax = axes[0][1]
    dist_ax.hist(valid_values(rows_a), bins=25, color="#0d5c63", alpha=0.60, label="Video 001")
    dist_ax.hist(valid_values(rows_b), bins=25, color="#d1495b", alpha=0.55, label="Video 002")
    dist_ax.set_title("Velocity Distribution")
    dist_ax.set_xlabel("Velocity (px/s)")
    dist_ax.set_ylabel("Frame count")
    dist_ax.grid(alpha=0.2)
    dist_ax.legend()

    trend_ax = axes[1][0]
    trend_ax.plot(times_a, values_a, color="#0d5c63", linewidth=1.0, alpha=0.30)
    trend_ax.plot(times_b, values_b, color="#d1495b", linewidth=1.0, alpha=0.25)
    trend_ax.set_title("Per-Frame Velocity")
    trend_ax.set_xlabel("Time (seconds)")
    trend_ax.set_ylabel("Velocity (px/s)")
    trend_ax.grid(alpha=0.25)

    text_ax = axes[1][1]
    text_ax.axis("off")
    text = "\n".join(summary_lines("Video 001", rows_a)) + "\n\n" + "\n".join(summary_lines("Video 002", rows_b))
    text_ax.text(
        0.02,
        0.98,
        text,
        va="top",
        ha="left",
        fontsize=11.5,
        bbox={"boxstyle": "round,pad=0.6", "facecolor": "white", "edgecolor": "#cccccc"},
    )
    text_ax.set_title("Summary", loc="left")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout(rect=(0, 0, 1, 0.96))
    plt.savefig(output_path, dpi=200)
    plt.close(fig)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create a simple velocity comparison dashboard for two videos.")
    parser.add_argument("--input-a", default=str(DEFAULT_INPUT_A), help="Path to the first velocity CSV.")
    parser.add_argument("--input-b", default=str(DEFAULT_INPUT_B), help="Path to the second velocity CSV.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PNG), help="Path to the output PNG.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    input_a = Path(args.input_a).expanduser().resolve()
    input_b = Path(args.input_b).expanduser().resolve()
    output_png = Path(args.output).expanduser().resolve()

    if not input_a.exists():
        raise FileNotFoundError(f"Velocity CSV not found: {input_a}")
    if not input_b.exists():
        raise FileNotFoundError(f"Velocity CSV not found: {input_b}")

    rows_a = load_velocity_rows(input_a)
    rows_b = load_velocity_rows(input_b)
    if not rows_a or not rows_b:
        raise ValueError("One or both velocity CSV files are empty.")

    create_dashboard(rows_a, rows_b, output_png)
    print(f"Velocity comparison dashboard saved to: {output_png}")


if __name__ == "__main__":
    main()
