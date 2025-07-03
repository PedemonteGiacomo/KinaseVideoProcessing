# Testing Examples

## 🧪 Step-by-Step Test Scenarios

### Scenario 1: Basic Pipeline Test

**Objective**: Verify the complete pipeline works end-to-end

**Steps**:
1. Deploy infrastructure
2. Wait for Fargate task to complete
3. Run consumer
4. Verify results

**Expected Results**:
- 5 processed frames in S3
- 5 messages in SQS (consumed by consumer)
- YOLO detections displayed by consumer

### Scenario 2: Custom Image Test

**Objective**: Test with your own images

**Steps**:
1. Replace `fargate_service/sample.jpg` with your image
2. Rebuild Docker image:
   ```powershell
   cd fargate_service
   docker build -t yolo-processor:latest .
   ```
3. Push to ECR and redeploy ComputeStack
4. Run consumer

**Expected Results**:
- Better object detections with real photos
- Different object classes detected

### Scenario 3: Monitor Real-time Processing

**Objective**: Watch the processing happen live

**Steps**:
1. Start consumer before deployment:
   ```powershell
   python cli_consumer/consume.py --queue <queue-url> --wait
   ```
2. Deploy ComputeStack
3. Watch live updates in consumer

**Expected Results**:
- Real-time processing updates
- Frame-by-frame results

## 📊 Verification Checklist

### ✅ Infrastructure Deployed
- [ ] NetworkStack: VPC created
- [ ] StorageStack: S3 buckets + SQS queue created
- [ ] StreamStack: Kinesis Video Stream created
- [ ] EcrStack: ECR repository created
- [ ] ComputeStack: Fargate service running

### ✅ Docker Image
- [ ] Image builds successfully
- [ ] Image pushed to ECR
- [ ] Fargate can pull image

### ✅ Processing
- [ ] Fargate task starts
- [ ] Task completes successfully
- [ ] CloudWatch logs show processing output
- [ ] No error messages in logs

### ✅ Results
- [ ] Processed frames appear in S3
- [ ] Messages appear in SQS
- [ ] Consumer receives and processes messages
- [ ] Objects detected and displayed

## 🔍 AWS Console Verification

### Check S3 Bucket
1. Go to S3 Console
2. Find bucket named `processedframebucket-...`
3. Navigate to date folder (e.g., `2025-07-01/`)
4. Verify frame images exist

### Check SQS Queue
1. Go to SQS Console
2. Find queue named `ProcessedFrameQueue`
3. Check "Messages available" count
4. Use "Send and receive messages" to view message content

### Check ECS Task
1. Go to ECS Console
2. Click on "YoloCluster"
3. Go to "Tasks" tab
4. Check task status (should be STOPPED after completion)
5. Click on task → "Logs" to see processing output

### Check CloudWatch Logs
1. Go to CloudWatch Console
2. Click "Log groups"
3. Find `/aws/ecs/YoloService`
4. View log streams for processing output

## 🐛 Common Test Results

### ✅ Successful Run
```
CloudWatch Logs:
Starting video processing from stream: video-input-stream
Processed frame 0, found 2 objects
Processed frame 1, found 3 objects
Processed frame 2, found 1 objects
Processed frame 3, found 2 objects
Processed frame 4, found 3 objects
Video processing complete. Processed 5 frames

Consumer Output:
Processing message: {...}
Downloaded frame_0_abc123.jpg from S3
Detected objects: 2
- person (confidence: 0.85)
- car (confidence: 0.92)
```

### ❌ No Objects Detected
```
CloudWatch Logs:
Starting video processing from stream: video-input-stream
Processed frame 0, found 0 objects
...

This is normal for synthetic test images.
Try with real photos containing people, cars, etc.
```

### ❌ S3 Permission Error
```
CloudWatch Logs:
botocore.exceptions.ClientError: An error occurred (AccessDenied) when calling the PutObject operation

Solution: Verify task role has S3 write permissions
```

### ❌ Container Won't Start
```
ECS Console: Task keeps stopping with exit code

1. Check CloudWatch logs for Python errors
2. Verify environment variables are set
3. Check if image exists in ECR
```

## 📈 Performance Expectations

### Processing Time
- **Single frame**: ~2-3 seconds
- **5 frames total**: ~10-15 seconds
- **Cold start**: Additional 30-60 seconds for container startup

### Resource Usage
- **CPU**: 1 vCPU (1024 CPU units)
- **Memory**: 2GB (2048 MiB)
- **Storage**: Minimal (images are small)

### Cost Estimates (US East 1)
- **Fargate**: ~$0.01 per run (15 minutes)
- **S3**: ~$0.001 for storage
- **SQS**: ~$0.001 for messages
- **NAT Gateway**: ~$0.15 per day (most expensive!)

**Total per test**: ~$0.02 (excluding NAT Gateway)

## 🎯 Success Criteria

A successful test run should demonstrate:

1. **Infrastructure**: All stacks deploy without errors
2. **Container**: Docker image builds and runs successfully
3. **Processing**: Video frames processed with YOLO detections
4. **Storage**: Processed frames stored in S3
5. **Messaging**: Results sent to SQS and consumed
6. **Monitoring**: Logs available in CloudWatch

Remember to clean up with `cdk destroy --all` after testing!
