import aws_cdk as cdk
from stacks.network import NetworkStack
from stacks.storage import StorageStack
from stacks.stream import StreamStack
from stacks.compute import ComputeStack


app = cdk.App()

net = NetworkStack(app, "NetworkStack")
stg = StorageStack(app, "StorageStack")
strm = StreamStack(app, "StreamStack")
ComputeStack(app, "ComputeStack", net=net, stg=stg, strm=strm)

app.synth()
