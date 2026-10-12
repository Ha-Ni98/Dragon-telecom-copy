import { z } from "zod";
import { ReturnType as SaleReturnType } from "@dragon-telecom/contract";
import type { ReturnWholeSaleCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";
import { sameMoney } from "@/lib/settlement";

// S32 (P2) — aligned to ReturnWholeSaleCommand: one refund figure for every remaining line. Same
// rules as create-return.schema.ts: the refund starts EMPTY (optional on input, required on
// output — 3-generic useForm, never z.preprocess), 0 is allowed, and a walk-in sale must refund
// exactly the remaining goods' sold value (`dueTotal`). An attached client's difference is
// confirmed in the dialog, not here.
export function returnWholeSaleSchema(
  t: ReturnType<typeof useTranslation>["t"],
  dueTotal: number,
  hasClient: boolean,
) {
  return z
    .object({
      saleId: z.uuid(),
      type: z.enum(SaleReturnType),
      reason: z.string().optional(),
      refundAmount: z.number().min(0, t("admin.sales.returnDialog.refundAmountInvalid")).optional(),
      lines: z
        .array(z.object({ saleLineId: z.uuid(), restock: z.boolean() }))
        .min(1, t("admin.sales.returnDialog.linesRequired")),
    })
    .superRefine((d, ctx) => {
      if (d.refundAmount == null) {
        ctx.addIssue({
          code: "custom",
          message: t("admin.sales.returnDialog.refundRequired"),
          path: ["refundAmount"],
        });
      } else if (!hasClient && !sameMoney(d.refundAmount, dueTotal)) {
        ctx.addIssue({
          code: "custom",
          message: t("admin.sales.returnDialog.walkInRefundMustMatch"),
          path: ["refundAmount"],
        });
      }
    })
    .transform((d) => ({ ...d, refundAmount: d.refundAmount ?? 0 }));
}

export type ReturnWholeSaleFormInput = z.input<ReturnType<typeof returnWholeSaleSchema>>;
export type ReturnWholeSaleFormValues = z.output<ReturnType<typeof returnWholeSaleSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract Command.
type AssertAssignable<T extends true> = T;
type _ReturnWholeSaleCommandCheck = AssertAssignable<
  ReturnWholeSaleFormValues extends ReturnWholeSaleCommand ? true : false
>;
