import { http, HttpResponse } from "msw";
import { INVENTORY_ROUTES, ErrorCode } from "@dragon-telecom/contract";
import { apiUrl } from "./api-url";
import { ok, fail } from "./envelope";
import {
  mockStockRows,
  mockMovementsPaginated,
  mockReservationsPaginated,
  mockAdjustmentResult,
} from "../data/inventory.mock";

export const inventoryUrls = {
  stock: apiUrl(INVENTORY_ROUTES.STOCK),
  movements: apiUrl(INVENTORY_ROUTES.MOVEMENTS),
  reservations: apiUrl(INVENTORY_ROUTES.RESERVATIONS),
  adjustments: apiUrl(INVENTORY_ROUTES.ADJUSTMENTS),
};

const MOCK_STOCK_CSV =
  "productId,name,quantityOnHand\n" + `${mockStockRows[0].productId},${mockStockRows[0].name},10\n`;

// No `:id`-vs-literal route-ordering risk here — all four routes are static admin-only paths
// (confirmed by the backend's own comment in inventory.routes.ts).
export const inventoryHandlers = [
  http.get(inventoryUrls.stock, ({ request }) => {
    const isExport = new URL(request.url).searchParams.get("export") === "csv";
    if (isExport) {
      return new HttpResponse(MOCK_STOCK_CSV, {
        status: 200,
        headers: {
          "Content-Type": "text/csv",
          "Content-Disposition": 'attachment; filename="stock.csv"',
        },
      });
    }
    return ok(mockStockRows);
  }),
  http.get(inventoryUrls.movements, () => ok(mockMovementsPaginated)),
  http.get(inventoryUrls.reservations, () => ok(mockReservationsPaginated)),
  http.post(inventoryUrls.adjustments, () => ok(mockAdjustmentResult, 201)),
];

export const inventoryErrorHandlers = {
  createAdjustmentValidationError: () =>
    http.post(inventoryUrls.adjustments, () =>
      fail(ErrorCode.VALIDATION_ERROR, "countedQuantity must be >= 0", 400),
    ),
  movementsServerError: () =>
    http.get(inventoryUrls.movements, () => fail(ErrorCode.INTERNAL_SERVER_ERROR, "boom", 500)),
};
