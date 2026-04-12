from __future__ import annotations

import argparse
import csv
import math
import re
from pathlib import Path

import cv2


SCRIPT_DIR = Path(__file__).resolve().parent
SHRIMP_AI_DIR = SCRIPT_DIR.parent
PROJECT_ROOT = SHRIMP_AI_DIR.parent
DEFAULT_VIDEO_STEM = "video_001"
DEFAULT_VIDEO_PATH = SHRIMP_AI_DIR / "data" / "raw" / f"{DEFAULT_VIDEO_STEM}.mp4"
DEFAULT_LABEL_FOLDER = SHRIMP_AI_DIR / "runs" / "detect" / "video_001_train4_test" / "labels"
DEFAULT_OUTPUT_CSV = SCRIPT_DIR / f"{DEFAULT_VIDEO_STEM}_clustering_results.csv"
DEFAULT_OUTPUT_VIDEO = SCRIPT_DIR / f"{DEFAULT_VIDEO_STEM}_clustering_overlay.avi"
DEFAULT_VELOCITY_CSV = SCRIPT_DIR / f"{DEFAULT_VIDEO_STEM}_velocity_results.csv"
DEFAULT_VELOCITY_BOX_VIDEO = SCRIPT_DIR / f"{DEFAULT_VIDEO_STEM}_velocity_boxes.avi"


