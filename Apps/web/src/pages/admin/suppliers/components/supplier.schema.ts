import { z } from "zod";
import type { CreateSupplierCommand, UpdateSupplierCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateSupplierCommand (purchasing.command.ts). Replaces the stub
// `admin-supplier-add-dialog.schema.ts` (numeric-id view-model, inline strings) once ADM-07
// is rewired onto `usePurchasingSuppliers` (Sprint 6) — the stub file is deleted behind the
// grep gate in Sprint 9, not here.
export function createSupplierSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.suppliers.supplierNameRequired")),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    email: z.email(t("common.validation.invalidEmail")).optional(),
    location: z.string().optional(),
    initialCredit: z.number().min(0, t("common.validation.nonNegativeNumber")).optional(),
  });
}

export type CreateSupplierFormValues = z.infer<ReturnType<typeof createSupplierSchema>>;

// Aligned to UpdateSupplierCommand — mirrors create minus `initialCredit` (credit is
// ledger-derived thereafter), plus the universal `isEnabled` (disable) toggle.
export function updateSupplierSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.suppliers.supplierNameRequired")).optional(),
    contactName: z.string().optional(),
    phone: z.string().optional(),
    email: z.email(t("common.validation.invalidEmail")).optional(),
    location: z.string().optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type UpdateSupplierFormValues = z.infer<ReturnType<typeof updateSupplierSchema>>;

// Compile-time guards — fail to compile if either schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateSupplierCommandCheck = AssertAssignable<
  CreateSupplierFormValues extends CreateSupplierCommand ? true : false
>;
type _UpdateSupplierCommandCheck = AssertAssignable<
  UpdateSupplierFormValues extends UpdateSupplierCommand ? true : false
>;
