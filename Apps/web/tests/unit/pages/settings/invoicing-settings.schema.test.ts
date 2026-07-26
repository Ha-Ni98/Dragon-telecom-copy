import { describe, it, expect } from "vitest";
import { DocType } from "@dragon-telecom/contract";
import { invoicingSettingsSchema } from "@/pages/admin/settings/components/invoicing-settings.schema";

const t = (key: string) => key;
const schema = invoicingSettingsSchema(t);

// z.record keyed by an enum is exhaustive in Zod 4 (every member must be present once the
// record itself is supplied) — mirrors the contract's own `prefixes`/`nextSequences` shape,
// so the Invoicing tab form must submit one row per DocType, not a partial map.
const allDocTypePrefixes = Object.fromEntries(Object.values(DocType).map((d) => [d, `${d}-`]));
const allDocTypeSequences = Object.fromEntries(Object.values(DocType).map((d) => [d, 1]));

describe("invoicingSettingsSchema (ADM-17 Invoicing tab)", () => {
  it("accepts an empty patch", () => {
    expect(schema.safeParse({}).success).toBe(true);
  });

  it("accepts prefixes + nextSequences keyed by every DocType", () => {
    const result = schema.safeParse({
      prefixes: allDocTypePrefixes,
      nextSequences: allDocTypeSequences,
      footerNote: "Thank you for your business",
    });
    expect(result.success).toBe(true);
  });

  it("rejects a negative nextSequence", () => {
    const result = schema.safeParse({
      nextSequences: { ...allDocTypeSequences, [DocType.INVOICE]: -1 },
    });
    expect(result.success).toBe(false);
  });
});
