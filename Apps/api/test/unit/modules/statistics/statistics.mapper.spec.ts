import { describe, it, expect } from 'vitest';
import { Prisma } from '@prisma/client';
import { StatisticsMapper } from '../../../../src/modules/statistics/statistics.mapper';

const now = new Date('2026-01-02T00:00:00.000Z');
const PRODUCT_ID = '11111111-1111-4111-8111-111111111111';
const ORDER_ID = '22222222-2222-4222-8222-222222222222';
const CLIENT_ID = '33333333-3333-4333-8333-333333333333';
const STAFF_ID = '44444444-4444-4444-8444-444444444444';

describe('StatisticsMapper.toLowStockItem', () => {
  it('computes availableQuantity as quantityOnHand minus quantityReserved', () => {
    const item = StatisticsMapper.toLowStockItem({
      id: PRODUCT_ID,
      name: 'Screen Protector',
      quantityOnHand: 10,
      quantityReserved: 3,
      reorderThreshold: 5,
    });

    expect(item.productId).toBe(PRODUCT_ID);
    expect(item.availableQuantity).toBe(7);
    expect(item.reorderThreshold).toBe(5);
  });
});

describe('StatisticsMapper.toDashboardOrderSummary / toDashboardClientSummary', () => {
  it('shapes an order summary with Decimal→number and Date→ISO', () => {
    const summary = StatisticsMapper.toDashboardOrderSummary({
      id: ORDER_ID,
      reference: 'ORD-2026-0001',
      totalAmount: new Prisma.Decimal(1500),
      placedAt: now,
    });

    expect(summary).toEqual({ id: ORDER_ID, reference: 'ORD-2026-0001', totalAmount: 1500, placedAt: now.toISOString() });
  });

  it('shapes a client summary with Date→ISO', () => {
    const summary = StatisticsMapper.toDashboardClientSummary({ id: CLIENT_ID, fullName: 'Karim Belkacem', createdAt: now });

    expect(summary).toEqual({ id: CLIENT_ID, fullName: 'Karim Belkacem', createdAt: now.toISOString() });
  });
});

describe('StatisticsMapper.toTopProductDto / toChartPoints', () => {
  it('converts Decimal revenue to a plain number', () => {
    const dto = StatisticsMapper.toTopProductDto({
      productId: PRODUCT_ID,
      productName: 'Screen Protector',
      brandName: 'Dragon',
      familyName: 'Screen Protectors',
      quantitySold: 12,
      revenue: new Prisma.Decimal(6000),
    });

    expect(dto.revenue).toBe(6000);
    expect(dto.quantitySold).toBe(12);
  });

  it('computes averagePrice as revenue / quantitySold (audit fix B4)', () => {
    const dto = StatisticsMapper.toTopProductDto({
      productId: PRODUCT_ID,
      productName: 'Screen Protector',
      brandName: 'Dragon',
      familyName: 'Screen Protectors',
      quantitySold: 4,
      revenue: 2000,
    });

    expect(dto.averagePrice).toBe(500);
  });

  it('guards against divide-by-zero: quantitySold 0 yields averagePrice 0', () => {
    const dto = StatisticsMapper.toTopProductDto({
      productId: PRODUCT_ID,
      productName: 'Screen Protector',
      brandName: 'Dragon',
      familyName: 'Screen Protectors',
      quantitySold: 0,
      revenue: 0,
    });

    expect(dto.averagePrice).toBe(0);
  });

  it('carries brandName/familyName/imageUrl when a primary image exists', () => {
    const dto = StatisticsMapper.toTopProductDto({
      productId: PRODUCT_ID,
      productName: 'Screen Protector',
      brandName: 'Dragon',
      familyName: 'Screen Protectors',
      quantitySold: 1,
      revenue: 500,
      imageUrl: 'https://cdn.example.com/screen-protector.jpg',
    });

    expect(dto.brandName).toBe('Dragon');
    expect(dto.familyName).toBe('Screen Protectors');
    expect(dto.imageUrl).toBe('https://cdn.example.com/screen-protector.jpg');
  });

  it('omits imageUrl entirely when the product has no image', () => {
    const dto = StatisticsMapper.toTopProductDto({
      productId: PRODUCT_ID,
      productName: 'Screen Protector',
      brandName: 'Dragon',
      familyName: 'Screen Protectors',
      quantitySold: 1,
      revenue: 500,
    });

    expect(dto).not.toHaveProperty('imageUrl');
  });

  it('validates chart points against ReportDto.chart\'s own shape', () => {
    const points = StatisticsMapper.toChartPoints([{ label: '2026-01', value: 1000 }]);
    expect(points).toEqual([{ label: '2026-01', value: 1000 }]);
  });
});

