import cv2
import os 
from pathlib import Path


# Define folder paths for input videos and output frames
video_folder = "data/raw_videos"
frames_folder = "data/frames"

# Create the frames output folder if it doesn't exist
Path(frames_folder).mkdir(parents=True, exist_ok=True)

#list of all video files from the raw_videos folder
video_files = [f for f in os.listdir(video_folder)]

for video_file in video_files:
    # Construct full path to the video file
    video_path = os.path.join(video_folder, video_file)
    print(f"processing : {video_file}")
    
    # Open the video file using OpenCV
    capture = cv2.VideoCapture(video_path)
    frame_count = 0
    
    # Extract video name without extension for organizing frames
    video_name = Path(video_file).stem
    
    # Create a folder for this video's frames
    video_frames_folder = os.path.join(frames_folder, video_name)
    Path(video_frames_folder).mkdir(parents=True, exist_ok=True)
    
    # Read and extract every 10th frame from the video
    while True:
        # Read the next frame from the video
        success, frame = capture.read()
        
        # Break if we've reached the end of the video
        if not success:
            break
        
        # Save only every 10th frame (0, 10, 20, ...)
        if frame_count % 10 == 0:
            frame_filename = os.path.join(video_frames_folder, f"frame_{frame_count:04d}.jpg")
            cv2.imwrite(frame_filename, frame)
        
        # Increment frame counter
        frame_count += 1
    
    # Release the video file and close resources
    capture.release()
    print(f"Extracted frames (every 10th) from {video_file}")

print("Frame extraction complete!")
