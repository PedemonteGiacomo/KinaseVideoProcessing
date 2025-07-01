import os
import uuid
from datetime import datetime

import boto3
from ultralytics import YOLO
import cv2

STREAM_NAME = os.environ.get("KINESIS_STREAM_NAME")
OUTPUT_BUCKET = os.environ.get("OUTPUT_BUCKET")
QUEUE_URL = os.environ.get("QUEUE_URL")

s3 = boto3.client("s3")
sqs = boto3.client("sqs")

# Placeholder: in real code you would read frames from the Kinesis Video Stream
# For demo we load a sample image and run detection
model = YOLO("yolov8n.pt")
img = cv2.imread("sample.jpg") if os.path.exists("sample.jpg") else None

if img is not None:
    results = model(img)
    for r in results:
        summary = [
            {
                "class": model.names[c],
                "conf": float(s),
                "bbox": box.xywhn[0].tolist(),
            }
            for box, c, s in zip(r.boxes, r.boxes.cls, r.boxes.conf)
        ]
        key = datetime.utcnow().strftime("%Y-%m-%d/") + f"{uuid.uuid4()}.jpg"
        _, buffer = cv2.imencode(".jpg", img)
        s3.put_object(Bucket=OUTPUT_BUCKET, Key=key, Body=buffer.tobytes())
        message = {
            "bucket": OUTPUT_BUCKET,
            "key": key,
            "summary": summary,
            "ts": datetime.utcnow().isoformat() + "Z",
        }
        sqs.send_message(QueueUrl=QUEUE_URL, MessageBody=str(message))

print("Processing complete")
