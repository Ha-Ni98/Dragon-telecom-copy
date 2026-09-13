import { useEffect, useMemo, useRef, useState } from "react";
import { FileStack } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/PageHeader";
import { PosProductSearch } from "@/pages/staff/pos/components/PosProductSearch";
import { FamilyQuickPickGrid } from "@/pages/staff/pos/components/FamilyQuickPickGrid";
import { PosTicket, type PosTicketLine } from "@/pages/staff/pos/components/PosTicket";
import { PosClientAttachZone } from "@/pages/staff/pos/components/PosClientAttachZone";
import { PosPaymentPanel } from "@/pages/staff/pos/components/PosPaymentPanel";
import { MyDraftsDrawer } from "@/pages/staff/pos/components/MyDraftsDrawer";
import { PosReceiptView } from "@/pages/staff/pos/components/PosReceiptView";
import { QuickAddPosClientDialog } from "@/pages/staff/pos/components/QuickAddPosClientDialog";
import { useStaffProducts } from "@/hooks/useCatalogProducts";
import { useCatalogFamilies } from "@/hooks/useCatalogTaxonomy";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { usePosClientSearch, useQuickCreatePosClient } from "@/hooks/usePosClients";
import {
  useSales,
  useCreateDraft,
  useUpdateDraft,
  useDeleteDraft,
  useConfirmSale,
} from "@/hooks/useSales";
import { useSendStaffSearch } from "@/hooks/useObservability";
import { usePublicSettings } from "@/hooks/usePlatform";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { useKeyboardShortcuts } from "@/hooks/use-keyboard-navigation";
import { useTranslation } from "@/hooks/useTranslation";
import { apiErrorMessage } from "@/lib/query-client";
import { printReceipt } from "@/lib/print";
import { resolvePosPrice } from "@/pages/staff/pos/pos-pricing";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  SaleStatus,
  type PosClientDto,
  type StaffProductDto,
  type SaleDto,
  type ReceiptDto,
  type SaleDraftCommand,
} from "@dragon-telecom/contract";
import type { QuickAddPosClientFormValues } from "@/pages/staff/pos/quick-add-pos-client.schema";

interface Props {
  /** Admin mounts this same tree unscoped (ADM-05 — "the exact STF-02 component, mounted
   * unscoped"); everything below reads this to decide staff-self vs all-staff data + actions. */
  scope?: "staff" | "admin";
}

interface TicketLineState {
  productId: string;
  productName: string;
  availableQuantity: number;
  categoryPrices: { categoryId: string; price: number }[];
  defaultSalePrice: number;
  quantity: number;
  unitPrice: number;
  resolvedPrice: number;
  manualPrice: boolean;
  serialNumbers?: string[];
}

