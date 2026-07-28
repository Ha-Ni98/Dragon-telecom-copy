import { z } from "zod";
import type { UpdateUserCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// S17 — the password change is a plain UpdateUserCommand carrying only `password`; the backend
// already hashes it (Argon2id) and revokes the user's refresh tokens (identity.service.ts
// #updateUser). `confirmPassword` is client-side only, stripped before the command is sent —
// same pattern as reset-client-password.schema.ts.
export function changeUserPasswordSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      password: z.string().min(8, t("admin.users.changePassword.minLength")),
      confirmPassword: z.string().min(1, t("admin.users.changePassword.confirmRequired")),
    })
    .refine((d) => d.password === d.confirmPassword, {
      message: t("register.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type ChangeUserPasswordFormValues = z.infer<ReturnType<typeof changeUserPasswordSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command. `confirmPassword` is omitted deliberately (see file header).
type AssertAssignable<T extends true> = T;
type _ChangeUserPasswordCommandCheck = AssertAssignable<
  Omit<ChangeUserPasswordFormValues, "confirmPassword"> extends UpdateUserCommand ? true : false
>;
