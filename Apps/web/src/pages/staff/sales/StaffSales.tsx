import { useCallback, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/PageHeader";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { SalesFilters } from "@/pages/staff/sales/components/SalesFilters";
import { SalesTable } from "@/pages/staff/sales/components/SalesTable";
import { SaleDetailDrawer } from "@/pages/staff/sales/components/SaleDetailDrawer";
import { ReturnDialog } from "@/pages/admin/sales/components/ReturnDialog";
import { ReturnsTable } from "@/pages/admin/sales/components/ReturnsTable";
import { ReturnDetailDialog } from "@/pages/admin/sales/components/ReturnDetailDialog";
import { ReturnWholeSaleDialog } from "@/pages/admin/sales/components/ReturnWholeSaleDialog";
import {
  useSales,
  useSale,
  useCreateReturn,
  useReturns,
  useReturnWholeSale,
} from "@/hooks/useSales";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useReceiptPrint } from "@/hooks/use-receipt-print";
import { PosReceiptPrintable } from "@/pages/staff/pos/components/PosReceiptPrintable";
import { buildPosReceiptEscPos } from "@/pages/staff/pos/pos-receipt-escpos";
import { saleToReceipt } from "@/pages/staff/sales/sale-to-receipt";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useTranslation } from "@/hooks/useTranslation";
import {
  SaleStatus,
  storeLocalDate,
  type ReturnDto,
  type ReturnListQuery,
  type SaleDto,
  type SaleListQuery,
} from "@dragon-telecom/contract";
import type { CreateReturnFormValues } from "@/pages/admin/sales/components/create-return.schema";
import type { ReturnWholeSaleFormValues } from "@/pages/admin/sales/components/return-whole-sale.schema";

interface Props {
  scope?: "staff" | "admin";
}

