import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AgeFlag } from "@/components/shared/AgeFlag";

describe("AgeFlag", () => {
  it("renders nothing when under the threshold", () => {
    const { container } = render(<AgeFlag since={new Date().toISOString()} thresholdHours={24} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders once elapsed time exceeds the threshold", () => {
    const oldDate = new Date(Date.now() - 30 * 3_600_000).toISOString();
    render(<AgeFlag since={oldDate} thresholdHours={24} />);
    expect(screen.getByText("common.age.days")).toBeInTheDocument();
  });

  it("with no threshold, always renders a plain elapsed-time badge", () => {
    render(<AgeFlag since={new Date().toISOString()} />);
    expect(screen.getByText("common.age.hours")).toBeInTheDocument();
  });
});
