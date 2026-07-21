import { z } from "zod";
import type { AdminUpdateClientCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to AdminUpdateClientCommand (clients.command.ts — "ADMIN_UPDATE route note: contact,
// isEnabled"). Replaces the stub `clientModificationSchema`, which conflated registration-
// approval fields (status/username/password/category) that now belong to `ApproveClientCommand`/
// `RejectClientCommand` (Sprint 1's `approve-client.schema.ts`, wired in Sprint 7's dedicated
// approval-dialog) — this dialog is contact-info + enable/disable only.
//
// `email`'s `z.literal("")` branch (same fix as Sprint 6's `supplier.schema.ts`) — the dialog's
// controlled `<Input>` defaults to `client.email ?? ""`, and `z.email().optional()` only skips
// its format check for `undefined`, not an empty string.
export function updateClientSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    email: z.union([z.literal(""), z.email(t("common.validation.invalidEmail"))]).optional(),
    storeName: z.string().optional(),
    address: z.string().optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type UpdateClientFormValues = z.infer<ReturnType<typeof updateClientSchema>>;

type AssertAssignable<T extends true> = T;
type _AdminUpdateClientCommandCheck = AssertAssignable<
  UpdateClientFormValues extends AdminUpdateClientCommand ? true : false
>;
