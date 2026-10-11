import { z } from "zod";
import { ReturnType as SaleReturnType } from "@dragon-telecom/contract";
import type { CreateReturnCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";
import { sameMoney } from "@/lib/settlement";

// Aligned to CreateReturnCommand (sales.command.ts). Contract's `ReturnType` enum is aliased to
// avoid shadowing TypeScript's built-in `ReturnType<T>` utility used below. `lineBounds` maps
// saleLineId -> (sold − already returned) so each line's quantity can be bound locally ("per-line
// qty ≤ sold − already returned", ADM-10 §UI); the backend re-validates the same bound.
// S32 — each line's refund starts EMPTY (optional on input, required on output via the refine +
// transform below — the codebase's 3-generic useForm precedent, never z.preprocess). A walk-in
// sale (`hasClient` false) must refund exactly unitPrice × quantity per line (`linePrices`); for
// an attached client any difference is allowed, and the dialog confirms the credit change first.
export function createReturnSchema(
  t: ReturnType<typeof useTranslation>["t"],
  lineBounds: Record<string, number>,
  linePrices: Record<string, number>,
  hasClient: boolean,
) {
  return z
    .object({
      saleId: z.uuid(),
      type: z.enum(SaleReturnType),
      reason: z.string().optional(),
      lines: z
        .array(
          z.object({
            saleLineId: z.uuid(),
            quantity: z.number().int().min(1, t("admin.sales.returnDialog.quantityMin")),
            restock: z.boolean(),
            refundAmount: z
              .number()
              .min(0, t("admin.sales.returnDialog.refundAmountInvalid"))
              .optional(),
          }),
        )
        .min(1, t("admin.sales.returnDialog.linesRequired")),
    })
    .superRefine((d, ctx) => {
      d.lines.forEach((line, index) => {
        const bound = lineBounds[line.saleLineId];
        if (bound !== undefined && line.quantity > bound) {
          ctx.addIssue({
            code: "custom",
            message: t("admin.sales.returnDialog.quantityExceedsRemaining"),
            path: ["lines", index, "quantity"],
          });
        }
        if (line.refundAmount == null) {
          ctx.addIssue({
            code: "custom",
            message: t("admin.sales.returnDialog.refundRequired"),
            path: ["lines", index, "refundAmount"],
          });
        } else if (
          !hasClient &&
          !sameMoney(line.refundAmount, (linePrices[line.saleLineId] ?? 0) * line.quantity)
        ) {
          ctx.addIssue({
            code: "custom",
            message: t("admin.sales.returnDialog.walkInRefundMustMatch"),
            path: ["lines", index, "refundAmount"],
          });
        }
      });
    })
    .transform((d) => ({
      ...d,
      lines: d.lines.map((line) => ({ ...line, refundAmount: line.refundAmount ?? 0 })),
    }));
}

export type CreateReturnFormInput = z.input<ReturnType<typeof createReturnSchema>>;
export type CreateReturnFormValues = z.output<ReturnType<typeof createReturnSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateReturnCommandCheck = AssertAssignable<
  CreateReturnFormValues extends CreateReturnCommand ? true : false
>;
