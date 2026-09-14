import { QueryClient, QueryCache, MutationCache } from "@tanstack/react-query";
import axios from "axios";
import { toast } from "sonner";
import {
  CATALOG_ERROR,
  EXPORT_ERROR,
  MEDIA_ERROR,
  type ApiResponse,
} from "@dragon-telecom/contract";
import { translate, getLanguage } from "@/lib/i18n";

// Business-rule sentinels travel as the error *message* (see apiErrorMessage below). When one
// reaches this generic toast it must not surface as a raw SCREAMING_SNAKE token — map the ones
// this app raises to a translated sentence. Anything unmapped falls through unchanged.
const SENTINEL_TRANSLATION_KEYS: Record<string, string> = {
  [CATALOG_ERROR.BARCODE_TAKEN]: "common.errors.sentinel.barcodeTaken",
  [CATALOG_ERROR.BARCODE_GENERATION_EXHAUSTED]: "common.errors.sentinel.barcodeGenerationExhausted",
  [EXPORT_ERROR.ROW_LIMIT_EXCEEDED]: "common.errors.sentinel.exportRowLimitExceeded",
  [MEDIA_ERROR.UNSUPPORTED_IMAGE_TYPE]: "common.errors.sentinel.unsupportedImageType",
  [MEDIA_ERROR.IMAGE_TOO_LARGE]: "common.errors.sentinel.imageTooLarge",
  [MEDIA_ERROR.IMAGE_TOO_MANY_PIXELS]: "common.errors.sentinel.imageTooManyPixels",
  [MEDIA_ERROR.IMAGE_DECODE_FAILED]: "common.errors.sentinel.imageDecodeFailed",
  [MEDIA_ERROR.IMAGE_STORAGE_UNAVAILABLE]: "common.errors.sentinel.imageStorageUnavailable",
};

export const message = (err: unknown): string => {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as ApiResponse<unknown> | undefined;
    if (data && !data.success) {
      const key = SENTINEL_TRANSLATION_KEYS[data.error.message];
      return key ? translate(key, getLanguage()) : data.error.message;
    }
  }
  return translate("common.errors.crashTitle", getLanguage());
};

// Business-rule sentinels (INSUFFICIENT_STOCK, CREDIT_REQUIRES_CLIENT, PRICING_REQUIRES_STOCK)
// travel as the *message*, not `error.code` — `Apps/api`'s ConflictError/BadRequestError take
// `(message, details?)`, and `code` is always the generic ErrorCode the class hardcodes
// (RESOURCE_CONFLICT/VALIDATION_ERROR respectively; confirmed against
// `Apps/api/src/common/errors/index.ts` and `inventory.service.ts`'s
// `throw new ConflictError('INSUFFICIENT_STOCK', {...})`). A field-error check must compare
// this against `apiErrorMessage(err)`, never `err.response?.data?.error?.code`.
export const apiErrorMessage = (err: unknown): string | undefined => {
  if (!axios.isAxiosError(err)) return undefined;
  const data = err.response?.data as ApiResponse<unknown> | undefined;
  return data && !data.success ? data.error.message : undefined;
};

// 401s are handled by the axios interceptor (redirect), never a toast. Canceled/aborted
// requests (unmount, refetch superseded) are silent too — neither is a failure worth
// surfacing to the user.
const isSilent = (err: unknown): boolean =>
  axios.isCancel(err) || (axios.isAxiosError(err) && err.response?.status === 401);

const isRetryableFailure = (err: unknown): boolean =>
  !(
    axios.isAxiosError(err) &&
    !!err.response &&
    err.response.status >= 400 &&
    err.response.status < 500
  );

// Global error feedback lives on the cache, not per-hook (TanStack v5 removed `onError`
// from useQuery).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, err) => failureCount < 1 && isRetryableFailure(err),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
  queryCache: new QueryCache({
    onError: (err, query) => {
      if (isSilent(err)) return;
      if (query.state.data !== undefined) toast.error(message(err)); // only on background-refetch failures
    },
  }),
  mutationCache: new MutationCache({
    // `meta: { silentErrorToast: true }` lets a mutation replace this generic backend-message
    // toast with its own — e.g. a conflict (409) that needs specific wording rather than the
    // raw message the API sends.
    onError: (err, _vars, _ctx, mutation) => {
      if (isSilent(err) || mutation.options?.meta?.silentErrorToast) return;
      toast.error(message(err));
    },
  }),
});
