import { z } from "zod";
import type { ApproveClientCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to ApproveClientCommand (clients.command.ts). `categoryId` is already required by
// the contract (no local refine needed — ADM-12 gap A-none, mandatory category per plan §Page
// 5). The username-unique 409 is a server-side error surfaced via `setError("username", ...)`
// at the call site (Sprint 7 wiring), not a client-side refine here.
export function approveClientSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    username: z.string().min(1, t("admin.clients.approval.usernameRequired")),
    password: z.string().min(8, t("admin.clients.approval.passwordMinLength")),
    categoryId: z.uuid(t("admin.clients.approval.categoryRequired")),
  });
}

export type ApproveClientFormValues = z.infer<ReturnType<typeof approveClientSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _ApproveClientCommandCheck = AssertAssignable<
  ApproveClientFormValues extends ApproveClientCommand ? true : false
>;
