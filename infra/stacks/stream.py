from aws_cdk import (
    Stack,
    aws_kinesisvideo as kv
)
from constructs import Construct


class StreamStack(Stack):
    def __init__(self, scope: Construct, id_: str, **kwargs) -> None:
        super().__init__(scope, id_, **kwargs)

        self.stream = kv.CfnStream(
            self,
            "InputStream",
            name="video-input-stream",
            data_retention_in_hours=1,
        )