// STF-02 `/staff/pos` = ADM-05 `/admin/pos` (scope-driven, unscoped for admin — "everyone's
// drafts, grouped by staff"). set-03 Sprint 7 wiring.
//
// Product search always uses `useStaffProducts` regardless of scope, not
// `useAdminCatalogProducts` as the plan's shorthand parenthetical suggested — `PosProductSearch`
// (Sprint 4) is hard-typed to `StaffProductDto[]`, which already carries exactly what a ticket
// needs (availableQuantity, defaultSalePrice, categoryPrices); `AdminProductDto` lacks
// equivalents and using it would need a second component variant, contradicting the twin
// pattern's single-tree design. Documented in report-sprint-07.md.
export default function StaffPos({ scope = "staff" }: Props) {
  const { t } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);

  // --- Left pane: product search ---
  const [productQuery, setProductQuery] = useState("");
  const debouncedProductQuery = useDebouncedValue(productQuery, 300);
  const [familyId, setFamilyId] = useState<string | undefined>();
  const {
    data: productsResult,
    isLoading: productsLoading,
    isError: productsIsError,
    refetch: refetchProducts,
  } = useStaffProducts({
    search: debouncedProductQuery || undefined,
    familyId,
    page: 1,
    limit: 20,
  });
  const { data: families } = useCatalogFamilies({});

  // The staff-search log records only the last thing typed, 2s after typing stops (S6/I7) — a much
  // longer window than the 300ms that drives the result list above, so a cashier typing a product
  // name logs one row, not one per keystroke. POS only: /admin/products and /staff/products keep
  // their own 300ms beacon (R3) — this is a second, independent debounce off the same raw query.
  const sendStaffSearch = useSendStaffSearch();
  // S25 — the receipt's store header (name/address/phone/logo). Public because the POS is a
  // STAFF page and GET /platform/settings is adminOnly.
  const publicSettings = usePublicSettings();
  const beaconQuery = useDebouncedValue(productQuery, 2000);
  useEffect(() => {
    if (beaconQuery.trim()) sendStaffSearch.mutate({ query: beaconQuery.trim() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [beaconQuery]);

  // --- Ticket state (client-side draft, PATCHed on change) ---
  const [lines, setLines] = useState<TicketLineState[]>([]);
  const [attachedClient, setAttachedClient] = useState<PosClientDto | undefined>();
  const [draftId, setDraftId] = useState<string | null>(null);
  const [paidAmount, setPaidAmount] = useState(0);
  // S6/I5/R1 — paidAmount auto-tracks the ticket total until the cashier types their own figure;
  // set true by the payment panel's onChange, reset on a fresh ticket or a resumed draft.
  const [paidAmountTouched, setPaidAmountTouched] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  // S25 — captured once when the receipt is set, not derived at render: the receipt view stays
  // mounted until "New sale", so a render-time `new Date()` would creep forward on every re-render.
  // S27 — now only the fallback: `receipt.soldAt` (the server's confirm-time stamp) is preferred
  // when present, since it is the honest source; this stays as the fallback for the unlikely case
  // a sale's `soldAt` comes back null.
  const [receiptAt, setReceiptAt] = useState<string | null>(null);
  const [clientZoneError, setClientZoneError] = useState<string>();
  const [paymentError, setPaymentError] = useState<string>();

  const ticketLines: PosTicketLine[] = useMemo(
    () =>
      lines.map((l) => ({
        productId: l.productId,
        productName: l.productName,
        quantity: l.quantity,
        availableQuantity: l.availableQuantity,
        resolvedPrice: l.resolvedPrice,
        unitPrice: l.unitPrice,
        lineTotal: l.quantity * l.unitPrice,
        serialNumbers: l.serialNumbers,
      })),
    [lines],
  );
  const subtotal = useMemo(
    () => ticketLines.reduce((sum, l) => sum + l.lineTotal, 0),
    [ticketLines],
  );
  // The discount is no longer settable from the POS (S6/I6) — the total is simply the subtotal.
  const total = subtotal;

  // The paid amount defaults to the ticket total — the cashier's most common case is exact
  // payment — and keeps following it until they type their own figure (S6/I5/R1). The client's
  // outstanding credit is deliberately NOT added in: this field is what is being paid for THIS
  // sale; settling an older balance is the separate record-payment flow.
  useEffect(() => {
    if (!paidAmountTouched) setPaidAmount(total);
  }, [total, paidAmountTouched]);

  const handleSelectProduct = (product: StaffProductDto) => {
    setLines((prev) => {
      const existing = prev.find((l) => l.productId === product.id);
      if (existing) {
        return prev.map((l) =>
          l.productId === product.id
            ? { ...l, quantity: Math.min(l.quantity + 1, l.availableQuantity) }
            : l,
        );
      }
      const resolvedPrice = resolvePosPrice(
        product.categoryPrices,
        product.defaultSalePrice ?? 0,
        attachedClient?.categoryId,
      );
      return [
        ...prev,
        {
          productId: product.id,
          productName: product.name,
          availableQuantity: product.availableQuantity,
          categoryPrices: product.categoryPrices,
          defaultSalePrice: product.defaultSalePrice ?? 0,
          quantity: 1,
          unitPrice: resolvedPrice,
          resolvedPrice,
          manualPrice: false,
        },
      ];
    });
  };

  const handleQuantityChange = (productId: string, quantity: number) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, quantity } : l)));

  const handleUnitPriceChange = (productId: string, unitPrice: number) =>
    setLines((prev) =>
      prev.map((l) => (l.productId === productId ? { ...l, unitPrice, manualPrice: true } : l)),
    );

  const handleSerialNumbersChange = (productId: string, serialNumbers: string[]) =>
    setLines((prev) => prev.map((l) => (l.productId === productId ? { ...l, serialNumbers } : l)));

  const handleRemoveLine = (productId: string) =>
    setLines((prev) => prev.filter((l) => l.productId !== productId));

  // Re-resolve non-overridden lines to the attached client's category price (delta visible via
  // ResolvedVsChargedPrice); manually-overridden lines and rehydrated-draft lines (manualPrice
  // forced true, see handleOpenDraft) are left untouched.
  const reresolveLines = (client: PosClientDto | undefined) =>
    setLines((prev) =>
      prev.map((l) => {
        if (l.manualPrice) return l;
        const resolvedPrice = resolvePosPrice(
          l.categoryPrices,
          l.defaultSalePrice,
          client?.categoryId,
        );
        return { ...l, resolvedPrice, unitPrice: resolvedPrice };
      }),
    );

  // --- POS client attach zone ---
  const [clientSearchQuery, setClientSearchQuery] = useState("");
  const debouncedClientSearch = useDebouncedValue(clientSearchQuery, 300);
  const { data: clientResults, isLoading: clientSearching } = usePosClientSearch({
    q: debouncedClientSearch,
  });
  const categories = useCatalogClientCategories();
  const categoryOptions: AutocompleteOption[] = useMemo(
    () => (categories.data ?? []).map((c) => ({ value: c.id, label: c.name })),
    [categories.data],
  );

  const handleAttachClient = (client: PosClientDto) => {
    setAttachedClient(client);
    setClientSearchQuery("");
    setClientZoneError(undefined);
    reresolveLines(client);
  };
  const handleDetachClient = () => {
    setAttachedClient(undefined);
    reresolveLines(undefined);
  };

  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const quickCreateClient = useQuickCreatePosClient();
  const handleQuickAddSubmit = (values: QuickAddPosClientFormValues) => {
    quickCreateClient.mutate(values, {
      onSuccess: (client) => {
        setQuickAddOpen(false);
        handleAttachClient(client);
      },
    });
  };

  // --- Draft persistence (PATCH-on-change, STF-02 §Forms) ---
  const createDraft = useCreateDraft();
  const updateDraft = useUpdateDraft();
  const deleteDraft = useDeleteDraft();

  const buildDraftCommand = (): SaleDraftCommand => ({
    posClientId: attachedClient?.id,
    // Always 0 — the discount is no longer settable from the POS (S6/I6); the column and the DTO
    // field remain (rendered wherever a sale's own details are shown).
    discountAmount: 0,
    lines: lines.map((l) => ({
      productId: l.productId,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      serialNumbers: l.serialNumbers,
    })),
  });

  // buildDraftCommand is a plain per-render function (not memoized on purpose); its own inputs
  // are already the dep array below.
  const draftSnapshot = useMemo(
    () => JSON.stringify(buildDraftCommand()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [lines, attachedClient],
  );
  const debouncedDraftSnapshot = useDebouncedValue(draftSnapshot, 600);
  const lastSyncedSnapshotRef = useRef<string | null>(null);
  useEffect(() => {
    if (lines.length === 0) return;
    if (debouncedDraftSnapshot === lastSyncedSnapshotRef.current) return;
    const command: SaleDraftCommand = JSON.parse(debouncedDraftSnapshot);
    lastSyncedSnapshotRef.current = debouncedDraftSnapshot;
    if (!draftId) {
      createDraft.mutate(command, { onSuccess: (sale) => setDraftId(sale.id) });
    } else {
      updateDraft.mutate({ id: draftId, command });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedDraftSnapshot]);

  // Emptying the ticket deletes the draft rather than PATCHing it: UpdateSaleDraftSchema.lines is
  // .min(1), so a zero-line draft is not expressible (S6/I4). Cannot fire on mount — draftId is
  // null until the sync effect above has created a draft, which only happens with ≥1 line.
  useEffect(() => {
    if (lines.length !== 0 || draftId == null) return;
    deleteDraft.mutate(draftId);
    setDraftId(null);
    lastSyncedSnapshotRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines.length, draftId]);

  // Flush the *current* (non-debounced) state before confirming — the debounced PATCH above
  // could otherwise still be pending when Confirm is clicked, letting the server confirm a
  // stale draft.
  const confirmSale = useConfirmSale();
  // Resets local ticket state only — does NOT touch the draft row. Used after a successful
  // confirm (the draft has become the completed sale and must never be deleted) and by the
  // receipt's "New sale" action. The Clear button uses handleClearTicket below instead, which
  // also deletes the draft (S6/I4).
  const resetTicketState = () => {
    setLines([]);
    setAttachedClient(undefined);
    setClientSearchQuery("");
    setPaidAmount(0);
    setPaidAmountTouched(false);
    setDraftId(null);
    setClientZoneError(undefined);
    setPaymentError(undefined);
    lastSyncedSnapshotRef.current = null;
  };

  // The Clear button discards the whole ticket AND its persisted draft (S6/I4) — distinct from
  // resetTicketState above, which must NOT delete anything: by then the draft row has become the
  // COMPLETED sale.
  const handleClearTicket = () => {
    if (draftId) deleteDraft.mutate(draftId);
    resetTicketState();
  };

  const handleConfirm = () => {
    if (lines.length === 0) return;
    setClientZoneError(undefined);
    setPaymentError(undefined);
    const command = buildDraftCommand();
    const runConfirm = (id: string) =>
      confirmSale.mutate(
        { id, command: { paidAmount } },
        {
          onSuccess: (receiptResult) => {
            setReceipt(receiptResult);
            setReceiptAt(new Date().toISOString());
            resetTicketState();
          },
          onError: (err) => {
            const serverMessage = apiErrorMessage(err);
            if (serverMessage === "CREDIT_REQUIRES_CLIENT") {
              setClientZoneError(t("staff.pos.clientZone.creditRequiresClient"));
            } else if (serverMessage === "INSUFFICIENT_STOCK") {
              setPaymentError(t("staff.pos.payment.insufficientStock"));
            }
          },
        },
      );
    if (!draftId) {
      createDraft.mutate(command, {
        onSuccess: (sale) => {
          setDraftId(sale.id);
          runConfirm(sale.id);
        },
      });
    } else {
      updateDraft.mutate({ id: draftId, command }, { onSuccess: () => runConfirm(draftId) });
    }
  };

  // --- Drafts drawer ---
  const { data: draftsResult, isLoading: draftsLoading } = useSales(scope, {
    status: SaleStatus.DRAFT,
    page: 1,
    limit: 50,
  });

  // Resuming a draft restores lines + discount only. There's no by-id POS-client read
  // (confirmed Sprint 6) and SaleDto only carries posClientId/posClientName — not the full
  // PosClientDto (credit/phone/category) the attach zone's "attached" view needs — so rather
  // than fabricate a fake credit value, the attach zone is left in its search state with the
  // name prefilled; the cashier must re-attach for real. Line prices are frozen (manualPrice
  // forced true) since the originating product's categoryPrices aren't known without a fresh
  // search-select; availableQuantity floors at the resumed quantity so the stepper never blocks
  // below what's already on the ticket. Both are documented approximations, report-sprint-07.md.
  const handleOpenDraft = (draft: SaleDto) => {
    setReceipt(null);
    setReceiptAt(null);
    setDraftId(draft.id);
    // The stored discount is not re-editable from the POS (S6/I6) — the resumed ticket's total is
    // simply its lines' subtotal.
    setPaidAmount(0);
    setPaidAmountTouched(false);
    setAttachedClient(undefined);
    setClientSearchQuery(draft.posClientName ?? "");
    setClientZoneError(undefined);
    setPaymentError(undefined);
    setLines(
      draft.lines.map((line) => ({
        productId: line.productId,
        productName: line.productName,
        availableQuantity: Math.max(line.quantity, 0),
        categoryPrices: [],
        defaultSalePrice: line.resolvedPrice,
        quantity: line.quantity,
        unitPrice: line.unitPrice,
        resolvedPrice: line.resolvedPrice,
        manualPrice: true,
        serialNumbers: line.serialNumbers,
      })),
    );
    lastSyncedSnapshotRef.current = null;
  };

  // F2 focuses the barcode/search input; F4 jumps to the paid-amount field; Enter confirms only
  // when that same field currently has focus (STF-02 §UI/§Optimization) — a page-wide Enter
  // listener would otherwise also fire while typing in the product/client search boxes.
  useKeyboardShortcuts({
    f2: () => searchRef.current?.focus(),
    f4: () => document.getElementById("pos-paid-amount")?.focus(),
    enter: () => {
      if (document.activeElement?.id === "pos-paid-amount") handleConfirm();
    },
  });

  const isSyncing = createDraft.isPending || updateDraft.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={scope === "admin" ? t("admin.pos.pageTitle") : t("staff.pos.pageTitle")}
        />
        <div className="flex gap-2">
          <MyDraftsDrawer
            trigger={
              <Button variant="outline">
                <FileStack className="mr-2 h-4 w-4" />
                {scope === "admin" ? t("admin.pos.drafts.title") : t("staff.pos.drafts.title")}
              </Button>
            }
            drafts={draftsResult?.items}
            isLoading={draftsLoading}
            onOpenDraft={handleOpenDraft}
            groupByStaff={scope === "admin"}
          />
          {lines.length > 0 && (
            <Button variant="outline" onClick={handleClearTicket}>
              {t("common.actions.clear")}
            </Button>
          )}
        </div>
      </div>

      {receipt ? (
        <PosReceiptView
          subtotal={receipt.subtotal}
          discountAmount={receipt.discountAmount}
          total={receipt.total}
          previousCredit={receipt.previousCredit}
          grandTotal={receipt.grandTotal}
          paid={receipt.totalPaid}
          newCredit={receipt.newCredit}
          posClientName={receipt.posClientName}
          staffName={receipt.staffName}
          reference={receipt.reference}
          lines={receipt.lines}
          issuedAt={receipt.soldAt ?? receiptAt ?? new Date().toISOString()}
          store={publicSettings.data?.store}
          onPrint={printReceipt}
          onNewSale={() => {
            setReceipt(null);
            setReceiptAt(null);
            resetTicketState();
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[2fr_3fr]">
          <div className="space-y-4">
            <PosProductSearch
              ref={searchRef}
              query={productQuery}
              onQueryChange={setProductQuery}
              products={productsResult?.items}
              isLoading={productsLoading}
              isError={productsIsError}
              onRetry={() => refetchProducts()}
              onSelect={handleSelectProduct}
              attachedCategoryId={attachedClient?.categoryId}
            />
            <FamilyQuickPickGrid
              families={families}
              onSelect={(family) =>
                setFamilyId((prev) => (prev === family.id ? undefined : family.id))
              }
            />
          </div>

          <div className="space-y-4">
            <PosClientAttachZone
              attachedClient={attachedClient}
              query={clientSearchQuery}
              onQueryChange={setClientSearchQuery}
              results={clientResults}
              isSearching={clientSearching}
              onAttach={handleAttachClient}
              onDetach={handleDetachClient}
              onQuickAdd={() => setQuickAddOpen(true)}
              error={clientZoneError}
            />

            <PosTicket
              lines={ticketLines}
              total={total}
              onQuantityChange={handleQuantityChange}
              onUnitPriceChange={handleUnitPriceChange}
              onSerialNumbersChange={handleSerialNumbersChange}
              onRemoveLine={handleRemoveLine}
            />

            <PosPaymentPanel
              total={total}
              paidAmount={paidAmount}
              onPaidAmountChange={(value) => {
                setPaidAmountTouched(true);
                setPaidAmount(value);
              }}
              onConfirm={handleConfirm}
              isConfirming={confirmSale.isPending || isSyncing}
              paidAmountError={paymentError}
              {...(attachedClient
                ? {
                    previousCredit: attachedClient.credit,
                    // S5: credit += (total − paid). The old inline preview here subtracted this,
                    // showing a client who underpays as owing LESS — F4, fixed by S6.
                    newCredit: attachedClient.credit + (total - paidAmount),
                  }
                : {})}
            />
          </div>
        </div>
      )}

      <QuickAddPosClientDialog
        open={quickAddOpen}
        onOpenChange={setQuickAddOpen}
        categoryOptions={categoryOptions}
        onSubmit={handleQuickAddSubmit}
        isSubmitting={quickCreateClient.isPending}
      />
    </div>
  );
}
