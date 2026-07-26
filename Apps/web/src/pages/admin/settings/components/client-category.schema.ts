import { z } from "zod";
import type {
  CreateClientCategoryCommand,
  UpdateClientCategoryCommand,
} from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateClientCategoryCommand (catalog.command.ts). Categories management moved
// from AdminClients into the Settings Categories tab (ADM-17 §2) — this replaces the old
// stub `client-category-dialog.schema.ts` under admin/clients/components, which stays until
// its stub dialog is torn down (Sprint 9, grep-gated).
export function createClientCategorySchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.categories.form.nameRequired")),
  });
}

export type CreateClientCategoryFormValues = z.infer<ReturnType<typeof createClientCategorySchema>>;

// Aligned to UpdateClientCategoryCommand — `isEnabled` follows the universal isEnabled-PATCH
// convention (disable-only, member/priced-product warning surfaced at the call site).
export function updateClientCategorySchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.categories.form.nameRequired")).optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type UpdateClientCategoryFormValues = z.infer<ReturnType<typeof updateClientCategorySchema>>;

// Compile-time guards — fail to compile if either schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateClientCategoryCommandCheck = AssertAssignable<
  CreateClientCategoryFormValues extends CreateClientCategoryCommand ? true : false
>;
type _UpdateClientCategoryCommandCheck = AssertAssignable<
  UpdateClientCategoryFormValues extends UpdateClientCategoryCommand ? true : false
>;
