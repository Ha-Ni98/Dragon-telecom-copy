import { z } from "zod";
import type {
  CreateBrandCommand,
  UpdateBrandCommand,
  CreateFamilyCommand,
  UpdateFamilyCommand,
  CreateModelCommand,
  UpdateModelCommand,
  SetModelFamiliesCommand,
} from "@dragon-telecom/contract";
import type { useTranslation } from "@/hooks/useTranslation";

// Hierarchy panel (ADM-17 §2 `hierarchy-panel`) — Families/Brands/Models sub-panels, disable-
// only, families multi-select on Model. Aligned to catalog.command.ts's taxonomy commands.
// A separate file from the products-page stub (`model-dialog.schema.ts`, numeric-id
// view-model) — that one is owned by the products trio (set-03), not this set.

export function createBrandSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")),
    logoUrl: z.string().optional(),
  });
}
export type CreateBrandFormValues = z.infer<ReturnType<typeof createBrandSchema>>;

export function updateBrandSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")).optional(),
    logoUrl: z.string().optional(),
    isEnabled: z.boolean().optional(),
  });
}
export type UpdateBrandFormValues = z.infer<ReturnType<typeof updateBrandSchema>>;

export function createFamilySchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")),
    parentId: z.uuid().optional(),
    iconUrl: z.string().optional(),
    isFeatured: z.boolean().optional(),
  });
}
export type CreateFamilyFormValues = z.infer<ReturnType<typeof createFamilySchema>>;

export function updateFamilySchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")).optional(),
    parentId: z.uuid().optional(),
    iconUrl: z.string().optional(),
    isFeatured: z.boolean().optional(),
    isEnabled: z.boolean().optional(),
  });
}
export type UpdateFamilyFormValues = z.infer<ReturnType<typeof updateFamilySchema>>;

export function createModelSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    brandId: z.uuid(t("common.validation.selectRequired")),
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")),
  });
}
export type CreateModelFormValues = z.infer<ReturnType<typeof createModelSchema>>;

export function updateModelSchema(t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    name: z.string().min(1, t("admin.settings.hierarchy.nameRequired")).optional(),
    isEnabled: z.boolean().optional(),
  });
}
export type UpdateModelFormValues = z.infer<ReturnType<typeof updateModelSchema>>;

export function setModelFamiliesSchema(_t: ReturnType<typeof useTranslation>["t"]) {
  return z.object({
    familyIds: z.array(z.uuid()),
  });
}
export type SetModelFamiliesFormValues = z.infer<ReturnType<typeof setModelFamiliesSchema>>;

// Compile-time guards — fail to compile if any schema's output drifts from its contract
// Command (e.g. a renamed/removed contract field).
type AssertAssignable<T extends true> = T;
type _CreateBrandCommandCheck = AssertAssignable<
  CreateBrandFormValues extends CreateBrandCommand ? true : false
>;
type _UpdateBrandCommandCheck = AssertAssignable<
  UpdateBrandFormValues extends UpdateBrandCommand ? true : false
>;
type _CreateFamilyCommandCheck = AssertAssignable<
  CreateFamilyFormValues extends CreateFamilyCommand ? true : false
>;
type _UpdateFamilyCommandCheck = AssertAssignable<
  UpdateFamilyFormValues extends UpdateFamilyCommand ? true : false
>;
type _CreateModelCommandCheck = AssertAssignable<
  CreateModelFormValues extends CreateModelCommand ? true : false
>;
type _UpdateModelCommandCheck = AssertAssignable<
  UpdateModelFormValues extends UpdateModelCommand ? true : false
>;
type _SetModelFamiliesCommandCheck = AssertAssignable<
  SetModelFamiliesFormValues extends SetModelFamiliesCommand ? true : false
>;
