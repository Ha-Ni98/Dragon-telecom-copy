import { useEffect, useMemo, useState } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { FileSearch } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { useCashRegisterDocuments } from "@/hooks/useStatistics";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD, formatStoreTime } from "@/lib/utils";
import { CashRegisterDrill, type CashRegisterDocumentDto } from "@dragon-telecom/contract";
import type {
  CashRegisterDrillColumns,
  CashRegisterDrillTarget,
} from "@/types/cash-register.types";

// Which optional columns each drill list shows (plan S33 Action 3.7; S35 adds profit — this endpoint
// is admin-only, so the margin is shown here so each profit figure can be checked against its documents).
const DRILL_COLUMNS: Record<CashRegisterDrill, CashRegisterDrillColumns> = {
  [CashRegisterDrill.SALES]: { paid: true, sourceReference: false, profit: true },
  [CashRegisterDrill.RETURNS]: { paid: false, sourceReference: true, profit: false },
  [CashRegisterDrill.REPAIRS_PICKED_UP]: { paid: true, sourceReference: false, profit: true },
  [CashRegisterDrill.REPAIR_REFUNDS]: { paid: false, sourceReference: false, profit: false },
  [CashRegisterDrill.ORDERS_CONFIRMED]: { paid: false, sourceReference: false, profit: false },
  [CashRegisterDrill.ORDERS_IN_DELIVERY]: { paid: false, sourceReference: false, profit: false },
  [CashRegisterDrill.ORDERS_COMPLETED]: { paid: true, sourceReference: false, profit: true },
  [CashRegisterDrill.SUPPLIER_INVOICES]: { paid: false, sourceReference: false, profit: false },
  [CashRegisterDrill.SUPPLIER_PAYMENTS]: { paid: false, sourceReference: true, profit: false },
  // S35 — the standalone Payments line. A client payment shows the invoice it settled, if any.
  [CashRegisterDrill.PAYMENTS_CLIENT]: { paid: false, sourceReference: true, profit: false },
  [CashRegisterDrill.PAYMENTS_SUPPLIER]: { paid: false, sourceReference: false, profit: false },
};

const PAGE_SIZE = 20;

interface CashRegisterDrillDialogProps {
  date: string;
  target: CashRegisterDrillTarget | null;
  onClose: () => void;
}

// S33 — the documents behind one Caisse figure. The server filters them with the very same
// where-builder and day bounds as the figure itself, so the rows always add up to it. Paginated
// (20 a page), oldest first.
export function CashRegisterDrillDialog({ date, target, onClose }: CashRegisterDrillDialogProps) {
  const { t, language } = useTranslation();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [target?.drill, date]);

  const drill = target?.drill ?? CashRegisterDrill.SALES;
  const { data, isLoading } = useCashRegisterDocuments(
    { date, drill, page, limit: PAGE_SIZE },
    { enabled: target != null },
  );
  const show = DRILL_COLUMNS[drill];

  const columns = useMemo<ColumnDef<CashRegisterDocumentDto>[]>(
    () => [
      {
        accessorKey: "reference",
        header: t("admin.cashRegister.drill.reference"),
        cell: ({ row }) => <span className="font-mono text-sm">{row.original.reference}</span>,
      },
      {
        accessorKey: "at",
        header: t("admin.cashRegister.drill.time"),
        cell: ({ row }) => formatStoreTime(row.original.at, language),
      },
      {
        id: "party",
        header: t("admin.cashRegister.drill.party"),
        cell: ({ row }) => row.original.partyName ?? t("staff.sales.table.counter"),
      },
      {
        accessorKey: "amount",
        header: t("admin.cashRegister.drill.amount"),
        cell: ({ row }) => formatDZD(row.original.amount, language),
      },
      ...(show.paid
        ? [
            {
              id: "paid",
              header: t("admin.cashRegister.drill.paid"),
              cell: ({ row }) => formatDZD(row.original.paid ?? 0, language),
            } satisfies ColumnDef<CashRegisterDocumentDto>,
          ]
        : []),
      ...(show.profit
        ? [
            {
              id: "profit",
              header: t("admin.cashRegister.drill.profit"),
              cell: ({ row }) =>
                row.original.profit != null ? formatDZD(row.original.profit, language) : "—",
            } satisfies ColumnDef<CashRegisterDocumentDto>,
          ]
        : []),
      ...(show.sourceReference
        ? [
            {
              id: "source",
              header: t("admin.cashRegister.drill.source"),
              cell: ({ row }) => (
                <span className="font-mono text-sm">{row.original.sourceReference ?? "—"}</span>
              ),
            } satisfies ColumnDef<CashRegisterDocumentDto>,
          ]
        : []),
    ],
    [t, language, show.paid, show.profit, show.sourceReference],
  );

  return (
    <Dialog open={target != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{target ? t(target.titleKey) : ""}</DialogTitle>
          <DialogDescription>{date}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton rows={5} columns={columns.length} />
          ) : (
            <DataTable
              columns={columns}
              data={data?.items ?? []}
              getRowKey={(row) => row.id}
              renderMobileRow={(row) => (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-mono">{row.reference}</span>
                    <span className="font-semibold">{formatDZD(row.amount, language)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2 text-muted-foreground">
                    <span>
                      {formatStoreTime(row.at, language)} ·{" "}
                      {row.partyName ?? t("staff.sales.table.counter")}
                    </span>
                    {show.paid && (
                      <span>
                        {t("admin.cashRegister.drill.paid")}: {formatDZD(row.paid ?? 0, language)}
                      </span>
                    )}
                    {show.sourceReference && row.sourceReference && (
                      <span className="font-mono">{row.sourceReference}</span>
                    )}
                  </div>
                </div>
              )}
              emptyState={
                <EmptyState
                  icon={<FileSearch className="h-6 w-6" />}
                  title={t("admin.cashRegister.drill.empty")}
                  body={date}
                />
              }
            />
          )}

          {data && data.meta.totalPages > 1 && (
            <SimplePagination
              page={data.meta.page}
              totalPages={data.meta.totalPages}
              onPageChange={setPage}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
