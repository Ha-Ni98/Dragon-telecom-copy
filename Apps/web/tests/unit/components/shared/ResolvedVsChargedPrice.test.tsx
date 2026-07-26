import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResolvedVsChargedPrice } from "@/components/shared/ResolvedVsChargedPrice";

describe("ResolvedVsChargedPrice", () => {
  it("shows only the charged price when it matches the resolved price", () => {
    render(<ResolvedVsChargedPrice resolvedPrice={100} unitPrice={100} />);
    expect(screen.queryByText("common.pricing.resolvedPrice")).not.toBeInTheDocument();
  });

  it("shows the struck-through resolved price when the charged price was overridden", () => {
    render(<ResolvedVsChargedPrice resolvedPrice={100} unitPrice={90} />);
    expect(screen.getByText("common.pricing.resolvedPrice")).toBeInTheDocument();
  });
});
