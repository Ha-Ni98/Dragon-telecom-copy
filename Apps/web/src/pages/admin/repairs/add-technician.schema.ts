import { z } from "zod";
import type { CreateTechnicianCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateTechnicianCommand (identity.command.ts) — the Technicians tab's "Add
// technician" dialog (S13/R1).
export function addTechnicianSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.repairs.technicians.nameRequired")),
    phone: z.string().optional(),
  });
}

export type AddTechnicianFormValues = z.infer<ReturnType<typeof addTechnicianSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract Command.
type AssertAssignable<T extends true> = T;
type _CreateTechnicianCommandCheck = AssertAssignable<
  AddTechnicianFormValues extends CreateTechnicianCommand ? true : false
>;
