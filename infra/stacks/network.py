from aws_cdk import (
    Stack,
    aws_ec2 as ec2
)
from constructs import Construct


class NetworkStack(Stack):
    def __init__(self, scope: Construct, id_: str, **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        self.vpc = ec2.Vpc(
            self,
            "PipelineVpc",
            max_azs=2,
            nat_gateways=1,
        )

        self.sg_fargate = ec2.SecurityGroup(
            self,
            "FargateSG",
            vpc=self.vpc,
            allow_all_outbound=True,
        )
