import type { ReactNode } from "react";
import { Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";
import type { ProductPickerColumn, ProductPickerRow } from "@/types/product-picker.types";

interface ProductPickerDialogProps<T extends ProductPickerRow> {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  search: string;
  onSearchChange: (value: string) => void;
  rows: T[] | undefined;
  isLoading?: boolean;
  isError?: boolean;
  onRetry?: () => void;
  page: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  columns: ProductPickerColumn<T>[];
  selected: ReadonlyMap<string, T>;
  onToggle: (row: T, checked: boolean) => void;
  onClearSelection: () => void;
  isRowDisabled?: (row: T) => boolean;
  /** Shown as the title (hover hint) of a disabled row. */
  disabledRowHint?: string;
  onAdd: () => void;
  /** Left-hand footer slot — the supplier-invoice consumer's "new product" button. */
  footerStart?: ReactNode;
}

const SKELETON_ROWS = 5;

// S31 — one dialog, two consumers (RepairPartPickerDialog, InvoiceProductPickerDialog). It
// replaces only the *finding* of products, never the confirming: Add hands the selected rows
// back to the consumer's own editable list (the repair's staged parts, the invoice's lines).
// Controlled and presentational (plan P6): search text, page and the selection Map all live in
// the consumer wrapper, which also owns the data hook — so the selection survives paging and
// re-searching within one dialog session, and each consumer resets it when the dialog closes
// (which is why Cancel discards it). Header, search, selection bar, pager and footer stay pinned;
// only the table body scrolls.
export function ProductPickerDialog<T extends ProductPickerRow>({
  open,
  onOpenChange,
  title,
  search,
  onSearchChange,
  rows,
  isLoading = false,
  isError = false,
  onRetry,
  page,
  totalPages,
  onPageChange,
  columns,
  selected,
  onToggle,
  onClearSelection,
  isRowDisabled,
  disabledRowHint,
  onAdd,
  footerStart,
}: ProductPickerDialogProps<T>) {
  const { t } = useTranslation();
  const columnCount = columns.length + 2;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[calc(100vw-2rem)] max-w-3xl flex-col gap-3">
        <DialogHeader className="shrink-0">
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>

        <div className="relative shrink-0">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={t("common.productPicker.searchPlaceholder")}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex shrink-0 items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {t("common.productPicker.selectedCount", { count: selected.size })}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClearSelection}
            disabled={selected.size === 0}
          >
            {t("common.actions.clearSelection")}
          </Button>
        </div>

        <div className="min-h-0 flex-1 overflow-auto rounded-md border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead>{t("common.productPicker.columns.name")}</TableHead>
                {columns.map((column) => (
                  <TableHead
                    key={column.id}
                    className={cn("whitespace-nowrap", column.align === "right" && "text-right")}
                  >
                    {column.header}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading &&
                Array.from({ length: SKELETON_ROWS }, (_, index) => (
                  <TableRow key={`skeleton-${index}`}>
                    <TableCell colSpan={columnCount}>
                      <Skeleton className="h-6 w-full" />
                    </TableCell>
                  </TableRow>
                ))}

              {!isLoading && isError && (
                <TableRow>
                  <TableCell colSpan={columnCount} className="text-center text-muted-foreground">
                    <div className="flex flex-col items-center gap-2 py-4">
                      <span>{t("common.productPicker.error")}</span>
                      {onRetry && (
                        <Button type="button" variant="outline" size="sm" onClick={onRetry}>
                          {t("common.actions.tryAgain")}
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              )}

              {!isLoading && !isError && (rows?.length ?? 0) === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={columnCount}
                    className="py-6 text-center text-muted-foreground"
                  >
                    {t("common.productPicker.empty")}
                  </TableCell>
                </TableRow>
              )}

              {!isLoading &&
                !isError &&
                rows?.map((row) => {
                  const disabled = isRowDisabled?.(row) ?? false;
                  const checked = selected.has(row.id);
                  return (
                    <TableRow
                      key={row.id}
                      onClick={() => {
                        if (!disabled) onToggle(row, !checked);
                      }}
                      title={disabled ? disabledRowHint : undefined}
                      className={cn(
                        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer",
                        checked && "bg-muted/50",
                      )}
                    >
                      <TableCell onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={checked}
                          disabled={disabled}
                          onCheckedChange={(value) => onToggle(row, value === true)}
                          aria-label={t("common.productPicker.select", { name: row.name })}
                        />
                      </TableCell>
                      <TableCell>
                        <div className="font-medium">{row.name}</div>
                        {row.barcode && (
                          <div className="font-mono text-xs text-muted-foreground">
                            {row.barcode}
                          </div>
                        )}
                      </TableCell>
                      {columns.map((column) => (
                        <TableCell
                          key={column.id}
                          className={cn(
                            "whitespace-nowrap",
                            column.align === "right" && "text-right",
                          )}
                        >
                          {column.cell(row)}
                        </TableCell>
                      ))}
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </div>

        {/* Always rendered, even on a single page — the set asks for explicit previous/next. */}
        <div className="flex shrink-0 items-center justify-between gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            {t("common.productPicker.previous")}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t("common.pagination.pageOf", { page, total: Math.max(totalPages, 1) })}
          </span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            {t("common.productPicker.next")}
          </Button>
        </div>

        <DialogFooter className="shrink-0 gap-2 sm:items-center">
          {footerStart && <div className="sm:mr-auto">{footerStart}</div>}
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t("common.actions.cancel")}
          </Button>
          <Button type="button" onClick={onAdd} disabled={selected.size === 0}>
            {t("common.productPicker.add", { count: selected.size })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