describe('StatisticsMapper.toReportDto', () => {
  it('preserves the drill { entity, idField } through .parse', () => {
    const dto = StatisticsMapper.toReportDto({
      chart: [{ label: 'Jan', value: 100 }],
      rows: [{ productId: PRODUCT_ID, total: 100 }],
      totals: { total: 100 },
      drill: { entity: 'order', idField: 'orderId' },
    });

    expect(dto.drill).toEqual({ entity: 'order', idField: 'orderId' });
    expect(dto.rows).toEqual([{ productId: PRODUCT_ID, total: 100 }]);
  });

  it('never throws on a valid input (conformance guard)', () => {
    expect(() =>
      StatisticsMapper.toReportDto({ chart: [], rows: [], totals: {}, drill: { entity: 'order', idField: 'id' } }),
    ).not.toThrow();
  });
});

describe('StatisticsMapper.toOverviewDto / toFilteredDto', () => {
  it('never throws on valid overview input', () => {
    expect(() =>
      StatisticsMapper.toOverviewDto({
        totalRevenue: 10000,
        totalProfit: 3000,
        stockValue: 50000,
        totalClientCredit: 2000,
        totalSupplierCredit: 1000,
      }),
    ).not.toThrow();
  });

  it('never throws on valid filtered input', () => {
    expect(() =>
      StatisticsMapper.toFilteredDto({
        revenue: 5000,
        profit: 1500,
        orders: 10,
        revenueChangePct: 12.5,
        profitChangePct: -3.2,
        ordersChangePct: 0,
      }),
    ).not.toThrow();
  });
});

describe('StatisticsMapper.toAdminDashboardDto', () => {
  const baseStats = {
    totalClients: 10,
    totalProducts: 20,
    ordersThisWeek: 5,
    revenueThisMonth: 10000,
    totalClientsChangePct: 1,
    totalProductsChangePct: 2,
    ordersThisWeekChangePct: 3,
    revenueThisMonthChangePct: 4,
  };

  it('assembles every section and never throws (conformance guard)', () => {
    const dto = StatisticsMapper.toAdminDashboardDto({
      stats: baseStats,
      pendingOrders: [{ id: ORDER_ID, reference: 'ORD-2026-0001', totalAmount: new Prisma.Decimal(1000), placedAt: now }],
      pendingClients: [{ id: CLIENT_ID, fullName: 'Karim', createdAt: now }],
      recentOrders: [],
      recentClients: [],
      lowStockProducts: [{ id: PRODUCT_ID, name: 'Screen', quantityOnHand: 2, quantityReserved: 0, reorderThreshold: 5 }],
      repairsByStatus: { INTAKE: 3, PROCESSING: 1 },
      draftSalesByStaff: [{ staffId: STAFF_ID, staffName: 'Amina Belkacem', draftCount: 2 }],
    });

    expect(dto.stats).toEqual(baseStats);
    expect(dto.pendingOrders[0]?.totalAmount).toBe(1000);
    expect(dto.lowStockProducts[0]?.availableQuantity).toBe(2);
    expect(dto.repairsByStatus).toEqual({ INTAKE: 3, PROCESSING: 1 });
    expect(dto.draftSalesByStaff).toEqual([{ staffId: STAFF_ID, staffName: 'Amina Belkacem', draftCount: 2 }]);
  });
});

describe('StatisticsMapper.toStaffDashboardDto', () => {
  it('assembles myDrafts and lowStock, omitting myPendingOrdersCount when absent', () => {
    const dto = StatisticsMapper.toStaffDashboardDto({
      mySalesToday: 3,
      myRevenueToday: 4500,
      myDrafts: [{ reference: 'SAL-DRAFT-1', total: new Prisma.Decimal(1200), ageHours: 2 }],
      lowStock: [{ id: PRODUCT_ID, name: 'Screen', quantityOnHand: 1, quantityReserved: 0, reorderThreshold: 5 }],
    });

    expect(dto).not.toHaveProperty('myPendingOrdersCount');
    expect(dto.myDrafts[0]?.total).toBe(1200);
    expect(dto.myDrafts[0]).not.toHaveProperty('clientName');
    expect(dto.lowStock[0]?.availableQuantity).toBe(1);
  });

  it('includes myPendingOrdersCount and myDrafts.clientName when present', () => {
    const dto = StatisticsMapper.toStaffDashboardDto({
      mySalesToday: 0,
      myRevenueToday: 0,
      myDrafts: [{ reference: 'SAL-DRAFT-1', clientName: 'Karim Store', total: 500, ageHours: 1 }],
      myPendingOrdersCount: 4,
      lowStock: [],
    });

    expect(dto.myPendingOrdersCount).toBe(4);
    expect(dto.myDrafts[0]?.clientName).toBe('Karim Store');
  });
});
