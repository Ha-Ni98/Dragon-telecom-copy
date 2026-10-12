import { z } from "zod";

// S30 — the return dialog's form. One row per fitted part; `restock` defaults to true (sales'
// ReturnDialog precedent). Mapped to ReturnRepairCommand by RepairReturnDialog on submit
// (restockPartIds = the parts left switched on) — the shapes differ on purpose, so there is no
// AssertAssignable guard against the contract command here. No refund field: the return reverses
// every payment in full (owner decision Q4), so there is nothing to validate but the shape.
export const returnRepairSchema = z.object({
  parts: z.array(z.object({ partId: z.uuid(), restock: z.boolean() })),
  note: z.string().optional(),
});

export type ReturnRepairFormValues = z.infer<typeof returnRepairSchema>;
