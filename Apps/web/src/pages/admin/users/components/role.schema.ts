import { z } from "zod";
import type {
  CreateRoleCommand,
  UpdateRoleCommand,
  SetRolePagesCommand,
} from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateRoleCommand (identity.command.ts).
export function createRoleSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    code: z.string().min(1, t("admin.users.roleForm.codeRequired")),
    name: z.string().min(1, t("admin.users.roleForm.nameRequired")),
    description: z.string().optional(),
  });
}

export type CreateRoleFormValues = z.infer<ReturnType<typeof createRoleSchema>>;

// Aligned to UpdateRoleCommand — system roles are read-only at the UI layer (ADM-16 §2), not
// via a schema refine (there's no "isSystem" flag on the command; the dialog disables the
// form entirely for those rows).
export function updateRoleSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.users.roleForm.nameRequired")).optional(),
    description: z.string().optional(),
    isEnabled: z.boolean().optional(),
  });
}

export type UpdateRoleFormValues = z.infer<ReturnType<typeof updateRoleSchema>>;

// Aligned to SetRolePagesCommand — the permission-matrix submit (ADM-16 §2 `role-dialog`).
export function setRolePagesSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    pageKeys: z.array(z.string()),
  });
}

export type SetRolePagesFormValues = z.infer<ReturnType<typeof setRolePagesSchema>>;

// Compile-time guards — fail to compile if any schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateRoleCommandCheck = AssertAssignable<
  CreateRoleFormValues extends CreateRoleCommand ? true : false
>;
type _UpdateRoleCommandCheck = AssertAssignable<
  UpdateRoleFormValues extends UpdateRoleCommand ? true : false
>;
type _SetRolePagesCommandCheck = AssertAssignable<
  SetRolePagesFormValues extends SetRolePagesCommand ? true : false
>;
