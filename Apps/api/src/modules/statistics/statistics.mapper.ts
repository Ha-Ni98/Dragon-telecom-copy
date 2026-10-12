import type { Prisma, Product } from '@prisma/client';
import { z } from 'zod';
import {
  AdminDashboardResponseSchema,
  CashRegisterResponseSchema,
  FilteredResponseSchema,
  OverviewResponseSchema,
  ReportResponseSchema,
  StaffDashboardResponseSchema,
  type AdminDashboardDto,
  type CashRegisterDto,
  type FilteredDto,
  type OverviewDto,
  type ReportDto,
  type StaffDashboardDto,
} from '@dragon-telecom/contract';

type Money = Prisma.Decimal | number;

// No entity owns statistics' aggregate DTOs (plan §D-6) — these row shapers are the repeatable
// pieces the service (Sprint 8) assembles from several tables; query composition stays there.
export type DashboardOrderSummaryRow = { id: string; reference: string; totalAmount: Money; placedAt: Date };
export type DashboardClientSummaryRow = { id: string; fullName: string; createdAt: Date };
export type LowStockRow = Pick<Product, 'id' | 'name' | 'quantityOnHand' | 'quantityReserved' | 'reorderThreshold'>;
export type DraftSaleRow = { staffId: string; staffName: string; draftCount: number };
export type MyDraftRow = { reference: string; clientName?: string; total: Money; ageHours: number };

// CHARTS (`STATS_ROUTES.CHARTS`) has no dedicated response schema anywhere in the contract —
// only `ReportDto.chart` ({label;value}[]) is the matching shape. Reused via `.shape.chart`
// (zod exposes each field's schema) rather than redeclaring the same array shape a second time.
const ChartPointsSchema = ReportResponseSchema.shape.chart;
export type ChartPoint = z.infer<typeof ChartPointsSchema>[number];

// TOP_PRODUCTS has no response shape *at all* in the contract (not even an informal field
// list, unlike AdminDashboardDto/StaffDashboardDto, which the contract stage at least flagged
// as "heavily inferred"). A local, non-contract schema — same precedent as orders' local
// CancelOrderCommand / inventory-platform's ExportResult filling a genuine contract gap
// without touching the frozen contract package. Minimal, defensible inference: products
// ranked by a sales metric, which is the conventional meaning of "top products".
// Extended to the ADM-15 page-spec shape (audit fix B4): product, brand, family, totalSold,
// revenue, averagePrice, image.
export const TopProductResponseSchema = z.object({
  productId: z.uuid(),
  productName: z.string(),
  brandName: z.string(),
  familyName: z.string(),
  quantitySold: z.number().int().min(0),
  revenue: z.number(),
  averagePrice: z.number(),
  imageUrl: z.string().optional(),
});
export type TopProductDto = z.infer<typeof TopProductResponseSchema>;
export type TopProductRow = {
  productId: string;
  productName: string;
  brandName: string;
  familyName: string;
  quantitySold: number;
  revenue: Money;
  imageUrl?: string;
};

export class StatisticsMapper {
  static toDashboardOrderSummary(row: DashboardOrderSummaryRow) {
    return {
      id: row.id,
      reference: row.reference,
      totalAmount: StatisticsMapper.toMoney(row.totalAmount),
      placedAt: row.placedAt.toISOString(),
    };
  }

  static toDashboardClientSummary(row: DashboardClientSummaryRow) {
    return { id: row.id, fullName: row.fullName, createdAt: row.createdAt.toISOString() };
  }

  // availableQuantity = quantityOnHand − quantityReserved (plan §III.1) — same formula
  // InventoryMapper.availableQuantity uses, recomputed here rather than imported (statistics
  // has no dependency on inventory's module folder).
  static toLowStockItem(product: LowStockRow) {
    return {
      productId: product.id,
      name: product.name,
      availableQuantity: product.quantityOnHand - product.quantityReserved,
      reorderThreshold: product.reorderThreshold,
    };
  }

