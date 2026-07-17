import { z } from 'zod';
import { ChartType, ReportFormat, ReportType } from './statistics.enums';

export const FilteredQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
});
export type FilteredQuery = z.infer<typeof FilteredQuerySchema>;

export const ChartsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
});
export type ChartsQuery = z.infer<typeof ChartsQuerySchema>;

export const ChartParamsSchema = z.object({ chart: z.enum(ChartType) });
export type ChartParams = z.infer<typeof ChartParamsSchema>;

// `period`'s values are never enumerated in the spec — kept a free string rather than
// inventing values (same call as ProductSort in sprint 2).
export const TopProductsQuerySchema = z.object({
  period: z.string().optional(),
});
export type TopProductsQuery = z.infer<typeof TopProductsQuerySchema>;

// `groupBy`'s values are likewise never enumerated.
export const ReportQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  groupBy: z.string().optional(),
  format: z.enum(ReportFormat).optional(),
});
export type ReportQuery = z.infer<typeof ReportQuerySchema>;

export const ReportParamsSchema = z.object({ type: z.enum(ReportType) });
export type ReportParams = z.infer<typeof ReportParamsSchema>;
