# Kinase Video Processing Pipeline

This repository demonstrates an end-to-end video processing pipeline built entirely with **AWS CDK v2** in Python. The infrastructure deploys a Fargate service running a YOLO-based object detector that processes video frames, stores results on S3, and notifies consumers through SQS.

## 🏗️ Architecture

```
Kinesis Video Stream → Fargate (YOLO Processing) → S3 (Processed Frames) 
                                ↓
                           SQS Queue → Local Consumer
```

## 📁 Repository Structure

```
infra/                # AWS CDK application
  app.py              # CDK entry point
  cdk.json            # CDK configuration
  stacks/             # Individual CDK stacks
    network.py        # VPC and security groups
    storage.py        # S3 buckets and SQS queue
    stream.py         # Kinesis Video Stream
    ecr.py           # ECR repository for Docker images
    compute.py        # ECS Fargate service
fargate_service/      # YOLO container source
  Dockerfile          # Container definition
  requirements.txt    # Python dependencies
  src/
    main.py          # Video processing logic
  sample.jpg          # Demo image for testing
cli_consumer/         # Consumer script for SQS + S3
  consume.py          # Script to consume processed results
docs/
  CONTRACT.md         # Message contract specification
```

## 🔧 Prerequisites

- **Python 3.11+**
- **Docker Desktop** (running)
- **AWS CLI** configured with appropriate permissions
- **AWS Account** with permissions for:
  - ECR (Elastic Container Registry)
  - ECS (Elastic Container Service) 
  - S3, SQS, Kinesis Video Streams
  - VPC, CloudFormation, IAM

## 🚀 Quick Start Guide

### Step 1: Environment Setup

1. **Clone and navigate to the repository**
   ```powershell
   git clone <your-repo-url>
   cd Hackaton
   ```

2. **Create and activate virtual environment**
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```

3. **Install dependencies**
   ```powershell
   pip install -r requirements.txt
   ```

4. **Verify AWS credentials**
   ```powershell
   aws sts get-caller-identity
   ```

### Step 2: Bootstrap CDK (One-time setup)

```powershell
cd infra
cdk bootstrap
```

### Step 3: Build Docker Image

```powershell
cd ..\fargate_service
docker build -t yolo-processor:latest .
```

### Step 4: Deploy Infrastructure (Gradual Deployment)

1. **Deploy base infrastructure**
   ```powershell
   cd ..\infra
   cdk deploy NetworkStack StorageStack StreamStack EcrStack --require-approval never
   ```

2. **Get ECR repository URI from output** (look for `EcrStack.RepositoryUri`)

3. **Login to ECR and push image**
   ```powershell
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   
   docker tag yolo-processor:latest <ecr-repository-uri>:latest
   docker push <ecr-repository-uri>:latest
   ```

4. **Deploy compute stack**
   ```powershell
   cdk deploy ComputeStack --require-approval never
   ```

### Step 5: Test the Pipeline

1. **Get SQS Queue URL from CloudFormation outputs**
   ```powershell
   aws cloudformation describe-stacks --stack-name StorageStack --query "Stacks[0].Outputs[?OutputKey=='QueueUrl'].OutputValue" --output text
   ```

2. **Run the consumer**
   ```powershell
   cd ..\cli_consumer
   python consume.py --queue <queue-url-from-above>
   ```

3. **Check results**
   - Monitor CloudWatch logs for Fargate task execution
   - Check S3 bucket for processed frames
   - Consumer should display detected objects

## 🔍 Expected Results

### Fargate Processing Output
```
Starting video processing from stream: video-input-stream
Processed frame 0, found 3 objects
Processed frame 1, found 2 objects
...
Video processing complete. Processed 5 frames
```

### Consumer Output
```
Processing message: {"bucket": "processedframebucket-xyz", "frame_index": 0, "detections_count": 3, ...}
Downloaded frame_0_abc123.jpg from S3
Detected objects: 3
- person (confidence: 0.85)
- car (confidence: 0.92)
- building (confidence: 0.78)
```

### AWS Resources Created
- **S3 Buckets**: Raw video storage + Processed frames storage
- **SQS Queue**: Message queue for frame processing notifications
- **Kinesis Video Stream**: Input stream for video data
- **ECR Repository**: Container image storage
- **ECS Fargate Service**: Serverless container execution
- **VPC**: Isolated network environment

## 🧪 Testing Different Scenarios

### Test with Custom Images
1. Replace `sample.jpg` in `fargate_service/` with your own image
2. Rebuild and redeploy: `docker build -t yolo-processor:latest .`
3. Push new image to ECR and redeploy ComputeStack

### Monitor Processing
- **CloudWatch Logs**: ECS → Clusters → YoloCluster → Tasks → Logs
- **S3 Console**: Check processed frames in bucket
- **SQS Console**: Monitor message queue activity

## 🧹 Cleanup

```powershell
cd infra
cdk destroy --all
```

**Note**: This will delete all resources and data. Make sure to backup any important processed results.

## 🚨 Troubleshooting

### Common Issues

1. **ECR Authentication Failed**
   ```powershell
   aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
   ```

2. **Fargate Task Failing**
   - Check CloudWatch logs in ECS console
   - Verify environment variables are set correctly
   - Check IAM permissions

3. **No Messages in SQS**
   - Verify Fargate task completed successfully
   - Check CloudWatch logs for errors
   - Verify S3 bucket permissions

4. **Consumer Not Working**
   - Verify SQS queue URL is correct
   - Check AWS credentials for consumer script
   - Ensure SQS queue has messages

### Debug Commands

```powershell
# Check CDK stacks status
cdk list

# View CloudFormation outputs
aws cloudformation describe-stacks --stack-name <stack-name>

# Check ECS task status
aws ecs list-tasks --cluster YoloCluster

# View SQS messages (without consuming)
aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 1
```

## 📚 Additional Resources

- [AWS CDK Documentation](https://docs.aws.amazon.com/cdk/)
- [Kinesis Video Streams Documentation](https://docs.aws.amazon.com/kinesisvideo/)
- [YOLO Ultralytics Documentation](https://docs.ultralytics.com/)

## 📄 License

This project is licensed under the MIT License.
