export interface UploadFile {
  buffer: Buffer;
  originalname: string;
  mimetype: string;
}

export interface UploadedFile {
  key: string;
  url: string;
  contentType: string;
  size?: number;
}

export interface StorageService {
  upload(
    file: UploadFile,
    folder?: string
  ): Promise<UploadedFile>;

  delete(key: string): Promise<void>;

  exists(key: string): Promise<boolean>;
}