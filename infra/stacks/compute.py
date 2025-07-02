from aws_cdk import (
    Stack,
    Duration,
    aws_ec2 as ec2,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_ecr as ecr,
    aws_iam as iam,
)
from constructs import Construct
from .network import NetworkStack
from .storage import StorageStack
from .stream import StreamStack
from .ecr import EcrStack


class ComputeStack(Stack):
    def __init__(self, scope: Construct, id_: str,
                 net: NetworkStack,
                 stg: StorageStack,
                 strm: StreamStack,
                 ecr_stack: EcrStack,
                 **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        repo = ecr_stack.repo
        image = ecs.ContainerImage.from_ecr_repository(repo, tag="latest")

        cluster = ecs.Cluster(
            self,
            "YoloCluster",
            vpc=net.vpc,
        )

        # Task execution role (for pulling images from ECR)
        task_execution_role = iam.Role(
            self,
            "YoloTaskExecutionRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managed_policies=[
                iam.ManagedPolicy.from_aws_managed_policy_name("service-role/AmazonECSTaskExecutionRolePolicy")
            ]
        )
        
        # Additional ECR permissions for private repositories
        task_execution_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "ecr:GetAuthorizationToken",
                    "ecr:BatchCheckLayerAvailability",
                    "ecr:GetDownloadUrlForLayer",
                    "ecr:BatchGetImage"
                ],
                resources=["*"]
            )
        )

        # Task role (for application permissions)
        task_role = iam.Role(
            self,
            "YoloTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        )
        
        # S3 permissions - specific to our buckets
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "s3:GetObject",
                    "s3:PutObject",
                    "s3:PutObjectAcl"
                ],
                resources=[
                    f"{stg.processed_bucket.bucket_arn}/*",
                    f"{stg.raw_bucket.bucket_arn}/*"
                ]
            )
        )
        
        # S3 bucket listing permission
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=["s3:ListBucket"],
                resources=[
                    stg.processed_bucket.bucket_arn,
                    stg.raw_bucket.bucket_arn
                ]
            )
        )
        
        # Kinesis Video Streams permissions
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "kinesisvideo:GetDataEndpoint",
                    "kinesisvideo:GetMedia",
                    "kinesisvideo:DescribeStream",
                    "kinesisvideo:ListStreams"
                ],
                resources=[strm.stream.attr_arn]
            )
        )
        
        # SQS permissions
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "sqs:SendMessage",
                    "sqs:GetQueueAttributes"
                ],
                resources=[stg.queue.queue_arn]
            )
        )
        
        # CloudWatch Logs permissions
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=[
                    "logs:CreateLogGroup",
                    "logs:CreateLogStream",
                    "logs:PutLogEvents"
                ],
                resources=["*"]
            )
        )

        service = ecs_patterns.ApplicationLoadBalancedFargateService(
            self,
            "YoloService",
            cluster=cluster,
            cpu=1024,
            memory_limit_mib=2048,
            desired_count=1,
            assign_public_ip=False,
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=image,
                container_port=5000,
                task_role=task_role,
                execution_role=task_execution_role,
                environment={
                    "KINESIS_STREAM_NAME": strm.stream.name,
                    "OUTPUT_BUCKET": stg.processed_bucket.bucket_name,
                    "QUEUE_URL": stg.queue.queue_url,
                },
                enable_logging=True,
            ),
        )
        
        # Configure security group after service creation
        service.service.connections.allow_from_any_ipv4(
            ec2.Port.tcp(80), "Allow HTTP access"
        )
