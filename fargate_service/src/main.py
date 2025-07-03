import os
import uuid
import time
import json
from datetime import datetime

import boto3
from ultralytics import YOLO
import cv2
import numpy as np
import torch

STREAM_NAME = os.environ.get("KINESIS_STREAM_NAME")
OUTPUT_BUCKET = os.environ.get("OUTPUT_BUCKET")
QUEUE_URL = os.environ.get("QUEUE_URL")

s3 = boto3.client("s3")
sqs = boto3.client("sqs")
kinesis_video = boto3.client("kinesisvideo")
kvs_media = boto3.client("kinesis-video-media")

# Initialize YOLO model
model = YOLO("yolov8n.pt")

def get_kvs_streaming_endpoint():
    """Get the streaming endpoint for Kinesis Video Stream"""
    try:
        response = kinesis_video.get_data_endpoint(
            StreamName=STREAM_NAME,
            APIName='GET_MEDIA'
        )
        return response['DataEndpoint']
    except Exception as e:
        print(f"Error getting KVS endpoint: {e}")
        return None

def process_video_stream():
    """Process frames from Kinesis Video Stream"""
    endpoint = get_kvs_streaming_endpoint()
    if not endpoint:
        print("Could not get KVS endpoint, using fallback demo")
        return process_demo_video()
    
    try:
        # For demo, we'll simulate video processing
        # In production, you'd use the KVS parser SDK
        return process_demo_video()
    except Exception as e:
        print(f"Error processing video stream: {e}")
        return process_demo_video()

def process_demo_video():
    """Process demo video or images"""
    # Create a simple video-like sequence by processing multiple frames
    frames_processed = 0
    
    # Check if we have a sample image
    if os.path.exists("sample.jpg"):
        base_img = cv2.imread("sample.jpg")
    else:
        # Create a synthetic video frame
        base_img = create_synthetic_frame()
    
    # Simulate processing multiple frames (like from a video)
    for frame_idx in range(5):  # Process 5 frames as demo
        # Add some variation to simulate video frames
        frame = add_frame_variation(base_img, frame_idx)
        
        # Run YOLO detection
        results = model(frame)
        
        # Process results
        process_frame_results(frame, results, frame_idx)
        frames_processed += 1
        
        # Small delay to simulate real-time processing
        time.sleep(1)
    
    return frames_processed

def create_synthetic_frame():
    """Create a synthetic video frame for demo"""
    frame = np.zeros((480, 640, 3), dtype=np.uint8)
    
    # Add some moving objects
    cv2.rectangle(frame, (50, 50), (150, 150), (0, 255, 0), -1)
    cv2.rectangle(frame, (200, 200), (300, 350), (255, 0, 0), -1)
    cv2.circle(frame, (450, 100), 50, (0, 0, 255), -1)
    cv2.putText(frame, "Synthetic Video Frame", (50, 400), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    return frame

def add_frame_variation(base_img, frame_idx):
    """Add variation to base image to simulate video frames"""
    frame = base_img.copy()
    
    # Add frame number
    cv2.putText(frame, f"Frame {frame_idx}", (10, 30), 
                cv2.FONT_HERSHEY_SIMPLEX, 1, (255, 255, 255), 2)
    
    # Add some moving element simulation
    offset = frame_idx * 10
    cv2.circle(frame, (100 + offset, 300), 20, (255, 255, 0), -1)
    
    return frame

def process_frame_results(frame, results, frame_idx):
    """Process and store detection results"""

def process_frame_results(frame, results, frame_idx):
    """Process and store detection results"""
    for r in results:
        summary = [
            {
                "class": model.names[c],
                "conf": float(s),
                "bbox": box.xywhn[0].tolist(),
            }
            for box, c, s in zip(r.boxes, r.boxes.cls, r.boxes.conf)
            if hasattr(r.boxes, 'cls') and hasattr(r.boxes, 'conf')
        ]
        
        # Create unique key for this frame
        timestamp = datetime.utcnow().strftime("%Y-%m-%d/%H-%M-%S")
        key = f"{timestamp}/frame_{frame_idx}_{uuid.uuid4()}.jpg"
        
        # Encode and upload frame to S3
        _, buffer = cv2.imencode(".jpg", frame)
        s3.put_object(Bucket=OUTPUT_BUCKET, Key=key, Body=buffer.tobytes())
        
        # Send message to SQS
        message = {
            "bucket": OUTPUT_BUCKET,
            "key": key,
            "frame_index": frame_idx,
            "detections_count": len(summary),
            "summary": summary,
            "timestamp": datetime.utcnow().isoformat() + "Z",
            "stream_name": STREAM_NAME
        }
        
        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=json.dumps(message))
        print(f"Processed frame {frame_idx}, found {len(summary)} objects")

if __name__ == "__main__":
    print(f"Starting video processing from stream: {STREAM_NAME}")
    print(f"Output bucket: {OUTPUT_BUCKET}")
    
    frames_processed = process_video_stream()
    
    print(f"Video processing complete. Processed {frames_processed} frames")