def get_video_info(video_path: Path) -> tuple[int, int, float, int]:
    cap = cv2.VideoCapture(str(video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video: {video_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    cap.release()

    return width, height, fps, total_frames


def load_centers_from_label(
    label_file_path: Path,
    frame_width: int,
    frame_height: int,
    confidence_threshold: float = 0.0,
) -> list[tuple[float, float]]:
    centers: list[tuple[float, float]] = []

    if not label_file_path.exists():
        return centers

    for line in label_file_path.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) < 5:
            continue

        x_center = float(parts[1])
        y_center = float(parts[2])

        if len(parts) >= 6:
            confidence = float(parts[5])
            if confidence < confidence_threshold:
                continue

        x_pixel = x_center * frame_width
        y_pixel = y_center * frame_height
        centers.append((x_pixel, y_pixel))

    return centers


def load_boxes_from_label(
    label_file_path: Path,
    frame_width: int,
    frame_height: int,
    confidence_threshold: float = 0.0,
) -> list[dict]:
    boxes: list[dict] = []

    if not label_file_path.exists():
        return boxes

    for line in label_file_path.read_text().splitlines():
        parts = line.strip().split()
        if len(parts) < 5:
            continue

        x_center = float(parts[1])
        y_center = float(parts[2])
        width = float(parts[3])
        height = float(parts[4])

        confidence = None
        if len(parts) >= 6:
            confidence = float(parts[5])
            if confidence < confidence_threshold:
                continue

        boxes.append(
            {
                "center": (x_center * frame_width, y_center * frame_height),
                "width": width * frame_width,
                "height": height * frame_height,
                "confidence": confidence,
            }
        )

    return boxes


def compute_average_pairwise_distance(points: list[tuple[float, float]]) -> float | None:
    if len(points) < 2:
        return None

    distances: list[float] = []
    for i in range(len(points)):
        for j in range(i + 1, len(points)):
            x1, y1 = points[i]
            x2, y2 = points[j]
            distances.append(math.hypot(x2 - x1, y2 - y1))

    if not distances:
        return None

    return sum(distances) / len(distances)


def compute_clustering_percentage(
    points: list[tuple[float, float]],
    frame_width: int,
    frame_height: int,
) -> float | None:
    avg_distance = compute_average_pairwise_distance(points)
    if avg_distance is None:
        return None

    max_distance = math.hypot(frame_width, frame_height)
    if max_distance == 0:
        return None

    clustering_score = 1 - (avg_distance / max_distance)
    clustering_score = max(0.0, min(1.0, clustering_score))
    return clustering_score * 100


def extract_frame_number(label_file_name: str) -> int | None:
    match = re.search(r"_(\d+)\.txt$", label_file_name)
    if not match:
        return None
    return int(match.group(1))


def sorted_label_files(label_folder: Path) -> list[Path]:
    def sort_key(path: Path) -> tuple[int, str]:
        frame_number = extract_frame_number(path.name)
        return (frame_number if frame_number is not None else math.inf, path.name)

    return sorted((path for path in label_folder.iterdir() if path.suffix == ".txt"), key=sort_key)


def analyze_saved_yolo_labels(
    video_path: Path,
    label_folder: Path,
    confidence_threshold: float = 0.0,
    min_shrimp: int = 2,
) -> dict:
    frame_width, frame_height, fps, total_frames = get_video_info(video_path)

    if not label_folder.exists():
        raise ValueError(f"Label folder does not exist: {label_folder}")

    label_files = sorted_label_files(label_folder)

    frame_results = []
    valid_clustering_values: list[float] = []

    for idx, label_path in enumerate(label_files):
        centers = load_centers_from_label(
            label_file_path=label_path,
            frame_width=frame_width,
            frame_height=frame_height,
            confidence_threshold=confidence_threshold,
        )

        shrimp_count = len(centers)
        clustering = None
        if shrimp_count >= min_shrimp:
            clustering = compute_clustering_percentage(centers, frame_width, frame_height)

        if clustering is not None:
            valid_clustering_values.append(clustering)

        detected_frame_number = extract_frame_number(label_path.name)
        frame_index = detected_frame_number - 1 if detected_frame_number is not None else idx
        time_seconds = frame_index / fps if fps > 0 else 0.0

        frame_results.append(
            {
                "frame_file": label_path.name,
                "frame_index": frame_index,
                "time_seconds": time_seconds,
                "shrimp_count": shrimp_count,
                "clustering_percentage": clustering,
            }
        )

        if clustering is not None:
            print(f"{label_path.name} -> Shrimp: {shrimp_count}, Clustering: {clustering:.2f}%")
        else:
            print(f"{label_path.name} -> Shrimp: {shrimp_count}, Clustering: skipped")

    average_video_clustering = None
    if valid_clustering_values:
        average_video_clustering = sum(valid_clustering_values) / len(valid_clustering_values)

    return {
        "video_path": str(video_path),
        "label_folder": str(label_folder),
        "frame_width": frame_width,
        "frame_height": frame_height,
        "fps": fps,
        "total_frames_in_video": total_frames,
        "total_label_files": len(label_files),
        "valid_clustering_frames": len(valid_clustering_values),
        "average_video_clustering": average_video_clustering,
        "frame_results": frame_results,
    }


def match_shrimp_between_frames(
    previous_centers: list[tuple[float, float]],
    current_centers: list[tuple[float, float]],
    max_distance: float,
) -> list[tuple[int, int, float]]:
    matches: list[tuple[int, int, float]] = []
    used_previous: set[int] = set()
    used_current: set[int] = set()

    candidate_pairs: list[tuple[float, int, int]] = []
    for prev_index, prev_center in enumerate(previous_centers):
        for curr_index, curr_center in enumerate(current_centers):
            distance = math.hypot(curr_center[0] - prev_center[0], curr_center[1] - prev_center[1])
            if distance <= max_distance:
                candidate_pairs.append((distance, prev_index, curr_index))

    candidate_pairs.sort(key=lambda item: item[0])

    for distance, prev_index, curr_index in candidate_pairs:
        if prev_index in used_previous or curr_index in used_current:
            continue
        used_previous.add(prev_index)
        used_current.add(curr_index)
        matches.append((prev_index, curr_index, distance))

    return matches


def analyze_shrimp_velocity(
    video_path: Path,
    label_folder: Path,
    confidence_threshold: float = 0.0,
    max_match_distance_ratio: float = 0.10,
) -> dict:
    frame_width, frame_height, fps, total_frames = get_video_info(video_path)
    if not label_folder.exists():
        raise ValueError(f"Label folder does not exist: {label_folder}")
    if fps <= 0:
        raise ValueError(f"Invalid FPS for video: {video_path}")

    label_files = sorted_label_files(label_folder)
    max_match_distance = math.hypot(frame_width, frame_height) * max_match_distance_ratio

    frame_results = []
    all_matched_velocities: list[float] = []
    previous_boxes: list[dict] | None = None
    previous_frame_index: int | None = None

    for fallback_index, label_path in enumerate(label_files):
        frame_number = extract_frame_number(label_path.name)
        frame_index = frame_number - 1 if frame_number is not None else fallback_index
        time_seconds = frame_index / fps

        boxes = load_boxes_from_label(
            label_file_path=label_path,
            frame_width=frame_width,
            frame_height=frame_height,
            confidence_threshold=confidence_threshold,
        )
        centers = [box["center"] for box in boxes]

        matched_count = 0
        average_velocity = None
        matched_velocities: list[float] = []

        if previous_boxes is not None and previous_frame_index is not None:
            frame_gap = frame_index - previous_frame_index
            if frame_gap > 0:
                delta_time = frame_gap / fps
                previous_centers = [box["center"] for box in previous_boxes]
                matches = match_shrimp_between_frames(previous_centers, centers, max_match_distance)

                for _, _, distance in matches:
                    velocity = distance / delta_time
                    matched_velocities.append(velocity)

                matched_count = len(matches)
                if matched_velocities:
                    average_velocity = sum(matched_velocities) / len(matched_velocities)
                    all_matched_velocities.extend(matched_velocities)

        frame_results.append(
            {
                "frame_file": label_path.name,
                "frame_index": frame_index,
                "time_seconds": time_seconds,
                "shrimp_count": len(centers),
                "matched_count": matched_count,
                "average_velocity_px_per_sec": average_velocity,
            }
        )

        if average_velocity is not None:
            print(
                f"{label_path.name} -> Shrimp: {len(centers)}, "
                f"Matched: {matched_count}, Avg velocity: {average_velocity:.2f} px/s"
            )
        else:
            print(f"{label_path.name} -> Shrimp: {len(centers)}, Matched: {matched_count}, Avg velocity: skipped")

        previous_boxes = boxes
        previous_frame_index = frame_index

    overall_average_velocity = None
    if all_matched_velocities:
        overall_average_velocity = sum(all_matched_velocities) / len(all_matched_velocities)

    return {
        "video_path": str(video_path),
        "label_folder": str(label_folder),
        "frame_width": frame_width,
        "frame_height": frame_height,
        "fps": fps,
        "total_frames_in_video": total_frames,
        "total_label_files": len(label_files),
        "frames_with_velocity": sum(1 for row in frame_results if row["average_velocity_px_per_sec"] is not None),
        "overall_average_velocity_px_per_sec": overall_average_velocity,
        "max_match_distance_px": max_match_distance,
        "frame_results": frame_results,
    }


def build_velocity_box_annotations(
    video_path: Path,
    label_folder: Path,
    confidence_threshold: float = 0.0,
    max_match_distance_ratio: float = 0.10,
) -> dict:
    frame_width, frame_height, fps, _ = get_video_info(video_path)
    if fps <= 0:
        raise ValueError(f"Invalid FPS for video: {video_path}")

    label_files = sorted_label_files(label_folder)
    max_match_distance = math.hypot(frame_width, frame_height) * max_match_distance_ratio

    frame_annotations: dict[int, list[dict]] = {}
    previous_boxes: list[dict] | None = None
    previous_frame_index: int | None = None

    for fallback_index, label_path in enumerate(label_files):
        frame_number = extract_frame_number(label_path.name)
        frame_index = frame_number - 1 if frame_number is not None else fallback_index

        boxes = load_boxes_from_label(
            label_file_path=label_path,
            frame_width=frame_width,
            frame_height=frame_height,
            confidence_threshold=confidence_threshold,
        )

        annotations = []
        for box in boxes:
            center_x, center_y = box["center"]
            half_width = box["width"] / 2
            half_height = box["height"] / 2
            annotations.append(
                {
                    "center": box["center"],
                    "x1": int(round(center_x - half_width)),
                    "y1": int(round(center_y - half_height)),
                    "x2": int(round(center_x + half_width)),
                    "y2": int(round(center_y + half_height)),
                    "velocity_px_per_sec": None,
                }
            )

        if previous_boxes is not None and previous_frame_index is not None:
            frame_gap = frame_index - previous_frame_index
            if frame_gap > 0:
                delta_time = frame_gap / fps
                previous_centers = [box["center"] for box in previous_boxes]
                current_centers = [box["center"] for box in boxes]
                matches = match_shrimp_between_frames(previous_centers, current_centers, max_match_distance)

                for _, current_index, distance in matches:
                    annotations[current_index]["velocity_px_per_sec"] = distance / delta_time

        frame_annotations[frame_index] = annotations
        previous_boxes = boxes
        previous_frame_index = frame_index

    return {
        "fps": fps,
        "frame_width": frame_width,
        "frame_height": frame_height,
        "frame_annotations": frame_annotations,
    }


def draw_velocity_box_overlay(frame, annotations: list[dict], frame_average_velocity: float | None) -> None:
    for annotation in annotations:
        velocity = annotation["velocity_px_per_sec"]
        if velocity is None:
            color = (120, 120, 120)
            label = "new"
        else:
            color = (0, 255, 255) if velocity < 80 else (0, 165, 255) if velocity < 160 else (0, 0, 255)
            label = f"{velocity:.1f} px/s"

        cv2.rectangle(frame, (annotation["x1"], annotation["y1"]), (annotation["x2"], annotation["y2"]), color, 2)
        text_y = max(20, annotation["y1"] - 8)
        cv2.putText(
            frame,
            label,
            (annotation["x1"], text_y),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.45,
            color,
            2,
            cv2.LINE_AA,
        )

    overlay = frame.copy()
    cv2.rectangle(overlay, (18, 18), (305, 86), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.4, frame, 0.6, 0, frame)
    cv2.putText(frame, "Per-Shrimp Velocity", (30, 43), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    average_text = (
        f"Frame avg: {frame_average_velocity:.1f} px/s"
        if frame_average_velocity is not None
        else "Frame avg: unavailable"
    )
    cv2.putText(frame, average_text, (30, 72), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 255, 200), 2, cv2.LINE_AA)


def render_velocity_box_video(
    source_video_path: Path,
    velocity_summary: dict,
    label_folder: Path,
    output_video_path: Path,
    confidence_threshold: float = 0.0,
    max_match_distance_ratio: float = 0.10,
) -> None:
    cap = cv2.VideoCapture(str(source_video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video for velocity overlay rendering: {source_video_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    fps = fps if fps > 0 else 30.0

    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"XVID")
    writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))

    if not writer.isOpened():
        cap.release()
        raise ValueError(f"Could not create output video: {output_video_path}")

    velocity_lookup = build_frame_result_lookup(velocity_summary)
    annotation_payload = build_velocity_box_annotations(
        video_path=source_video_path,
        label_folder=label_folder,
        confidence_threshold=confidence_threshold,
        max_match_distance_ratio=max_match_distance_ratio,
    )
    annotation_lookup = annotation_payload["frame_annotations"]

    frame_index = 0
    while True:
        success, frame = cap.read()
        if not success:
            break

        annotations = annotation_lookup.get(frame_index, [])
        frame_velocity_row = velocity_lookup.get(frame_index)
        frame_average_velocity = None if frame_velocity_row is None else frame_velocity_row["average_velocity_px_per_sec"]
        draw_velocity_box_overlay(frame, annotations, frame_average_velocity)
        writer.write(frame)
        frame_index += 1

    cap.release()
    writer.release()
    print(f"Velocity box overlay video saved to: {output_video_path}")


def build_frame_result_lookup(summary: dict) -> dict[int, dict]:
    return {row["frame_index"]: row for row in summary["frame_results"]}


def draw_overlay(frame, row: dict | None, average_clustering: float | None) -> None:
    box_left = 20
    box_top = 20
    box_right = 360
    box_bottom = 140

    overlay = frame.copy()
    cv2.rectangle(overlay, (box_left, box_top), (box_right, box_bottom), (0, 0, 0), -1)
    cv2.addWeighted(overlay, 0.45, frame, 0.55, 0, frame)

    title = "Shrimp Clustering Analysis"
    cv2.putText(frame, title, (35, 50), cv2.FONT_HERSHEY_SIMPLEX, 0.8, (255, 255, 255), 2, cv2.LINE_AA)

    if row is None:
        clustering_text = "Clustering: no data"
        shrimp_text = "Shrimp count: no data"
    else:
        clustering = row["clustering_percentage"]
        if clustering is None:
            clustering_text = "Clustering: skipped"
        else:
            clustering_text = f"Clustering: {clustering:.2f}%"
        shrimp_text = f"Shrimp count: {row['shrimp_count']}"

    average_text = (
        f"Video average: {average_clustering:.2f}%"
        if average_clustering is not None
        else "Video average: unavailable"
    )

    cv2.putText(frame, clustering_text, (35, 82), cv2.FONT_HERSHEY_SIMPLEX, 0.75, (80, 255, 80), 2, cv2.LINE_AA)
    cv2.putText(frame, shrimp_text, (35, 112), cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2, cv2.LINE_AA)
    cv2.putText(frame, average_text, (35, 136), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 255), 2, cv2.LINE_AA)


def render_clustering_video(
    source_video_path: Path,
    summary: dict,
    output_video_path: Path,
) -> None:
    cap = cv2.VideoCapture(str(source_video_path))
    if not cap.isOpened():
        raise ValueError(f"Could not open video for overlay rendering: {source_video_path}")

    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    fps = fps if fps > 0 else 30.0

    output_video_path.parent.mkdir(parents=True, exist_ok=True)
    fourcc = cv2.VideoWriter_fourcc(*"XVID")
    writer = cv2.VideoWriter(str(output_video_path), fourcc, fps, (width, height))

    if not writer.isOpened():
        cap.release()
        raise ValueError(f"Could not create output video: {output_video_path}")

    frame_lookup = build_frame_result_lookup(summary)
    average_clustering = summary["average_video_clustering"]

    frame_index = 0
    while True:
        success, frame = cap.read()
        if not success:
            break

        row = frame_lookup.get(frame_index)
        draw_overlay(frame, row, average_clustering)
        writer.write(frame)
        frame_index += 1

    cap.release()
    writer.release()
    print(f"Overlay video saved to: {output_video_path}")


def save_results_to_csv(summary: dict, output_csv_path: Path) -> None:
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)

    with output_csv_path.open("w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(
            [
                "frame_file",
                "frame_index",
                "time_seconds",
                "shrimp_count",
                "clustering_percentage",
            ]
        )

        for row in summary["frame_results"]:
            writer.writerow(
                [
                    row["frame_file"],
                    row["frame_index"],
                    row["time_seconds"],
                    row["shrimp_count"],
                    row["clustering_percentage"],
                ]
            )

    print(f"\nResults saved to CSV: {output_csv_path}")


