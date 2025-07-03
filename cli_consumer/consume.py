import argparse
import boto3
import json

parser = argparse.ArgumentParser()
parser.add_argument("--queue", required=True, help="SQS queue URL")
args = parser.parse_args()

sqs = boto3.client("sqs")
s3 = boto3.client("s3")

print("Listening for messages... Press Ctrl+C to exit.")
while True:
    resp = sqs.receive_message(
        QueueUrl=args.queue,
        MaxNumberOfMessages=1,
        WaitTimeSeconds=10,
    )
    messages = resp.get("Messages", [])
    if not messages:
        continue
    for msg in messages:
        body = json.loads(msg["Body"].replace("'", '"'))
        print(f"Received: {body}")
        s3.download_file(body["bucket"], body["key"], body["key"].split("/")[-1])
        sqs.delete_message(QueueUrl=args.queue, ReceiptHandle=msg["ReceiptHandle"])
        print("Frame saved")
