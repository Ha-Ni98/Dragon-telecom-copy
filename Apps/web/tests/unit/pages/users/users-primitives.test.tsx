import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { UsersTable } from "@/pages/admin/users/components/users-table";
import { RolesTable } from "@/pages/admin/users/components/roles-table";

describe("Users page-local primitives", () => {
  it("UsersTable shows a skeleton while loading", () => {
    const { container } = render(<UsersTable data={[]} isLoading onEdit={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("UsersTable shows the empty state with no rows", () => {
    render(<UsersTable data={[]} isLoading={false} onEdit={vi.fn()} />);
    expect(screen.getByText("admin.users.empty")).toBeInTheDocument();
  });

  it("RolesTable shows a skeleton while loading", () => {
    const { container } = render(<RolesTable data={[]} isLoading onEdit={vi.fn()} />);
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("RolesTable shows the empty state with no rows", () => {
    render(<RolesTable data={[]} isLoading={false} onEdit={vi.fn()} />);
    expect(screen.getByText("admin.users.roles.empty")).toBeInTheDocument();
  });
});
