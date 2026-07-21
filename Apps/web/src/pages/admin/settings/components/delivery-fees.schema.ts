import { z } from "zod";
import type { UpsertFeesCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to UpsertFeesCommand (platform.command.ts). Backs the manual per-row edit form; the
// Excel import path (`excel-file-uploader` + dry-run report, ADM-17 §3) parses rows into this
// same shape before the dry-run/apply mutation, so both paths validate identically.
export function deliveryFeesSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    rows: z.array(
      z.object({
        wilayaId: z.uuid(t("common.validation.selectRequired")),
        communeId: z.uuid().nullable().optional(),
        deliveryHome: z.number().min(0, t("common.validation.nonNegativeNumber")),
        deliveryOffice: z.number().min(0, t("common.validation.nonNegativeNumber")),
      }),
    ),
  });
}

export type DeliveryFeesFormValues = z.infer<ReturnType<typeof deliveryFeesSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpsertFeesCommandCheck = AssertAssignable<
  DeliveryFeesFormValues extends UpsertFeesCommand ? true : false
>;
