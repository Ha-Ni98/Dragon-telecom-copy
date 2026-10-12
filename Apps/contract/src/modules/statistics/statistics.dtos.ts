import { z } from 'zod';

export const OverviewResponseSchema = z.object({
  totalRevenue: z.number(),
  totalProfit: z.number(),
  stockValue: z.number(),
  totalClientCredit: z.number(),
  totalSupplierCredit: z.number(),
});
export type OverviewDto = z.infer<typeof OverviewResponseSchema>;

export const FilteredResponseSchema = z.object({
  revenue: z.number(),
  profit: z.number(),
  orders: z.number().int(),
  revenueChangePct: z.number(),
  profitChangePct: z.number(),
  ordersChangePct: z.number(),
});
export type FilteredDto = z.infer<typeof FilteredResponseSchema>;

// `totals` shape varies per report type (sales-by-product vs. ageing, etc.) — kept as an
// unknown-valued record like `rows`, matching the spec's own notation for `rows`.
export const ReportResponseSchema = z.object({
  chart: z.array(z.object({ label: z.string(), value: z.number() })),
  rows: z.array(z.record(z.string(), z.unknown())),
  totals: z.record(z.string(), z.unknown()),
  drill: z.object({ entity: z.string(), idField: z.string() }),
});
export type ReportDto = z.infer<typeof ReportResponseSchema>;

// AdminDashboardDto/StaffDashboardDto's array item shapes have no field lists anywhere in
// statistics.md — only the property names (`pendingOrders[]`, `myDrafts[]`, etc.). Cross-
// checked against Pages-Requirements/ADM-01-dashboard.md and STF-01-dashboard.md (still
// Stage-00-Conception, the sole source of truth) to ground the inference:
//  - ADM-01: pending orders/clients are "actionable" (link to a confirm/approval dialog);
//    recent orders (8) / recent clients (5); low stock (5, "threshold-flagged"); repairs
//    by status; draft sales by staff.
//  - STF-01: "my sales today (count + revenue)" — mySalesToday is a count, distinct from
//    myRevenueToday; "My drafts list (reference, client, total, age)" gives myDrafts'
//    exact fields; "low-stock alert list (read-only)".
// Flagged as the most heavily-inferred DTOs in the contract — revisit once the backend
// stage's actual dashboard queries are implemented.
const DashboardOrderSummarySchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  totalAmount: z.number(),
  placedAt: z.iso.datetime(),
});

const DashboardClientSummarySchema = z.object({
  id: z.uuid(),
  fullName: z.string(),
  createdAt: z.iso.datetime(),
});

const DashboardLowStockItemSchema = z.object({
  productId: z.uuid(),
  name: z.string(),
  availableQuantity: z.number().int(),
  reorderThreshold: z.number().int(),
});

export const AdminDashboardResponseSchema = z.object({
  stats: z.object({
    totalClients: z.number().int(),
    totalProducts: z.number().int(),
    ordersThisWeek: z.number().int(),
    revenueThisMonth: z.number(),
    totalClientsChangePct: z.number(),
    totalProductsChangePct: z.number(),
    ordersThisWeekChangePct: z.number(),
    revenueThisMonthChangePct: z.number(),
  }),
  pendingOrders: z.array(DashboardOrderSummarySchema),
  pendingClients: z.array(DashboardClientSummarySchema),
  recentOrders: z.array(DashboardOrderSummarySchema),
  recentClients: z.array(DashboardClientSummarySchema),
  lowStockProducts: z.array(DashboardLowStockItemSchema),
  // Keyed by RepairStatus value -> count; kept as an open string key rather than
  // importing RepairStatus from repairs (no such dependency edge in the plan).
  repairsByStatus: z.record(z.string(), z.number().int()),
  draftSalesByStaff: z.array(
    z.object({ staffId: z.uuid(), staffName: z.string(), draftCount: z.number().int() }),
  ),
});
export type AdminDashboardDto = z.infer<typeof AdminDashboardResponseSchema>;

export const StaffDashboardResponseSchema = z.object({
  mySalesToday: z.number().int(),
  myRevenueToday: z.number(),
  myDrafts: z.array(
    z.object({
      reference: z.string(),
      clientName: z.string().optional(),
      total: z.number(),
      ageHours: z.number(),
    }),
  ),
  myPendingOrdersCount: z.number().int().optional(),
  lowStock: z.array(DashboardLowStockItemSchema),
});
export type StaffDashboardDto = z.infer<typeof StaffDashboardResponseSchema>;

// S33 — the Caisse. Every figure is a stored value summed in SQL over one Africa/Algiers day
// (plan S33 §0.4). `date` echoes the day actually used (today when the query omitted it).
// Repairs' paidAmount is GROSS (paid + since-refunded) so a later return never rewrites the
// pickup day; refunds are dated on the cancellation/return itself.
export const CashRegisterResponseSchema = z.object({
  date: z.iso.date(),
  sales: z.object({
    count: z.number().int(),
    totalSold: z.number(),
    totalPaid: z.number(),
    newCredit: z.number(),
  }),
  returns: z.object({ count: z.number().int(), totalRefunded: z.number() }),
  repairs: z.object({
    count: z.number().int(),
    paidAmount: z.number(),
    unpaidAmount: z.number(),
    refundCount: z.number().int(),
    refundedAmount: z.number(),
  }),
  orders: z.object({
    confirmedCount: z.number().int(),
    inDeliveryCount: z.number().int(),
    completedCount: z.number().int(),
    completedPaid: z.number(),
  }),
  suppliers: z.object({
    invoiceCount: z.number().int(),
    totalInvoiced: z.number(),
    paymentCount: z.number().int(),
    totalPaid: z.number(),
    newCredit: z.number(),
  }),
});
export type CashRegisterDto = z.infer<typeof CashRegisterResponseSchema>;

// S33 — one row of a drill-through list, uniform across every CashRegisterDrill target.
// `at` is the anchoring timestamp; `paid` is set for SALES, REPAIRS_PICKED_UP (gross) and
// ORDERS_COMPLETED; `sourceReference` is the sale/order of a return, or the invoice a supplier
// payment settles. `partyName` is absent for a walk-in sale.
export const CashRegisterDocumentResponseSchema = z.object({
  id: z.uuid(),
  reference: z.string(),
  at: z.iso.datetime(),
  partyName: z.string().optional(),
  amount: z.number(),
  paid: z.number().optional(),
  sourceReference: z.string().optional(),
});
export type CashRegisterDocumentDto = z.infer<typeof CashRegisterDocumentResponseSchema>;
