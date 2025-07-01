from aws_cdk import (
    Stack,
    Duration,
    aws_ecs as ecs,
    aws_ecs_patterns as ecs_patterns,
    aws_ecr as ecr,
    aws_iam as iam,
)
from constructs import Construct
from .network import NetworkStack
from .storage import StorageStack
from .stream import StreamStack


class ComputeStack(Stack):
    def __init__(self, scope: Construct, id_: str,
                 net: NetworkStack,
                 stg: StorageStack,
                 strm: StreamStack,
                 **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        repo = ecr.Repository(self, "YoloRepo")
        image = ecs.ContainerImage.from_ecr_repository(repo, tag="latest")

        cluster = ecs.Cluster(
            self,
            "YoloCluster",
            vpc=net.vpc,
        )

        task_role = iam.Role(
            self,
            "YoloTaskRole",
            assumed_by=iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
        )
        task_role.add_managed_policy(
            iam.ManagedPolicy.from_aws_managed_policy_name("AmazonS3FullAccess")
        )
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=["kinesisvideo:Get*", "kinesisvideo:DescribeStream"],
                resources=["*"]
            )
        )
        task_role.add_to_policy(
            iam.PolicyStatement(
                actions=["sqs:SendMessage"],
                resources=[stg.queue.queue_arn],
            )
        )

        ecs_patterns.ApplicationLoadBalancedFargateService(
            self,
            "YoloService",
            cluster=cluster,
            cpu=1024,
            memory_limit_mib=2048,
            desired_count=1,
            assign_public_ip=False,
            security_groups=[net.sg_fargate],
            task_image_options=ecs_patterns.ApplicationLoadBalancedTaskImageOptions(
                image=image,
                container_port=5000,
                task_role=task_role,
                environment={
                    "KINESIS_STREAM_NAME": strm.stream.name,
                    "OUTPUT_BUCKET": stg.processed_bucket.bucket_name,
                    "QUEUE_URL": stg.queue.queue_url,
                },
            ),
        )
