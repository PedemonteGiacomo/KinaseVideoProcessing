# Kinase Video Processing

This repository demonstrates an end-to-end video processing pipeline built entirely with **AWS CDK v2** in Python. The infrastructure deploys a Fargate service running a YOLO-based object detector that reads frames from Kinesis Video Streams, stores results on S3 and notifies a consumer through SQS.

## Repository structure

```
infra/                # AWS CDK application
  app.py              # entry point
  stacks/             # individual stacks
    network.py        # VPC and security groups
    storage.py        # S3 buckets and SQS queue
    stream.py         # Kinesis Video Stream
    compute.py        # ECS Fargate service
fargate_service/      # YOLO container source
  Dockerfile
  requirements.txt
  src/
    main.py
cli_consumer/         # example script consuming SQS + S3
  consume.py
  producer.py (optional)
docs/
  CONTRACT.md         # message contract
```

## Prerequisites

- Python 3.11
- Docker
- An AWS account with permissions for CDK and ECR

Create and activate a virtual environment and install dependencies:

```bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Bootstrap CDK once in your AWS account:

```bash
cd infra
cdk bootstrap
```

## Deployment

1. **Build and push the container**

```bash
cd ../fargate_service
# build the container locally
docker build -t yolo-processor:latest .
# authenticate and push to ECR (replace placeholders)
aws ecr get-login-password | \
  docker login --username AWS --password-stdin <account>.dkr.ecr.<region>.amazonaws.com
# tag and push
docker tag yolo-processor:latest <repo-url>:latest
docker push <repo-url>:latest
```

2. **Deploy the infrastructure**

```bash
cd ../infra
cdk deploy --all
```

3. **Run the consumer**

```bash
python ../cli_consumer/consume.py --queue <ProcessedFrameQueueUrl>
```

## Clean up

```bash
cdk destroy --all
```

## License

This project is licensed under the MIT License.
