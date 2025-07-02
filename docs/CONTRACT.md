# Message Contract Specification

## SQS Message Format

This document describes the message format sent from the Fargate video processing service to the SQS queue.

### Message Structure

```json
{
  "bucket": "string",
  "key": "string", 
  "frame_index": "number",
  "detections_count": "number",
  "summary": [
    {
      "class": "string",
      "conf": "number",
      "bbox": [number, number, number, number]
    }
  ],
  "timestamp": "string (ISO 8601)",
  "stream_name": "string"
}
```

### Field Descriptions

| Field | Type | Description | Example |
|-------|------|-------------|---------|
| `bucket` | string | S3 bucket name containing the processed frame | `"processedframebucket-abc123"` |
| `key` | string | S3 object key for the processed frame image | `"2025-07-01/14-30-15/frame_0_uuid.jpg"` |
| `frame_index` | number | Sequential frame number in the video sequence | `0, 1, 2, ...` |
| `detections_count` | number | Total number of objects detected in this frame | `3` |
| `summary` | array | List of detected objects with their properties | See Object Detection below |
| `timestamp` | string | ISO 8601 timestamp when frame was processed | `"2025-07-01T14:30:15.123456Z"` |
| `stream_name` | string | Name of the Kinesis Video Stream source | `"video-input-stream"` |

### Object Detection Format

Each object in the `summary` array contains:

| Field | Type | Description | Range |
|-------|------|-------------|-------|
| `class` | string | YOLO object class name | `"person", "car", "bicycle", etc.` |
| `conf` | number | Detection confidence score | `0.0 - 1.0` |
| `bbox` | array | Normalized bounding box coordinates | `[x_center, y_center, width, height]` |

**Bounding Box Format**: All coordinates are normalized (0.0 to 1.0) relative to image dimensions.
- `x_center`: Horizontal center position
- `y_center`: Vertical center position  
- `width`: Box width
- `height`: Box height

### Complete Example

```json
{
  "bucket": "processedframebucket-a1b2c3d4",
  "key": "2025-07-01/14-30-15/frame_2_a1b2c3d4-e5f6-7g8h-9i0j-k1l2m3n4o5p6.jpg",
  "frame_index": 2,
  "detections_count": 3,
  "summary": [
    {
      "class": "person",
      "conf": 0.8547,
      "bbox": [0.3245, 0.6012, 0.1245, 0.3456]
    },
    {
      "class": "car", 
      "conf": 0.9234,
      "bbox": [0.7123, 0.4567, 0.2345, 0.1890]
    },
    {
      "class": "bicycle",
      "conf": 0.7891,
      "bbox": [0.1567, 0.7234, 0.0987, 0.2345]
    }
  ],
  "timestamp": "2025-07-01T14:30:15.123456Z",
  "stream_name": "video-input-stream"
}
```

### Usage by Consumer

The consumer application should:

1. **Poll SQS Queue**: Continuously check for new messages
2. **Parse JSON**: Extract message fields from JSON payload
3. **Download Image**: Use `bucket` and `key` to download processed frame from S3
4. **Process Results**: Display or further process the detection results
5. **Acknowledge Message**: Delete message from SQS after successful processing

### Error Handling

- Messages without required fields should be logged and discarded
- Failed S3 downloads should be retried with exponential backoff
- Invalid JSON should be logged and the message deleted
- Processing errors should not prevent message acknowledgment

### YOLO Classes

Common object classes detected by YOLOv8:
- `person`, `bicycle`, `car`, `motorcycle`, `airplane`, `bus`, `train`, `truck`
- `boat`, `traffic light`, `fire hydrant`, `stop sign`, `parking meter`
- `bench`, `bird`, `cat`, `dog`, `horse`, `sheep`, `cow`, `elephant`
- `bear`, `zebra`, `giraffe`, `backpack`, `umbrella`, `handbag`, `tie`
- And 60+ more classes...

Full list available at: https://docs.ultralytics.com/datasets/detect/coco/