def save_velocity_results_to_csv(summary: dict, output_csv_path: Path) -> None:
    output_csv_path.parent.mkdir(parents=True, exist_ok=True)

    with output_csv_path.open("w", newline="") as csvfile:
        writer = csv.writer(csvfile)
        writer.writerow(
            [
                "frame_file",
                "frame_index",
                "time_seconds",
                "shrimp_count",
                "matched_count",
                "average_velocity_px_per_sec",
            ]
        )

        for row in summary["frame_results"]:
            writer.writerow(
                [
                    row["frame_file"],
                    row["frame_index"],
                    row["time_seconds"],
                    row["shrimp_count"],
                    row["matched_count"],
                    row["average_velocity_px_per_sec"],
                ]
            )

    print(f"Velocity results saved to CSV: {output_csv_path}")


def print_summary(summary: dict) -> None:
    print("\n========== FINAL SUMMARY ==========")
    print(f"Video path: {summary['video_path']}")
    print(f"Label folder: {summary['label_folder']}")
    print(f"Frame size: {summary['frame_width']} x {summary['frame_height']}")
    print(f"FPS: {summary['fps']}")
    print(f"Total frames in video: {summary['total_frames_in_video']}")
    print(f"Total label files read: {summary['total_label_files']}")
    print(f"Frames with valid clustering: {summary['valid_clustering_frames']}")

    if summary["average_video_clustering"] is not None:
        print(f"Average video clustering: {summary['average_video_clustering']:.2f}%")
    else:
        print("Average video clustering: Could not be computed")


