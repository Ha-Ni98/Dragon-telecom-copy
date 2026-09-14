// S26.1 — the single image-upload call. Multipart, same shape as platform.service.ts's
// importFees: a bare FormData with no manual Content-Type (the browser must set the boundary).
import { api } from "@/lib/axios";
import { apiPath } from "@/lib/api-path";
import {
  PLATFORM_ROUTES,
  type ApiResponse,
  type ImagePurpose,
  type MediaImageDto,
} from "@dragon-telecom/contract";

export async function uploadImage(file: File, purpose: ImagePurpose): Promise<MediaImageDto> {
  const formData = new FormData();
  formData.append("purpose", purpose);
  formData.append("image", file);
  const res = await api.post<ApiResponse<MediaImageDto>>(
    apiPath(PLATFORM_ROUTES.ADMIN_MEDIA_IMAGE),
    formData,
  );
  if (!res.data.success) throw new Error(res.data.error.message); // defensive
  return res.data.data;
}
