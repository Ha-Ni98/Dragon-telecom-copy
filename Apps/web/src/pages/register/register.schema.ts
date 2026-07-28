import { z } from "zod";
import type { RegisterClientCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";
import { phoneField } from "@/lib/validation/phone.schema";

// Contract's RegisterClientSchema (clients.command.ts) carries no field-level messages — this
// wrapper adds the translated required/format validation the PUB-07 form UX needs, same pattern
// as login.schema.ts. `email` accepts an empty string from the controlled input and transforms it
// to `undefined` so the submitted command matches the contract's `.optional()` (not an empty
// string, which `z.email()` would reject server-side).
export function registerSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    firstName: z.string().min(1, t("register.firstNameRequired")),
    lastName: z.string().min(1, t("register.lastNameRequired")),
    // S15/R3 — shared with the order form's phone field (lib/validation/phone.schema.ts): the
    // register form previously had no format rule at all, just this required check.
    phone: phoneField(t),
    email: z
      .union([z.email(t("register.emailRequired")), z.literal("")])
      .optional()
      .transform((v) => (v ? v : undefined)),
    storeName: z.string().optional(),
    wilayaId: z.string().min(1, t("register.wilayaRequired")),
    communeId: z.string().min(1, t("register.communeRequired")),
  });
}

export type RegisterFormValues = z.infer<ReturnType<typeof registerSchema>>;
// `email`'s `.transform()` makes the schema's input shape (what the form fields/defaultValues
// use) differ from its output shape (what onSubmit receives) — RHF needs both, via useForm's
// 3-generic form: useForm<RegisterInput, unknown, RegisterFormValues>().
export type RegisterInput = z.input<ReturnType<typeof registerSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _RegisterClientCommandCheck = AssertAssignable<
  RegisterFormValues extends RegisterClientCommand ? true : false
>;
