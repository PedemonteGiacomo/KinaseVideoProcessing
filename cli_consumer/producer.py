"""Example producer that uploads a video to the raw bucket.
This is a simplified example which just uploads a local file to S3.
"""
import boto3
import argparse

parser = argparse.ArgumentParser()
parser.add_argument("--bucket", required=True, help="Raw video bucket")
parser.add_argument("file", help="Path to video file")
args = parser.parse_args()

s3 = boto3.client("s3")
key = args.file.split("/")[-1]

s3.upload_file(args.file, args.bucket, key)
print(f"Uploaded {args.file} to s3://{args.bucket}/{key}")