def print_velocity_summary(summary: dict) -> None:
    print("\n========== VELOCITY SUMMARY ==========")
    print(f"Video path: {summary['video_path']}")
    print(f"Label folder: {summary['label_folder']}")
    print(f"FPS: {summary['fps']}")
    print(f"Total label files read: {summary['total_label_files']}")
    print(f"Frames with velocity data: {summary['frames_with_velocity']}")
    print(f"Matching threshold: {summary['max_match_distance_px']:.2f} px")

    if summary["overall_average_velocity_px_per_sec"] is not None:
        print(f"Overall average velocity: {summary['overall_average_velocity_px_per_sec']:.2f} px/s")
    else:
        print("Overall average velocity: Could not be computed")


def resolve_video_path(video_path_arg: str | None) -> Path:
    if video_path_arg:
        return Path(video_path_arg).expanduser().resolve()
    return DEFAULT_VIDEO_PATH


def resolve_label_folder(label_folder_arg: str | None, video_stem: str) -> Path:
    if label_folder_arg:
        return Path(label_folder_arg).expanduser().resolve()

    preferred = SHRIMP_AI_DIR / "runs" / "detect" / f"{video_stem}_train4" / "labels"
    fallback = SHRIMP_AI_DIR / "runs" / "detect" / f"{video_stem}_train4_test" / "labels"

    if preferred.exists():
        return preferred
    if fallback.exists():
        return fallback
    return DEFAULT_LABEL_FOLDER


