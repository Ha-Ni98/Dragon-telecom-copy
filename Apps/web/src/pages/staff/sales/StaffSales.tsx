import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { SalesFilters } from "@/pages/staff/sales/components/SalesFilters";
import { SalesTable } from "@/pages/staff/sales/components/SalesTable";
import { SaleDetailDrawer } from "@/pages/staff/sales/components/SaleDetailDrawer";
import { ReturnDialog } from "@/pages/admin/sales/components/ReturnDialog";
import { useSales, useSale, useCreateReturn } from "@/hooks/useSales";
import { useUsers } from "@/hooks/useIdentity";
import { usePosClientSearch } from "@/hooks/usePosClients";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import { SaleStatus, type SaleDto, type SaleListQuery } from "@dragon-telecom/contract";
import type { CreateReturnFormValues } from "@/pages/admin/sales/components/create-return.schema";

interface Props {
  scope?: "staff" | "admin";
}

// STF-05 `/staff/sales` = ADM-10 `/admin/sales` (scope-driven twin). set-03 Sprint 6 wiring.
// Admin's seller/POS-client filters (A3) are free-text name inputs on the Sprint 4 `SalesFilters`
// component (no picker/dropdown affordance was built) — resolved to a `sellerId`/`posClientId`
// here only on an exact, case-insensitive name match against the debounced search results, never
// a "first match" guess (report-sprint-06.md: avoids silently filtering to the wrong seller).
// `useUsers` only fires for scope="admin" (a staff caller may not hold identity:list-users).
export default function StaffSales({ scope = "staff" }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<SaleStatus | undefined>();
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [sellerNameInput, setSellerNameInput] = useState("");
  const [posClientNameInput, setPosClientNameInput] = useState("");
  const [page, setPage] = useState(1);

  const debouncedSeller = useDebouncedValue(sellerNameInput, 300);
  const debouncedPosClient = useDebouncedValue(posClientNameInput, 300);

  const { data: sellerMatches } = useUsers(
    { search: debouncedSeller || undefined, page: 1, limit: 5 },
    { enabled: scope === "admin" && !!debouncedSeller.trim() },
  );
  const sellerId = useMemo(() => {
    if (scope !== "admin" || !debouncedSeller.trim()) return undefined;
    return sellerMatches?.items.find(
      (u) => u.username.toLowerCase() === debouncedSeller.trim().toLowerCase(),
    )?.id;
  }, [scope, sellerMatches, debouncedSeller]);

  const { data: posClientMatches } = usePosClientSearch({
    q: scope === "admin" ? debouncedPosClient : "",
  });
  const posClientId = useMemo(() => {
    if (scope !== "admin" || !debouncedPosClient.trim()) return undefined;
    return posClientMatches?.find(
      (c) => c.name.toLowerCase() === debouncedPosClient.trim().toLowerCase(),
    )?.id;
  }, [scope, posClientMatches, debouncedPosClient]);

  const query: SaleListQuery = useMemo(
    () => ({
      status,
      from: scope === "admin" ? from : undefined,
      to: scope === "admin" ? to : undefined,
      sellerId,
      posClientId,
      page,
      limit: 20,
    }),
    [status, from, to, sellerId, posClientId, page, scope],
  );

  const {
    data: salesResult,
    isLoading: salesLoading,
    isError: salesIsError,
    refetch: refetchSales,
  } = useSales(scope, query);

  const [selectedReference, setSelectedReference] = useState<string | null>(null);
  const [returnDialogOpen, setReturnDialogOpen] = useState(false);
  const handleRowClick = useCallback((sale: SaleDto) => setSelectedReference(sale.reference), []);

  const {
    data: selectedSale,
    isLoading: saleLoading,
    isError: saleIsError,
    error: saleError,
  } = useSale(scope, selectedReference ?? "");
  const forbidden =
    saleIsError && axios.isAxiosError(saleError) && saleError.response?.status === 403;

  const returnMutation = useCreateReturn();

  const handleReturnSubmit = (values: CreateReturnFormValues) => {
    returnMutation.mutate(values, { onSuccess: () => setReturnDialogOpen(false) });
  };

  const canReturn =
    scope === "admin" &&
    !!selectedSale &&
    [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED].includes(selectedSale.status);

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "admin" ? t("admin.sales.pageTitle") : t("staff.sales.pageTitle")}
      />

      <SalesFilters
        status={status}
        onStatusChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        scope={scope}
        from={from}
        onFromChange={(next) => {
          setFrom(next || undefined);
          setPage(1);
        }}
        to={to}
        onToChange={(next) => {
          setTo(next || undefined);
          setPage(1);
        }}
        sellerName={sellerNameInput}
        onSellerSearch={(next) => {
          setSellerNameInput(next);
          setPage(1);
        }}
        posClientName={posClientNameInput}
        onPosClientSearch={(next) => {
          setPosClientNameInput(next);
          setPage(1);
        }}
      />

      <SalesTable
        sales={salesResult?.items}
        isLoading={salesLoading}
        isError={salesIsError}
        onRetry={() => refetchSales()}
        onRowClick={handleRowClick}
        scope={scope}
      />

      {salesResult && salesResult.meta.totalPages > 1 && (
        <SimplePagination
          page={salesResult.meta.page}
          totalPages={salesResult.meta.totalPages}
          onPageChange={setPage}
        />
      )}

      <SaleDetailDrawer
        open={!!selectedReference}
        onOpenChange={(open) => !open && setSelectedReference(null)}
        sale={saleLoading ? null : (selectedSale ?? null)}
        onReprint={() => window.print()}
        onResumeDraft={
          selectedSale ? () => navigate(`/${scope}/pos?draftId=${selectedSale.id}`) : undefined
        }
        onIssueReturn={canReturn ? () => setReturnDialogOpen(true) : undefined}
        scope={scope}
        forbidden={forbidden}
      />

      {scope === "admin" && (
        <ReturnDialog
          // Forces a fresh mount per sale — same defaultValues-frozen-at-first-render bug as
          // OrderConfirmDialog (StaffOrders.tsx), found while writing set-03 Sprint 9's tests.
          key={selectedSale?.id ?? "none"}
          open={returnDialogOpen}
          onOpenChange={setReturnDialogOpen}
          sale={selectedSale ?? null}
          onSubmit={handleReturnSubmit}
          isSubmitting={returnMutation.isPending}
        />
      )}
    </div>
  );
}
