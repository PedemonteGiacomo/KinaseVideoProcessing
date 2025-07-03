import cv2
import numpy as np
import os

def create_demo_video():
    """Create a simple demo video with moving objects"""
    # Video properties
    width, height = 640, 480
    fps = 10
    duration = 5  # seconds
    total_frames = fps * duration
    
    # Create video writer
    fourcc = cv2.VideoWriter_fourcc(*'mp4v')
    out = cv2.VideoWriter('demo_video.mp4', fourcc, fps, (width, height))
    
    for frame_idx in range(total_frames):
        # Create black background
        frame = np.zeros((height, width, 3), dtype=np.uint8)
        
        # Add moving objects
        # Moving car (rectangle)
        car_x = int((frame_idx * 5) % (width + 100)) - 50
        cv2.rectangle(frame, (car_x, 200), (car_x + 80, 250), (0, 255, 0), -1)
        cv2.rectangle(frame, (car_x + 10, 210), (car_x + 70, 240), (0, 100, 0), -1)
        
        # Moving person (circle)
        person_x = int((frame_idx * 3) % (width + 60)) - 30
        cv2.circle(frame, (person_x, 350), 25, (255, 100, 100), -1)
        
        # Static building
        cv2.rectangle(frame, (500, 100), (600, 300), (100, 100, 255), -1)
        
        # Add frame info
        cv2.putText(frame, f"Frame: {frame_idx}", (10, 30), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.7, (255, 255, 255), 2)
        cv2.putText(frame, "Demo Video Processing", (10, height - 20), 
                   cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1)
        
        out.write(frame)
    
    out.release()
    print(f"Created demo video: demo_video.mp4 ({total_frames} frames)")

if __name__ == "__main__":
    create_demo_video()
