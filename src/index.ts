import express, { Request, Response } from 'express';
import AWS from 'aws-sdk';
import dotenv from 'dotenv';
import { HeadObjectRequest } from 'aws-sdk/clients/s3';

dotenv.config();

const app = express();
const port = 3000;

const s3 = new AWS.S3({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION,
});

const bucketName = process.env.S3_BUCKET_NAME;
const videoKey = process.env.S3_VIDEO_KEY;
const CHUNK_SIZE = 1048576

if (!bucketName || !videoKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

app.get('/video', async (req: Request, res: Response) => {
  try {
    const range = req.headers.range;

    if (!range) {
      res.status(400).send("Requires Range header");
      return;
    }

    const headParams: HeadObjectRequest = {
      Bucket: bucketName,
      Key: videoKey,
    };

    const headData = await s3.headObject(headParams).promise();
    const fileSize = headData.ContentLength;

    if (!fileSize) {
      res.status(404).send("File not found");
      return;
    }

    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = Math.min(start + CHUNK_SIZE - 1, fileSize as number - 1);

    if (start >= fileSize || end >= fileSize) {
      res.status(416).send("Requested range not satisfiable\n" + start + " - " + end + " / " + fileSize);
      return;
    }

    const streamParams = {
      Bucket: bucketName,
      Key: videoKey,
      Range: `bytes=${start}-${end}`,
    };

    const stream = s3.getObject(streamParams).createReadStream();

    const head = {
      'Content-Range': `bytes ${start}-${end}/${fileSize}`,
      'Accept-Ranges': 'bytes',
      'Content-Length': (end - start) + 1,
      'Content-Type': 'video/mp4',
    };

    res.writeHead(206, head);
    stream.pipe(res);
  } catch (err) {
    console.error(err);
    res.status(500).send("Internal Server Error");
  }
});

app.listen(port, () => {
  console.log(`Server is running on http://localhost:${port}`);
});
