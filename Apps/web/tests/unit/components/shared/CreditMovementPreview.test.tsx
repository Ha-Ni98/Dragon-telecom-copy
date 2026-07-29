import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { CreditMovementPreview } from "@/components/shared/CreditMovementPreview";

describe("CreditMovementPreview", () => {
  it("renders both the previous and new credit amounts", () => {
    render(<CreditMovementPreview previousCredit={1000} newCredit={500} />);
    expect(screen.getByText("invoices.detail.previousCredit")).toBeInTheDocument();
    expect(screen.getByText("invoices.detail.newCredit")).toBeInTheDocument();
    expect(screen.getByText(/1,000|1000/)).toBeInTheDocument();
    expect(screen.getByText(/500/)).toBeInTheDocument();
  });

  it("flags an increase (worse for the payer) distinctly from a decrease", () => {
    const { rerender, container } = render(
      <CreditMovementPreview previousCredit={1000} newCredit={1500} />,
    );
    expect(container.querySelector(".text-destructive")).not.toBeNull();

    rerender(<CreditMovementPreview previousCredit={1000} newCredit={500} />);
    expect(container.querySelector(".text-success")).not.toBeNull();
  });
});
