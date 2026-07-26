import { z } from "zod";
import type { AdminCancelOrderCommand } from "@/services/orders.service";
import type { useTranslation } from "@/hooks/useTranslation";

// AdminCancelOrderCommand is a service-local view-command (orders.service.ts), not a
// contract DTO — same precedent as the rest of that file (see statistics.service.ts's own
// comment on this). Admin-only (ADM-09 §Forms), reason optional — no required message needed,
// but the factory still takes `t` for consistency with every other page schema.
export function cancelOrderSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    reason: z.string().optional(),
  });
}

export type CancelOrderFormValues = z.infer<ReturnType<typeof cancelOrderSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the service type.
type AssertAssignable<T extends true> = T;
type _AdminCancelOrderCommandCheck = AssertAssignable<
  CancelOrderFormValues extends AdminCancelOrderCommand ? true : false
>;
