import type { PrismaClient } from '@prisma/client';
import {
  ChartType,
  EXPORT_ERROR,
  EXPORT_MAX_ROWS,
  ReportFormat,
  ReportType,
  RevenueSource,
  type AdminDashboardDto,
  type ChartsQuery,
  type FilteredDto,
  type FilteredQuery,
  type OverviewDto,
  type ReportDto,
  type ReportQuery,
  type StaffDashboardDto,
  type TopProductsQuery,
} from '@dragon-telecom/contract';
import { BadRequestError } from '@common/errors';
import { csvMoney, toCsv, toCsvSection, CSV_EOL, CSV_MIME } from '@common/utils/csv.utils';
import { renderTablePdf } from '@common/utils/pdf.utils';
import type { ChartPoint, DraftSaleRow, LowStockRow, TopProductDto } from './statistics.mapper';
import { StatisticsMapper } from './statistics.mapper';
import type { ExportResult, IStatisticsService } from './statistics.interface';

const DAY_MS = 24 * 3_600_000;

// S25 — every export in this module is a single in-memory document, so an unbounded row count
// would hold the request open while it serialised. Declared locally rather than shared with
// inventory.service.ts's identical-shaped helper — the two modules have no shared error-helper
// file; both import EXPORT_MAX_ROWS/EXPORT_ERROR from the same contract constants instead.
const assertExportSize = (total: number): void => {
  if (total > EXPORT_MAX_ROWS) {
    throw new BadRequestError(EXPORT_ERROR.ROW_LIMIT_EXCEEDED, { limit: EXPORT_MAX_ROWS, total });
  }
};

// A report row's cell can be string | number | boolean | null | undefined today (no current
// report emits anything else) — guarded to '' for any other shape rather than "[object Object]".
const toReportCsvValue = (value: unknown): string | number | boolean | null | undefined =>
  value == null || typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean' ? value : '';

// Same guard as toReportCsvValue, but always returns a string (renderTablePdf's `rows` are
// pre-formatted strings) — non-integer numbers go through csvMoney for a consistent 2 dp.
const formatReportCell = (value: unknown): string => {
  if (value == null) return '';
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : csvMoney(value);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (typeof value === 'string') return value;
  return '';
};

