import { z } from "zod";
import type { ResetClientPasswordCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ResetClientPasswordCommand (clients.command.ts). `confirmPassword` is a
// client-side-only field backing the match `.refine` below — stripped before the command is
// submitted (same pattern as change-password.schema.ts), so the AssertAssignable check below
// targets the field that actually crosses the wire.
export function resetClientPasswordSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      newPassword: z.string().min(6, t("admin.clients.resetPassword.minLength")),
      confirmPassword: z.string().min(1, t("admin.clients.resetPassword.confirmRequired")),
    })
    .refine((d) => d.newPassword === d.confirmPassword, {
      message: t("register.passwordMismatch"),
      path: ["confirmPassword"],
    });
}

export type ResetClientPasswordFormValues = z.infer<ReturnType<typeof resetClientPasswordSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command. `confirmPassword` is omitted deliberately (see file header).
type AssertAssignable<T extends true> = T;
type _ResetClientPasswordCommandCheck = AssertAssignable<
  Omit<ResetClientPasswordFormValues, "confirmPassword"> extends ResetClientPasswordCommand
    ? true
    : false
>;
