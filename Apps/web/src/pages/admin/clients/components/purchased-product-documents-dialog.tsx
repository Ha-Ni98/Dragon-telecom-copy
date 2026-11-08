import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
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
import { NotFoundState } from "@/components/shared/NotFoundState";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { usePurchasedProductDocuments } from "@/hooks/usePurchaseHistory";
import { useTranslation } from "@/hooks/useTranslation";
import { cn, formatDateTime, formatDZD } from "@/lib/utils";
import { orderDeepLink, saleDeepLink, type BackofficeScope } from "@/lib/deep-links";
import {
  PurchaseDocumentKind,
  type PurchasedProductDocumentDto,
  type PurchasedProductDto,
} from "@dragon-telecom/contract";
import type { PurchaseHistoryOwner } from "@/types/purchase-history.types";

const PAGE_SIZE = 10;

const KIND_LABEL_KEY: Record<PurchaseDocumentKind, string> = {
  [PurchaseDocumentKind.SALE]: "admin.clients.purchasedProducts.documents.kind.sale",
  [PurchaseDocumentKind.ORDER]: "admin.clients.purchasedProducts.documents.kind.order",
  [PurchaseDocumentKind.RETURN]: "admin.clients.purchasedProducts.documents.kind.return",
};

// A sale with the same product on two lines yields two rows with one documentId, so rows are keyed
// by their position on the page instead.
type DocumentRow = PurchasedProductDocumentDto & { rowKey: string };

interface PurchasedProductDocumentsDialogProps {
  owner: PurchaseHistoryOwner;
  product: PurchasedProductDto | null;
  onClose: () => void;
}

// The sale or order a row opens — a return opens the document it came from (it has no page).
function documentHref(scope: BackofficeScope, row: PurchasedProductDocumentDto): string {
  if (row.kind === PurchaseDocumentKind.SALE) return saleDeepLink(scope, row.reference);
  if (row.kind === PurchaseDocumentKind.ORDER) return orderDeepLink(scope, row.reference);
  const source = row.sourceReference ?? "";
  return row.sourceKind === PurchaseDocumentKind.ORDER
    ? orderDeepLink(scope, source)
    : saleDeepLink(scope, source);
}

// S36 — the documents behind one purchased product: each sale/order line that contained it and
// each return of it (own rows, newest first), from the stored line figures. Every row links to its
// sale or order (returns to the document they came from) via lib/deep-links.
export function PurchasedProductDocumentsDialog({
  owner,
  product,
  onClose,
}: PurchasedProductDocumentsDialogProps) {
  const { t, language } = useTranslation();
  const [page, setPage] = useState(1);

  useEffect(() => {
    setPage(1);
  }, [product?.productId]);

  const query = useMemo(() => ({ page, limit: PAGE_SIZE }), [page]);
  const { data, isLoading, isError } = usePurchasedProductDocuments(
    owner,
    product?.productId ?? null,
    query,
  );
  const linkScope: BackofficeScope = owner.kind === "client" ? "admin" : owner.scope;

  const rows = useMemo<DocumentRow[]>(
    () => (data?.items ?? []).map((item, index) => ({ ...item, rowKey: `${page}-${index}` })),
    [data, page],
  );

  const columns = useMemo<ColumnDef<DocumentRow>[]>(
    () => [
      {
        id: "type",
        header: t("admin.clients.purchasedProducts.documents.type"),
        cell: ({ row }) => t(KIND_LABEL_KEY[row.original.kind]),
      },
      {
        accessorKey: "at",
        header: t("admin.clients.purchasedProducts.documents.date"),
        cell: ({ row }) => formatDateTime(row.original.at, language),
      },
      {
        accessorKey: "reference",
        header: t("admin.clients.purchasedProducts.documents.reference"),
        cell: ({ row }) => (
          <div className="space-y-0.5">
            <Link
              to={documentHref(linkScope, row.original)}
              className="font-mono text-sm text-primary hover:underline"
            >
              {row.original.reference}
            </Link>
            {row.original.kind === PurchaseDocumentKind.RETURN && row.original.sourceReference && (
              <div className="text-xs text-muted-foreground">
                {t("admin.clients.purchasedProducts.documents.from", {
                  reference: row.original.sourceReference,
                })}
              </div>
            )}
          </div>
        ),
      },
      {
        accessorKey: "quantity",
        header: t("admin.clients.purchasedProducts.documents.quantity"),
      },
      {
        id: "unitPrice",
        header: t("admin.clients.purchasedProducts.documents.unitPrice"),
        cell: ({ row }) =>
          row.original.unitPrice != null ? formatDZD(row.original.unitPrice, language) : "—",
      },
      {
        accessorKey: "amount",
        header: t("admin.clients.purchasedProducts.documents.amount"),
        cell: ({ row }) => (
          <span
            className={cn(row.original.kind === PurchaseDocumentKind.RETURN && "text-destructive")}
          >
            {formatDZD(row.original.amount, language)}
          </span>
        ),
      },
    ],
    [t, language, linkScope],
  );

  return (
    <Dialog open={product != null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>
            {product
              ? t("admin.clients.purchasedProducts.documents.title", {
                  product: product.productName,
                })
              : ""}
          </DialogTitle>
          <DialogDescription>{t("admin.clients.purchasedProducts.note")}</DialogDescription>
        </DialogHeader>

        <div className="max-h-[70vh] space-y-4 overflow-y-auto">
          {isLoading ? (
            <TableSkeleton rows={5} columns={columns.length} />
          ) : isError ? (
            <NotFoundState title={t("admin.clients.purchasedProducts.error")} body="" />
          ) : (
            <DataTable
              columns={columns}
              data={rows}
              getRowKey={(row) => row.rowKey}
              renderMobileRow={(row) => (
                <div className="space-y-1 text-sm">
                  <div className="flex items-center justify-between gap-2">
                    <Link
                      to={documentHref(linkScope, row)}
                      className="font-mono text-primary hover:underline"
                    >
                      {row.reference}
                    </Link>
                    <span
                      className={cn(
                        "font-semibold",
                        row.kind === PurchaseDocumentKind.RETURN && "text-destructive",
                      )}
                    >
                      {formatDZD(row.amount, language)}
                    </span>
                  </div>
                  <div className="text-muted-foreground">
                    {t(KIND_LABEL_KEY[row.kind])} · {formatDateTime(row.at, language)} · ×
                    {row.quantity}
                  </div>
                </div>
              )}
              emptyState={
                <EmptyState
                  icon={<FileSearch className="h-6 w-6" />}
                  title={t("admin.clients.purchasedProducts.documents.empty")}
                  body=""
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
