import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import type { AdminProductDto } from "@dragon-telecom/contract";
import { Button } from "@/components/ui/button";
import { ProductPickerDialog } from "@/components/shared/product-picker-dialog";
import { QuickAddProductDialog } from "@/pages/admin/supplier-invoices/components/quick-add-product-dialog";
import type { QuickAddProductFormValues } from "@/pages/admin/supplier-invoices/components/quick-add-product.schema";
import { useAdminCatalogProducts, useCreateProduct } from "@/hooks/useCatalogProducts";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { ProductPickerColumn } from "@/types/product-picker.types";

interface InvoiceProductPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (products: AdminProductDto[]) => void;
}

const PAGE_SIZE = 10;

// S31 — the supplier-invoice consumer of the shared ProductPickerDialog. Server-side search over
// the WHOLE catalog (`/admin/products`, name or barcode, debounced 300 ms) — before S31 the editor
// filtered a one-off first-100 slice in the browser, so older products could not be picked at all.
// An empty search lists products newest first (the endpoint's own default, plan P5), which puts a
// just-created product at the top. Columns are what the buyer is recalling — on-hand, avgPrice
// (unweighted, supplier-invoice context, D10) and avgStockPrice — not sale prices. Nothing is
// disabled: receiving stock for an out-of-stock product is the normal case. The quick-add-product
// button (S7 I5) lives in this dialog's footer now, and the product it creates comes back already
// selected.
export function InvoiceProductPickerDialog({
  open,
  onOpenChange,
  onAdd,
}: InvoiceProductPickerDialogProps) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, AdminProductDto>>(() => new Map());
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const debouncedSearch = useDebouncedValue(search, 300);

  const products = useAdminCatalogProducts(
    { search: debouncedSearch.trim() || undefined, page, limit: PAGE_SIZE },
    { enabled: open },
  );
  const createProduct = useCreateProduct();

  const columns = useMemo<ProductPickerColumn<AdminProductDto>[]>(
    () => [
      {
        id: "onHand",
        header: t("common.productPicker.columns.onHand"),
        align: "right",
        cell: (row) => row.quantityOnHand,
      },
      {
        id: "avgPrice",
        header: t("common.productPicker.columns.avgPrice"),
        align: "right",
        cell: (row) => formatDZD(row.avgPrice, language),
      },
      {
        id: "avgStockPrice",
        header: t("common.productPicker.columns.avgStockPrice"),
        align: "right",
        cell: (row) => formatDZD(row.avgStockPrice, language),
      },
    ],
    [t, language],
  );

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch("");
      setPage(1);
      setSelected(new Map());
    }
    onOpenChange(nextOpen);
  };

  const handleToggle = (row: AdminProductDto, checked: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });

  const handleSaveNewProduct = (values: QuickAddProductFormValues) => {
    createProduct.mutate(
      { command: values, images: [] },
      {
        onSuccess: (product) => {
          setSelected((prev) => new Map(prev).set(product.id, product));
          setIsQuickAddOpen(false);
        },
      },
    );
  };

  return (
    <>
      <ProductPickerDialog
        open={open}
        onOpenChange={handleClose}
        title={t("admin.supplierInvoices.productPicker.title")}
        search={search}
        onSearchChange={(value) => {
          setSearch(value);
          setPage(1);
        }}
        rows={products.data?.items}
        isLoading={products.isLoading}
        isError={products.isError}
        onRetry={() => products.refetch()}
        page={page}
        totalPages={products.data?.meta.totalPages ?? 1}
        onPageChange={setPage}
        columns={columns}
        selected={selected}
        onToggle={handleToggle}
        onClearSelection={() => setSelected(new Map())}
        onAdd={() => {
          onAdd([...selected.values()]);
          handleClose(false);
        }}
        footerStart={
          <Button type="button" variant="outline" onClick={() => setIsQuickAddOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            {t("admin.supplierInvoices.editor.quickAddProduct")}
          </Button>
        }
      />

      {/* Sibling of the picker — Radix stacks the two modal dialogs. */}
      <QuickAddProductDialog
        open={isQuickAddOpen}
        onOpenChange={setIsQuickAddOpen}
        onSave={handleSaveNewProduct}
        isSaving={createProduct.isPending}
      />
    </>
  );
}
