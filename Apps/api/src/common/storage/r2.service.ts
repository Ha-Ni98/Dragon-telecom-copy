import {
  DeleteObjectCommand,
  DeleteObjectsCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { env } from '../../env';
import { logger } from '../config/logger';
import { StorageUnavailableError } from '../errors';
import { MEDIA_ERROR } from '@dragon-telecom/contract';
import { IMMUTABLE_CACHE_CONTROL, type PutObjectInput, type StorageService, type StoredObject } from './storage.types';

export class R2StorageService implements StorageService {
  private client: S3Client;

  constructor() {
    this.client = new S3Client({
      region: 'auto',
      endpoint: env.R2_ENDPOINT,
      credentials: {
        accessKeyId: env.R2_ACCESS_KEY_ID,
        secretAccessKey: env.R2_SECRET_ACCESS_KEY,
      },
    });
  }

  async put(input: PutObjectInput): Promise<StoredObject> {
    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: input.key,
          Body: input.body,
          ContentType: input.contentType,
          CacheControl: input.cacheControl ?? IMMUTABLE_CACHE_CONTROL,
        }),
      );
    } catch (err) {
      // S26.1 — R2 unreachable or refused the write. Thrown before any caller has written a
      // database row, so nothing ever points at an object that does not exist.
      logger.error({ err, key: input.key }, 'R2 put failed');
      throw new StorageUnavailableError(MEDIA_ERROR.IMAGE_STORAGE_UNAVAILABLE);
    }

    return {
      key: input.key,
      url: `${env.R2_PUBLIC_URL}/${input.key}`,
      contentType: input.contentType,
      size: input.body.length,
    };
  }

  async delete(key: string): Promise<void> {
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
    } catch (err) {
      // Tolerates an already-absent key — the row being deleted is what the caller asked for;
      // an orphaned object costs nothing.
      logger.warn({ err, key }, 'R2 delete failed, ignoring');
    }
  }

  async deleteMany(keys: string[]): Promise<void> {
    if (keys.length === 0) return;
    try {
      await this.client.send(
        new DeleteObjectsCommand({
          Bucket: env.R2_BUCKET_NAME,
          Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true },
        }),
      );
    } catch (err) {
      logger.warn({ err, keys }, 'R2 deleteMany failed, ignoring');
    }
  }

  async exists(key: string): Promise<boolean> {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: key }));
      return true;
    } catch {
      return false;
    }
  }
}
