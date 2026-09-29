import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

let s3Client: S3Client | null = null;

export const getS3Client = (env: any) => {
  if (s3Client) return s3Client;
  if (!env.S3_ENDPOINT || !env.S3_REGION || !env.S3_ACCESS_KEY_ID || !env.S3_SECRET_ACCESS_KEY) {
    throw new Error('Missing S3 credentials');
  }
  s3Client = new S3Client({
    endpoint: env.S3_ENDPOINT,
    region: env.S3_REGION,
    credentials: {
      accessKeyId: env.S3_ACCESS_KEY_ID,
      secretAccessKey: env.S3_SECRET_ACCESS_KEY,
    },
    // Force path style for S3 compatible storage
    forcePathStyle: true,
  });
  return s3Client;
};

export const generatePresignedPutUrl = async (client: S3Client, bucket: string, key: string, expiresIn = 3600) => {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return await getSignedUrl(client, command, { expiresIn });
};

export const generatePresignedGetUrl = async (client: S3Client, bucket: string, key: string, expiresIn = 3600) => {
  const command = new GetObjectCommand({
    Bucket: bucket,
    Key: key,
  });
  return await getSignedUrl(client, command, { expiresIn });
};
