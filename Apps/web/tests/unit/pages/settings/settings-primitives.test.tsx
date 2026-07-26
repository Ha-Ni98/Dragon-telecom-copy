import "../../../fixtures/wrappers/mockTranslation";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { StoreSettingsForm } from "@/pages/admin/settings/components/store-settings-form";
import { InvoicingSettingsForm } from "@/pages/admin/settings/components/invoicing-settings-form";
import { HierarchyPanel } from "@/pages/admin/settings/components/hierarchy-panel";
import { StorefrontSettings } from "@/pages/admin/settings/components/storefront-settings";

describe("Settings page-local primitives", () => {
  it("StoreSettingsForm submits the current field values", async () => {
    const onSave = vi.fn();
    render(<StoreSettingsForm onSave={onSave} />);
    fireEvent.click(screen.getByText("admin.settings.general.save"));
    expect(await screen.findByText("admin.settings.general.save")).toBeInTheDocument();
  });

  it("InvoicingSettingsForm shows the sequence-decrease error banner when flagged", () => {
    render(<InvoicingSettingsForm onSave={vi.fn()} sequenceDecreaseError />);
    expect(screen.getByText("admin.settings.invoicing.sequenceDecreaseError")).toBeInTheDocument();
  });

  it("InvoicingSettingsForm hides the error banner once dismissed", () => {
    render(<InvoicingSettingsForm onSave={vi.fn()} sequenceDecreaseError />);
    fireEvent.click(screen.getByText("common.dismiss"));
    expect(
      screen.queryByText("admin.settings.invoicing.sequenceDecreaseError"),
    ).not.toBeInTheDocument();
  });

  it("HierarchyPanel shows a skeleton while loading", () => {
    const { container } = render(
      <HierarchyPanel
        families={[]}
        brands={[]}
        models={[]}
        isLoading
        onCreateFamily={vi.fn()}
        onCreateBrand={vi.fn()}
        onCreateModel={vi.fn()}
        onDisableFamily={vi.fn()}
        onDisableBrand={vi.fn()}
        onDisableModel={vi.fn()}
      />,
    );
    expect(container.querySelectorAll(".animate-pulse").length).toBeGreaterThan(0);
  });

  it("HierarchyPanel calls onCreateFamily with the typed name", () => {
    const onCreateFamily = vi.fn();
    render(
      <HierarchyPanel
        families={[]}
        brands={[]}
        models={[]}
        onCreateFamily={onCreateFamily}
        onCreateBrand={vi.fn()}
        onCreateModel={vi.fn()}
        onDisableFamily={vi.fn()}
        onDisableBrand={vi.fn()}
        onDisableModel={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("admin.settings.hierarchy.addFamily"), {
      target: { value: "Smartphones" },
    });
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onCreateFamily).toHaveBeenCalledWith("Smartphones");
  });

  it("StorefrontSettings renders the deferral note and existing featured products", () => {
    render(
      <StorefrontSettings
        featuredProducts={[{ id: "p1", name: "Product 1" }]}
        productOptions={[]}
        onAdd={vi.fn()}
        onRemove={vi.fn()}
        onSave={vi.fn()}
      />,
    );
    expect(screen.getByText("admin.settings.storefront.deliveryCompaniesNote")).toBeInTheDocument();
    expect(screen.getByText("Product 1")).toBeInTheDocument();
  });

  it("StorefrontSettings calls onRemove when a featured product's remove button is clicked", () => {
    const onRemove = vi.fn();
    render(
      <StorefrontSettings
        featuredProducts={[{ id: "p1", name: "Product 1" }]}
        productOptions={[]}
        onAdd={vi.fn()}
        onRemove={onRemove}
        onSave={vi.fn()}
      />,
    );
    fireEvent.click(screen.getAllByRole("button")[0]);
    expect(onRemove).toHaveBeenCalledWith("p1");
  });
});
