import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Prisma } from '@prisma/client';
import { ReportFormat, ReportType } from '@dragon-telecom/contract';
import { StatisticsService } from '../../../../src/modules/statistics/statistics.service';

const {
  saleAggregateMock,
  orderAggregateMock,
  orderCountMock,
  productFindManyMock,
  posClientAggregateMock,
  supplierAggregateMock,
  saleLineFindManyMock,
  repairFindManyMock,
  repairGroupByMock,
  saleGroupByMock,
  staffFindManyMock,
  clientFindManyMock,
  clientCountMock,
  orderFindManyMock,
  saleFindManyMock,
} = vi.hoisted(() => ({
  saleAggregateMock: vi.fn(),
  orderAggregateMock: vi.fn(),
  orderCountMock: vi.fn(),
  productFindManyMock: vi.fn(),
  posClientAggregateMock: vi.fn(),
  supplierAggregateMock: vi.fn(),
  saleLineFindManyMock: vi.fn(),
  repairFindManyMock: vi.fn(),
  repairGroupByMock: vi.fn(),
  saleGroupByMock: vi.fn(),
  staffFindManyMock: vi.fn(),
  clientFindManyMock: vi.fn(),
  clientCountMock: vi.fn(),
  orderFindManyMock: vi.fn(),
  saleFindManyMock: vi.fn(),
}));

const prismaMock = {
  sale: { aggregate: saleAggregateMock, groupBy: saleGroupByMock, findMany: saleFindManyMock },
  order: { aggregate: orderAggregateMock, count: orderCountMock, findMany: orderFindManyMock },
  product: { findMany: productFindManyMock },
  posClient: { aggregate: posClientAggregateMock },
  supplier: { aggregate: supplierAggregateMock },
  saleLine: { findMany: saleLineFindManyMock },
  repair: { findMany: repairFindManyMock, groupBy: repairGroupByMock },
  staff: { findMany: staffFindManyMock },
  client: { findMany: clientFindManyMock, count: clientCountMock },
};