// STF-05 `/staff/sales` = ADM-10 `/admin/sales` (scope-driven twin). set-03 Sprint 6 wiring.
// S34 — the seller and client boxes send free text (`seller`/`client`), matched server-side.
// They used to be resolved to an id here on an exact name match: the seller box matched usernames
// (the table shows first + last name) and sent a User id where Sale.staffId holds a Staff id, and
// the client box ignored partial names and phones (report-S34 F1/F2). The client search shows in
// both scopes (staff results stay limited to their own sales server-side); seller and the date
// range are admin-only.
// S18/D-2 — the Returns tab and issue-return are no longer admin-only: staff holding the sales
// page gets both, hitting the staff-mounted returns routes. Profit, the seller column and the
// footer total stay admin-only (margin data, gated inside SaleDetailDrawer/SalesTable directly).
// S32 — product search and the Today's sales toggle apply in both scopes (staff results stay
// limited to their own sales — enforced server-side); the date filter is on soldAt, in
// Africa/Algiers days. "Return whole sale" sits beside Issue return.
export default function StaffSales({ scope = "staff" }: Props) {
  const { t, language } = useTranslation();
  const navigate = useNavigate();

  const [status, setStatus] = useState<SaleStatus | undefined>();
  const [from, setFrom] = useState<string | undefined>();
  const [to, setTo] = useState<string | undefined>();
  const [sellerInput, setSellerInput] = useState("");
  const [clientInput, setClientInput] = useState("");
  const [productInput, setProductInput] = useState("");
  const [page, setPage] = useState(1);
  const debouncedProduct = useDebouncedValue(productInput, 300);

  // S32 — the store's day (Africa/Algiers), not the browser's or UTC.
  const today = storeLocalDate();
  const todayActive = from === today && to === today;
  const handleToggleToday = () => {
    setFrom(todayActive ? undefined : today);
    setTo(todayActive ? undefined : today);
    setPage(1);
  };

  const debouncedSeller = useDebouncedValue(sellerInput, 300);
  const debouncedClient = useDebouncedValue(clientInput, 300);

  const query: SaleListQuery = useMemo(
    () => ({
      status,
      // S32 (P7) — no longer admin-only: staff reach them through the Today toggle.
      from,
      to,
      // S34 — free text, matched server-side (sales.query.ts `client`/`seller`).
      client: debouncedClient.trim() || undefined,
      seller: scope === "admin" ? debouncedSeller.trim() || undefined : undefined,
      product: debouncedProduct.trim() || undefined,
      page,
      limit: 20,
    }),
    [status, from, to, scope, debouncedSeller, debouncedClient, debouncedProduct, page],
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
  // Reprint uses exactly the same path as the POS and the repair ticket: thermal via the helper
  // when it can reach a receipt printer, browser otherwise. It used to be a bare window.print(),
  // which printed the whole page rather than a receipt and never touched the helper at all.
  //
  // The receipt is rebuilt from the SaleDto because no endpoint returns a ReceiptDto for an
  // existing sale — see sale-to-receipt.ts, which mirrors the API's own mapper.
  const publicSettings = usePublicSettings();
  const { print: printReceiptDocument } = useReceiptPrint();
  const reprintReceipt = useMemo(
    () => (selectedSale ? saleToReceipt(selectedSale) : null),
    [selectedSale],
  );
  const handleReprint = useCallback(async () => {
    if (!reprintReceipt) return;
    const store = publicSettings.data?.store;
    await printReceiptDocument(
      () =>
        buildPosReceiptEscPos({
          receipt: reprintReceipt,
          issuedAt: reprintReceipt.soldAt ?? new Date().toISOString(),
          store,
          t,
          language,
        }),
      store?.printLogoUrl ?? store?.logoUrl,
    );
  }, [reprintReceipt, publicSettings.data?.store, printReceiptDocument, t, language]);
  const forbidden =
    saleIsError && axios.isAxiosError(saleError) && saleError.response?.status === 403;

  const returnMutation = useCreateReturn();

  const canReturn =
    !!selectedSale &&
    [SaleStatus.COMPLETED, SaleStatus.PARTIALLY_RETURNED].includes(selectedSale.status);

  // S12/F1 — ReturnDialog has always accepted `alreadyReturnedByLine`; until this set nothing
  // could produce it, so its per-line max was "sold" rather than "sold − already returned" and a
  // second return on the same line was rejected only by the server. limit 100: a single sale's
  // returns, not a page of the global list.
  const { data: saleReturns } = useReturns(
    scope,
    { saleId: selectedSale?.id, page: 1, limit: 100 },
    { enabled: canReturn && !!selectedSale },
  );
  const alreadyReturnedByLine = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of saleReturns?.items ?? []) {
      for (const line of item.lines) {
        map[line.saleLineId] = (map[line.saleLineId] ?? 0) + line.quantity;
      }
    }
    return map;
  }, [saleReturns]);

  const handleReturnSubmit = (values: CreateReturnFormValues) => {
    returnMutation.mutate(
      { scope, command: values },
      { onSuccess: () => setReturnDialogOpen(false) },
    );
  };

  // S32 (P2) — return every remaining line with one refund figure.
  const [wholeReturnOpen, setWholeReturnOpen] = useState(false);
  const wholeReturnMutation = useReturnWholeSale();
  const handleWholeReturnSubmit = (values: ReturnWholeSaleFormValues) => {
    wholeReturnMutation.mutate(
      { scope, command: values },
      { onSuccess: () => setWholeReturnOpen(false) },
    );
  };

  // S12, opened to staff by S18/D-2 — the Returns tab.
  const [returnsPage, setReturnsPage] = useState(1);
  const [selectedReturn, setSelectedReturn] = useState<ReturnDto | null>(null);
  const returnsQuery: ReturnListQuery = useMemo(
    () => ({ page: returnsPage, limit: 20 }),
    [returnsPage],
  );
  const {
    data: returnsResult,
    isLoading: returnsLoading,
    isError: returnsIsError,
    refetch: refetchReturns,
  } = useReturns(scope, returnsQuery);

  const salesSection = (
    <>
      <SalesFilters
        status={status}
        onStatusChange={(next) => {
          setStatus(next);
          setPage(1);
        }}
        productQuery={productInput}
        onProductQueryChange={(next) => {
          setProductInput(next);
          setPage(1);
        }}
        todayActive={todayActive}
        onToggleToday={handleToggleToday}
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
        sellerQuery={sellerInput}
        onSellerQueryChange={(next) => {
          setSellerInput(next);
          setPage(1);
        }}
        clientQuery={clientInput}
        onClientQueryChange={(next) => {
          setClientInput(next);
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
    </>
  );

  const returnsSection = (
    <>
      <ReturnsTable
        returns={returnsResult?.items}
        isLoading={returnsLoading}
        isError={returnsIsError}
        onRetry={() => refetchReturns()}
        onRowClick={setSelectedReturn}
      />

      {returnsResult && returnsResult.meta.totalPages > 1 && (
        <SimplePagination
          page={returnsResult.meta.page}
          totalPages={returnsResult.meta.totalPages}
          onPageChange={setReturnsPage}
        />
      )}
    </>
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title={scope === "admin" ? t("admin.sales.pageTitle") : t("staff.sales.pageTitle")}
      />

      <Tabs defaultValue="sales">
        <TabsList>
          <TabsTrigger value="sales">{t("admin.sales.tabs.sales")}</TabsTrigger>
          <TabsTrigger value="returns">{t("admin.sales.tabs.returns")}</TabsTrigger>
        </TabsList>
        <TabsContent value="sales" className="space-y-6">
          {salesSection}
        </TabsContent>
        <TabsContent value="returns" className="space-y-6">
          {returnsSection}
        </TabsContent>
      </Tabs>

      <SaleDetailDrawer
        open={!!selectedReference}
        onOpenChange={(open) => !open && setSelectedReference(null)}
        sale={saleLoading ? null : (selectedSale ?? null)}
        onReprint={handleReprint}
        onResumeDraft={
          selectedSale ? () => navigate(`/${scope}/pos?draftId=${selectedSale.id}`) : undefined
        }
        onIssueReturn={canReturn ? () => setReturnDialogOpen(true) : undefined}
        onReturnWholeSale={canReturn ? () => setWholeReturnOpen(true) : undefined}
        scope={scope}
        forbidden={forbidden}
      />

      {/* The browser-fallback artefact. printReceipt() reveals whatever carries
          RECEIPT_ROOT_CLASS, so without this mounted the fallback would print the whole page —
          which is exactly what the old bare window.print() did. Invisible on screen: index.css
          only reveals the receipt root during a lib/print.ts-driven print. */}
      {reprintReceipt && (
        <PosReceiptPrintable
          reference={reprintReceipt.reference}
          lines={reprintReceipt.lines}
          issuedAt={reprintReceipt.soldAt ?? new Date().toISOString()}
          subtotal={reprintReceipt.subtotal}
          discountAmount={reprintReceipt.discountAmount}
          total={reprintReceipt.total}
          previousCredit={reprintReceipt.previousCredit}
          grandTotal={reprintReceipt.grandTotal}
          paid={reprintReceipt.totalPaid}
          newCredit={reprintReceipt.newCredit}
          posClientName={reprintReceipt.posClientName}
          staffName={reprintReceipt.staffName}
          store={publicSettings.data?.store}
        />
      )}

      <ReturnDialog
        // Forces a fresh mount per sale — same defaultValues-frozen-at-first-render bug as
        // OrderConfirmDialog (StaffOrders.tsx), found while writing set-03 Sprint 9's tests.
        // S12 — also folds in the returns count so the bounds recompute after a return lands
        // rather than staying frozen at the first render's values.
        key={`${selectedSale?.id ?? "none"}-${saleReturns?.meta.total ?? 0}`}
        open={returnDialogOpen}
        onOpenChange={setReturnDialogOpen}
        sale={selectedSale ?? null}
        alreadyReturnedByLine={alreadyReturnedByLine}
        onSubmit={handleReturnSubmit}
        isSubmitting={returnMutation.isPending}
      />
      <ReturnWholeSaleDialog
        // Same fresh-mount-per-sale-and-return-count key as ReturnDialog above.
        key={`whole-${selectedSale?.id ?? "none"}-${saleReturns?.meta.total ?? 0}`}
        open={wholeReturnOpen}
        onOpenChange={setWholeReturnOpen}
        sale={selectedSale ?? null}
        alreadyReturnedByLine={alreadyReturnedByLine}
        onSubmit={handleWholeReturnSubmit}
        isSubmitting={wholeReturnMutation.isPending}
      />
      <ReturnDetailDialog
        open={!!selectedReturn}
        onOpenChange={(open) => !open && setSelectedReturn(null)}
        item={selectedReturn}
      />
    </div>
  );
}
