import dotenv from "dotenv";
import {
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

console.log("=== R2 SERVICE VERSION 2026-09-30 ===");

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({
  path: path.resolve(__dirname, "../.env"),
});

const createStorageKey = ({ folder, fileName }) => {
  const extension = path.extname(fileName || "").toLowerCase() || ".bin";

  return `${folder}/${crypto.randomUUID()}${extension}`;
};

const getR2Config = () => {
  const accountId = process.env.R2_ACCOUNT_ID?.trim();
  const accessKeyId = process.env.R2_ACCESS_KEY_ID?.trim();
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY?.trim();
  const bucketName = process.env.R2_BUCKET_NAME?.trim();
  const publicUrl = process.env.R2_PUBLIC_URL?.trim();

  if (
    !accountId ||
    !accessKeyId ||
    !secretAccessKey ||
    !bucketName ||
    !publicUrl
  ) {
    throw new Error(
      "R2 configuration is incomplete. Check R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, and R2_PUBLIC_URL."
    );
  }

  return {
    accountId,
    accessKeyId,
    secretAccessKey,
    bucketName,
    publicUrl,
  };
};

const createR2Client = ({
  accountId,
  accessKeyId,
  secretAccessKey,
}) => {
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
};

export const createPresignedUploadUrl = async ({
  folder,
  fileName,
  contentType,
}) => {
  if (!fileName) {
    throw new Error("File name is required");
  }

  if (!contentType) {
    throw new Error("Content type is required");
  }

  const config = getR2Config();
  const r2 = createR2Client(config);

  const key = createStorageKey({
    folder,
    fileName,
  });

  const command = new PutObjectCommand({
    Bucket: config.bucketName,
    Key: key,
    ContentType: contentType,
  });

  const uploadUrl = await getSignedUrl(r2, command, {
    expiresIn: 900,
  });

  return {
    uploadUrl,
    key,
    publicUrl: `${config.publicUrl.replace(/\/$/, "")}/${key}`,
    expiresIn: 900,
  };
};

export const deleteR2Object = async (key) => {
  if (!key) return;

  const config = getR2Config();
  const r2 = createR2Client(config);

  await r2.send(
    new DeleteObjectCommand({
      Bucket: config.bucketName,
      Key: key,
    })
  );
};

export default null;