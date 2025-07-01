from aws_cdk import (
    Stack,
    RemovalPolicy,
    Duration,
    aws_s3 as s3,
    aws_sqs as sqs
)
from constructs import Construct


class StorageStack(Stack):
    def __init__(self, scope: Construct, id_: str, **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        self.raw_bucket = s3.Bucket(
            self,
            "RawVideoBucket",
            versioned=False,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        self.processed_bucket = s3.Bucket(
            self,
            "ProcessedFrameBucket",
            versioned=True,
            removal_policy=RemovalPolicy.DESTROY,
            auto_delete_objects=True,
        )

        self.queue = sqs.Queue(
            self,
            "ProcessedFrameQueue",
            visibility_timeout=Duration.seconds(60),
            retention_period=Duration.days(1),
        )
