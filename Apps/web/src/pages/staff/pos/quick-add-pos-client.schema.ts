import { z } from "zod";
import type { CreatePosClientCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreatePosClientCommand (clients.command.ts). Only `name` is required by the
// contract; this wrapper adds the translated message for the POS quick-add dialog (RHF +
// zodResolver, STF-02 §Forms).
export function quickAddPosClientSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("staff.pos.quickAddClient.nameRequired")),
    phone: z.string().optional(),
    categoryId: z.uuid().optional(),
    initialCredit: z.number().optional(),
  });
}

export type QuickAddPosClientFormValues = z.infer<ReturnType<typeof quickAddPosClientSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreatePosClientCommandCheck = AssertAssignable<
  QuickAddPosClientFormValues extends CreatePosClientCommand ? true : false
>;
