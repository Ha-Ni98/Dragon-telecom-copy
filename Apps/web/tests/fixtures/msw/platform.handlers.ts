import { http, HttpResponse } from "msw";
import { PLATFORM_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockWilayas,
  mockFeeDefault,
  mockPublicSettings,
  mockAdminFees,
  mockSettings,
} from "../data/platform.mock";

export const platformUrls = {
  wilayas: apiUrl(PLATFORM_ROUTES.WILAYAS),
  fee: apiUrl(PLATFORM_ROUTES.FEE),
  adminFees: apiUrl(PLATFORM_ROUTES.ADMIN_FEES),
  feesImport: apiUrl(PLATFORM_ROUTES.FEES_IMPORT),
  feesExport: apiUrl(PLATFORM_ROUTES.FEES_EXPORT),
  settings: apiUrl(PLATFORM_ROUTES.SETTINGS),
  settingsPublic: apiUrl(PLATFORM_ROUTES.SETTINGS_PUBLIC),
};

const MOCK_CSV = "wilayaCode,communeCode,deliveryHome,deliveryOffice\n16,1601,700,400\n";

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3).
export const platformHandlers = [
  http.get(platformUrls.wilayas, () => ok(mockWilayas)),
  http.get(platformUrls.fee, () => ok(mockFeeDefault)),
  http.get(platformUrls.settingsPublic, () => ok(mockPublicSettings)),
  http.get(platformUrls.adminFees, () => ok(mockAdminFees)),
  http.put(platformUrls.adminFees, () => ok(mockAdminFees)),
  http.post(platformUrls.feesImport, () => ok({ imported: 5 })),
  // Deliberately bypasses the ApiResponse envelope (backend controller comment: "plan §8.4") —
  // a raw Content-Type/Content-Disposition response, not `ok(...)`.
  http.get(
    platformUrls.feesExport,
    () =>
      new HttpResponse(MOCK_CSV, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="delivery-fees.csv"',
        },
      }),
  ),
  http.get(platformUrls.settings, () => ok(mockSettings)),
  http.patch(platformUrls.settings, () => ok(mockSettings)),
];

export const platformErrorHandlers = {
  upsertFeesValidationError: () =>
    http.put(platformUrls.adminFees, () =>
      fail(ErrorCode.VALIDATION_ERROR, "deliveryHome must be >= 0", 400),
    ),
  importFeesBadFile: () =>
    http.post(platformUrls.feesImport, () =>
      fail(ErrorCode.VALIDATION_ERROR, 'No file uploaded (field name must be "file")', 400),
    ),
  updateSettingsValidationError: () =>
    http.patch(platformUrls.settings, () =>
      fail(ErrorCode.VALIDATION_ERROR, "Invalid settings payload", 400),
    ),
};
