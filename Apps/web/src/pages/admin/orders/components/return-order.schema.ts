import { z } from "zod";
import type { ReturnOrderCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ReturnOrderCommand (orders.command.ts). Admin-only (ADM-09 §Forms). D1 (S9) — an
// order is now multi-line, so the return command carries one quantity per OrderLine; `lines` is
// the order's own lines (known client-side in the return dialog — unlike the public order form,
// which deliberately has no client-side stock bound) so each line gets its own `.max()` bound
// enforced locally. The backend validates the same bound again.
//
// z.coerce.number() (not `valueAsNumber: true`) — an empty numeric input with `valueAsNumber`
// resolves to NaN before zod ever sees it (report-S03.md's finding); coerce is this codebase's
// settled fix.
export function returnOrderSchema(
  t: ReturnType<typeof useTranslation>["t"],
  lines: { id: string; quantity: number }[],
) {
  const maxById = new Map(lines.map((line) => [line.id, line.quantity]));
  return z.object({
    lines: z
      .array(
        z.object({
          orderLineId: z.string().min(1),
          quantity: z.coerce.number().int().min(1, t("admin.orders.returnDialog.quantityMin")),
        }),
      )
      .min(1)
      .superRefine((value, ctx) => {
        value.forEach((line, index) => {
          const max = maxById.get(line.orderLineId);
          if (max !== undefined && line.quantity > max) {
            ctx.addIssue({
              code: "custom",
              message: t("admin.orders.returnDialog.quantityExceedsOrdered"),
              path: [index, "quantity"],
            });
          }
        });
      }),
    restock: z.boolean(),
    refundAmount: z.coerce.number().min(0, t("admin.orders.returnDialog.refundAmountInvalid")),
  });
}

export type ReturnOrderFormValues = z.infer<ReturnType<typeof returnOrderSchema>>;

// 3-generic form: useForm<ReturnOrderFormInput, unknown, ReturnOrderFormValues>() — z.coerce's
// input type is `unknown`, which zodResolver can't reconcile against a plain single-generic
// useForm<ReturnOrderFormValues> (supplier.schema.ts's optionalEmail comment documents the same
// zodResolver input-type-inference gotcha; register.schema.ts is this codebase's existing
// 3-generic precedent).
export type ReturnOrderFormInput = z.input<ReturnType<typeof returnOrderSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _ReturnOrderCommandCheck = AssertAssignable<
  ReturnOrderFormValues extends ReturnOrderCommand ? true : false
>;
