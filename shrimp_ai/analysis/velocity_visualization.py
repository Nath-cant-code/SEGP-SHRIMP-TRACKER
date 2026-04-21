from __future__ import annotations

import argparse
import csv
import math
import os
import statistics
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_CSV = SCRIPT_DIR / "video 002_velocity_results.csv"
DEFAULT_OUTPUT_PNG = SCRIPT_DIR / "video 002_velocity_dashboard.png"


def load_velocity_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open(newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            avg_velocity_text = row["average_velocity_px_per_sec"].strip()
            rows.append(
                {
                    "frame_index": int(row["frame_index"]),
                    "time_seconds": float(row["time_seconds"]),
                    "shrimp_count": int(row["shrimp_count"]),
                    "matched_count": int(row["matched_count"]),
                    "average_velocity_px_per_sec": float(avg_velocity_text) if avg_velocity_text else None,
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


def percentile(sorted_values: list[float], p: float) -> float:
    if not sorted_values:
        return math.nan
    if len(sorted_values) == 1:
        return sorted_values[0]

    rank = (len(sorted_values) - 1) * p
    lower = math.floor(rank)
    upper = math.ceil(rank)
    if lower == upper:
        return sorted_values[lower]

    weight = rank - lower
    return sorted_values[lower] * (1 - weight) + sorted_values[upper] * weight


def build_summary_text(velocities: list[float], rows: list[dict]) -> str:
    sorted_velocities = sorted(velocities)
    highest_row = max(
        (row for row in rows if row["average_velocity_px_per_sec"] is not None),
        key=lambda row: row["average_velocity_px_per_sec"],
    )

    return "\n".join(
        [
            f"Frames analyzed: {len(rows)}",
            f"Frames with velocity: {len(velocities)}",
            f"Mean velocity: {statistics.mean(velocities):.2f} px/s",
            f"Median velocity: {statistics.median(velocities):.2f} px/s",
            f"90th percentile: {percentile(sorted_velocities, 0.90):.2f} px/s",
            f"Peak velocity: {max(velocities):.2f} px/s",
            f"Peak frame: {highest_row['frame_index']}",
            f"Peak time: {highest_row['time_seconds']:.2f} s",
        ]
    )


def create_dashboard(rows: list[dict], output_path: Path) -> None:
    frame_indices = [row["frame_index"] for row in rows]
    times = [row["time_seconds"] for row in rows]
    shrimp_counts = [row["shrimp_count"] for row in rows]
    matched_counts = [row["matched_count"] for row in rows]
    velocities = [row["average_velocity_px_per_sec"] for row in rows]
    valid_velocities = [value for value in velocities if value is not None]
    valid_rows = [row for row in rows if row["average_velocity_px_per_sec"] is not None]
    smoothed = rolling_average(velocities, window_size=15)

    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    fig.patch.set_facecolor("#f7f4ef")
    fig.suptitle("Video 002 Velocity Analysis Dashboard", fontsize=18, fontweight="bold")

    line_ax = axes[0][0]
    line_ax.plot(times, velocities, color="#0d5c63", linewidth=1.2, alpha=0.45, label="Per-frame velocity")
    line_ax.plot(times, smoothed, color="#d1495b", linewidth=2.0, label="15-frame rolling average")
    line_ax.set_title("Velocity Over Time")
    line_ax.set_xlabel("Time (seconds)")
    line_ax.set_ylabel("Velocity (px/s)")
    line_ax.grid(alpha=0.25)
    line_ax.legend()

    hist_ax = axes[0][1]
    hist_ax.hist(valid_velocities, bins=30, color="#edae49", edgecolor="black", alpha=0.85)
    hist_ax.axvline(statistics.mean(valid_velocities), color="#00798c", linestyle="--", linewidth=2, label="Mean")
    hist_ax.axvline(statistics.median(valid_velocities), color="#b33c86", linestyle=":", linewidth=2, label="Median")
    hist_ax.set_title("Distribution of Average Frame Velocity")
    hist_ax.set_xlabel("Velocity (px/s)")
    hist_ax.set_ylabel("Frame count")
    hist_ax.legend()
    hist_ax.grid(alpha=0.2)

    scatter_ax = axes[1][0]
    scatter = scatter_ax.scatter(
        [row["shrimp_count"] for row in valid_rows],
        [row["average_velocity_px_per_sec"] for row in valid_rows],
        c=[row["matched_count"] for row in valid_rows],
        cmap="viridis",
        alpha=0.75,
        edgecolors="none",
    )
    scatter_ax.set_title("Shrimp Count vs Velocity")
    scatter_ax.set_xlabel("Detected shrimp in frame")
    scatter_ax.set_ylabel("Average velocity (px/s)")
    scatter_ax.grid(alpha=0.2)
    colorbar = fig.colorbar(scatter, ax=scatter_ax)
    colorbar.set_label("Matched shrimp count")

    text_ax = axes[1][1]
    text_ax.axis("off")
    summary_text = build_summary_text(valid_velocities, rows)
    text_ax.text(
        0.02,
        0.98,
        summary_text,
        va="top",
        ha="left",
        fontsize=12,
        bbox={"boxstyle": "round,pad=0.6", "facecolor": "white", "edgecolor": "#cccccc"},
    )
    text_ax.set_title("Key Takeaways", loc="left")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout(rect=(0, 0, 1, 0.96))
    plt.savefig(output_path, dpi=200)
    plt.close(fig)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create graphs from a shrimp velocity CSV.")
    parser.add_argument("--input", default=str(DEFAULT_INPUT_CSV), help="Path to the velocity CSV file.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PNG), help="Path to the output PNG dashboard.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    input_csv = Path(args.input).expanduser().resolve()
    output_png = Path(args.output).expanduser().resolve()

    if not input_csv.exists():
        raise FileNotFoundError(f"Velocity CSV not found: {input_csv}")

    rows = load_velocity_rows(input_csv)
    if not rows:
        raise ValueError(f"No rows found in velocity CSV: {input_csv}")

    create_dashboard(rows, output_png)
    print(f"Velocity dashboard saved to: {output_png}")


if __name__ == "__main__":
    main()
