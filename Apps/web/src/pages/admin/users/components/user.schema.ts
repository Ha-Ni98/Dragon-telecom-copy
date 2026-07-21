import { z } from "zod";
import { UserType } from "@dragon-telecom/contract";
import type { CreateUserCommand, UpdateUserCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

const StaffProfileSchema = (t: ReturnType<typeof useTranslation>["t"]) =>
  z.object({
    firstName: z.string().min(1, t("common.validation.required")),
    lastName: z.string().min(1, t("common.validation.required")),
    phone: z.string().optional(),
    jobTitle: z.string().optional(),
  });

// Aligned to CreateUserCommand (identity.command.ts). The contract already enforces
// "roleIds required+non-empty iff STAFF, forbidden iff ADMIN" via its own `.refine`, but a
// `ZodEffects` can't be re-`.extend()`-ed with translated messages, so this wrapper
// re-declares the same shape + both refines with localized messages (ADM-16 §4's type switch
// mirrors this rule client-side).
export function createUserSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      username: z.string().min(1, t("admin.users.form.usernameRequired")),
      email: z.email(t("common.validation.invalidEmail")).optional(),
      password: z.string().min(8, t("admin.users.form.passwordMinLength")),
      type: z.enum([UserType.ADMIN, UserType.STAFF], {
        message: t("common.validation.selectRequired"),
      }),
      profile: StaffProfileSchema(t),
      roleIds: z.array(z.uuid()).optional(),
    })
    .refine((d) => d.type !== UserType.STAFF || (d.roleIds?.length ?? 0) > 0, {
      message: t("admin.users.form.roleIdsRequiredForStaff"),
      path: ["roleIds"],
    })
    .refine((d) => d.type !== UserType.ADMIN || d.roleIds === undefined, {
      message: t("admin.users.form.roleIdsForbiddenForAdmin"),
      path: ["roleIds"],
    });
}

export type CreateUserFormValues = z.infer<ReturnType<typeof createUserSchema>>;

export function updateUserSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    isEnabled: z.boolean().optional(),
    roleIds: z.array(z.uuid()).optional(),
    profile: StaffProfileSchema(t).partial().optional(),
    password: z.string().min(8, t("admin.users.form.passwordMinLength")).optional(),
  });
}

export type UpdateUserFormValues = z.infer<ReturnType<typeof updateUserSchema>>;

// Compile-time guards — fail to compile if either schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateUserCommandCheck = AssertAssignable<
  CreateUserFormValues extends CreateUserCommand ? true : false
>;
type _UpdateUserCommandCheck = AssertAssignable<
  UpdateUserFormValues extends UpdateUserCommand ? true : false
>;
