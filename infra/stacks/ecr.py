from aws_cdk import (
    Stack,
    aws_ecr as ecr,
    CfnOutput,
    RemovalPolicy
)
from constructs import Construct


class EcrStack(Stack):
    def __init__(self, scope: Construct, id_: str, **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        self.repo = ecr.Repository(
            self, 
            "YoloRepo",
            repository_name="yolo-processor",
            removal_policy=RemovalPolicy.DESTROY
        )

        # Output dell'URI del repository per facilitare il push
        CfnOutput(
            self,
            "RepositoryUri",
            value=self.repo.repository_uri,
            description="URI del repository ECR"
        )
