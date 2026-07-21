import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { BrowsingActivityTable } from "@/pages/admin/clients/components/browsing-activity-table";
import { ApprovalDialog } from "@/pages/admin/clients/components/approval-dialog";

describe("Client detail page-local primitives", () => {
  it("BrowsingActivityTable shows a skeleton while loading", () => {
    const { container } = render(<BrowsingActivityTable data={[]} isLoading />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("BrowsingActivityTable shows the empty state with no rows", () => {
    render(<BrowsingActivityTable data={[]} isLoading={false} />);
    expect(screen.getByText("admin.clients.browsing.empty")).toBeInTheDocument();
  });

  it("ApprovalDialog renders nothing with no client selected", () => {
    const { container } = render(
      <ApprovalDialog
        open={false}
        onOpenChange={vi.fn()}
        client={null}
        categoryOptions={[]}
        onApprove={vi.fn()}
        onReject={vi.fn()}
      />,
    );
    expect(container).toBeEmptyDOMElement();
  });
});
