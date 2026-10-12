import { z } from 'zod';
import { CashRegisterDrill, ChartType, ReportFormat, ReportType, RevenueSource } from './statistics.enums';

export const FilteredQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
  source: z.enum(RevenueSource).optional(), // S24 — omitted means ALL
});
export type FilteredQuery = z.infer<typeof FilteredQuerySchema>;

export const ChartsQuerySchema = z.object({
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  familyId: z.uuid().optional(),
  source: z.enum(RevenueSource).optional(), // S24 — omitted means ALL
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

// S33 — one store-local (Africa/Algiers) day; omitted means today. Every section reads the same
// storeDayRangeUtc(date, date) bounds.
export const CashRegisterQuerySchema = z.object({
  date: z.iso.date().optional(),
});
export type CashRegisterQuery = z.infer<typeof CashRegisterQuerySchema>;

// S33 — one drill-through list of the Caisse: the documents behind one headline figure, filtered
// exactly as that figure is. Bounded page (max 100).
export const CashRegisterDocumentsQuerySchema = z.object({
  date: z.iso.date().optional(),
  drill: z.enum(CashRegisterDrill),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type CashRegisterDocumentsQuery = z.infer<typeof CashRegisterDocumentsQuerySchema>;
