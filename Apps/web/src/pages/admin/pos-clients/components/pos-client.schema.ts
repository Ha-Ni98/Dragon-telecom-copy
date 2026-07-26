import { z } from "zod";
import type { CreatePosClientCommand, UpdatePosClientCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreatePosClientCommand (clients.command.ts). Admin add-dialog (ADM-11 §4) — the
// staff quick-add dialog (quick-add-pos-client.schema.ts, STF-02) is a separate co-located
// wrapper; this one is admin-only and does not share a file per the "co-located, not shared
// across pages" convention.
export function createPosClientSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.posClients.form.nameRequired")),
    phone: z.string().optional(),
    categoryId: z.uuid().optional(),
    initialCredit: z.number().optional(),
  });
}

export type CreatePosClientFormValues = z.infer<ReturnType<typeof createPosClientSchema>>;

// Aligned to UpdatePosClientCommand — `initialCredit` is create-only (credit is ledger-derived
// thereafter per the contract comment), replaced here by the universal `isEnabled` toggle.
export function updatePosClientSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.posClients.form.nameRequired")).optional(),
    phone: z.string().optional(),
    categoryId: z.uuid().optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type UpdatePosClientFormValues = z.infer<ReturnType<typeof updatePosClientSchema>>;

// Compile-time guards — fail to compile if either schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreatePosClientCommandCheck = AssertAssignable<
  CreatePosClientFormValues extends CreatePosClientCommand ? true : false
>;
type _UpdatePosClientCommandCheck = AssertAssignable<
  UpdatePosClientFormValues extends UpdatePosClientCommand ? true : false
>;
