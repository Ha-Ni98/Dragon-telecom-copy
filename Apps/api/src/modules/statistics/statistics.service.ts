import type { PrismaClient } from '@prisma/client';
import {
  ChartType,
  ReportFormat,
  ReportType,
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
import type { ChartPoint, DraftSaleRow, LowStockRow, TopProductDto } from './statistics.mapper';
import { StatisticsMapper } from './statistics.mapper';
import type { ExportResult, IStatisticsService } from './statistics.interface';

const DAY_MS = 24 * 3_600_000;

// D2 (S10) — nothing accrues before completion any more: cost and profit are stamped at
// COMPLETED only, so recognising a CONFIRMED/PACKAGED/IN_DELIVERY order here would report
// revenue against a zero cost. Mirrors Sale's own soldAt-gated COMPLETED population.
const ORDER_RECOGNIZED_STATUSES = ['COMPLETED'] as const;

// D8/D9 (S13/S14 R1) — a repair recognises revenue, cost and profit together at PICKED_UP, and
// produces no Sale row at all (D9). Every figure below that used to arrive through the deleted
// REPAIR-origin Sale is read directly off Repair here, dated on pickedUpAt.
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
  // numbers.
  async getFiltered(query: FilteredQuery): Promise<FilteredDto> {
    const to = query.to != null ? new Date(query.to) : new Date();
    const from = query.from != null ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);
    const durationMs = Math.max(to.getTime() - from.getTime(), 0);
    const prevTo = new Date(from.getTime());
    const prevFrom = new Date(from.getTime() - durationMs);

    const [current, previous, orders, prevOrders] = await Promise.all([
      this.computeRevenueProfit({ from, to }, query.familyId),
      this.computeRevenueProfit({ from: prevFrom, to: prevTo }, query.familyId),
      this.countRecognizedOrders(from, to, query.familyId),
      this.countRecognizedOrders(prevFrom, prevTo, query.familyId),
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
  // (a client has no family) and SALES_BY_FAMILY needs no special-case (a familyId would just
  // collapse its own breakdown to one bar, which is already what happens today).
  async getChart(chart: ChartType, query: ChartsQuery): Promise<ChartPoint[]> {
    const to = query.to != null ? new Date(query.to) : new Date();
    const from = query.from != null ? new Date(query.from) : new Date(to.getTime() - 30 * DAY_MS);

    switch (chart) {
      case ChartType.SALES_BY_FAMILY:
        return this.chartSalesByFamily(from, to);
      case ChartType.REVENUE:
        return this.chartDailyRevenue(from, to, query.familyId);
      case ChartType.ORDERS:
        return this.chartDailyOrderCounts(from, to, query.familyId);
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

  // Revenue/profit = Σ COMPLETED Sale + Σ COMPLETED Order (D2) + Σ PICKED_UP Repair (D8/D9, S14).
  // Dated on soldAt/deliveredAt/pickedUpAt respectively — the timestamp each document's own
  // recognition moment writes. No double-count: a picked-up repair produces an Invoice
  // (sourceType REPAIR) and never a Sale or an Order, and this method never reads Invoice.
  //
  // `familyId` (S14/F1) switches to a LINE-level computation (SaleLine/OrderLine/RepairPart
  // joined to product.familyId) instead of document totals — a document's delivery fee (Order)
  // or labour (Repair) belongs to no single family and is excluded from the family-filtered
  // figure. This is a deliberate asymmetry from the unfiltered figure above it, not a bug.
  private async computeRevenueProfit(range: { from?: Date; to?: Date }, familyId?: string): Promise<{ revenue: number; profit: number }> {
    if (familyId != null) {
      const filter = this.dateRangeFilter(range);
      const [saleLines, orderLines, repairParts] = await Promise.all([
        this.prisma.saleLine.findMany({
          where: { product: { familyId }, sale: { status: 'COMPLETED', ...(filter ? { soldAt: filter } : {}) } },
          select: { lineTotal: true, profit: true },
        }),
        this.prisma.orderLine.findMany({
          where: {
            product: { familyId },
            order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
          },
          select: { lineTotal: true, profit: true },
        }),
        this.prisma.repairPart.findMany({
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
      return { revenue, profit };
    }

    const filter = this.dateRangeFilter(range);
    const [saleAgg, orderAgg, repairAgg] = await Promise.all([
      this.prisma.sale.aggregate({
        where: { status: 'COMPLETED', ...(filter ? { soldAt: filter } : {}) },
        _sum: { totalAmount: true, totalProfit: true },
      }),
      this.prisma.order.aggregate({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
        _sum: { totalAmount: true, totalProfit: true },
      }),
      this.prisma.repair.aggregate({
        where: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
        _sum: { totalAmount: true, totalProfit: true },
      }),
    ]);

    return {
      revenue:
        (saleAgg._sum.totalAmount?.toNumber() ?? 0) +
        (orderAgg._sum.totalAmount?.toNumber() ?? 0) +
        (repairAgg._sum.totalAmount?.toNumber() ?? 0),
      profit:
        (saleAgg._sum.totalProfit?.toNumber() ?? 0) +
        (orderAgg._sum.totalProfit?.toNumber() ?? 0) +
        (repairAgg._sum.totalProfit?.toNumber() ?? 0),
    };
  }

  // S14/F1 — `familyId` narrows to orders with at least one line in that family.
  private async countRecognizedOrders(from: Date, to: Date, familyId?: string): Promise<number> {
    return this.prisma.order.count({
      where: {
        status: { in: [...ORDER_RECOGNIZED_STATUSES] },
        deliveredAt: { gte: from, lte: to },
        ...(familyId != null ? { lines: { some: { product: { familyId } } } } : {}),
      },
    });
  }

  // S14/R1 — the shared per-product line-level reader: Sale + completed Order + picked-up
  // Repair lines, merged by productId. Used by both getTopProducts and reportSalesByProduct so
  // the three-source union is written exactly once (plan's "fix the root cause once" rule).
  private async productLineTotals(range: { from?: Date; to?: Date }): Promise<Map<string, { productName: string; quantity: number; revenue: number }>> {
    const filter = this.dateRangeFilter(range);
    const [saleLines, orderLines, repairParts] = await Promise.all([
      this.prisma.saleLine.findMany({
        where: { sale: { status: 'COMPLETED', ...(filter ? { soldAt: filter } : {}) } },
        select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
      }),
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) } },
        select: { productId: true, productNameSnapshot: true, quantity: true, lineTotal: true },
      }),
      this.prisma.repairPart.findMany({
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
    return byProduct;
  }

  private pctChange(current: number, previous: number): number {
    if (previous === 0) return 0;
    return ((current - previous) / previous) * 100;
  }

  private dateRangeFilter(range: { from?: Date; to?: Date }): { gte?: Date; lte?: Date } | undefined {
    if (range.from == null && range.to == null) return undefined;
    return { ...(range.from ? { gte: range.from } : {}), ...(range.to ? { lte: range.to } : {}) };
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
  // document totals.
  private async chartDailyRevenue(from: Date, to: Date, familyId?: string): Promise<ChartPoint[]> {
    const byDay = new Map<string, number>();

    if (familyId != null) {
      const [saleLines, orderLines, repairParts] = await Promise.all([
        this.prisma.saleLine.findMany({
          where: { product: { familyId }, sale: { status: 'COMPLETED', soldAt: { gte: from, lte: to } } },
          select: { lineTotal: true, sale: { select: { soldAt: true } } },
        }),
        this.prisma.orderLine.findMany({
          where: {
            product: { familyId },
            order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lte: to } },
          },
          select: { lineTotal: true, order: { select: { deliveredAt: true } } },
        }),
        this.prisma.repairPart.findMany({
          where: {
            product: { familyId },
            repair: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lte: to } },
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
      return this.sortedChartPoints(byDay);
    }

    const [sales, orders, repairs] = await Promise.all([
      this.prisma.sale.findMany({ where: { status: 'COMPLETED', soldAt: { gte: from, lte: to } }, select: { soldAt: true, totalAmount: true } }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lte: to } },
        select: { deliveredAt: true, totalAmount: true },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lte: to } },
        select: { pickedUpAt: true, totalAmount: true },
      }),
    ]);

    for (const sale of sales) {
      const day = sale.soldAt!.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + sale.totalAmount.toNumber());
    }
    for (const order of orders) {
      const day = order.deliveredAt!.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + order.totalAmount.toNumber());
    }
    for (const repair of repairs) {
      const day = repair.pickedUpAt!.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + repair.totalAmount.toNumber());
    }

    return this.sortedChartPoints(byDay);
  }

  // S14/F1 — `familyId` narrows to orders with at least one line in that family.
  private async chartDailyOrderCounts(from: Date, to: Date, familyId?: string): Promise<ChartPoint[]> {
    const orders = await this.prisma.order.findMany({
      where: {
        status: { in: [...ORDER_RECOGNIZED_STATUSES] },
        deliveredAt: { gte: from, lte: to },
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

  // Family-agnostic on purpose (S14) — a client has no family, so query.familyId is never read
  // here.
  private async chartDailyNewClients(from: Date, to: Date): Promise<ChartPoint[]> {
    const clients = await this.prisma.client.findMany({ where: { createdAt: { gte: from, lte: to } }, select: { createdAt: true } });
    const byDay = new Map<string, number>();
    for (const client of clients) {
      const day = client.createdAt.toISOString().slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + 1);
    }
    return this.sortedChartPoints(byDay);
  }

  // S14/R1 — folds in completed-Order and picked-up-Repair lines alongside SaleLine. Labour
  // (no product, D-a) is excluded, same as it is from every other per-product dimension.
  private async chartSalesByFamily(from: Date, to: Date): Promise<ChartPoint[]> {
    const [saleLines, orderLines, repairParts] = await Promise.all([
      this.prisma.saleLine.findMany({
        where: { sale: { status: 'COMPLETED', soldAt: { gte: from, lte: to } } },
        select: { lineTotal: true, product: { select: { family: { select: { name: true } } } } },
      }),
      this.prisma.orderLine.findMany({
        where: { order: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, deliveredAt: { gte: from, lte: to } } },
        select: { lineTotal: true, product: { select: { family: { select: { name: true } } } } },
      }),
      this.prisma.repairPart.findMany({
        where: { repair: { status: REPAIR_RECOGNIZED_STATUS, pickedUpAt: { gte: from, lte: to } } },
        select: { lineTotal: true, product: { select: { family: { select: { name: true } } } } },
      }),
    ]);
    const byFamily = new Map<string, number>();
    for (const line of [...saleLines, ...orderLines, ...repairParts]) {
      const name = line.product.family.name;
      byFamily.set(name, (byFamily.get(name) ?? 0) + line.lineTotal.toNumber());
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

  // S14/R1 — reads the shared productLineTotals reader (Sale + completed Order + picked-up
  // Repair), not SaleLine alone.
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

  // S14/R1 — folds in completed orders (via client.posClientId — an order's registered client
  // who was never approved as a PosClient has no ledger identity and is skipped, same as a sale
  // with posClientId null) and picked-up repairs (posClientId is direct on Repair, no proxy).
  private async reportSalesByClient(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', posClientId: { not: null }, ...(filter ? { soldAt: filter } : {}) },
        select: { posClientId: true, totalAmount: true, posClient: { select: { name: true } } },
      }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, clientId: { not: null }, ...(filter ? { deliveredAt: filter } : {}) },
        select: { totalAmount: true, client: { select: { posClient: { select: { id: true, name: true } } } } },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, posClientId: { not: null }, ...(filter ? { pickedUpAt: filter } : {}) },
        select: { posClientId: true, totalAmount: true, posClient: { select: { name: true } } },
      }),
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
      existing.revenue += order.totalAmount.toNumber();
      byClient.set(posClient.id, existing);
    }
    for (const repair of repairs) {
      const id = repair.posClientId!;
      const existing = byClient.get(id) ?? { name: repair.posClient?.name ?? '', revenue: 0 };
      existing.revenue += repair.totalAmount.toNumber();
      byClient.set(id, existing);
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

  // S14/R1 — folds in completed orders and picked-up repairs. Orders carry both resolvedPrice
  // and unitPrice per line (D11) so every column (including discount) is well-defined the same
  // way it is for sales; a repair has no per-line resolved/charged price pair, so it contributes
  // resolvedRevenue = revenue and discount = 0 at the document level (no per-part loop).
  private async reportSalesByCategory(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', ...(filter ? { soldAt: filter } : {}) },
        select: {
          posClient: { select: { categoryId: true, category: { select: { name: true } } } },
          lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true, costOfGoods: true, profit: true } },
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
        },
      }),
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
      for (const line of sale.lines) {
        const unitPrice = line.unitPrice.toNumber();
        const resolvedPrice = line.resolvedPrice.toNumber();
        existing.quantity += line.quantity;
        existing.revenue += unitPrice * line.quantity;
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
        existing.revenue += unitPrice * line.quantity;
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
      const revenue = repair.totalAmount.toNumber();
      existing.revenue += revenue;
      existing.resolvedRevenue += revenue;
      existing.cost += repair.totalCost?.toNumber() ?? 0;
      existing.profit += repair.totalProfit?.toNumber() ?? 0;
      byCategory.set(categoryId, existing);
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
  private async reportSalesBySeller(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const filter = this.dateRangeFilter(range);

    const [sales, orders, repairs] = await Promise.all([
      this.prisma.sale.findMany({
        where: { status: 'COMPLETED', ...(filter ? { soldAt: filter } : {}) },
        select: {
          staffId: true,
          totalAmount: true,
          staff: { select: { firstName: true, lastName: true } },
          lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true } },
        },
      }),
      this.prisma.order.findMany({
        where: { status: { in: [...ORDER_RECOGNIZED_STATUSES] }, ...(filter ? { deliveredAt: filter } : {}) },
        select: { totalAmount: true, lines: { select: { resolvedPrice: true, unitPrice: true, quantity: true } } },
      }),
      this.prisma.repair.findMany({
        where: { status: REPAIR_RECOGNIZED_STATUS, ...(filter ? { pickedUpAt: filter } : {}) },
        select: { id: true, totalAmount: true },
      }),
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
        existing.revenue += order.totalAmount.toNumber();
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

  private async reportStockMovements(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const createdAtFilter = this.dateRangeFilter(range);
    const groups = await this.prisma.stockMovement.groupBy({
      by: ['type'],
      ...(createdAtFilter ? { where: { createdAt: createdAtFilter } } : {}),
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
  // money view (totals, dated by pickedUpAt: what was actually recognised — D8). Every row's
  // revenue/cost/profit is 0 except PICKED_UP's, since nothing is recognised earlier; a row's
  // `totalAmount` (parts+labour accrued so far) is kept distinct from `revenue` for exactly that
  // reason — they coincide only for PICKED_UP.
  private async reportRepairs(range: { from?: Date; to?: Date }): Promise<ReportDto> {
    const intakeAtFilter = this.dateRangeFilter(range);
    const groups = await this.prisma.repair.groupBy({
      by: ['status'],
      ...(intakeAtFilter ? { where: { intakeAt: intakeAtFilter } } : {}),
      _count: { _all: true },
      _sum: { totalAmount: true, totalCost: true, totalProfit: true },
    });

    const rows = groups.map((g) => ({
      status: g.status,
      count: g._count._all,
      totalAmount: g._sum.totalAmount?.toNumber() ?? 0,
      revenue: g.status === REPAIR_RECOGNIZED_STATUS ? (g._sum.totalAmount?.toNumber() ?? 0) : 0,
      cost: g.status === REPAIR_RECOGNIZED_STATUS ? (g._sum.totalCost?.toNumber() ?? 0) : 0,
      profit: g.status === REPAIR_RECOGNIZED_STATUS ? (g._sum.totalProfit?.toNumber() ?? 0) : 0,
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

  // S14/F6 — "purchased" now unions SaleLine, completed-OrderLine and picked-up-RepairPart (was
  // SaleLine alone), so a product bought via an order or fitted in a repair correctly leaves the
  // "viewed but never purchased" set. Deliberately no date filter on the purchased-set queries
  // (unchanged from before S14) — "ever purchased" is a lifetime fact, not scoped to `range`.
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
      this.prisma.saleLine.findMany({ select: { productId: true }, distinct: ['productId'] }),
      this.prisma.orderLine.findMany({ select: { productId: true }, distinct: ['productId'] }),
      this.prisma.repairPart.findMany({ select: { productId: true }, distinct: ['productId'] }),
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

  private toCsvExport(type: ReportType, dto: ReportDto): ExportResult {
    const headers = dto.rows.length > 0 ? Object.keys(dto.rows[0]!) : [];
    const lines = [headers.join(',')];
    for (const row of dto.rows) {
      lines.push(headers.map((header) => JSON.stringify((row as Record<string, unknown>)[header] ?? '')).join(','));
    }
    return { filename: `${type}.csv`, mime: 'text/csv', body: lines.join('\n') };
  }
}
