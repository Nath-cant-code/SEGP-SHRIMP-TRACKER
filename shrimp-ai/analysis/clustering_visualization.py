from __future__ import annotations

import argparse
import csv
import os
import statistics
from pathlib import Path

os.environ.setdefault("MPLBACKEND", "Agg")

import matplotlib.pyplot as plt


SCRIPT_DIR = Path(__file__).resolve().parent
DEFAULT_INPUT_A = SCRIPT_DIR / "video_001_clustering_results.csv"
DEFAULT_INPUT_B = SCRIPT_DIR / "video 002_clustering_results.csv"
DEFAULT_OUTPUT_PNG = SCRIPT_DIR / "clustering_comparison_dashboard.png"


def load_clustering_rows(csv_path: Path) -> list[dict]:
    rows: list[dict] = []
    with csv_path.open(newline="") as csvfile:
        reader = csv.DictReader(csvfile)
        for row in reader:
            clustering_text = row["clustering_percentage"].strip()
            rows.append(
                {
                    "frame_index": int(row["frame_index"]),
                    "time_seconds": float(row["time_seconds"]),
                    "shrimp_count": int(row["shrimp_count"]),
                    "clustering_percentage": float(clustering_text) if clustering_text else None,
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


def build_summary_text(label: str, rows: list[dict]) -> str:
    values = [row["clustering_percentage"] for row in rows if row["clustering_percentage"] is not None]
    peak_row = max(rows, key=lambda row: row["clustering_percentage"] or float("-inf"))

    return "\n".join(
        [
            label,
            f"Frames analysed: {len(rows)}",
            f"Mean clustering: {statistics.mean(values):.2f}%",
            f"Median clustering: {statistics.median(values):.2f}%",
            f"Min clustering: {min(values):.2f}%",
            f"Max clustering: {max(values):.2f}%",
            f"Peak time: {peak_row['time_seconds']:.2f} s",
            f"Average shrimp count: {statistics.mean(row['shrimp_count'] for row in rows):.2f}",
        ]
    )


def create_dashboard(rows_a: list[dict], rows_b: list[dict], output_path: Path) -> None:
    times_a = [row["time_seconds"] for row in rows_a]
    values_a = [row["clustering_percentage"] for row in rows_a]
    counts_a = [row["shrimp_count"] for row in rows_a]
    smooth_a = rolling_average(values_a, window_size=20)

    times_b = [row["time_seconds"] for row in rows_b]
    values_b = [row["clustering_percentage"] for row in rows_b]
    counts_b = [row["shrimp_count"] for row in rows_b]
    smooth_b = rolling_average(values_b, window_size=20)

    fig, axes = plt.subplots(2, 2, figsize=(16, 10))
    fig.patch.set_facecolor("#f7f4ef")
    fig.suptitle("Shrimp Clustering Over Time", fontsize=18, fontweight="bold")

    compare_ax = axes[0][0]
    compare_ax.plot(times_a, values_a, color="#0d5c63", linewidth=1.0, alpha=0.30)
    compare_ax.plot(times_a, smooth_a, color="#0d5c63", linewidth=2.2, label="Video 001")
    compare_ax.plot(times_b, values_b, color="#d1495b", linewidth=1.0, alpha=0.25)
    compare_ax.plot(times_b, smooth_b, color="#d1495b", linewidth=2.2, label="Video 002")
    compare_ax.set_title("Clustering Percentage Over Time")
    compare_ax.set_xlabel("Time (seconds)")
    compare_ax.set_ylabel("Clustering (%)")
    compare_ax.grid(alpha=0.25)
    compare_ax.legend()

    video1_ax = axes[0][1]
    video1_ax.plot(times_a, values_a, color="#0d5c63", linewidth=1.1, alpha=0.35, label="Per-frame clustering")
    video1_ax.plot(times_a, smooth_a, color="#edae49", linewidth=2.0, label="20-frame rolling average")
    video1_ax.set_title("Video 001")
    video1_ax.set_xlabel("Time (seconds)")
    video1_ax.set_ylabel("Clustering (%)")
    video1_ax.grid(alpha=0.25)
    video1_ax.legend()

    video2_ax = axes[1][0]
    video2_ax.plot(times_b, values_b, color="#d1495b", linewidth=1.1, alpha=0.35, label="Per-frame clustering")
    video2_ax.plot(times_b, smooth_b, color="#00798c", linewidth=2.0, label="20-frame rolling average")
    video2_ax.set_title("Video 002")
    video2_ax.set_xlabel("Time (seconds)")
    video2_ax.set_ylabel("Clustering (%)")
    video2_ax.grid(alpha=0.25)
    video2_ax.legend()

    text_ax = axes[1][1]
    text_ax.axis("off")
    summary_text = build_summary_text("Video 001", rows_a) + "\n\n" + build_summary_text("Video 002", rows_b)
    text_ax.text(
        0.02,
        0.98,
        summary_text,
        va="top",
        ha="left",
        fontsize=11.5,
        bbox={"boxstyle": "round,pad=0.6", "facecolor": "white", "edgecolor": "#cccccc"},
    )
    text_ax.set_title("Key Takeaways", loc="left")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    plt.tight_layout(rect=(0, 0, 1, 0.96))
    plt.savefig(output_path, dpi=200)
    plt.close(fig)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Create clustering comparison graphs from two shrimp CSV files.")
    parser.add_argument("--input-a", default=str(DEFAULT_INPUT_A), help="Path to the first clustering CSV.")
    parser.add_argument("--input-b", default=str(DEFAULT_INPUT_B), help="Path to the second clustering CSV.")
    parser.add_argument("--output", default=str(DEFAULT_OUTPUT_PNG), help="Path to the output PNG dashboard.")
    return parser


def main() -> None:
    args = build_parser().parse_args()
    input_a = Path(args.input_a).expanduser().resolve()
    input_b = Path(args.input_b).expanduser().resolve()
    output_png = Path(args.output).expanduser().resolve()

    if not input_a.exists():
        raise FileNotFoundError(f"Clustering CSV not found: {input_a}")
    if not input_b.exists():
        raise FileNotFoundError(f"Clustering CSV not found: {input_b}")

    rows_a = load_clustering_rows(input_a)
    rows_b = load_clustering_rows(input_b)
    if not rows_a or not rows_b:
        raise ValueError("One or both clustering CSV files are empty.")

    create_dashboard(rows_a, rows_b, output_png)
    print(f"Clustering dashboard saved to: {output_png}")


if __name__ == "__main__":
    main()
