import { z } from "zod";
import { DocType } from "@dragon-telecom/contract";
import type { UpdateSettingsCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to the `invoicing` section of UpdateSettingsCommand (platform.command.ts). Lowering
// a next-sequence is a backend 409 (SEQUENCE_DECREASE_FORBIDDEN) — not contract-enforceable
// without reading current state, so it surfaces as an inline banner at the call site (ADM-17
// §4), not a Zod refine here.
export function invoicingSettingsSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    prefixes: z.record(z.enum(DocType), z.string()).optional(),
    nextSequences: z
      .record(z.enum(DocType), z.number().int().min(0, t("common.validation.nonNegativeNumber")))
      .optional(),
    footerNote: z.string().optional(),
  });
}

export type InvoicingSettingsFormValues = z.infer<ReturnType<typeof invoicingSettingsSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command's `invoicing` section.
type AssertAssignable<T extends true> = T;
type _InvoicingSettingsCommandCheck = AssertAssignable<
  InvoicingSettingsFormValues extends NonNullable<UpdateSettingsCommand["invoicing"]> ? true : false
>;
