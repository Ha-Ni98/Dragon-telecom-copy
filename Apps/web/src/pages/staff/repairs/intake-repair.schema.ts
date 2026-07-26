import { z } from "zod";
import { ReportedIssue } from "@dragon-telecom/contract";
import type { CreateRepairCommand } from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Aligned to CreateRepairCommand (repairs.command.ts). Shared by STF-07 and ADM-13 (same
// `IntakeDialog`). The "other → free-text field" requirement (ADM-13 §UI) is a page-local
// refine — the contract only requires `reportedIssueOther` to be a plain optional string.
export function intakeRepairSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z
    .object({
      posClientId: z.uuid().optional(),
      customerName: z.string().min(1, t("staff.repairs.intake.customerNameRequired")),
      customerPhone: z.string().min(1, t("staff.repairs.intake.customerPhoneRequired")),
      brandId: z.uuid().optional(),
      deviceModelId: z.uuid().optional(),
      deviceLabel: z.string().optional(),
      deviceImei: z.string().optional(),
      reportedIssues: z
        .array(z.enum(ReportedIssue))
        .min(1, t("staff.repairs.intake.reportedIssuesRequired")),
      reportedIssueOther: z.string().optional(),
      technicianId: z.uuid().optional(),
    })
    .refine((d) => !d.reportedIssues.includes(ReportedIssue.OTHER) || !!d.reportedIssueOther, {
      message: t("staff.repairs.intake.reportedIssueOtherRequired"),
      path: ["reportedIssueOther"],
    });
}

export type IntakeRepairFormValues = z.infer<ReturnType<typeof intakeRepairSchema>>;

// Compile-time guard — fails to compile if this schema's output drifts from the contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateRepairCommandCheck = AssertAssignable<
  IntakeRepairFormValues extends CreateRepairCommand ? true : false
>;