def resolve_overlay_source_video(overlay_video_arg: str | None, video_stem: str) -> Path:
    if overlay_video_arg:
        return Path(overlay_video_arg).expanduser().resolve()

    preferred = SHRIMP_AI_DIR / "runs" / "detect" / f"{video_stem}_train4" / f"{video_stem}.avi"
    fallback = SHRIMP_AI_DIR / "runs" / "detect" / f"{video_stem}_train4_test" / f"{video_stem}.avi"

    if preferred.exists():
        return preferred
    if fallback.exists():
        return fallback
    return resolve_video_path(None)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Analyze clustering from YOLO label files for a shrimp video."
    )
    parser.add_argument("--video", help="Path to the source video file.")
    parser.add_argument("--labels", help="Path to the YOLO labels folder.")
    parser.add_argument("--output", help="Path to the output CSV file.")
    parser.add_argument(
        "--output-video",
        help="Path to the annotated video with clustering overlay.",
    )
    parser.add_argument(
        "--overlay-source-video",
        help="Video to draw clustering text onto. Defaults to the YOLO-labeled output video if available.",
    )
    parser.add_argument(
        "--no-video",
        action="store_true",
        help="Skip rendering the annotated video and only produce CSV/console output.",
    )
    parser.add_argument(
        "--confidence-threshold",
        type=float,
        default=0.0,
        help="Ignore predictions below this confidence when labels include confidence.",
    )
    parser.add_argument(
        "--min-shrimp",
        type=int,
        default=2,
        help="Minimum shrimp detections required before computing clustering.",
    )
    parser.add_argument(
        "--velocity-output",
        help="Path to the output CSV file for velocity analysis.",
    )
    parser.add_argument(
        "--velocity-only",
        action="store_true",
        help="Run only the velocity analysis pipeline.",
    )
    parser.add_argument(
        "--max-match-distance-ratio",
        type=float,
        default=0.10,
        help="Maximum center matching distance as a fraction of the frame diagonal.",
    )
    parser.add_argument(
        "--velocity-box-video-output",
        help="Path to the video that shows per-box velocity labels.",
    )
    parser.add_argument(
        "--velocity-box-video-only",
        action="store_true",
        help="Render only the per-box velocity overlay video.",
    )
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    video_path = resolve_video_path(args.video)
    if not video_path.exists():
        raise FileNotFoundError(f"Video file not found: {video_path}")

    video_stem = video_path.stem
    label_folder = resolve_label_folder(args.labels, video_stem)
    output_csv_path = (
        Path(args.output).expanduser().resolve()
        if args.output
        else SCRIPT_DIR / f"{video_stem}_clustering_results.csv"
    )
    output_video_path = (
        Path(args.output_video).expanduser().resolve()
        if args.output_video
        else SCRIPT_DIR / f"{video_stem}_clustering_overlay.avi"
    )
    velocity_output_path = (
        Path(args.velocity_output).expanduser().resolve()
        if args.velocity_output
        else SCRIPT_DIR / f"{video_stem}_velocity_results.csv"
    )
    velocity_box_video_output = (
        Path(args.velocity_box_video_output).expanduser().resolve()
        if args.velocity_box_video_output
        else SCRIPT_DIR / f"{video_stem}_velocity_boxes.avi"
    )

    velocity_summary = analyze_shrimp_velocity(
        video_path=video_path,
        label_folder=label_folder,
        confidence_threshold=args.confidence_threshold,
        max_match_distance_ratio=args.max_match_distance_ratio,
    )
    print_velocity_summary(velocity_summary)
    save_velocity_results_to_csv(velocity_summary, velocity_output_path)

    if args.velocity_box_video_only:
        render_velocity_box_video(
            source_video_path=video_path,
            velocity_summary=velocity_summary,
            label_folder=label_folder,
            output_video_path=velocity_box_video_output,
            confidence_threshold=args.confidence_threshold,
            max_match_distance_ratio=args.max_match_distance_ratio,
        )
        return

    if args.velocity_only:
        return

    summary = analyze_saved_yolo_labels(
        video_path=video_path,
        label_folder=label_folder,
        confidence_threshold=args.confidence_threshold,
        min_shrimp=args.min_shrimp,
    )

    print_summary(summary)
    save_results_to_csv(summary, output_csv_path)

    if not args.no_video:
        overlay_source_video = resolve_overlay_source_video(args.overlay_source_video, video_stem)
        if not overlay_source_video.exists():
            raise FileNotFoundError(f"Overlay source video not found: {overlay_source_video}")
        render_clustering_video(overlay_source_video, summary, output_video_path)

    render_velocity_box_video(
        source_video_path=video_path,
        velocity_summary=velocity_summary,
        label_folder=label_folder,
        output_video_path=velocity_box_video_output,
        confidence_threshold=args.confidence_threshold,
        max_match_distance_ratio=args.max_match_distance_ratio,
    )


if __name__ == "__main__":
    main()
