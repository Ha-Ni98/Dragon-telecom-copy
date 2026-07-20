import { z } from "zod";
import type { ChangeMyPasswordCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ChangeMyPasswordCommand (clients.command.ts). `confirmPassword` is a client-side-
// only field backing the match `.refine` below — it must be stripped before the command is
// submitted (plan.md PUB-08 §4), so the AssertAssignable check below targets the two fields
// that actually cross the wire, not the full form shape.
export function changePasswordSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      currentPassword: z.string().min(1, t("account.currentPasswordRequired")),
      newPassword: z.string().min(6, t("account.newPasswordMinLength")),
      confirmPassword: z.string().min(1, t("account.confirmPasswordRequired")),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t("register.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type ChangePasswordFormValues = z.infer<ReturnType<typeof changePasswordSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command. `confirmPassword` is omitted deliberately (see file header).
type AssertAssignable<T extends true> = T;
type _ChangeMyPasswordCommandCheck = AssertAssignable<
  Omit<ChangePasswordFormValues, "confirmPassword"> extends ChangeMyPasswordCommand ? true : false
>;
