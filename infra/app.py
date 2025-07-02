import aws_cdk as cdk
from stacks.network import NetworkStack
from stacks.storage import StorageStack
from stacks.stream import StreamStack
from stacks.ecr import EcrStack
from stacks.compute import ComputeStack


app = cdk.App()

# Stack di base
net = NetworkStack(app, "NetworkStack")
stg = StorageStack(app, "StorageStack")
strm = StreamStack(app, "StreamStack")
ecr_stack = EcrStack(app, "EcrStack")

# ComputeStack - da deployare dopo aver pushato l'immagine
ComputeStack(app, "ComputeStack", net=net, stg=stg, strm=strm, ecr_stack=ecr_stack)

app.synth()
