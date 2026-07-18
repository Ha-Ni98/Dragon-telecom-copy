import type {
  AdminDashboardDto,
  ChartsQuery,
  ChartType,
  FilteredDto,
  FilteredQuery,
  OverviewDto,
  ReportDto,
  ReportQuery,
  ReportType,
  StaffDashboardDto,
  TopProductsQuery,
} from '@dragon-telecom/contract';
import type { ChartPoint, TopProductDto } from './statistics.mapper';

// Mirrors inventory/platform/billing's own local ExportResult shape — never a contract DTO,
// since CSV/PDF bypass the ApiResponse envelope entirely (rules §4, the CSV-streaming
// exception already established for REPORT's format=csv branch).
export type ExportResult = { filename: string; mime: string; body: Buffer | string };

export interface IStatisticsService {
  getAdminDashboard(): Promise<AdminDashboardDto>;
  // Strictly staffId=me — never a global read (spec BL#5).
  getStaffDashboard(staffId: string): Promise<StaffDashboardDto>;
  getOverview(): Promise<OverviewDto>;
  // + % vs. the immediately-preceding equal-length period.
  getFiltered(query: FilteredQuery): Promise<FilteredDto>;
  // No dedicated contract schema for CHARTS — reuses ReportDto.chart's own shape
  // (statistics.mapper.ts's ChartPoint, extracted via ReportResponseSchema.shape.chart).
  getChart(chart: ChartType, query: ChartsQuery): Promise<ChartPoint[]>;
  // No contract schema for TOP_PRODUCTS at all — a locally-declared TopProductDto
  // (statistics.mapper.ts), same "fill a genuine gap without touching the contract"
  // precedent as orders' CancelOrderCommand.
  getTopProducts(query: TopProductsQuery): Promise<TopProductDto[]>;
  // table+chart JSON, or a CSV export (format=csv streams the same rows).
  getReport(type: ReportType, query: ReportQuery): Promise<ReportDto | ExportResult>;
}
