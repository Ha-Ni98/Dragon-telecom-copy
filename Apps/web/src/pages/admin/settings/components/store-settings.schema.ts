import { z } from "zod";
import type { UpdateSettingsCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to the `store` section of UpdateSettingsCommand (platform.command.ts). Every field
// of `UpdateSettingsCommand` is section-scoped and independently optional (a PATCH may touch
// just one leaf field), so each Settings tab submits only its own section — this wrapper's
// output is assigned to `{ store: ... }` at the call site (ADM-17 §4), not the top-level
// command shape.
export function storeSettingsSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().optional(),
    address: z.string().optional(),
    phone: z.string().optional(),
    logoUrl: z.string().optional(),
  });
}

export type StoreSettingsFormValues = z.infer<ReturnType<typeof storeSettingsSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command's `store` section.
type AssertAssignable<T extends true> = T;
type _StoreSettingsCommandCheck = AssertAssignable<
  StoreSettingsFormValues extends NonNullable<UpdateSettingsCommand["store"]> ? true : false
>;
