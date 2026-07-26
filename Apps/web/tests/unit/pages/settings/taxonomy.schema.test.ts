import { describe, it, expect } from "vitest";
import {
  createBrandSchema,
  updateBrandSchema,
  createFamilySchema,
  updateFamilySchema,
  createModelSchema,
  updateModelSchema,
  setModelFamiliesSchema,
} from "@/pages/admin/settings/components/taxonomy.schema";

const t = (key: string) => key;
const FAMILY_ID = "10000000-0000-4000-8000-000000000001";
const BRAND_ID = "20000000-0000-4000-8000-000000000002";

describe("taxonomy schemas (ADM-17 Hierarchy tab)", () => {
  it("createBrandSchema accepts a named brand", () => {
    expect(createBrandSchema(t).safeParse({ name: "Samsung" }).success).toBe(true);
  });

  it("createBrandSchema rejects an empty name", () => {
    expect(createBrandSchema(t).safeParse({ name: "" }).success).toBe(false);
  });

  it("updateBrandSchema accepts a disable-only patch", () => {
    expect(updateBrandSchema(t).safeParse({ isEnabled: false }).success).toBe(true);
  });

  it("createFamilySchema accepts a top-level family", () => {
    expect(createFamilySchema(t).safeParse({ name: "Screens" }).success).toBe(true);
  });

  it("createFamilySchema accepts a nested family with parentId", () => {
    expect(
      createFamilySchema(t).safeParse({ name: "OLED Screens", parentId: FAMILY_ID }).success,
    ).toBe(true);
  });

  it("updateFamilySchema accepts a disable-only patch", () => {
    expect(updateFamilySchema(t).safeParse({ isEnabled: false }).success).toBe(true);
  });

  it("createModelSchema requires a brandId", () => {
    const result = createModelSchema(t).safeParse({ name: "Galaxy S24" });
    expect(result.success).toBe(false);
  });

  it("createModelSchema accepts a valid model", () => {
    expect(createModelSchema(t).safeParse({ brandId: BRAND_ID, name: "Galaxy S24" }).success).toBe(
      true,
    );
  });

  it("updateModelSchema accepts a disable-only patch", () => {
    expect(updateModelSchema(t).safeParse({ isEnabled: false }).success).toBe(true);
  });

  it("setModelFamiliesSchema accepts a families multi-select", () => {
    expect(setModelFamiliesSchema(t).safeParse({ familyIds: [FAMILY_ID] }).success).toBe(true);
  });
});
