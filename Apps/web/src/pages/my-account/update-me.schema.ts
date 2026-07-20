import { z } from "zod";
import type { UpdateMeCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to UpdateMeCommand (clients.command.ts, `.strict()`). `phone` is deliberately absent:
// PUB-08 renders it read-only, and the backend 400s on a `phone` key in this PATCH body — the
// RHF form built on this schema must never register a `phone` field. `email` accepts an empty
// string from the controlled input and transforms it to `undefined` (same reasoning as
// register.schema.ts) so an untouched/cleared field never gets validated as an invalid email.
export function updateMeSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    email: z
      .union([z.email(t("account.emailInvalid")), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
    storeName: z.string().optional(),
    wilayaId: z.string().min(1, t("register.wilayaRequired")).optional(),
    communeId: z.string().min(1, t("register.communeRequired")).optional(),
    address: z.string().optional(),
  });
}

export type UpdateMeFormValues = z.infer<ReturnType<typeof updateMeSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _UpdateMeCommandCheck = AssertAssignable<
  UpdateMeFormValues extends UpdateMeCommand ? true : false
>;
