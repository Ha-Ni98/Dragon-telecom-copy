import { z } from "zod";
import { isDzPhone, type UpdateSettingsCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to the `store` section of UpdateSettingsCommand (platform.command.ts). Every field
// of `UpdateSettingsCommand` is section-scoped and independently optional (a PATCH may touch
// just one leaf field), so each Settings tab submits only its own section — this wrapper's
// output is assigned to `{ store: ... }` at the call site (ADM-17 §4), not the top-level
// command shape.
//
// S26.1 — `logoUrl`/`printLogoUrl` are deliberately **not** in this form. The two logo controls
// commit their own PATCH the moment an upload succeeds (like `ProductImagesSection` does), so if
// the text form also carried a logo field, pressing Save with a form seeded before the upload
// would silently revert the logo it just set.
//
// S38 — the footer contact fields (WhatsApp, email, three social URLs). In the form an empty
// input is "", but the command rejects "" for email/URLs and uses `null` for "clear this field",
// so `toStorePatch` is the one place that translates the form's shape into the command's.
const httpsUrlField = (t: ReturnType<typeof useTranslation>["t"]) =>
  z.union([
    z.literal(""),
    z.url({ protocol: /^https?$/, error: t("common.validation.invalidUrl") }),
  ]);

export function storeSettingsSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().optional(),
    activityLine: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    repairPhone: z.string().optional(),
    salesPhone: z.string().optional(),
    whatsappPhone: z
      .string()
      .trim()
      .refine((v) => v === "" || isDzPhone(v), t("common.validation.invalidPhone")),
    email: z.union([
      z.literal(""),
      z
        .string()
        .trim()
        .pipe(z.email(t("common.validation.invalidEmail"))),
    ]),
    facebookUrl: httpsUrlField(t),
    instagramUrl: httpsUrlField(t),
    tiktokUrl: httpsUrlField(t),
  });
}

export type StoreSettingsFormValues = z.infer<ReturnType<typeof storeSettingsSchema>>;
export type StoreSettingsPatch = NonNullable<UpdateSettingsCommand["store"]>;

// "" → null for the five S38 fields (null = cleared, the only way to unset a stored leaf). The
// older six keep their existing behaviour: an emptied one is still stored as "".
export function toStorePatch(values: StoreSettingsFormValues): StoreSettingsPatch {
  const orNull = (value: string): string | null => (value.trim() === "" ? null : value.trim());
  return {
    ...(values.name !== undefined ? { name: values.name } : {}),
    ...(values.activityLine !== undefined ? { activityLine: values.activityLine } : {}),
    ...(values.address !== undefined ? { address: values.address } : {}),
    ...(values.phone !== undefined ? { phone: values.phone } : {}),
    ...(values.repairPhone !== undefined ? { repairPhone: values.repairPhone } : {}),
    ...(values.salesPhone !== undefined ? { salesPhone: values.salesPhone } : {}),
    whatsappPhone: orNull(values.whatsappPhone),
    email: orNull(values.email),
    facebookUrl: orNull(values.facebookUrl),
    instagramUrl: orNull(values.instagramUrl),
    tiktokUrl: orNull(values.tiktokUrl),
  };
}