  static toTopProductDto(row: TopProductRow): TopProductDto {
    const revenue = StatisticsMapper.toMoney(row.revenue);
    const dto: TopProductDto = {
      productId: row.productId,
      productName: row.productName,
      brandName: row.brandName,
      familyName: row.familyName,
      quantitySold: row.quantitySold,
      revenue,
      averagePrice: row.quantitySold > 0 ? revenue / row.quantitySold : 0,
      ...(row.imageUrl != null ? { imageUrl: row.imageUrl } : {}),
    };
    return TopProductResponseSchema.parse(dto);
  }

  static toChartPoints(points: { label: string; value: number }[]): ChartPoint[] {
    return ChartPointsSchema.parse(points);
  }

  static toOverviewDto(input: {
    totalRevenue: number;
    totalProfit: number;
    stockValue: number;
    totalClientCredit: number;
    totalSupplierCredit: number;
  }): OverviewDto {
    return OverviewResponseSchema.parse(input);
  }

  // S33 — the Caisse summary; every figure arrives pre-summed from SQL aggregates.
  static toCashRegisterDto(input: CashRegisterDto): CashRegisterDto {
    return CashRegisterResponseSchema.parse(input);
  }

  static toFilteredDto(input: {
    revenue: number;
    profit: number;
    orders: number;
    revenueChangePct: number;
    profitChangePct: number;
    ordersChangePct: number;
  }): FilteredDto {
    return FilteredResponseSchema.parse(input);
  }

  static toReportDto(input: {
    chart: { label: string; value: number }[];
    rows: Record<string, unknown>[];
    totals: Record<string, unknown>;
    drill: { entity: string; idField: string };
  }): ReportDto {
    return ReportResponseSchema.parse(input);
  }

  static toAdminDashboardDto(input: {
    stats: {
      totalClients: number;
      totalProducts: number;
      ordersThisWeek: number;
      revenueThisMonth: number;
      totalClientsChangePct: number;
      totalProductsChangePct: number;
      ordersThisWeekChangePct: number;
      revenueThisMonthChangePct: number;
    };
    pendingOrders: DashboardOrderSummaryRow[];
    pendingClients: DashboardClientSummaryRow[];
    recentOrders: DashboardOrderSummaryRow[];
    recentClients: DashboardClientSummaryRow[];
    lowStockProducts: LowStockRow[];
    repairsByStatus: Record<string, number>;
    draftSalesByStaff: DraftSaleRow[];
  }): AdminDashboardDto {
    const dto: AdminDashboardDto = {
      stats: input.stats,
      pendingOrders: input.pendingOrders.map(StatisticsMapper.toDashboardOrderSummary),
      pendingClients: input.pendingClients.map(StatisticsMapper.toDashboardClientSummary),
      recentOrders: input.recentOrders.map(StatisticsMapper.toDashboardOrderSummary),
      recentClients: input.recentClients.map(StatisticsMapper.toDashboardClientSummary),
      lowStockProducts: input.lowStockProducts.map(StatisticsMapper.toLowStockItem),
      repairsByStatus: input.repairsByStatus,
      draftSalesByStaff: input.draftSalesByStaff,
    };
    return AdminDashboardResponseSchema.parse(dto);
  }

  static toStaffDashboardDto(input: {
    mySalesToday: number;
    myRevenueToday: number;
    myDrafts: MyDraftRow[];
    myPendingOrdersCount?: number;
    lowStock: LowStockRow[];
  }): StaffDashboardDto {
    const dto: StaffDashboardDto = {
      mySalesToday: input.mySalesToday,
      myRevenueToday: input.myRevenueToday,
      myDrafts: input.myDrafts.map((draft) => ({
        reference: draft.reference,
        ...(draft.clientName != null ? { clientName: draft.clientName } : {}),
        total: StatisticsMapper.toMoney(draft.total),
        ageHours: draft.ageHours,
      })),
      ...(input.myPendingOrdersCount != null ? { myPendingOrdersCount: input.myPendingOrdersCount } : {}),
      lowStock: input.lowStock.map(StatisticsMapper.toLowStockItem),
    };
    return StaffDashboardResponseSchema.parse(dto);
  }

  private static toMoney(value: Money): number {
    return typeof value === 'number' ? value : value.toNumber();
  }
}