describe('StatisticsService', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  const service = () => new StatisticsService(prismaMock as never);

  describe('getOverview', () => {
    it('sums profit from stored Sale.totalProfit + Order.profit (no FIFO recomputation)', async () => {
      saleAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(5000), totalProfit: new Prisma.Decimal(1200) } });
      orderAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(2000), profit: new Prisma.Decimal(400) } });
      productFindManyMock.mockResolvedValueOnce([{ quantityOnHand: 10, averageCost: new Prisma.Decimal(500) }]);
      posClientAggregateMock.mockResolvedValueOnce({ _sum: { credit: new Prisma.Decimal(300) } });
      supplierAggregateMock.mockResolvedValueOnce({ _sum: { credit: new Prisma.Decimal(150) } });

      const dto = await service().getOverview();

      expect(dto.totalRevenue).toBe(7000); // 5000 + 2000
      expect(dto.totalProfit).toBe(1600); // 1200 + 400
      expect(dto.stockValue).toBe(5000); // 10 * 500
      expect(dto.totalClientCredit).toBe(300);
      expect(dto.totalSupplierCredit).toBe(150);
    });

    it('never reads the Repair table directly — a repair sale is counted once, via its own Sale row', async () => {
      saleAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(1000), totalProfit: new Prisma.Decimal(300) } });
      orderAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } });
      productFindManyMock.mockResolvedValueOnce([]);
      posClientAggregateMock.mockResolvedValueOnce({ _sum: { credit: null } });
      supplierAggregateMock.mockResolvedValueOnce({ _sum: { credit: null } });

      await service().getOverview();

      expect(repairFindManyMock).not.toHaveBeenCalled();
      expect(repairGroupByMock).not.toHaveBeenCalled();
      // The Sale aggregate has no origin filter — a REPAIR-origin COMPLETED sale is summed
      // exactly like a POS one, and the Repair row itself is never separately added.
      expect(saleAggregateMock).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ status: 'COMPLETED' }) }));
    });

    it('defaults every aggregate to 0 when nothing is stored yet', async () => {
      saleAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: null, totalProfit: null } });
      orderAggregateMock.mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } });
      productFindManyMock.mockResolvedValueOnce([]);
      posClientAggregateMock.mockResolvedValueOnce({ _sum: { credit: null } });
      supplierAggregateMock.mockResolvedValueOnce({ _sum: { credit: null } });

      const dto = await service().getOverview();

      expect(dto).toEqual({ totalRevenue: 0, totalProfit: 0, stockValue: 0, totalClientCredit: 0, totalSupplierCredit: 0 });
    });
  });

  describe('getFiltered', () => {
    it('guards against an empty previous period — 0% change, never divide-by-zero', async () => {
      saleAggregateMock
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(1000), totalProfit: new Prisma.Decimal(200) } }) // current
        .mockResolvedValueOnce({ _sum: { totalAmount: null, totalProfit: null } }); // previous (empty)
      orderAggregateMock
        .mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } });
      orderCountMock.mockResolvedValueOnce(3).mockResolvedValueOnce(0);

      const dto = await service().getFiltered({ from: '2026-01-01', to: '2026-01-31' });

      expect(dto.revenue).toBe(1000);
      expect(dto.revenueChangePct).toBe(0);
      expect(dto.profitChangePct).toBe(0);
      expect(dto.ordersChangePct).toBe(0);
    });

    it('computes a real percentage change against a non-empty previous period', async () => {
      saleAggregateMock
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(1500), totalProfit: new Prisma.Decimal(300) } })
        .mockResolvedValueOnce({ _sum: { totalAmount: new Prisma.Decimal(1000), totalProfit: new Prisma.Decimal(200) } });
      orderAggregateMock
        .mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } })
        .mockResolvedValueOnce({ _sum: { totalAmount: null, profit: null } });
      orderCountMock.mockResolvedValueOnce(5).mockResolvedValueOnce(4);

      const dto = await service().getFiltered({ from: '2026-01-01', to: '2026-01-31' });

      expect(dto.revenueChangePct).toBe(50); // (1500-1000)/1000 * 100
      expect(dto.ordersChangePct).toBe(25); // (5-4)/4 * 100
    });
  });

  describe('getReport — discount column', () => {
    it('sales-by-seller: discount matches the sum of (resolvedPrice − unitPrice) × qty across a seller\'s lines', async () => {
      const STAFF_ID = '11111111-1111-4111-8111-111111111111';
      saleFindManyMock.mockResolvedValueOnce([
        {
          staffId: STAFF_ID,
          totalAmount: new Prisma.Decimal(1800),
          staff: { firstName: 'Amina', lastName: 'Belkacem' },
          lines: [
            { resolvedPrice: new Prisma.Decimal(1000), unitPrice: new Prisma.Decimal(900), quantity: 1 }, // 100 discount
            { resolvedPrice: new Prisma.Decimal(500), unitPrice: new Prisma.Decimal(450), quantity: 2 }, // 100 discount
          ],
        },
      ]);

      const result = await service().getReport(ReportType.SALES_BY_SELLER, {});
      const dto = result as Extract<typeof result, { rows: unknown[] }>;

      expect(dto.rows).toEqual([{ staffId: STAFF_ID, staffName: 'Amina Belkacem', revenue: 1800, discount: 200 }]);
      expect(dto.totals.totalDiscount).toBe(200);
    });
  });

  describe('getReport — CSV export', () => {
    it('streams the same rows the JSON response carries', async () => {
      saleLineFindManyMock.mockResolvedValueOnce([
        { productId: 'p1', productNameSnapshot: 'Screen', quantity: 2, lineTotal: new Prisma.Decimal(1000) },
      ]);

      const jsonResult = await service().getReport(ReportType.SALES_BY_PRODUCT, {});
      const jsonDto = jsonResult as Extract<typeof jsonResult, { rows: unknown[] }>;

      saleLineFindManyMock.mockResolvedValueOnce([
        { productId: 'p1', productNameSnapshot: 'Screen', quantity: 2, lineTotal: new Prisma.Decimal(1000) },
      ]);
      const csvResult = await service().getReport(ReportType.SALES_BY_PRODUCT, { format: ReportFormat.CSV });
      const csvExport = csvResult as Extract<typeof csvResult, { mime: string }>;

      expect(csvExport.mime).toBe('text/csv');
      const csvLines = (csvExport.body as string).split('\n');
      expect(csvLines).toHaveLength(jsonDto.rows.length + 1); // header + one data row
      expect(csvLines[0]).toBe(Object.keys(jsonDto.rows[0]!).join(','));
    });
  });

  describe('getStaffDashboard — leak test', () => {
    it('scopes mySalesToday/myRevenueToday/myDrafts by staffId, and never reads other staff rows for those fields', async () => {
      const STAFF_ID = '22222222-2222-4222-8222-222222222222';
      saleFindManyMock.mockResolvedValueOnce([{ totalAmount: new Prisma.Decimal(500) }]); // mySalesToday
      saleFindManyMock.mockResolvedValueOnce([]); // myDrafts
      orderCountMock.mockResolvedValueOnce(7); // global pending orders — the one non-scoped field, by design
      productFindManyMock.mockResolvedValueOnce([]);

      const dto = await service().getStaffDashboard(STAFF_ID);

      expect(saleFindManyMock).toHaveBeenNthCalledWith(1, expect.objectContaining({ where: expect.objectContaining({ staffId: STAFF_ID }) }));
      expect(saleFindManyMock).toHaveBeenNthCalledWith(2, expect.objectContaining({ where: expect.objectContaining({ staffId: STAFF_ID }) }));
      expect(dto.mySalesToday).toBe(1);
      expect(dto.myRevenueToday).toBe(500);
      // myPendingOrdersCount is the documented exception (orders have no owner staff) —
      // everything else above is genuinely staffId-scoped.
      expect(dto.myPendingOrdersCount).toBe(7);
    });
  });
});
