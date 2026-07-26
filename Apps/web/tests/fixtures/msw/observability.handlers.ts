import { http } from "msw";
import { OBS_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockClientActivities,
  mockStaffSearches,
  mockAuditLogsPaginated,
  mockLogStats,
} from "../data/observability.mock";

// OBS_ROUTES are full literal paths, including a `:id` placeholder on CLIENT_ACTIVITY — msw
// matches it as a path pattern natively (same builder as services, test-rules §3).
export const observabilityUrls = {
  clientBeacon: apiUrl(OBS_ROUTES.CLIENT_BEACON),
  staffSearchBeacon: apiUrl(OBS_ROUTES.STAFF_SEARCH_BEACON),
  clientActivity: apiUrl(OBS_ROUTES.CLIENT_ACTIVITY),
  staffSearches: apiUrl(OBS_ROUTES.STAFF_SEARCHES),
  logs: apiUrl(OBS_ROUTES.LOGS),
  logStats: apiUrl(OBS_ROUTES.LOG_STATS),
};

// Happy-path defaults — always registered. Individual tests override with `server.use()`
// for 4xx/5xx variants (test-rules §3). Beacons respond 202 with `{success:true,data:null}` —
// NOT the null-body 204 case (Sprint 4's noContent() rule); `ok(null, 202)` is correct here
// because 202 is not a WHATWG null-body status, so the envelope does survive the wire.
export const observabilityHandlers = [
  http.post(observabilityUrls.clientBeacon, () => ok(null, 202)),
  http.post(observabilityUrls.staffSearchBeacon, () => ok(null, 202)),
  http.get(observabilityUrls.clientActivity, () => ok(mockClientActivities)),
  http.get(observabilityUrls.staffSearches, () => ok(mockStaffSearches)),
  http.get(observabilityUrls.logs, () => ok(mockAuditLogsPaginated)),
  http.get(observabilityUrls.logStats, () => ok(mockLogStats)),
];

export const observabilityErrorHandlers = {
  // ClientActivitySchema's `.refine()` — durationSeconds is invalid for SEARCH (spec Business
  // Logic #2, confirmed by Test Scenarios: "SEARCH + duration -> 400").
  clientBeaconSearchDurationInvalid: () =>
    http.post(observabilityUrls.clientBeacon, () =>
      fail(ErrorCode.VALIDATION_ERROR, "durationSeconds is not valid for SEARCH", 400),
    ),
};
