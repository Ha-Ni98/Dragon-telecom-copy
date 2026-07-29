import { z } from "zod";
import type { useTranslation } from "@/hooks/useTranslation";

// One phone rule for the whole storefront (S15/R3): registration and order placement must agree,
// and the register form had no format rule at all before this. Accepts an optional +213 / 00213
// prefix or a leading 0, then 9 digits (first non-zero); spaces, dots and dashes anywhere are
// stripped before matching, so the regex itself only ever sees the cleaned digit string.
const DZ_PHONE = /^(?:(?:\+|00)213|0)[1-9]\d{8}$/;

export function phoneField(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .string()
    .min(1, t("register.phoneRequired"))
    .refine((v) => DZ_PHONE.test(v.replace(/[\s.-]/g, "")), t("common.validation.invalidPhone"));
}
