import { R2StorageService } from "./r2.service";
import type { StorageService } from "./storage.types";

export const storageService: StorageService =
  new R2StorageService();