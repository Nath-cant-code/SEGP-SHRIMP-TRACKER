from __future__ import annotations

import hashlib
import json
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".bmp", ".tif", ".tiff", ".webp"}
SPLIT_BY_VIDEO = {
    "video01": "train",
    "video02": "train",
    "video03": "train",
    "video06": "train",
    "video07": "train",
    "video08": "val",
    "video09": "test",
}


@dataclass
class MergeSummary:
    added: dict[str, int] = field(default_factory=lambda: {"train": 0, "val": 0, "test": 0})
    replaced: dict[str, int] = field(default_factory=lambda: {"train": 0, "val": 0, "test": 0})
    unchanged: dict[str, int] = field(default_factory=lambda: {"train": 0, "val": 0, "test": 0})
    backed_up_conflicts: list[dict[str, str]] = field(default_factory=list)
    copied_pairs: list[dict[str, str]] = field(default_factory=list)
    mapping: list[dict[str, str]] = field(default_factory=list)
    missing_pairs: list[str] = field(default_factory=list)
    invalid_labels_fixed: list[str] = field(default_factory=list)
    invalid_labels_unresolved: list[dict[str, str]] = field(default_factory=list)


def natural_image_index(path: Path) -> int:
    match = re.fullmatch(r"image(\d+)", path.stem)
    if not match:
        raise ValueError(f"Unexpected prediction image name: {path.name}")
    return int(match.group(1))


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def normalize_source_frame_name(path: Path) -> str:
    match = re.fullmatch(r"video_(\d{3})_(\d{4})", path.stem)
    if not match:
        raise ValueError(f"Unexpected source frame name: {path.name}")
    video_number = int(match.group(1))
    frame_number = int(match.group(2))
    return f"video{video_number:02d}_{frame_number:03d}"


def backup_existing(path: Path, backup_root: Path, summary: MergeSummary) -> None:
    relative = path.relative_to(path.parents[2])
    backup_path = backup_root / relative
    backup_path.parent.mkdir(parents=True, exist_ok=True)
    shutil.copy2(path, backup_path)
    summary.backed_up_conflicts.append(
        {
            "original": str(path),
            "backup": str(backup_path),
        }
    )


def normalize_yolo_label(path: Path, summary: MergeSummary) -> str:
    original_text = path.read_text(encoding="utf-8").splitlines()
    normalized_lines: list[str] = []
    changed = False

    for line_number, raw_line in enumerate(original_text, start=1):
        stripped = raw_line.strip()
        if not stripped:
            changed = True
            continue

        parts = stripped.split()
        if len(parts) == 6:
            parts = parts[:5]
            changed = True
        elif len(parts) != 5:
            raise ValueError(f"{path} line {line_number}: expected 5 values, found {len(parts)}")

        try:
            class_id = int(parts[0])
            coords = [float(value) for value in parts[1:]]
        except ValueError as exc:
            raise ValueError(f"{path} line {line_number}: non-numeric YOLO values") from exc

        if class_id < 0:
            raise ValueError(f"{path} line {line_number}: class id must be non-negative")
        if any(value < 0 or value > 1 for value in coords):
            raise ValueError(f"{path} line {line_number}: normalized coordinates must be in [0, 1]")

        normalized_lines.append(
            " ".join([str(class_id), *(f"{value:.6f}".rstrip("0").rstrip(".") for value in coords)])
        )

    normalized_text = "\n".join(normalized_lines)
    if normalized_lines:
        normalized_text += "\n"

    if path.read_text(encoding="utf-8") != normalized_text:
        path.write_text(normalized_text, encoding="utf-8")
        changed = True

    if changed:
        summary.invalid_labels_fixed.append(str(path))
    return normalized_text


def verify_split_pairs(dataset_root: Path) -> list[str]:
    missing_pairs: list[str] = []
    for split in ("train", "val", "test"):
        images_dir = dataset_root / "images" / split
        labels_dir = dataset_root / "labels" / split

        image_basenames = {path.stem for path in images_dir.iterdir() if path.is_file() and path.suffix.lower() in IMAGE_EXTENSIONS}
        label_basenames = {path.stem for path in labels_dir.iterdir() if path.is_file() and path.suffix.lower() == ".txt"}

        for basename in sorted(image_basenames - label_basenames):
            missing_pairs.append(f"{split}: image without label -> {basename}")
        for basename in sorted(label_basenames - image_basenames):
            missing_pairs.append(f"{split}: label without image -> {basename}")

    return missing_pairs


