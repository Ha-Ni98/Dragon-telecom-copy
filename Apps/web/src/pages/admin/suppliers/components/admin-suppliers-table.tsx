import { memo, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import type { ColumnDef } from "@tanstack/react-table";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import {
  Truck,
  AlertTriangle,
  Edit,
  Plus,
  Ban,
  RotateCcw,
  Phone,
  Mail,
  MapPin,
  Search,
} from "lucide-react";
import type { PaginatedResult, SupplierDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface AdminSuppliersTableProps {
  data?: PaginatedResult<SupplierDto>;
  loading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  onEdit: (supplierId: string) => void;
  onToggleEnabled: (supplierId: string, nextEnabled: boolean) => void;
  onPageChange: (page: number) => void;
  searchQuery?: string;
  onSearchChange?: (query: string) => void;
  className?: string;
}

function formatCurrency(amount: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "DZD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

// ADM-07 — retyped off SupplierDto (purchasing.dtos.ts): `id` is a uuid string (was
// `idSupplier: number`), `name`/`contactName`/`phone`/`email`/`location` (was
// `supplierName`/`supplierPersonName`/...), `credit`/`totalPaid`/`totalInvoiced`/
// `invoiceCount` (was `supplierCredit`/`totalDue`/`totalCredit`/`productsSuppliedCount`/
// `invoicesCount` — none of which the DTO carries). "Add invoice" is a `<Link>` to ADM-08
// with the supplier preselected (plan §Page 2), not a dialog; delete becomes disable
// (`isEnabled: false` — suppliers are never hard-deleted, per the universal isEnabled
// convention). S7 I12: the action is now a two-way toggle (`onToggleEnabled`) — a disabled
// supplier's row shows a re-enable icon instead, and hides the "add invoice" link entirely
// (S7 I13).
export const AdminSuppliersTable = memo(function AdminSuppliersTable({
  data,
  loading = false,
  error = null,
  onRetry,
  onEdit,
  onToggleEnabled,
  onPageChange,
  searchQuery = "",
  onSearchChange,
  className = "",
}: AdminSuppliersTableProps) {
  const { t } = useTranslation();
  const suppliers = data?.items ?? [];
  const pagination = data?.meta;

  const renderActions = useCallback(
    (supplier: SupplierDto) => (
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onEdit(supplier.id)}
          className="h-8 w-8 p-0"
        >
          <Edit className="h-4 w-4" />
        </Button>
        {supplier.isEnabled && (
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" asChild>
            <Link to={`/admin/supplier-invoices/new?supplierId=${supplier.id}`}>
              <Plus className="h-4 w-4" />
            </Link>
          </Button>
        )}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onToggleEnabled(supplier.id, !supplier.isEnabled)}
          className={
            supplier.isEnabled
              ? "h-8 w-8 p-0 text-destructive hover:text-destructive"
              : "h-8 w-8 p-0"
          }
          aria-label={
            supplier.isEnabled
              ? t("admin.suppliers.table.disable")
              : t("admin.suppliers.table.enable")
          }
        >
          {supplier.isEnabled ? <Ban className="h-4 w-4" /> : <RotateCcw className="h-4 w-4" />}
        </Button>
      </div>
    ),
    [onEdit, onToggleEnabled, t],
  );

  const columns = useMemo<ColumnDef<SupplierDto>[]>(
    () => [
      {
        accessorKey: "name",
        header: t("admin.suppliers.table.supplier"),
        cell: ({ row }) => (
          <div className="max-w-[150px] break-words font-medium">{row.original.name}</div>
        ),
      },
      {
        accessorKey: "contactName",
        header: t("admin.suppliers.table.person"),
        cell: ({ row }) => (
          <div className="max-w-[120px] break-words">{row.original.contactName ?? "-"}</div>
        ),
      },
      {
        id: "contact",
        header: t("admin.suppliers.table.contact"),
        cell: ({ row }) => (
          <div className="max-w-[200px] space-y-1">
            {row.original.phone && (
              <div className="flex items-center gap-1 text-sm">
                <Phone className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.original.phone}</span>
              </div>
            )}
            {row.original.email && (
              <div className="flex items-center gap-1 text-sm">
                <Mail className="h-3 w-3 shrink-0" />
                <span className="truncate">{row.original.email}</span>
              </div>
            )}
            {!row.original.phone && !row.original.email && (
              <span className="text-muted-foreground">-</span>
            )}
          </div>
        ),
      },
      {
        accessorKey: "location",
        header: t("admin.suppliers.table.location"),
        cell: ({ row }) =>
          row.original.location ? (
            <div className="flex max-w-[100px] items-center gap-1 break-words text-sm">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="break-words">{row.original.location}</span>
            </div>
          ) : (
            <span className="text-muted-foreground">-</span>
          ),
      },
      {
        accessorKey: "credit",
        header: t("admin.suppliers.table.credit"),
        cell: ({ row }) => <div className="font-medium">{formatCurrency(row.original.credit)}</div>,
      },
      {
        accessorKey: "invoiceCount",
        header: t("admin.suppliers.table.invoices"),
        cell: ({ row }) => row.original.invoiceCount,
      },
      {
        accessorKey: "isEnabled",
        header: t("common.labels.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        id: "actions",
        header: t("admin.suppliers.table.actions"),
        cell: ({ row }) => renderActions(row.original),
      },
    ],
    [t, renderActions],
  );

  const renderMobileRow = (supplier: SupplierDto) => (
    <div className="space-y-2 p-4">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-medium">{supplier.name}</div>
          <div className="text-sm text-muted-foreground">{supplier.contactName ?? "-"}</div>
        </div>
        {renderActions(supplier)}
      </div>
      <div className="grid grid-cols-2 gap-2 border-t pt-2 text-sm">
        <div className="font-medium">{formatCurrency(supplier.credit)}</div>
        <div>
          {supplier.invoiceCount} {t("admin.suppliers.table.invoices")}
        </div>
      </div>
    </div>
  );

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg">{t("admin.suppliers.table.title")}</CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {onSearchChange && (
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={t("admin.suppliers.table.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="pl-10"
            />
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={5} columns={8} />
        ) : error ? (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-center gap-4">
              <span>{error}</span>
              {onRetry && (
                <Button variant="outline" size="sm" onClick={onRetry}>
                  {t("common.retry")}
                </Button>
              )}
            </AlertDescription>
          </Alert>
        ) : (
          <DataTable
            columns={columns}
            data={suppliers}
            getRowKey={(supplier) => supplier.id}
            renderMobileRow={renderMobileRow}
            emptyState={
              <EmptyState
                icon={<Truck className="h-6 w-6" />}
                title={t("admin.suppliers.table.noSuppliers")}
                body={t("admin.suppliers.table.noSuppliersDescription")}
              />
            }
          />
        )}

        {pagination && (
          <div className="mt-3">
            <SimplePagination
              page={pagination.page}
              totalPages={pagination.totalPages}
              onPageChange={onPageChange}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
});

export default AdminSuppliersTable;
