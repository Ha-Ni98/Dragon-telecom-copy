import { z } from "zod";
import { isDzPhone } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// One phone rule for the whole storefront (S15/R3): registration and order placement must agree,
// and the register form had no format rule at all before this. Accepts an optional +213 / 00213
// prefix or a leading 0, then 9 digits (first non-zero); spaces, dots and dashes anywhere are
// stripped before matching. S38: the rule itself now lives in `@dragon-telecom/contract`
// (common/phone.ts) so the API validates the store's WhatsApp number with the same pattern.
export function phoneField(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .string()
    .min(1, t("register.phoneRequired"))
    .refine(isDzPhone, t("common.validation.invalidPhone"));
}