def main() -> int:
    root = Path(__file__).resolve().parent
    dataset_root = root / "dataset"
    source_frames_dir = root / "new_frames"
    predict_images_dir = root / "runs" / "detect" / "predict"
    predict_labels_dir = predict_images_dir / "labels"
    backup_root = dataset_root / "conflicts_backup"
    summary = MergeSummary()

    predict_images = sorted(predict_images_dir.glob("image*.jpg"), key=natural_image_index)
    source_frames = sorted(source_frames_dir.iterdir(), key=lambda path: path.name)

    if len(predict_images) != len(source_frames):
        raise RuntimeError(
            f"Prediction image count ({len(predict_images)}) does not match source frame count ({len(source_frames)})"
        )

    for predict_image, source_frame in zip(predict_images, source_frames):
        label_path = predict_labels_dir / f"{predict_image.stem}.txt"
        if not label_path.exists():
            summary.missing_pairs.append(f"missing corrected label for {predict_image.name}")
            continue

        try:
            normalized_label_text = normalize_yolo_label(label_path, summary)
        except ValueError as exc:
            summary.invalid_labels_unresolved.append({"file": str(label_path), "reason": str(exc)})
            continue

        dataset_basename = normalize_source_frame_name(source_frame)
        video_prefix = dataset_basename.split("_", 1)[0]
        split = SPLIT_BY_VIDEO.get(video_prefix)
        if split is None:
            summary.missing_pairs.append(f"no split rule for {dataset_basename}")
            continue

        target_image = dataset_root / "images" / split / f"{dataset_basename}{source_frame.suffix.lower()}"
        target_label = dataset_root / "labels" / split / f"{dataset_basename}.txt"
        target_image.parent.mkdir(parents=True, exist_ok=True)
        target_label.parent.mkdir(parents=True, exist_ok=True)

        summary.mapping.append(
            {
                "predict_image": predict_image.name,
                "source_frame": source_frame.name,
                "dataset_image": target_image.name,
                "split": split,
            }
        )

        image_exists = target_image.exists()
        label_exists = target_label.exists()

        if image_exists and label_exists:
            same_image = sha256(source_frame) == sha256(target_image)
            same_label = normalized_label_text == target_label.read_text(encoding="utf-8")
            if same_image and same_label:
                summary.unchanged[split] += 1
                continue

            backup_existing(target_image, backup_root, summary)
            backup_existing(target_label, backup_root, summary)
            shutil.copy2(source_frame, target_image)
            target_label.write_text(normalized_label_text, encoding="utf-8")
            summary.replaced[split] += 1
        else:
            if image_exists:
                backup_existing(target_image, backup_root, summary)
            if label_exists:
                backup_existing(target_label, backup_root, summary)

            shutil.copy2(source_frame, target_image)
            target_label.write_text(normalized_label_text, encoding="utf-8")
            summary.added[split] += 1

        summary.copied_pairs.append(
            {
                "source_image": str(source_frame),
                "source_label": str(label_path),
                "target_image": str(target_image),
                "target_label": str(target_label),
                "split": split,
            }
        )

    for split in ("train", "val", "test"):
        labels_dir = dataset_root / "labels" / split
        for label_path in sorted(labels_dir.glob("*.txt")):
            try:
                normalize_yolo_label(label_path, summary)
            except ValueError as exc:
                summary.invalid_labels_unresolved.append({"file": str(label_path), "reason": str(exc)})

    summary.missing_pairs.extend(verify_split_pairs(dataset_root))

    summary_path = root / "merge_summary.json"
    summary_path.write_text(json.dumps(summary.__dict__, indent=2), encoding="utf-8")

    print(f"Summary written to: {summary_path}")
    print(json.dumps(summary.__dict__, indent=2))

    if summary.invalid_labels_unresolved:
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
