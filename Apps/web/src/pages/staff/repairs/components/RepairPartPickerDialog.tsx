import { useMemo, useState } from "react";
import type { StaffProductDto } from "@dragon-telecom/contract";
import { ProductPickerDialog } from "@/components/shared/product-picker-dialog";
import { useStaffProducts } from "@/hooks/useCatalogProducts";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { ProductPickerColumn } from "@/types/product-picker.types";

interface RepairPartPickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (products: StaffProductDto[]) => void;
}

const PAGE_SIZE = 10;

// S31 — the repairs consumer of the shared ProductPickerDialog. Owns the search/page/selection
// state and the data hook (the shared dialog is presentational). Same server-side search the old
// inline autocomplete used (`/staff/products`, name or barcode, debounced 300 ms, whole catalog),
// but it also lists products with an empty search (name A→Z, the endpoint's own default). Columns
// mirror the POS card: available quantity, the default sale price and each client-category price.
// A product with nothing available is disabled — you cannot fit a part you don't have
// (`availableQuantity` is exactly what reserve() checks against).
export function RepairPartPickerDialog({ open, onOpenChange, onAdd }: RepairPartPickerDialogProps) {
  const { t, language } = useTranslation();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Map<string, StaffProductDto>>(() => new Map());
  const debouncedSearch = useDebouncedValue(search, 300);

  const products = useStaffProducts(
    { search: debouncedSearch.trim() || undefined, page, limit: PAGE_SIZE },
    { enabled: open },
  );
  const categories = useCatalogClientCategories();

  const columns = useMemo<ProductPickerColumn<StaffProductDto>[]>(() => {
    const sortedCategories = [...(categories.data ?? [])].sort((a, b) =>
      a.name.localeCompare(b.name),
    );
    return [
      {
        id: "available",
        header: t("common.productPicker.columns.available"),
        align: "right",
        cell: (row) => row.availableQuantity,
      },
      {
        id: "defaultPrice",
        header: t("common.productPicker.columns.defaultPrice"),
        align: "right",
        cell: (row) => formatDZD(row.defaultSalePrice ?? 0, language),
      },
      ...sortedCategories.map((category): ProductPickerColumn<StaffProductDto> => ({
        id: `category-${category.id}`,
        header: category.name,
        align: "right",
        cell: (row) => {
          const price = row.categoryPrices.find((cp) => cp.categoryId === category.id)?.price;
          return price != null ? formatDZD(price, language) : "—";
        },
      })),
    ];
  }, [categories.data, t, language]);

  const handleClose = (nextOpen: boolean) => {
    if (!nextOpen) {
      setSearch("");
      setPage(1);
      setSelected(new Map());
    }
    onOpenChange(nextOpen);
  };

  const handleToggle = (row: StaffProductDto, checked: boolean) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (checked) next.set(row.id, row);
      else next.delete(row.id);
      return next;
    });

  return (
    <ProductPickerDialog
      open={open}
      onOpenChange={handleClose}
      title={t("staff.repairs.partPicker.title")}
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
      isRowDisabled={(row) => row.availableQuantity <= 0}
      disabledRowHint={t("staff.repairs.addPart.outOfStock")}
      onAdd={() => {
        onAdd([...selected.values()]);
        handleClose(false);
      }}
    />
  );
}
