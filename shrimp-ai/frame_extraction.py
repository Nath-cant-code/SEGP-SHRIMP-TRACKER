from pathlib import Path

import cv2


VIDEO_EXTENSIONS = {".mp4", ".avi"}
FRAME_INTERVAL = 30
PROJECT_ROOT = Path(__file__).resolve().parent
VIDEO_FOLDER = PROJECT_ROOT / "data" / "raw"
FRAMES_FOLDER = PROJECT_ROOT / "new_frames"


def safe_stem(path: Path) -> str:
    return "".join(char if char.isalnum() or char in {"-", "_"} else "_" for char in path.stem)


def extract_frames(video_path: Path) -> int:
    print(f"Processing {video_path.name}")

    capture = cv2.VideoCapture(str(video_path))
    if not capture.isOpened():
        print(f"Unable to open {video_path.name}, skipping.")
        return 0

    saved_count = 0
    frame_index = 0
    video_name = safe_stem(video_path)

    while True:
        success, frame = capture.read()
        if not success:
            break

        if frame_index % FRAME_INTERVAL == 0:
            saved_count += 1
            frame_path = FRAMES_FOLDER / f"{video_name}_{saved_count:04d}.jpg"
            if not frame_path.exists():
                cv2.imwrite(str(frame_path), frame)

        frame_index += 1

    capture.release()
    print(f"Extracted {saved_count} frames")
    return saved_count


def main() -> None:
    FRAMES_FOLDER.mkdir(parents=True, exist_ok=True)

    if not VIDEO_FOLDER.exists():
        raise FileNotFoundError(f"Input folder not found: {VIDEO_FOLDER}")

    video_files = sorted(
        path for path in VIDEO_FOLDER.iterdir() if path.is_file() and path.suffix.lower() in VIDEO_EXTENSIONS
    )

    if not video_files:
        print(f"No video files found in {VIDEO_FOLDER}")
        return

    for video_path in video_files:
        extract_frames(video_path)

    print("Frame extraction complete!")


if __name__ == "__main__":
    main()
