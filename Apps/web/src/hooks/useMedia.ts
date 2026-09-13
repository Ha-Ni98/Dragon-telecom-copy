import { useMutation } from "@tanstack/react-query";
import type { ImagePurpose } from "@dragon-telecom/contract";
import * as mediaService from "@/services/media.service";

// S26.1 — mutation only, no query key: an upload produces a URL the caller then persists via
// its own entity mutation (brand PATCH, family PATCH, settings PATCH), and each of those already
// invalidates the cache the new URL shows up in. Nothing here is cacheable domain data.
export function useUploadImage() {
  return useMutation({
    mutationFn: ({ file, purpose }: { file: File; purpose: ImagePurpose }) =>
      mediaService.uploadImage(file, purpose),
  });
}
