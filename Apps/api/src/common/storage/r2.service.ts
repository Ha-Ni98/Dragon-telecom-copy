import crypto from "crypto";

import {
  DeleteObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";

import type {
  StorageService,
  UploadFile,
  UploadedFile,
} from "./storage.types";

export class R2StorageService implements StorageService {
  private client: S3Client;

  private bucket: string;

  private publicUrl: string;

  constructor() {
    this.bucket = process.env.R2_BUCKET_NAME!;

    this.publicUrl = process.env.R2_PUBLIC_URL!;

    this.client = new S3Client({
      region: "auto",

      endpoint: process.env.R2_ENDPOINT!,

      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID!,

        secretAccessKey:
          process.env.R2_SECRET_ACCESS_KEY!,
      },
    });
  }

  async upload(
    file: UploadFile,
    folder = "uploads"
  ): Promise<UploadedFile> {
    const extension =
      file.originalname.split(".").pop() ?? "";

    const filename =
      extension.length > 0
        ? `${crypto.randomUUID()}.${extension}`
        : crypto.randomUUID();

    const key = `${folder}/${filename}`;

    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,

        Key: key,

        Body: file.buffer,

        ContentType: file.mimetype,
      })
    );

    return {
      key,

      url: `${this.publicUrl}/${key}`,

      contentType: file.mimetype,

      size: file.buffer.length,
    };
  }

  async delete(key: string): Promise<void> {
    await this.client.send(
      new DeleteObjectCommand({
        Bucket: this.bucket,

        Key: key,
      })
    );
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(
        new HeadObjectCommand({
          Bucket: this.bucket,

          Key: key,
        })
      );

      return true;
    } catch {
      return false;
    }
  }
}