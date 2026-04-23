from __future__ import annotations

import argparse
import shutil
from pathlib import Path

import cv2


SUPPORTED_EXTENSIONS = {".jpg", ".jpeg", ".png"}
SPLITS = ("train", "val", "test")


def parse_args() -> argparse.Namespace:
    project_root = Path(__file__).resolve().parent

    parser = argparse.ArgumentParser(
        description=(
            "Preprocess all images in a YOLO dataset without changing filenames, "
            "dimensions, labels, or bounding boxes."
        )
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=project_root / "dataset",
        help="Input YOLO dataset root containing train/images, val/images, and test/images.",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=project_root / "dataset_preprocessed",
        help="Output dataset root where processed images will be written.",
    )
    return parser.parse_args()


def collect_images(images_dir: Path) -> list[Path]:
    return sorted(
        path
        for path in images_dir.iterdir()
        if path.is_file() and path.suffix.lower() in SUPPORTED_EXTENSIONS
    )


def resolve_layout(input_root: Path) -> tuple[str, dict[str, Path], dict[str, Path]]:
    standard_images = {split: input_root / "images" / split for split in SPLITS}
    standard_labels = {split: input_root / "labels" / split for split in SPLITS}
    nested_images = {split: input_root / split / "images" for split in SPLITS}
    nested_labels = {split: input_root / split / "labels" for split in SPLITS}

    if all(path.exists() for path in standard_images.values()):
        return "standard", standard_images, standard_labels

    if all(path.exists() for path in nested_images.values()):
        return "nested", nested_images, nested_labels

    missing_standard = [path for path in standard_images.values() if not path.exists()]
    missing_nested = [path for path in nested_images.values() if not path.exists()]
    missing_list = "\n".join(str(path) for path in [*missing_standard, *missing_nested])
    raise FileNotFoundError(
        "Missing expected dataset folders. Supported layouts are:\n"
        f"1. {input_root}\\images\\train, val, test\n"
        f"2. {input_root}\\train\\images, {input_root}\\val\\images, {input_root}\\test\\images\n"
        f"Checked paths:\n{missing_list}"
    )


def preprocess_image(image):
    lab_image = cv2.cvtColor(image, cv2.COLOR_BGR2LAB)
    l_channel, a_channel, b_channel = cv2.split(lab_image)

    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    enhanced_l_channel = clahe.apply(l_channel)

    enhanced_lab = cv2.merge((enhanced_l_channel, a_channel, b_channel))
    color_corrected = cv2.cvtColor(enhanced_lab, cv2.COLOR_LAB2BGR)

    blurred = cv2.GaussianBlur(color_corrected, (3, 3), 0)
    sharpened = cv2.addWeighted(color_corrected, 1.5, blurred, -0.5, 0)

    return sharpened


def copy_labels(split: str, input_labels_dir: Path, output_labels_dir: Path) -> None:

    if not input_labels_dir.exists():
        return

    output_labels_dir.mkdir(parents=True, exist_ok=True)
    for label_path in sorted(input_labels_dir.glob("*.txt")):
        shutil.copy2(label_path, output_labels_dir / label_path.name)


def process_split(
    split: str,
    input_images_dir: Path,
    input_labels_dir: Path,
    output_images_dir: Path,
    output_labels_dir: Path,
) -> tuple[int, int]:
    output_images_dir.mkdir(parents=True, exist_ok=True)

    if not input_images_dir.exists():
        print(f"Skipping {split}: input folder not found at {input_images_dir}")
        return 0, 0

    image_paths = collect_images(input_images_dir)
    total_images = len(image_paths)
    saved_images = 0
    skipped_images = 0

    if total_images == 0:
        print(f"No supported images found in {input_images_dir}")
        return 0, 0

    for index, image_path in enumerate(image_paths, start=1):
        print(f"Processing {split} image {index}/{total_images}: {image_path.name}")

        image = cv2.imread(str(image_path), cv2.IMREAD_COLOR)
        if image is None:
            skipped_images += 1
            print(f"Skipping corrupted image: {image_path}")
            continue

        processed_image = preprocess_image(image)
        if processed_image.shape[:2] != image.shape[:2]:
            raise RuntimeError(f"Image dimensions changed unexpectedly for {image_path}")

        output_path = output_images_dir / image_path.name
        if cv2.imwrite(str(output_path), processed_image):
            saved_images += 1
        else:
            skipped_images += 1
            print(f"Failed to save processed image: {output_path}")

    copy_labels(split, input_labels_dir, output_labels_dir)
    return saved_images, skipped_images


def main() -> int:
    args = parse_args()
    input_root = args.input.resolve()
    output_root = args.output.resolve()

    layout, input_image_dirs, input_label_dirs = resolve_layout(input_root)

    if layout == "standard":
        output_image_dirs = {split: output_root / "images" / split for split in SPLITS}
        output_label_dirs = {split: output_root / "labels" / split for split in SPLITS}
    else:
        output_image_dirs = {split: output_root / split / "images" for split in SPLITS}
        output_label_dirs = {split: output_root / split / "labels" for split in SPLITS}

    processed_count = 0
    skipped_count = 0

    for split in SPLITS:
        split_processed, split_skipped = process_split(
            split=split,
            input_images_dir=input_image_dirs[split],
            input_labels_dir=input_label_dirs[split],
            output_images_dir=output_image_dirs[split],
            output_labels_dir=output_label_dirs[split],
        )
        processed_count += split_processed
        skipped_count += split_skipped

    print(
        "Preprocessing complete. "
        f"Processed: {processed_count} images. "
        f"Skipped: {skipped_count} images."
    )
    print(f"Detected dataset layout: {layout}")
    print(f"Output dataset written to: {output_root}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
