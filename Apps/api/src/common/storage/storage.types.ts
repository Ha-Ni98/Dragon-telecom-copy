export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface PutObjectInput {
  /** Full object key, including folder. Content-addressed by ImagePipelineService. */
  key: string;
  body: Buffer;
  contentType: string;
  /** Defaults to IMMUTABLE_CACHE_CONTROL. */
  cacheControl?: string;
}

export interface StoredObject {
  key: string;
  url: string;
  contentType: string;
  size: number;
}

// Safe because every key this app writes is content-addressed — the bytes behind a key can
// never change, so a year-long immutable cache can never go stale (set S26.1, Storage).
export const IMMUTABLE_CACHE_CONTROL = 'public, max-age=31536000, immutable';

export interface StorageService {
  put(input: PutObjectInput): Promise<StoredObject>;

  /** Tolerates an already-absent key. */
  delete(key: string): Promise<void>;

  /** Deletes every derivative of one image in one call (full size + thumbnail). Tolerates
   *  already-absent keys, same as delete(). */
  deleteMany(keys: string[]): Promise<void>;

  exists(key: string): Promise<boolean>;
}
