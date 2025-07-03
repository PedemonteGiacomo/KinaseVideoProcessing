import { DemoVideo } from "../types/video";

const AWS_REGION = process.env.NEXT_PUBLIC_AWS_REGION;
const AWS_ACCESS_KEY_ID = process.env.NEXT_PUBLIC_AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.NEXT_PUBLIC_AWS_SECRET_ACCESS_KEY;
const KINESIS_STREAM_NAME = process.env.NEXT_PUBLIC_KINESIS_STREAM_NAME;
const SQS_QUEUE_URL = process.env.NEXT_PUBLIC_SQS_QUEUE_URL;

// Send a video frame to Kinesis
export async function sendVideoFrame(videoData: Uint8Array | Buffer | string) {
  if (typeof window === "undefined") return;
  const AWS = (await import("aws-sdk")).default;
  const kinesis = new AWS.Kinesis({
    region: AWS_REGION as string,
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
  });
  const params = {
    StreamName: KINESIS_STREAM_NAME as string,
    Data: videoData,
    PartitionKey: "video-processing",
  };
  try {
    await kinesis.putRecord(params).promise();
    return true;
  } catch (error) {
    return error;
  }
}

// Receive detection results from SQS
export async function receiveLiveVideo() {
  if (typeof window === "undefined") return [];
  const AWS = (await import("aws-sdk")).default;
  const sqs = new AWS.SQS({
    region: AWS_REGION as string,
    accessKeyId: AWS_ACCESS_KEY_ID as string,
    secretAccessKey: AWS_SECRET_ACCESS_KEY as string,
  });
  const params = {
    QueueUrl: SQS_QUEUE_URL as string,
    MaxNumberOfMessages: 10,
    WaitTimeSeconds: 2,
  };
  try {
    const data = await sqs.receiveMessage(params).promise();
    if (data.Messages) {
      for (const message of data.Messages) {
        await sqs
          .deleteMessage({
            QueueUrl: SQS_QUEUE_URL as string,
            ReceiptHandle: message.ReceiptHandle as string,
          })
          .promise();
      }
      return data.Messages.map((msg) => JSON.parse(msg.Body!));
    }
    return [];
  } catch (error) {
    return error;
  }
}