const humaniseReportType = (type: ReportType): string => {
  const words = type.replace(/-/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
};

// D2 (S10) — nothing accrues before completion any more: cost and profit are stamped at
// COMPLETED only, so recognising a CONFIRMED/PACKAGED/IN_DELIVERY order here would report
// revenue against a zero cost. Mirrors Sale's own soldAt-gated COMPLETED population.
//
// S24 (A1) — RETURNED is included alongside COMPLETED: an order flips straight to RETURNED
// whether the return was partial or full (orders.service.ts returnOrder), so excluding it would
// erase the goods the client kept on a partial return. returnAdjustments() below nets the
// returned lines back out; a fully-returned order therefore still nets to 0, but a partial one no
// longer vanishes entirely (the pre-S24 defect).
const ORDER_RECOGNIZED_STATUSES = ['COMPLETED', 'RETURNED'] as const;

// S24 (A1) — a sale that has seen a return is still a recognised sale; returnAdjustments() below
// subtracts the returned lines from it. Previously only COMPLETED was listed here, so a single
// returned item erased the sale's ENTIRE total from every figure in this file, not just the
// returned line's share of it.
const SALE_RECOGNIZED_STATUSES = ['COMPLETED', 'PARTIALLY_RETURNED', 'RETURNED'] as const;

// D8/D9 (S13/S14 R1) — a repair recognises revenue, cost and profit together at PICKED_UP, and
// produces no Sale row at all (D9). Every figure below that used to arrive through the deleted
// REPAIR-origin Sale is read directly off Repair here, dated on pickedUpAt. Repairs have no
// return path (terminal at PICKED_UP), so nothing is ever netted out of them.
const REPAIR_RECOGNIZED_STATUS = 'PICKED_UP' as const;

// D-b (S14) — orders have no owning seller (Order.confirmedByStaffId is who CONFIRMED it, not
// who sold it, and is nullable). They aggregate into one bucket in sales-by-seller rather than
// being mis-attributed to whoever happened to confirm them.
const UNASSIGNED_SELLER_BUCKET = 'Unassigned';

// Large-ADJUSTMENT_OUT shrinkage flag threshold (spec: "large ADJUSTMENT_OUT flagged") — no
// concrete number given anywhere; a documented, defensible inference, not derived from any
// stored setting.
const LARGE_ADJUSTMENT_OUT_THRESHOLD = 50;

const AGEING_BUCKETS = ['0-30', '31-60', '61-90', '90+'] as const;

export class StatisticsService implements IStatisticsService {
  constructor(private prisma: PrismaClient) {}

  async getOverview(): Promise<OverviewDto> {
    const [{ revenue, profit }, products, clientCreditAgg, supplierCreditAgg] = await Promise.all([
      this.computeRevenueProfit({}),
      this.prisma.product.findMany({ select: { quantityOnHand: true, avgStockPrice: true } }),
      this.prisma.posClient.aggregate({ _sum: { credit: true } }),
      this.prisma.supplier.aggregate({ _sum: { credit: true } }),
    ]);

    // Σ quantityOnHand × avgStockPrice (D10: stock valuation reads avgStockPrice, never avgPrice)
    // — no single-column Prisma aggregate multiplies two columns, so this reduces client-side
    // (acceptable at this store's catalog scale). Confirmed already correct pre-S14 — unchanged.
    const stockValue = products.reduce((sum, p) => sum + p.quantityOnHand * p.avgStockPrice.toNumber(), 0);

    return StatisticsMapper.toOverviewDto({
      totalRevenue: revenue,
      totalProfit: profit,
      stockValue,
      totalClientCredit: clientCreditAgg._sum.credit?.toNumber() ?? 0,
      totalSupplierCredit: supplierCreditAgg._sum.credit?.toNumber() ?? 0,
    });
  }

  // S14/F1 — `familyId` now actually scopes the figures: computeRevenueProfit/countRecognizedOrders
  // both switch to a line-level (family-scoped) computation when it's set. Previously validated
  // and silently ignored — the Family dropdown changed the query key and refetched identical
  // numbers. S24 — `source` (RevenueSource) is threaded through the same way.
  async getFiltered(query: FilteredQuery): Promise<FilteredDto> {
    const to = query.to != null ? new Date(query.to) : new Date();
    const from = query.from != null ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);
    const durationMs = Math.max(to.getTime() - from.getTime(), 0);
    const prevTo = new Date(from.getTime());
    const prevFrom = new Date(from.getTime() - durationMs);
    const source = query.source ?? RevenueSource.ALL;

    const [current, previous, orders, prevOrders] = await Promise.all([
      this.computeRevenueProfit({ from, to }, query.familyId, source),
      this.computeRevenueProfit({ from: prevFrom, to: prevTo }, query.familyId, source),
      this.countRecognizedOrders(from, to, query.familyId, source),
      this.countRecognizedOrders(prevFrom, prevTo, query.familyId, source),
    ]);

    return StatisticsMapper.toFilteredDto({
      revenue: current.revenue,
      profit: current.profit,
      orders,
      revenueChangePct: this.pctChange(current.revenue, previous.revenue),
      profitChangePct: this.pctChange(current.profit, previous.profit),
      ordersChangePct: this.pctChange(orders, prevOrders),
    });
  }

  // No dedicated contract schema (statistics.mapper.ts's ChartPoint, reused from
  // ReportResponseSchema.shape.chart). Day-bucketed for revenue/orders/clients (no explicit
  // granularity is specified anywhere — a day bucket is the most common "chart" default);
  // sales-by-family is a single category breakdown, not a time series, matching its own name.
  // S14/F1 — REVENUE and ORDERS also honour query.familyId now; CLIENTS stays family-agnostic
  // (a client has no family). S24 (A6) — SALES_BY_FAMILY now honours query.familyId too: it was
  // previously silently ignored (the code here wrongly claimed a familyId "would just collapse
  // its own breakdown to one bar, which is already what happens today" — it did not; every
  // family kept rendering regardless of the selection). All four also honour query.source.
  async getChart(chart: ChartType, query: ChartsQuery): Promise<ChartPoint[]> {
    const to = query.to != null ? new Date(query.to) : new Date();
    const from = query.from != null ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);
    const source = query.source ?? RevenueSource.ALL;

    switch (chart) {
      case ChartType.SALES_BY_FAMILY:
        return this.chartSalesByFamily(from, to, query.familyId, source);
      case ChartType.REVENUE:
        return this.chartDailyRevenue(from, to, query.familyId, source);
      case ChartType.ORDERS:
        return this.chartDailyOrderCounts(from, to, query.familyId, source);
      case ChartType.CLIENTS:
        return this.chartDailyNewClients(from, to);
      default:
        throw new Error(`Unknown chart type: ${String(chart)}`);
    }
  }

  // No contract schema for TOP_PRODUCTS at all (statistics.mapper.ts's locally-declared
  // TopProductDto). `period` is a free string (no enumerated values anywhere) — 'week'/
  // 'month'/'year' recognized, anything else (including undefined) means all-time.
  // S14/R1 — reads productLineTotals (Sale + completed Order + picked-up Repair lines), not
  // SaleLine alone; a repair's parts now count toward "top products".
  async getTopProducts(query: TopProductsQuery): Promise<TopProductDto[]> {
    const range = this.resolvePeriodRange(query.period);
    const byProduct = await this.productLineTotals(range ?? {});

    // TopProductRow names this field `quantitySold` (statistics.mapper.ts); productLineTotals'
    // map uses the plainer `quantity` for its other consumer (reportSalesByProduct, whose row
    // has no schema constraint) — renamed here at the one call site that needs it.
    const ranked = [...byProduct.entries()]
      .map(([productId, data]) => ({ productId, productName: data.productName, quantitySold: data.quantity, revenue: data.revenue }))
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 10);

    // ADM-15 needs brand/family/image too (audit fix B4) — joined only for the 10 ranked
    // products, not every product ever sold.
    const products = await this.prisma.product.findMany({
      where: { id: { in: ranked.map((row) => row.productId) } },
      select: {
        id: true,
        brand: { select: { name: true } },
        family: { select: { name: true } },
        images: { orderBy: [{ isPrimary: 'desc' }, { position: 'asc' }], take: 1, select: { url: true } },
      },
    });
    const productById = new Map(products.map((product) => [product.id, product]));

    return ranked.map((row) => {
      const product = productById.get(row.productId);
      const imageUrl = product?.images[0]?.url;
      return StatisticsMapper.toTopProductDto({
        ...row,
        brandName: product?.brand.name ?? '',
        familyName: product?.family.name ?? '',
        ...(imageUrl != null ? { imageUrl } : {}),
      });
    });
  }

  async getReport(type: ReportType, query: ReportQuery): Promise<ReportDto | ExportResult> {
    const range = {
      ...(query.from != null ? { from: new Date(query.from) } : {}),
      ...(query.to != null ? { to: new Date(query.to) } : {}),
    };
    const dto = await this.buildReport(type, range);

    if (query.format === ReportFormat.CSV) {
      return this.toCsvExport(type, dto);
    }
    if (query.format === ReportFormat.PDF) {
      return this.toPdfExport(type, dto, query);
    }
    return dto;
  }

  // stats + *ChangePct compare "this week"/"this month" against the immediately-preceding
  // equal-length window (empty-previous guarded to 0 via pctChange). recentOrders(8)/
  // recentClients(5)/lowStockProducts(5) limits are the contract's own grounding comment
  // (statistics.dtos.ts) for AdminDashboardDto's otherwise-unspecified array sizes.
  async getAdminDashboard(): Promise<AdminDashboardDto> {
    const now = new Date();
    const startOfWeek = new Date(now.getTime() - 7 * DAY_MS);
    const startOfPrevWeek = new Date(now.getTime() - 14 * DAY_MS);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfPrevMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const endOfPrevMonth = new Date(startOfMonth.getTime() - 1);

    const [
      totalClients,
      totalProducts,
      clientsThisWeek,
      clientsPrevWeek,
      productsThisWeek,
      productsPrevWeek,
      ordersThisWeek,
      ordersPrevWeek,
      thisMonth,
      prevMonth,
      pendingOrders,
      pendingClientsRaw,
      recentOrders,
      recentClientsRaw,
      lowStockProducts,
      repairGroups,
      draftGroups,
    ] = await Promise.all([
      this.prisma.client.count(),
      this.prisma.product.count(),
      this.prisma.client.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.client.count({ where: { createdAt: { gte: startOfPrevWeek, lt: startOfWeek } } }),
      this.prisma.product.count({ where: { createdAt: { gte: startOfWeek } } }),
      this.prisma.product.count({ where: { createdAt: { gte: startOfPrevWeek, lt: startOfWeek } } }),
      this.countRecognizedOrders(startOfWeek, now),
      this.countRecognizedOrders(startOfPrevWeek, startOfWeek),
      this.computeRevenueProfit({ from: startOfMonth, to: now }),
      this.computeRevenueProfit({ from: startOfPrevMonth, to: endOfPrevMonth }),
      this.prisma.order.findMany({
        where: { status: 'PENDING' },
        orderBy: { placedAt: 'desc' },
        select: { id: true, reference: true, totalAmount: true, placedAt: true },
      }),
      this.prisma.client.findMany({
        where: { status: 'PENDING' },
        orderBy: { createdAt: 'desc' },
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      }),
      this.prisma.order.findMany({
        orderBy: { placedAt: 'desc' },
        take: 8,
        select: { id: true, reference: true, totalAmount: true, placedAt: true },
      }),
      this.prisma.client.findMany({
        orderBy: { createdAt: 'desc' },
        take: 5,
        select: { id: true, firstName: true, lastName: true, createdAt: true },
      }),
      this.lowStockProducts(5),
      this.prisma.repair.groupBy({ by: ['status'], _count: { _all: true } }),
      this.prisma.sale.groupBy({ by: ['staffId'], where: { status: 'DRAFT' }, _count: { _all: true } }),
    ]);

    const draftSalesByStaff = await this.attachStaffNames(draftGroups);

    return StatisticsMapper.toAdminDashboardDto({
      stats: {
        totalClients,
        totalProducts,
        ordersThisWeek,
        revenueThisMonth: thisMonth.revenue,
        // "Change" for a running total is read as its own week-over-week growth rate (new
        // clients/products this week vs. last week), not a reconstructed prior total.
        totalClientsChangePct: this.pctChange(clientsThisWeek, clientsPrevWeek),
        totalProductsChangePct: this.pctChange(productsThisWeek, productsPrevWeek),
        ordersThisWeekChangePct: this.pctChange(ordersThisWeek, ordersPrevWeek),
        revenueThisMonthChangePct: this.pctChange(thisMonth.revenue, prevMonth.revenue),
      },
      pendingOrders,
      pendingClients: pendingClientsRaw.map((c) => ({ id: c.id, fullName: `${c.firstName} ${c.lastName}`, createdAt: c.createdAt })),
      recentOrders,
      recentClients: recentClientsRaw.map((c) => ({ id: c.id, fullName: `${c.firstName} ${c.lastName}`, createdAt: c.createdAt })),
      lowStockProducts,
      repairsByStatus: Object.fromEntries(repairGroups.map((g) => [g.status, g._count._all])),
      draftSalesByStaff,
    });
  }

  // Strictly staffId=me (spec BL#5) — myPendingOrdersCount is the one field that can't
  // actually be personally scoped: orders have no owner staff at all (plan §I "orders have no
  // owner staff"), so it's read as a global count, same footing as the low-stock alert (the
  // spec's own "the only non-scoped datum").
  //
  // `staffId` is optional (S18/P5) — an ADMIN viewer (opening /staff, which the staff sidebar
  // explicitly supports: effectivePages() returns every PageKey for ADMIN) carries no `staffId`
  // in their JWT, only STAFF users do (identity.service.ts#login). Prisma's `where` clause
  // treats `staffId: undefined` as "field omitted", not "no match" — without the guards below an
  // admin caller would see every staff member's sales/drafts as their own instead of zero.
  async getStaffDashboard(staffId: string | undefined): Promise<StaffDashboardDto> {
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);
    const now = new Date();

    const [salesToday, draftSales, pendingOrdersCount, lowStock] = await Promise.all([
      staffId != null
        ? this.prisma.sale.findMany({
            where: { staffId, status: 'COMPLETED', soldAt: { gte: startOfToday } },
            select: { totalAmount: true },
          })
        : Promise.resolve([]),
      staffId != null
        ? this.prisma.sale.findMany({
            where: { staffId, status: 'DRAFT' },
            select: { reference: true, totalAmount: true, createdAt: true, posClient: { select: { name: true } } },
          })
        : Promise.resolve([]),
      this.prisma.order.count({ where: { status: 'PENDING' } }),
      this.lowStockProducts(),
    ]);

    return StatisticsMapper.toStaffDashboardDto({
      mySalesToday: salesToday.length,
      myRevenueToday: salesToday.reduce((sum, sale) => sum + sale.totalAmount.toNumber(), 0),
      myDrafts: draftSales.map((draft) => ({
        reference: draft.reference,
        ...(draft.posClient?.name != null ? { clientName: draft.posClient.name } : {}),
        total: draft.totalAmount,
        ageHours: (now.getTime() - draft.createdAt.getTime()) / 3_600_000,
      })),
      myPendingOrdersCount: pendingOrdersCount,
      lowStock,
    });
  }

  // --- Shared aggregation core ---

  // Revenue/profit = Σ recognised Sale + Σ recognised Order (D2) + Σ PICKED_UP Repair (D8/D9,
  // S14), each dated on soldAt/deliveredAt/pickedUpAt respectively — the timestamp each
  // document's own recognition moment writes. No double-count: a picked-up repair produces an
  // Invoice (sourceType REPAIR) and never a Sale or an Order, and this method never reads Invoice.
  //
  // S24 (Q2) — orders contribute `subtotal`, never `totalAmount`: the delivery fee is not
  // revenue (owner decision). `Order.totalProfit` is already computed fee-free, so it needs no
  // change. S24 (A1) — returnAdjustments() nets returned lines back out of both sums, restated
  // into the ORIGINAL document's period (Q1) rather than the period the refund was issued in.
  // S24 — `source` (RevenueSource) restricts to PRODUCTS (sales+orders) or REPAIRS; ALL (default)
  // sums everything, matching the pre-S24 shape.
  //
  // `familyId` (S14/F1) switches to a LINE-level computation (SaleLine/OrderLine/RepairPart
  // joined to product.familyId) instead of document totals — a document's delivery fee (Order,
  // already excluded above) or labour (Repair, owner decision Q3) belongs to no single family and
  // is excluded from the family-filtered figure. This is a deliberate asymmetry from the
  // unfiltered figure above it, not a bug — surfaced in the UI (familyExcludesLabourNote).
  private async computeRevenueProfit(
    range: { from?: Date; to?: Date },
    familyId?: string,
    source: RevenueSource = RevenueSource.ALL,
  ): Promise<{ revenue: number; profit: number }> {
    const adjustments = await this.returnAdjustments(range, familyId, source);
    const returnedRevenue = adjustments.reduce((sum, a) => sum + a.revenue, 0);
    const returnedProfit = adjustments.reduce((sum, a) => sum + a.profit, 0);

    if (familyId != null) {
      const filter = this.dateRangeFilter(range);
      const [saleLines, orderLines, repairParts] = await Promise.all([
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.saleLine.findMany({
              where: { product: { familyId }, sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) } },
              select: { lineTotal: true, profit: true },
            }),
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.orderLine.findMany({
              where: {
                product: { familyId },
                order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
              },
              select: { lineTotal: true, profit: true },
            }),
        source === RevenueSource.PRODUCTS
          ? Promise.resolve([])
          : this.prisma.repairPart.findMany({
              where: {
                product: { familyId },
                repair: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
              },
              select: { lineTotal: true, profit: true },
            }),
      ]);
      const revenue =
        saleLines.reduce((sum, l) => sum + l.lineTotal.toNumber(), 0) +
        orderLines.reduce((sum, l) => sum + l.lineTotal.toNumber(), 0) +
        repairParts.reduce((sum, l) => sum + l.lineTotal.toNumber(), 0);
      const profit =
        saleLines.reduce((sum, l) => sum + l.profit.toNumber(), 0) +
        orderLines.reduce((sum, l) => sum + (l.profit?.toNumber() ?? 0), 0) +
        repairParts.reduce((sum, l) => sum + (l.profit?.toNumber() ?? 0), 0);
      return { revenue: revenue - returnedRevenue, profit: profit - returnedProfit };
    }

    const filter = this.dateRangeFilter(range);
    const [saleAgg, orderAgg, repairAgg] = await Promise.all([
      source === RevenueSource.REPAIRS
        ? Promise.resolve({ _sum: { totalAmount: null, totalProfit: null } })
        : this.prisma.sale.aggregate({
            where: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) },
            _sum: { totalAmount: true, totalProfit: true },
          }),
      source === RevenueSource.REPAIRS
        ? Promise.resolve({ _sum: { subtotal: null, totalProfit: null } })
        : this.prisma.order.aggregate({
            where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
            _sum: { subtotal: true, totalProfit: true },
          }),
      source === RevenueSource.PRODUCTS
        ? Promise.resolve({ _sum: { totalAmount: null, totalProfit: null } })
        : this.prisma.repair.aggregate({
            where: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
            _sum: { totalAmount: true, totalProfit: true },
          }),
    ]);

    const revenue =
      (saleAgg._sum.totalAmount?.toNumber() ?? 0) + (orderAgg._sum.subtotal?.toNumber() ?? 0) + (repairAgg._sum.totalAmount?.toNumber() ?? 0);
    const profit =
      (saleAgg._sum.totalProfit?.toNumber() ?? 0) + (orderAgg._sum.totalProfit?.toNumber() ?? 0) + (repairAgg._sum.totalProfit?.toNumber() ?? 0);

    return { revenue: revenue - returnedRevenue, profit: profit - returnedProfit };
  }

  // S14/F1 — `familyId` narrows to orders with at least one line in that family. S24 — `source`
  // returns 0 immediately for REPAIRS (orders are never repairs); (A1) a fully-returned order (every
  // line returned in full — owner rule Q1, "as if never bought") no longer counts, while a partial
  // return still counts as one real order.
  private async countRecognizedOrders(from: Date, to: Date, familyId?: string, source: RevenueSource = RevenueSource.ALL): Promise<number> {
    if (source === RevenueSource.REPAIRS) return 0;
    const toExclusive = new Date(to.getTime() + DAY_MS);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [...ORDER_RECOGNIZED_STATUSES] },
        deliveredAt: { gte: from, lt: toExclusive },
        ...(familyId != null ? { lines: { some: { product: { familyId } } } } : {}),
      },
      select: { id: true, lines: { select: { id: true, quantity: true } } },
    });
    if (orders.length === 0) return 0;

    const lineIds = orders.flatMap((o) => o.lines.map((l) => l.id));
    const returned = await this.prisma.returnLine.groupBy({
      by: ['orderLineId'],
      where: { orderLineId: { in: lineIds } },
      _sum: { quantity: true },
    });
    const returnedByLineId = new Map(returned.map((r) => [r.orderLineId!, r._sum.quantity ?? 0]));

    return orders.filter((o) => o.lines.some((l) => l.quantity - (returnedByLineId.get(l.id) ?? 0) > 0)).length;
  }

  // S24 (A1) — every returned line, enriched with everything any consumer needs to subtract it
  // from the right bucket. Owner rule Q1: revenue falls by the refund actually given; cost falls
  // only if the goods came back (restock); profit is the difference; quantity always falls. The
  // row is dated by the PARENT document's own recognition date, not returnedAt — a return
  // restates the period in which the sale happened ("as if never bought"), it is not a contra
  // entry in the period the refund was issued. Repairs have no return path, so `source ===
  // REPAIRS` always yields no rows.
  private async returnAdjustments(
    range: { from?: Date; to?: Date },
    familyId?: string,
    source: RevenueSource = RevenueSource.ALL,
  ): Promise<
    {
      productId: string;
      familyId: string;
      posClientId: string | null;
      categoryId: string | null;
      categoryName: string | null;
      sellerStaffId: string | null; // sales only; orders have no owning seller (D-b)
      recognizedAt: Date;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }[]
  > {
    if (source === RevenueSource.REPAIRS) return [];
    const filter = this.dateRangeFilter(range);

    const [saleReturnLines, orderReturnLines] = await Promise.all([
      this.prisma.returnLine.findMany({
        where: {
          saleLineId: { not: null },
          saleLine: {
            ...(familyId != null ? { product: { familyId } } : {}),
            sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) },
          },
        },
        select: {
          quantity: true,
          restock: true,
          refundAmount: true,
          saleLine: {
            select: {
              quantity: true,
              costOfGoods: true,
              productId: true,
              product: { select: { familyId: true } },
              sale: {
                select: {
                  soldAt: true,
                  staffId: true,
                  posClientId: true,
                  posClient: { select: { categoryId: true, category: { select: { name: true } } } },
                },
              },
            },
          },
        },
      }),
      this.prisma.returnLine.findMany({
        where: {
          orderLineId: { not: null },
          orderLine: {
            ...(familyId != null ? { product: { familyId } } : {}),
            order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
          },
        },
        select: {
          quantity: true,
          restock: true,
          refundAmount: true,
          orderLine: {
            select: {
              quantity: true,
              costOfGoods: true,
              productId: true,
              product: { select: { familyId: true } },
              order: {
                select: {
                  deliveredAt: true,
                  client: {
                    select: { posClient: { select: { id: true, categoryId: true, category: { select: { name: true } } } } },
                  },
                },
              },
            },
          },
        },
      }),
    ]);

    const rows: {
      productId: string;
      familyId: string;
      posClientId: string | null;
      categoryId: string | null;
      categoryName: string | null;
      sellerStaffId: string | null;
      recognizedAt: Date;
      quantity: number;
      revenue: number;
      cost: number;
      profit: number;
    }[] = [];

    for (const rl of saleReturnLines) {
      const line = rl.saleLine!;
      const revenue = rl.refundAmount.toNumber();
      // Proportional share of the line's stored FIFO cost — reversed only when the goods actually
      // re-entered stock. Not restocked => the store lost them, so the cost stands.
      const cost = rl.restock && line.quantity > 0 ? line.costOfGoods.toNumber() * (rl.quantity / line.quantity) : 0;
      rows.push({
        productId: line.productId,
        familyId: line.product.familyId,
        posClientId: line.sale.posClientId,
        categoryId: line.sale.posClient?.categoryId ?? null,
        categoryName: line.sale.posClient?.category?.name ?? null,
        sellerStaffId: line.sale.staffId,
        recognizedAt: line.sale.soldAt!,
        quantity: rl.quantity,
        revenue,
        cost,
        profit: revenue - cost,
      });
    }
    for (const rl of orderReturnLines) {
      const line = rl.orderLine!;
      const revenue = rl.refundAmount.toNumber();
      const cost = rl.restock && line.quantity > 0 ? (line.costOfGoods?.toNumber() ?? 0) * (rl.quantity / line.quantity) : 0;
      const posClient = line.order.client?.posClient;
      rows.push({
        productId: line.productId,
        familyId: line.product.familyId,
        posClientId: posClient?.id ?? null,
        categoryId: posClient?.categoryId ?? null,
        categoryName: posClient?.category?.name ?? null,
        sellerStaffId: null,
        recognizedAt: line.order.deliveredAt!,
        quantity: rl.quantity,
        revenue,
        cost,
        profit: revenue - cost,
      });
    }
    return rows;
  }

  // S14/R1 — the shared per-product line-level reader: Sale + completed/returned Order + picked-
  // up Repair lines, merged by productId. Used by both getTopProducts and reportSalesByProduct so
  // the three-source union is written exactly once (plan's "fix the root cause once" rule).
  // S24 — gated on `source` (ALL/PRODUCTS/REPAIRS) and nets returned quantity/revenue back out
  // (A1) via returnAdjustments(); a product whose netted quantity and revenue both reach 0 is
  // dropped (a fully-returned line truly contributed nothing).
  private async productLineTotals(
    range: { from?: Date; to?: Date },
    familyId?: string,
    source: RevenueSource = RevenueSource.ALL,
  ): Promise<Map<string, { productName: string; quantity: number; revenue: number }>> {
    const filter = this.dateRangeFilter(range);
    const [saleLines, orderLines, repairParts] = await Promise.all([
      source === RevenueSource.REPAIRS
        ? Promise.resolve([])
        : this.prisma.saleLine.findMany({
            where: { sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) } },
            select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
          }),
      source === RevenueSource.REPAIRS
        ? Promise.resolve([])
        : this.prisma.orderLine.findMany({
            where: { order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) } },
            select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
          }),
      source === RevenueSource.PRODUCTS
        ? Promise.resolve([])
        : this.prisma.repairPart.findMany({
            where: { repair: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) } },
            select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
          }),
    ]);

    const byProduct = new Map<string, { productName: string; quantity: number; revenue: number }>();
    for (const line of [...saleLines, ...orderLines, ...repairParts]) {
      const existing = byProduct.get(line.productId) ?? { productName: line.productNameSnapshot, quantity: 0, revenue: 0 };
      existing.quantity += line.quantity;
      existing.revenue += line.lineTotal.toNumber();
      byProduct.set(line.productId, existing);
    }

    const adjustments = await this.returnAdjustments(range, familyId, source);
    for (const a of adjustments) {
      const existing = byProduct.get(a.productId);
      if (!existing) continue;
      existing.quantity -= a.quantity;
      existing.revenue -= a.revenue;
      if (existing.quantity <= 0 && existing.revenue <= 0) byProduct.delete(a.productId);
    }
    return byProduct;
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  // S24 (A2) — `to` arrives as a bare YYYY-MM-DD, which Date parses to midnight UTC. An inclusive
  // `lte` against that instant silently dropped the whole final day — and the UI's default range
  // ends *today* (AdminStatistics.tsx), so today's business never appeared in any filtered
  // figure. Same +1-day exclusive bound inventory.service.ts#listMovements already uses.
  private dateRangeFilter(range: { from?: Date; to?: Date }): { gte?: Date; lt?: Date } | undefined {
    if (range.from == null && range.to == null) return undefined;
    return { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lt: new Date(range.to.getTime() + DAY_MS) } : {}) };
  }

  private resolvePeriodRange(period?: string): { from: Date; to: Date } | undefined {
    const to = new Date();
    const days = period === 'week' ? 7 : period === 'month' ? 30 : period === 'year' ? 365 : undefined;
    if (days == null) return undefined;
    return { from: new Date(to.getTime() - days * DAY_MS), to };
  }

  private async lowStockProducts(limit?: number): Promise<LowStockRow[]> {
    const products = await this.prisma.product.findMany({
      select: { id: true, name: true, quantityOnHand: true, quantityReserved: true, reorderThreshold: true },
    });
    const low = products.filter((p) => p.quantityOnHand - p.quantityReserved <= p.reorderThreshold);
    return limit != null ? low.slice(0, limit) : low;
  }

  private async attachStaffNames(groups: { staffId: string; _count: { _all: number } }[]): Promise<DraftSaleRow[]> {
    if (groups.length === 0) return [];
    const staffRows = await this.prisma.staff.findMany({
      where: { id: { in: groups.map((g) => g.staffId) } },
      select: { id: true, firstName: true, lastName: true },
    });
    const nameById = new Map(staffRows.map((s) => [s.id, `${s.firstName} ${s.lastName}`]));
    return groups.map((g) => ({ staffId: g.staffId, staffName: nameById.get(g.staffId) ?? '', draftCount: g._count._all }));
  }

  // --- Charts (day-bucketed; sales-by-family is a category breakdown, not a time series) ---

  // S14/F1 — `familyId` switches to line-level sums (SaleLine/OrderLine/RepairPart joined to
  // product.familyId), bucketed by the parent document's own recognition date, instead of
  // document totals. S24 — `to` is now an exclusive next-day bound (A2, matching
  // dateRangeFilter); orders use `unitPrice × quantity` (family path) / `subtotal` (unfiltered
  // path) rather than `totalAmount` (Q2 — no delivery fee); `source` gates each of the three
  // queries; returned lines are subtracted per day via returnAdjustments() (A1).
  private async chartDailyRevenue(from: Date, to: Date, familyId?: string, source: RevenueSource = RevenueSource.ALL): Promise<ChartPoint[]> {
    const toExclusive = new Date(to.getTime() + DAY_MS);
    const byDay = new Map<string, number>();

    if (familyId != null) {
      const [saleLines, orderLines, repairParts] = await Promise.all([
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.saleLine.findMany({
              where: { product: { familyId }, sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, soldAt: { gte: from, lt: toExclusive } } },
              select: { lineTotal: true, sale: { select: { soldAt: true } } },
            }),
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.orderLine.findMany({
              where: {
                product: { familyId },
                order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lt: toExclusive } },
              },
              select: { lineTotal: true, order: { select: { deliveredAt: true } } },
            }),
        source === RevenueSource.PRODUCTS
          ? Promise.resolve([])
          : this.prisma.repairPart.findMany({
              where: {
                product: { familyId },
                repair: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lt: toExclusive } },
              },
              select: { lineTotal: true, repair: { select: { pickedUpAt: true } } },
            }),
      ]);
      for (const line of saleLines) {
        const day = line.sale.soldAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + line.lineTotal.toNumber());
      }
      for (const line of orderLines) {
        const day = line.order.deliveredAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + line.lineTotal.toNumber());
      }
      for (const line of repairParts) {
        const day = line.repair.pickedUpAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + line.lineTotal.toNumber());
      }
    } else {
      const [sales, orders, repairs] = await Promise.all([
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.sale.findMany({
              where: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, soldAt: { gte: from, lt: toExclusive } },
              select: { soldAt: true, totalAmount: true },
            }),
        source === RevenueSource.REPAIRS
          ? Promise.resolve([])
          : this.prisma.order.findMany({
              where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lt: toExclusive } },
              select: { deliveredAt: true, subtotal: true },
            }),
        source === RevenueSource.PRODUCTS
          ? Promise.resolve([])
          : this.prisma.repair.findMany({
              where: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lt: toExclusive } },
              select: { pickedUpAt: true, totalAmount: true },
            }),
      ]);

      for (const sale of sales) {
        const day = sale.soldAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + sale.totalAmount.toNumber());
      }
      for (const order of orders) {
        const day = order.deliveredAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + order.subtotal.toNumber());
      }
      for (const repair of repairs) {
        const day = repair.pickedUpAt!.toISOString().slice(0, 10);
        byDay.set(day, (byDay.get(day) ?? 0) + repair.totalAmount.toNumber());
      }
    }

    // S24 (A1) — subtract each returned line from the day bucket of its PARENT document's own
    // recognition date (Q1: a return restates the period the sale happened in), not the day the
    // return itself was processed.
    const adjustments = await this.returnAdjustments({ from, to }, familyId, source);
    for (const a of adjustments) {
      const day = a.recognizedAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) - a.revenue);
    }
    return this.sortedChartPoints(byDay);
  }

  // S14/F1 — `familyId` narrows to orders with at least one line in that family. S24 — `to` is
  // exclusive (A2); returns 0 rows for REPAIRS (orders are never repairs, so the array response
  // is simply empty, same "no data" shape the chart already renders for any empty range).
  private async chartDailyOrderCounts(from: Date, to: Date, familyId?: string, source: RevenueSource = RevenueSource.ALL): Promise<ChartPoint[]> {
    if (source === RevenueSource.REPAIRS) return [];
    const toExclusive = new Date(to.getTime() + DAY_MS);
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [...ORDER_RECOGNIZED_STATUSES] },
        deliveredAt: { gte: from, lt: toExclusive },
        ...(familyId != null ? { lines: { some: { product: { familyId } } } } : {}),
      },
      select: { deliveredAt: true },
    });
    const byDay = new Map<string, number>();
    for (const order of orders) {
      const day = order.deliveredAt!.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return this.sortedChartPoints(byDay);
  }

  // Family- and source-agnostic on purpose (S14, S24) — a client belongs to no family and is
  // neither a product nor a repair, so query.familyId/query.source are never read here. S24
  // (A2) — `to` is now an exclusive next-day bound, same as the other three charts.
  private async chartDailyNewClients(from: Date, to: Date): Promise<ChartPoint[]> {
    const toExclusive = new Date(to.getTime() + DAY_MS);
    const clients = await this.prisma.client.findMany({ where: { createdAt: { gte: from, lt: toExclusive } }, select: { createdAt: true } });
    const byDay = new Map<string, number>();
    for (const client of clients) {
      const day = client.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return this.sortedChartPoints(byDay);
  }

  // S14/R1 — folds in completed-Order and picked-up-Repair lines alongside SaleLine. Labour
  // (no product, D-a) is excluded, same as it is from every other per-product dimension — owner
  // decision Q3 confirms this stays excluded even outside a family filter, since labour belongs
  // to no product/family at all.
  // S24 (A6) — `familyId` now actually narrows the three queries (it was previously accepted as a
  // parameter by the caller's query object but never read here, so every family kept rendering
  // regardless of the selection — the fix, not "already collapses to one bar" as the old comment
  // wrongly claimed). `to` is exclusive (A2); `source` gates each query; returned lines are
  // subtracted per family via returnAdjustments() (A1).
  private async chartSalesByFamily(from: Date, to: Date, familyId?: string, source: RevenueSource = RevenueSource.ALL): Promise<ChartPoint[]> {
    const toExclusive = new Date(to.getTime() + DAY_MS);
    const [saleLines, orderLines, repairParts] = await Promise.all([
      source === RevenueSource.REPAIRS
        ? Promise.resolve([])
        : this.prisma.saleLine.findMany({
            where: {
              ...(familyId != null ? { product: { familyId } } : {}),
              sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, soldAt: { gte: from, lt: toExclusive } },
            },
            select: { lineTotal: true, product: { select: { familyId: true, family: { select: { name: true } } } } },
          }),
      source === RevenueSource.REPAIRS
        ? Promise.resolve([])
        : this.prisma.orderLine.findMany({
            where: {
              ...(familyId != null ? { product: { familyId } } : {}),
              order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lt: toExclusive } },
            },
            select: { lineTotal: true, product: { select: { familyId: true, family: { select: { name: true } } } } },
          }),
      source === RevenueSource.PRODUCTS
        ? Promise.resolve([])
        : this.prisma.repairPart.findMany({
            where: {
              ...(familyId != null ? { product: { familyId } } : {}),
              repair: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lt: toExclusive } },
            },
            select: { lineTotal: true, product: { select: { familyId: true, family: { select: { name: true } } } } },
          }),
    ]);
    const byFamily = new Map<string, number>();
    for (const line of [...saleLines, ...orderLines, ...repairParts]) {
      const name = line.product.family.name;
      byFamily.set(name, (byFamily.get(name) ?? 0) + line.lineTotal.toNumber());
    }

    const adjustments = await this.returnAdjustments({ from, to }, familyId, source);
    if (adjustments.length > 0) {
      const familyNameById = new Map(
        [...saleLines, ...orderLines, ...repairParts].map((l) => [l.product.familyId, l.product.family.name]),
      );
      for (const a of adjustments) {
        const name = familyNameById.get(a.familyId);
        if (name == null) continue; // the family had no recognised line in range to attribute the return to
        byFamily.set(name, (byFamily.get(name) ?? 0) - a.revenue);
      }
    }

    return StatisticsMapper.toChartPoints(
      [...byFamily.entries()].map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value),
    );
  }

  private sortedChartPoints(byLabel: Map<string, number>): ChartPoint[] {
    const points = [...byLabel.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value }));
    return StatisticsMapper.toChartPoints(points);
  }

  // --- Reports (the nine ReportType values) ---

  private async buildReport(type: ReportType, range: { from?: Date; to?: Date }): Promise<ReportDto> {
    switch (type) {
      case ReportType.SALES_BY_PRODUCT:
        return this.reportSalesByProduct(range);
      case ReportType.SALES_BY_CLIENT:
        return this.reportSalesByClient(range);
      case ReportType.SALES_BY_CATEGORY:
        return this.reportSalesByCategory(range);
      case ReportType.SALES_BY_SELLER:
        return this.reportSalesBySeller(range);
      case ReportType.STOCK_MOVEMENTS:
        return this.reportStockMovements(range);
      case ReportType.REPAIRS:
        return this.reportRepairs(range);
      case ReportType.SUPPLIER_SPEND:
        return this.reportSupplierSpend(range);
      case ReportType.AGEING:
        return this.reportAgeing();
      case ReportType.CLIENT_BROWSING:
        return this.reportClientBrowsing(range);
      default:
        throw new Error(`Unknown report type: ${String(type)}`);
    }
  }

  // S14/R1 — reads the shared productLineTotals reader (Sale + recognised Order + picked-up
  // Repair), not SaleLine alone. S24 (A1) — productLineTotals itself nets returned quantity/
  // revenue back out; a product whose net contribution reaches 0 no longer appears.
  private async reportSalesByProduct(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const byProduct = await this.productLineTotals(range);
    const rows = [...byProduct.entries()].map(([productId, data]) => ({ productId, ...data }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.productName, value: r.revenue })),
      rows,
      totals: { totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0) },
      drill: { entity: 'product', idField: 'productId' },
    });
  }

  // S14/R1 — folds in recognised orders (via client.posClientId — an order's registered client
  // who was never approved as a PosClient has no ledger identity and is skipped, same as a sale
  // with posClientId null) and picked-up repairs (posClientId is direct on Repair, no proxy).
  // S24 (Q2) — orders contribute `subtotal`, never `totalAmount` (the delivery fee is not
  // revenue). S24 (A1) — returned lines are subtracted per client via returnAdjustments().
  private async reportSalesByClient(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs, adjustments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, posClientId: { not: null }, ...(filter ? { soldAt: filter } : {}) },
        select: { posClientId: true, totalAmount: true, posClient: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, clientId: { not: null }, ...(filter ? { deliveredAt: filter } : {}) },
        select: { subtotal: true, client: { select: { posClient: { select: { id: true, name: true } } } } },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, posClientId: { not: null }, ...(filter ? { pickedUpAt: filter } : {}) },
        select: { posClientId: true, totalAmount: true, posClient: { select: { name: true } } },
      }),
      this.returnAdjustments(range),
    ]);

    const byClient = new Map<string, { name: string; revenue: number }>();
    for (const sale of sales) {
      const id = sale.posClientId!;
      const existing = byClient.get(id) ?? { name: sale.posClient?.name ?? '', revenue: 0 };
      existing.revenue += sale.totalAmount.toNumber();
      byClient.set(id, existing);
    }
    for (const order of orders) {
      const posClient = order.client?.posClient;
      if (posClient == null) continue; // never approved as a PosClient — no ledger identity to attribute to
      const existing = byClient.get(posClient.id) ?? { name: posClient.name, revenue: 0 };
      existing.revenue += order.subtotal.toNumber();
      byClient.set(posClient.id, existing);
    }
    for (const repair of repairs) {
      const id = repair.posClientId!;
      const existing = byClient.get(id) ?? { name: repair.posClient?.name ?? '', revenue: 0 };
      existing.revenue += repair.totalAmount.toNumber();
      byClient.set(id, existing);
    }
    for (const a of adjustments) {
      if (a.posClientId == null) continue;
      const existing = byClient.get(a.posClientId);
      if (existing) existing.revenue -= a.revenue;
    }

    const rows = [...byClient.entries()].map(([posClientId, data]) => ({ posClientId, clientName: data.name, revenue: data.revenue }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.clientName, value: r.revenue })),
      rows,
      totals: { totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0) },
      drill: { entity: 'posClient', idField: 'posClientId' },
    });
  }

  // "category" is the client's pricing tier (ClientCategory, via posClient.categoryId) — "how
  // much discount does each tier really get" (audit fix A1). The product-family split already
  // exists as the CHARTS route's own sales-by-family; this is a distinct dimension, not a
  // duplicate of it. Documents with no linked POS client, or whose POS client has no category,
  // land in the categoryId=null "No client / default price" bucket.
  private static readonly NO_CATEGORY_BUCKET = 'No client / default price';

  // S14/R1 — folds in recognised orders and picked-up repairs. Orders carry both resolvedPrice
  // and unitPrice per line (D11) so every column (including discount) is well-defined the same
  // way it is for sales; a repair has no per-line resolved/charged price pair, so it contributes
  // resolvedRevenue = revenue and discount = 0 at the document level (no per-part loop).
  // S24 (A10) — three corrections: (1) sales now sum the stored `lineTotal` and subtract the
  // sale's own `discountAmount` once per document (previously `unitPrice × quantity`, which
  // ignored a document-level discount and so could disagree with `Sale.totalAmount`); orders are
  // left as `unitPrice × quantity`, which is already fee-free and needed no change — Q2 is
  // already satisfied here; (2) repair parts now add to `quantity` (previously silently excluded,
  // so a category with repairs showed revenue against too few units); (3) returned lines are
  // subtracted per category via returnAdjustments().
  private async reportSalesByCategory(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs, adjustments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) },
        select: {
          discountAmount: true,
          posClient: { select: { categoryId: true, category: { select: { name: true } } } },
          lines: { select: { resolvedPrice: true, unitPrice: true, lineTotal: true, quantity: true, costOfGoods: true, profit: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
        select: {
          client: { select: { posClient: { select: { categoryId: true, category: { select: { name: true } } } } } },
          lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true, costOfGoods: true, profit: true } },
        },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
        select: {
          posClient: { select: { categoryId: true, category: { select: { name: true } } } },
          totalAmount: true,
          totalCost: true,
          totalProfit: true,
          parts: { select: { quantity: true } },
        },
      }),
      this.returnAdjustments(range),
    ]);

    const byCategory = new Map<
      string | null,
      { name: string; salesCount: number; quantity: number; revenue: number; resolvedRevenue: number; discount: number; cost: number; profit: number }
    >();

    for (const sale of sales) {
      const categoryId = sale.posClient?.categoryId ?? null;
      const name = sale.posClient?.category?.name ?? StatisticsService.NO_CATEGORY_BUCKET;
      const existing = byCategory.get(categoryId) ?? { name, salesCount: 0, quantity: 0, revenue: 0, resolvedRevenue: 0, discount: 0, cost: 0, profit: 0 };
      existing.salesCount += 1;
      // Document-level discount subtracted once, so Σ per-category revenue ties to
      // Σ Sale.totalAmount rather than the pre-discount subtotal.
      existing.revenue -= sale.discountAmount.toNumber();
      for (const line of sale.lines) {
        const unitPrice = line.unitPrice.toNumber();
        const resolvedPrice = line.resolvedPrice.toNumber();
        existing.quantity += line.quantity;
        existing.revenue += line.lineTotal.toNumber();
        existing.resolvedRevenue += resolvedPrice * line.quantity;
        existing.discount += (resolvedPrice - unitPrice) * line.quantity;
        existing.cost += line.costOfGoods.toNumber();
        existing.profit += line.profit.toNumber();
      }
      byCategory.set(categoryId, existing);
    }

    for (const order of orders) {
      const posClient = order.client?.posClient;
      const categoryId = posClient?.categoryId ?? null;
      const name = posClient?.category?.name ?? StatisticsService.NO_CATEGORY_BUCKET;
      const existing = byCategory.get(categoryId) ?? { name, salesCount: 0, quantity: 0, revenue: 0, resolvedRevenue: 0, discount: 0, cost: 0, profit: 0 };
      existing.salesCount += 1;
      for (const line of order.lines) {
        const unitPrice = line.unitPrice.toNumber();
        const resolvedPrice = line.resolvedPrice.toNumber();
        existing.quantity += line.quantity;
        existing.revenue += unitPrice * line.quantity; // already fee-free (Q2) — no document total here
        existing.resolvedRevenue += resolvedPrice * line.quantity;
        existing.discount += (resolvedPrice - unitPrice) * line.quantity;
        existing.cost += line.costOfGoods?.toNumber() ?? 0;
        existing.profit += line.profit?.toNumber() ?? 0;
      }
      byCategory.set(categoryId, existing);
    }

    for (const repair of repairs) {
      const categoryId = repair.posClient?.categoryId ?? null;
      const name = repair.posClient?.category?.name ?? StatisticsService.NO_CATEGORY_BUCKET;
      const existing = byCategory.get(categoryId) ?? { name, salesCount: 0, quantity: 0, revenue: 0, resolvedRevenue: 0, discount: 0, cost: 0, profit: 0 };
      existing.salesCount += 1;
      existing.quantity += repair.parts.reduce((sum, part) => sum + part.quantity, 0);
      const revenue = repair.totalAmount.toNumber();
      existing.revenue += revenue;
      existing.resolvedRevenue += revenue;
      existing.cost += repair.totalCost?.toNumber() ?? 0;
      existing.profit += repair.totalProfit?.toNumber() ?? 0;
      byCategory.set(categoryId, existing);
    }

    for (const a of adjustments) {
      const existing = byCategory.get(a.categoryId);
      if (!existing) continue;
      existing.quantity -= a.quantity;
      existing.revenue -= a.revenue;
      existing.resolvedRevenue -= a.revenue;
      existing.cost -= a.cost;
      existing.profit -= a.profit;
    }

    const rows = [...byCategory.entries()].map(([categoryId, data]) => ({
      categoryId,
      categoryName: data.name,
      salesCount: data.salesCount,
      quantity: data.quantity,
      revenue: data.revenue,
      resolvedRevenue: data.resolvedRevenue,
      discount: data.discount,
      cost: data.cost,
      profit: data.profit,
    }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.categoryName, value: r.revenue })),
      rows,
      totals: {
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
        totalDiscount: rows.reduce((sum, r) => sum + r.discount, 0),
      },
      drill: { entity: 'clientCategory', idField: 'categoryId' },
    });
  }

  // S14/R1/D-b — folds in orders (bucketed under UNASSIGNED_SELLER_BUCKET — Order has no owning
  // seller, D-b) and picked-up repairs (seller = the staff who performed the PICKED_UP
  // transition, read from RepairStatusHistory in one batched query, not per-repair).
  // S24 (Q2) — orders contribute `subtotal`, never `totalAmount`. S24 (A1) — returned lines are
  // subtracted per seller via returnAdjustments() (order returns fold into
  // UNASSIGNED_SELLER_BUCKET, matching how order revenue itself is bucketed above).
  private async reportSalesBySeller(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs, adjustments] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: { in: [...SALE_RECOGNIZED_STATUSES] }, ...(filter ? { soldAt: filter } : {}) },
        select: {
          staffId: true,
          totalAmount: true,
          staff: { select: { firstName: true, lastName: true } },
          lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
        select: { subtotal: true, lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true } } },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
        select: { id: true, totalAmount: true },
      }),
      this.returnAdjustments(range),
    ]);

    const bySeller = new Map<string, { name: string; revenue: number; discount: number }>();
    for (const sale of sales) {
      const existing = bySeller.get(sale.staffId) ?? { name: `${sale.staff.firstName} ${sale.staff.lastName}`, revenue: 0, discount: 0 };
      existing.revenue += sale.totalAmount.toNumber();
      for (const line of sale.lines) {
        existing.discount += (line.resolvedPrice.toNumber() - line.unitPrice.toNumber()) * line.quantity;
      }
      bySeller.set(sale.staffId, existing);
    }

    if (orders.length > 0) {
      const existing = bySeller.get(UNASSIGNED_SELLER_BUCKET) ?? { name: UNASSIGNED_SELLER_BUCKET, revenue: 0, discount: 0 };
      for (const order of orders) {
        existing.revenue += order.subtotal.toNumber();
        for (const line of order.lines) {
          existing.discount += (line.resolvedPrice.toNumber() - line.unitPrice.toNumber()) * line.quantity;
        }
      }
      bySeller.set(UNASSIGNED_SELLER_BUCKET, existing);
    }

    if (repairs.length > 0) {
      const histories = await this.prisma.repairStatusHistory.findMany({
        where: { repairId: { in: repairs.map((r) => r.id) }, toStatus: 'PICKED_UP' },
        select: { repairId: true, staffId: true, staff: { select: { firstName: true, lastName: true } } },
      });
      const historyByRepairId = new Map(histories.map((h) => [h.repairId, h]));
      for (const repair of repairs) {
        const history = historyByRepairId.get(repair.id);
        if (!history) continue; // defensive — every PICKED_UP repair has one by construction (S13)
        const existing = bySeller.get(history.staffId) ?? {
          name: `${history.staff.firstName} ${history.staff.lastName}`,
          revenue: 0,
          discount: 0,
        };
        existing.revenue += repair.totalAmount.toNumber();
        bySeller.set(history.staffId, existing);
      }
    }

    for (const a of adjustments) {
      const key = a.sellerStaffId ?? UNASSIGNED_SELLER_BUCKET;
      const existing = bySeller.get(key);
      if (existing) existing.revenue -= a.revenue;
    }

    const rows = [...bySeller.entries()].map(([staffId, data]) => ({
      staffId: staffId === UNASSIGNED_SELLER_BUCKET ? null : staffId,
      staffName: data.name,
      revenue: data.revenue,
      discount: data.discount,
    }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.staffName, value: r.revenue })),
      rows,
      totals: {
        totalRevenue: rows.reduce((sum, r) => sum + r.revenue, 0),
        totalDiscount: rows.reduce((sum, r) => sum + r.discount, 0),
      },
      drill: { entity: 'staff', idField: 'staffId' },
    });
  }

  // S24 (A3) — IN/OUT only. The three PENDING types (PENDING_ORDER, PENDING_REPAIR,
  // PENDING_RELEASE) are reservations: they move no layers and must never be reported as stock
  // in or out. Previously ungated, so a reservation and its later release both appeared as if
  // they were real movements.
  private async reportStockMovements(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const createdAtFilter = this.dateRangeFilter(range);
    const groups = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      where: { direction: { in: ['IN', 'OUT'] }, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
      _sum: { quantity: true },
      _count: { _all: true },
    });

    const rows = groups.map((g) => ({
      type: g.type,
      totalQuantity: g._sum.quantity ?? 0,
      movementCount: g._count._all,
      flagged: g.type === 'ADJUSTMENT_OUT' && Math.abs(g._sum.quantity ?? 0) >= LARGE_ADJUSTMENT_OUT_THRESHOLD,
    }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.type, value: Math.abs(r.totalQuantity) })),
      rows,
      totals: { movementTypeCount: rows.length },
      drill: { entity: 'stockMovement', idField: 'type' },
    });
  }

  // S14/F7 — a workload view (rows, grouped/dated by intakeAt: how many tickets came in) plus a
  // money view (totals, dated by pickedUpAt: what was actually recognised — D8).
  // S24 (A5) — rows previously ALSO carried revenue/cost/profit computed on the intakeAt basis,
  // which contradicted `totals.recognized*` (the correct pickedUpAt-basis figures) for any repair
  // whose intake and pickup fall in different report ranges. Rows now carry only `accruedAmount`
  // (parts+labour accrued so far, on whichever basis the row itself is grouped by — a workload
  // figure, not a recognised-revenue one) so nothing on a row can be read as recognised revenue.
  // `totals.recognized*` is the report's one and only money answer.
  private async reportRepairs(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const intakeAtFilter = this.dateRangeFilter(range);
    const groups = await this.prisma.repair.groupBy({
      by: ['status'],
      ...(intakeAtFilter ? { where: { intakeAt: intakeAtFilter } } : {}),
      _count: { _all: true },
      _sum: { totalAmount: true },
    });

    const rows = groups.map((g) => ({
      status: g.status,
      count: g._count._all,
      accruedAmount: g._sum.totalAmount?.toNumber() ?? 0,
    }));

    const pickedUpAtFilter = this.dateRangeFilter(range);
    const recognized = await this.prisma.repair.aggregate({
      where: { status: REPAIR_RECOGNIZED_STATUS, ...(pickedUpAtFilter ? { pickedUpAt: pickedUpAtFilter } : {}) },
      _sum: { totalAmount: true, totalCost: true, totalProfit: true },
    });

    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.status, value: r.count })),
      rows,
      totals: {
        totalRepairs: rows.reduce((sum, r) => sum + r.count, 0),
        recognizedRevenue: recognized._sum.totalAmount?.toNumber() ?? 0,
        recognizedCost: recognized._sum.totalCost?.toNumber() ?? 0,
        recognizedProfit: recognized._sum.totalProfit?.toNumber() ?? 0,
      },
      drill: { entity: 'repair', idField: 'status' },
    });
  }

  private async reportSupplierSpend(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const invoiceDateFilter = this.dateRangeFilter(range);
    const invoices = await this.prisma.supplierInvoice.findMany({
      where: { status: 'CONFIRMED', ...(invoiceDateFilter ? { invoiceDate: invoiceDateFilter } : {}) },
      select: { supplierId: true, totalAmount: true, supplier: { select: { name: true } } },
    });

    const bySupplier = new Map<string, { name: string; spend: number }>();
    for (const invoice of invoices) {
      const existing = bySupplier.get(invoice.supplierId) ?? { name: invoice.supplier.name, spend: 0 };
      existing.spend += invoice.totalAmount.toNumber();
      bySupplier.set(invoice.supplierId, existing);
    }

    const rows = [...bySupplier.entries()].map(([supplierId, data]) => ({ supplierId, supplierName: data.name, spend: data.spend }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.supplierName, value: r.spend })),
      rows,
      totals: { totalSpend: rows.reduce((sum, r) => sum + r.spend, 0) },
      drill: { entity: 'supplier', idField: 'supplierId' },
    });
  }

  // Buckets outstanding client (Invoice, ISSUED|PARTIALLY_PAID) and supplier (SupplierInvoice,
  // CONFIRMED) balances by document age — no single "age" column exists on PosClient/Supplier
  // themselves (credit is a running balance, not tied to one document), so this ages each
  // *invoice's* own outstanding remainder instead. S14/F9 — confirmed already correct: a repair
  // invoice (sourceType REPAIR) is just another Invoice row, already covered by this query
  // without any change.
  private async reportAgeing(): Promise<ReportDto> {
    const now = new Date();
    const bucketFor = (days: number): (typeof AGEING_BUCKETS)[number] =>
      days <= 30 ? '0-30' : days <= 60 ? '31-60' : days <= 90 ? '61-90' : '90+';

    const [clientInvoices, supplierInvoices] = await Promise.all([
      this.prisma.invoice.findMany({
        where: { status: { in: ['ISSUED', 'PARTIALLY_PAID'] } },
        select: { issuedAt: true, totalAmount: true, paidAmount: true },
      }),
      this.prisma.supplierInvoice.findMany({
        where: { status: 'CONFIRMED' },
        select: { invoiceDate: true, totalAmount: true, paidAmount: true },
      }),
    ]);

    const buckets = new Map<string, { clientOutstanding: number; supplierOutstanding: number }>();
    for (const invoice of clientInvoices) {
      const outstanding = invoice.totalAmount.toNumber() - invoice.paidAmount.toNumber();
      if (outstanding <= 0) continue;
      const bucket = bucketFor(Math.floor((now.getTime() - invoice.issuedAt.getTime()) / DAY_MS));
      const entry = buckets.get(bucket) ?? { clientOutstanding: 0, supplierOutstanding: 0 };
      entry.clientOutstanding += outstanding;
      buckets.set(bucket, entry);
    }
    for (const invoice of supplierInvoices) {
      const outstanding = invoice.totalAmount.toNumber() - invoice.paidAmount.toNumber();
      if (outstanding <= 0) continue;
      const bucket = bucketFor(Math.floor((now.getTime() - invoice.invoiceDate.getTime()) / DAY_MS));
      const entry = buckets.get(bucket) ?? { clientOutstanding: 0, supplierOutstanding: 0 };
      entry.supplierOutstanding += outstanding;
      buckets.set(bucket, entry);
    }

    const rows = AGEING_BUCKETS.filter((bucket) => buckets.has(bucket)).map((bucket) => ({ bucket, ...buckets.get(bucket)! }));
    return StatisticsMapper.toReportDto({
      chart: rows.map((r) => ({ label: r.bucket, value: r.clientOutstanding + r.supplierOutstanding })),
      rows,
      totals: {
        totalClientOutstanding: rows.reduce((sum, r) => sum + r.clientOutstanding, 0),
        totalSupplierOutstanding: rows.reduce((sum, r) => sum + r.supplierOutstanding, 0),
      },
      drill: { entity: 'invoice', idField: 'bucket' },
    });
  }

  // S14/F6 — "purchased" now unions SaleLine, recognised-OrderLine and picked-up-RepairPart (was
  // SaleLine alone), so a product bought via an order or fitted in a repair correctly leaves the
  // "viewed but never purchased" set. Deliberately no date filter on the purchased-set queries
  // (unchanged from before S14) — "ever purchased" is a lifetime fact, not scoped to `range`.
  // S24 (A7) — the three "purchased" queries previously carried no status filter at all, so a
  // product merely sitting in a DRAFT/CANCELLED sale or a PENDING/CONFIRMED/CANCELLED order
  // counted as "purchased" and was wrongly removed from the one set this report exists to
  // surface. Now gated on each document type's own recognised statuses.
  private async reportClientBrowsing(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const createdAtFilter = this.dateRangeFilter(range);

    const [searchGroups, viewGroups, purchasedSaleLines, purchasedOrderLines, purchasedRepairParts] = await Promise.all([
      this.prisma.staffSearchLog.groupBy({
        by: ['query'],
        ...(createdAtFilter ? { where: { createdAt: createdAtFilter } } : {}),
        _count: { _all: true },
        orderBy: { _count: { query: 'desc' } },
        take: 10,
      }),
      this.prisma.clientActivityLog.groupBy({
        by: ['productId'],
        where: { type: 'PRODUCT_VIEW', productId: { not: null }, ...(createdAtFilter ? { createdAt: createdAtFilter } : {}) },
        _count: { _all: true },
      }),
      this.prisma.saleLine.findMany({
        where: { sale: { status: { in: [...SALE_RECOGNIZED_STATUSES] } } },
        select: { productId: true },
        distinct: ['productId'],
      }),
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] } } },
        select: { productId: true },
        distinct: ['productId'],
      }),
      this.prisma.repairPart.findMany({
        where: { repair: { status: REPAIR_RECOGNIZED_STATUS } },
        select: { productId: true },
        distinct: ['productId'],
      }),
    ]);

    const purchasedSet = new Set(
      [...purchasedSaleLines, ...purchasedOrderLines, ...purchasedRepairParts].map((l) => l.productId),
    );
    const zeroPurchaseViewed = viewGroups.filter((v) => v.productId != null && !purchasedSet.has(v.productId));

    const productIds = zeroPurchaseViewed.map((v) => v.productId!);
    const products = productIds.length ? await this.prisma.product.findMany({ where: { id: { in: productIds } }, select: { id: true, name: true } }) : [];
    const nameById = new Map(products.map((p) => [p.id, p.name]));

    const topSearches = searchGroups.map((g) => ({ kind: 'search' as const, query: g.query, count: g._count._all }));
    const mostViewedNoPurchase = zeroPurchaseViewed
      .map((v) => ({ kind: 'viewedNoPurchase' as const, productId: v.productId!, productName: nameById.get(v.productId!) ?? '', viewCount: v._count._all }))
      .sort((a, b) => b.viewCount - a.viewCount)
      .slice(0, 10);

    return StatisticsMapper.toReportDto({
      chart: topSearches.map((s) => ({ label: s.query, value: s.count })),
      rows: [...topSearches, ...mostViewedNoPurchase],
      totals: { topSearchCount: topSearches.length, zeroPurchaseProductCount: mostViewedNoPurchase.length },
      drill: { entity: 'product', idField: 'productId' },
    });
  }

  // S25 — was JSON.stringify-per-field (JSON escaping, not CSV: an inner quote came out \" where
  // CSV needs ""), with headers taken from rows[0] alone. Columns are now the union of every
  // row's keys in first-seen order — the same fix S24/A9 applied to report-picker.tsx, and for
  // the same reason (client-browsing emits two row shapes). `totals` is appended after a blank
  // line as label,value pairs: S24/A4 established that the repairs report's recognised revenue,
  // cost and profit exist ONLY in totals, so a rows-only CSV of that report carries no money at
  // all. The trailing block costs strict rectangularity; Excel reads it fine and the alternative
  // is exporting a report without its headline figures.
  private toCsvExport(type: ReportType, dto: ReportDto): ExportResult {
    assertExportSize(dto.rows.length);
    const headers = [...new Set(dto.rows.flatMap((row) => Object.keys(row)))];
    const rows = dto.rows.map((row) =>
      headers.map((header) => toReportCsvValue((row as Record<string, unknown>)[header])),
    );

    let body = toCsv(headers, rows);
    if (Object.keys(dto.totals).length > 0) {
      const totalsRows = Object.entries(dto.totals).map(([label, value]) => [label, toReportCsvValue(value)]);
      body += CSV_EOL + toCsvSection(['Total', 'Value'], totalsRows);
    }

    return { filename: `${type}.csv`, mime: CSV_MIME, body };
  }

  // S25 — PDF counterpart of toCsvExport, sharing its column-union logic. Column headers are the
  // raw field names: the REPORT_COLUMN_KEY label map that translates them into readable text
  // lives in the frontend (report-columns.ts) and the backend must not import across apps — a
  // server-rendered document's text is English literals by established precedent (invoice PDFs,
  // barcode labels; see S25 §0.6).
  private async toPdfExport(type: ReportType, dto: ReportDto, query: ReportQuery): Promise<ExportResult> {
    assertExportSize(dto.rows.length);
    const headers = [...new Set(dto.rows.flatMap((row) => Object.keys(row)))];
    const rows = dto.rows.map((row) => headers.map((header) => formatReportCell((row as Record<string, unknown>)[header])));

    // S24 (A11) — reportAgeing takes no range at all (a point-in-time snapshot); printing a date
    // range on it would be lying, so it gets a note instead, matching the UI's own
    // ageingSnapshotNote.
    const filters: { label: string; value: string }[] =
      type === ReportType.AGEING
        ? [{ label: 'Note', value: 'point-in-time snapshot — the date range does not apply' }]
        : [
            ...(query.from ? [{ label: 'From', value: query.from }] : []),
            ...(query.to ? [{ label: 'To', value: query.to }] : []),
          ];

    const body = await renderTablePdf({
      title: humaniseReportType(type),
      filters,
      generatedAt: new Date(),
      orientation: headers.length > 6 ? 'landscape' : 'portrait',
      columns: headers.map((header) => ({ header, width: 1 })),
      rows,
      chart: dto.chart,
      totals: Object.entries(dto.totals).map(([label, value]) => ({ label, value: formatReportCell(value) })),
    });

    return { filename: `${type}.pdf`, mime: 'application/pdf', body };
  }
}
