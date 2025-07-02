# Troubleshooting Guide

## 🚨 Common Issues and Solutions

### 1. CDK Bootstrap Issues

**Problem**: `ValidationError: 'ComputeStack' depends on 'NetworkStack'`
```
Solution: This is a dependency issue. Deploy stacks in order:
cdk deploy NetworkStack StorageStack StreamStack EcrStack
# Then deploy ComputeStack separately
cdk deploy ComputeStack
```

**Problem**: `Specify an environment name like 'aws://123456789012/us-east-1'`
```
Solution: Ensure cdk.json exists in infra/ directory and AWS credentials are configured:
aws configure
aws sts get-caller-identity
```

### 2. Docker Build Issues

**Problem**: Build fails with permission errors
```powershell
# On Windows, ensure Docker Desktop is running as administrator
# Check Docker is accessible:
docker --version
docker ps
```

**Problem**: Ultralytics installation fails
```
Solution: The build process downloads YOLO models. Ensure stable internet connection.
If it fails, try rebuilding - Docker will cache successful layers.
```

### 3. ECR Push Issues

**Problem**: `no basic auth credentials`
```powershell
# Re-authenticate with ECR:
aws ecr get-login-password --region <your-region> | docker login --username AWS --password-stdin <account-id>.dkr.ecr.<region>.amazonaws.com
```

**Problem**: `repository does not exist`
```
Solution: Ensure EcrStack is deployed first:
cdk deploy EcrStack
```

### 4. Fargate Deployment Issues

**Problem**: Task keeps stopping with exit code 1
```
Check CloudWatch logs:
1. Go to ECS Console → Clusters → YoloCluster
2. Click on Tasks tab
3. Click on the stopped task
4. Go to Logs tab
5. Check for error messages
```

**Problem**: Task can't pull image from ECR
```
Solution: Verify task execution role has ECR permissions.
This should be automatic with our CDK configuration.
```

### 5. Processing Issues

**Problem**: No objects detected
```
This is normal for synthetic test images. YOLO might not detect 
simple geometric shapes. Try with a real photo containing people, cars, etc.
```

**Problem**: S3 upload fails
```
Check CloudWatch logs for S3 permission errors.
Verify the task role has S3 write permissions to the processed bucket.
```

### 6. Consumer Issues

**Problem**: Consumer shows "No messages available"
```
1. Check if Fargate task completed successfully
2. Verify SQS queue URL is correct
3. Check if messages exist in SQS console
4. Ensure consumer has SQS read permissions
```

**Problem**: Consumer can't download from S3
```
Verify AWS credentials for consumer script:
aws sts get-caller-identity
```

### 7. Cleanup Issues

**Problem**: `cdk destroy` fails
```
Some resources might have dependencies. Try:
1. Delete in reverse order: ComputeStack, then others
2. Check CloudFormation console for stuck resources
3. Manually delete problematic resources if needed
```

### 8. Cost Management

**Problem**: Unexpected AWS charges
```
Monitor costs:
1. NAT Gateway (in VPC) - most expensive component
2. Fargate task running time
3. S3 storage costs
4. Data transfer costs

Always run `cdk destroy --all` after testing!
```

## 🔍 Debug Commands

### Check Stack Status
```powershell
cdk list
cdk diff
aws cloudformation describe-stacks --stack-name <stack-name>
```

### Monitor ECS Tasks
```powershell
aws ecs list-tasks --cluster YoloCluster
aws ecs describe-tasks --cluster YoloCluster --tasks <task-arn>
```

### Check SQS Messages
```powershell
aws sqs get-queue-attributes --queue-url <queue-url> --attribute-names ApproximateNumberOfMessages
aws sqs receive-message --queue-url <queue-url> --max-number-of-messages 1
```

### Check S3 Contents
```powershell
aws s3 ls s3://<bucket-name> --recursive
```

### View CloudWatch Logs
```powershell
aws logs describe-log-groups --log-group-name-prefix "/aws/ecs/"
aws logs get-log-events --log-group-name <log-group> --log-stream-name <log-stream>
```

## 🛡️ Security Notes

- Never commit AWS credentials to git
- Use IAM roles instead of access keys when possible
- Review and minimize IAM permissions
- Enable CloudTrail for audit logging
- Consider using AWS Secrets Manager for sensitive data

## 📞 Getting Help

1. Check AWS CloudFormation events for detailed error messages
2. Review CloudWatch logs for application-level errors
3. Use AWS CLI debug mode: `aws --debug <command>`
4. Check AWS service status page for regional issues
