import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { StaffSearchesTable } from "@/pages/admin/staff-searches/components/staff-searches-table";

describe("Staff searches page-local primitives", () => {
  it("StaffSearchesTable shows a skeleton while loading", () => {
    const { container } = render(<StaffSearchesTable data={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("StaffSearchesTable shows the empty state with no rows", () => {
    render(<StaffSearchesTable data={[]} isLoading={false} />);
    expect(screen.getByText("admin.staffSearches.empty")).toBeInTheDocument();
  });
});
