import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { FileStack, Maximize2, Minimize2 } from "lucide-react";
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
import { CreditChangeConfirmDialog } from "@/components/shared/CreditChangeConfirmDialog";
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
import { useReceiptPrint } from "@/hooks/use-receipt-print";
import { buildPosReceiptEscPos } from "@/pages/staff/pos/pos-receipt-escpos";
import { cn, formatDZD } from "@/lib/utils";
import { checkSettlement } from "@/lib/settlement";
import { SETTLEMENT_CHECK } from "@/types/settlement.types";
import { resolvePosPrice } from "@/pages/staff/pos/pos-pricing";
import { useWorkspaceFocusScope } from "@/components/providers/WorkspaceFocusProvider";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  SALE_ERROR,
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
  const { t, language } = useTranslation();
  const searchRef = useRef<HTMLInputElement>(null);

  // S29 — declares the POS as focus-capable. The preference itself is remembered globally
  // (localStorage), but the chrome only actually hides while this page is mounted.
  const { focusPreferred, setFocusPreferred, chromeHidden } = useWorkspaceFocusScope();

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
  // S32 — starts empty (null) and is never pre-filled with the total: the cashier must enter what
  // the customer actually handed over. Replaces S6/I5's auto-tracking of the total.
  const [paidAmount, setPaidAmount] = useState<number | null>(null);
  // S32 — an attached client paying a different amount than the total confirms the credit change.
  const [creditConfirmOpen, setCreditConfirmOpen] = useState(false);
  const [receipt, setReceipt] = useState<ReceiptDto | null>(null);
  // S25 — captured once when the receipt is set, not derived at render: the receipt view stays
  // mounted until "New sale", so a render-time `new Date()` would creep forward on every re-render.
  // S27 — now only the fallback: `receipt.soldAt` (the server's confirm-time stamp) is preferred
  // when present, since it is the honest source; this stays as the fallback for the unlikely case
  // a sale's `soldAt` comes back null.
  const [receiptAt, setReceiptAt] = useState<string | null>(null);
  const [clientZoneError, setClientZoneError] = useState<string>();
  const [paymentError, setPaymentError] = useState<string>();
  // S27.1 — thermal printing preference + helper availability, read here so the receipt's own
  // fallback can stay synchronous (see handlePrintReceipt).
  const { print: printReceiptDocument } = useReceiptPrint();

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

  // The paid amount is what is being paid for THIS sale. The client's outstanding credit is
  // deliberately NOT added in: settling an older balance is the separate record-payment flow.

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
  // Thermal first, browser fallback — the decision, the toasts and the gesture-safety rule all
  // live in useReceiptPrint so the POS, the repair ticket and the sales drawer cannot drift apart.
  // Note it does NOT consult the label dialogs' Thermal/Browser radio: picking Browser to print
  // one barcode used to silently switch every receipt to browser printing too.
  const handlePrintReceipt = async () => {
    if (!receipt) {
      printReceipt();
      return;
    }
    const store = publicSettings.data?.store;
    await printReceiptDocument(
      () =>
        buildPosReceiptEscPos({
          receipt,
          issuedAt: receipt.soldAt ?? receiptAt ?? new Date().toISOString(),
          store,
          t,
          language,
        }),
      store?.printLogoUrl ?? store?.logoUrl,
    );
  };

  const resetTicketState = () => {
    setLines([]);
    setAttachedClient(undefined);
    setClientSearchQuery("");
    setPaidAmount(null);
    setCreditConfirmOpen(false);
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

  // Runs the sale — reached directly on an exact payment, or from the credit-change dialog.
  const submitConfirm = () => {
    if (lines.length === 0) return;
    const command = buildDraftCommand();
    const runConfirm = (id: string) =>
      confirmSale.mutate(
        { id, command: { paidAmount: paidAmount ?? 0 } },
        {
          onSuccess: (receiptResult) => {
            setReceipt(receiptResult);
            setReceiptAt(new Date().toISOString());
            resetTicketState();
          },
          onError: (err) => {
            setCreditConfirmOpen(false);
            const serverMessage = apiErrorMessage(err);
            if (serverMessage === SALE_ERROR.CREDIT_REQUIRES_CLIENT) {
              setClientZoneError(t("staff.pos.clientZone.creditRequiresClient"));
            } else if (serverMessage === SALE_ERROR.WALK_IN_OVERPAYMENT) {
              setPaymentError(
                t("staff.pos.payment.walkInMustMatch", { total: formatDZD(total, language) }),
              );
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

  const handleConfirm = () => {
    if (lines.length === 0) return;
    setClientZoneError(undefined);
    setPaymentError(undefined);
    // S32 — paid starts empty; a walk-in must pay the exact total; an attached client may pay
    // any amount, but a difference is confirmed against the credit it will leave.
    switch (checkSettlement(paidAmount, total, !!attachedClient)) {
      case SETTLEMENT_CHECK.EMPTY:
        setPaymentError(t("staff.pos.payment.paidAmountRequired"));
        return;
      case SETTLEMENT_CHECK.WALK_IN_MISMATCH:
        setPaymentError(
          t("staff.pos.payment.walkInMustMatch", { total: formatDZD(total, language) }),
        );
        return;
      case SETTLEMENT_CHECK.NEEDS_CREDIT_CONFIRM:
        setCreditConfirmOpen(true);
        return;
      case SETTLEMENT_CHECK.MATCH:
        submitConfirm();
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
    setPaidAmount(null);
    setCreditConfirmOpen(false);
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

  // S29 — Esc leaves focus mode. Deliberately NOT routed through useKeyboardShortcuts: that hook
  // preventDefaults every key it handles, and Escape belongs to whichever Radix overlay is open
  // (quick-add client, drafts drawer). This listener never preventDefaults, stands down while any
  // overlay is open, and is only attached while the chrome is actually hidden.
  useEffect(() => {
    if (!chromeHidden) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][data-state="open"]')) return;
      setFocusPreferred(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [chromeHidden, setFocusPreferred]);

  const isSyncing = createDraft.isPending || updateDraft.isPending;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <PageHeader
          title={scope === "admin" ? t("admin.pos.pageTitle") : t("staff.pos.pageTitle")}
        />
        <div className="flex gap-2">
          <Button
            variant="outline"
            size={chromeHidden ? "icon" : "default"}
            onClick={() => setFocusPreferred(!focusPreferred)}
            aria-label={chromeHidden ? t("staff.pos.focus.exit") : t("staff.pos.focus.enter")}
            // S29 — one button, three exits. In focus mode it detaches from this row and pins
            // itself to the viewport's top-right, which is the brief's "floating button";
            // rendering a second, separate floating button would land it on top of this one once
            // the app header is gone.
            className={cn(chromeHidden && "fixed right-4 top-4 z-40 shadow-lg")}
          >
            {chromeHidden ? (
              <Minimize2 className="h-4 w-4" />
            ) : (
              <Maximize2 className="mr-2 h-4 w-4" />
            )}
            {!chromeHidden && t("staff.pos.focus.enter")}
          </Button>
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
          onPrint={handlePrintReceipt}
          onNewSale={() => {
            setReceipt(null);
            setReceiptAt(null);
            resetTicketState();
          }}
        />
      ) : (
        // S29 — minmax(0,·) rather than a bare fr: a grid item's min-width defaults to auto, so a
        // 3fr track could not shrink below the ticket row's min-content width and the whole page
        // scrolled sideways. The ratio also shifts 2:3 -> 1:2 toward the ticket, which holds the
        // editable quantity and price inputs and needs the room more than the read-only product
        // list does.
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
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
              paidAmount={paidAmount}
              onPaidAmountChange={setPaidAmount}
              onConfirm={handleConfirm}
              isConfirming={confirmSale.isPending || isSyncing}
              paidAmountError={paymentError}
              {...(attachedClient && paidAmount != null
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

      {attachedClient && paidAmount != null && (
        <CreditChangeConfirmDialog
          open={creditConfirmOpen}
          onOpenChange={setCreditConfirmOpen}
          dueLabel={t("staff.pos.payment.totalDue")}
          dueAmount={total}
          enteredLabel={t("staff.pos.payment.paidAmountLabel")}
          enteredAmount={paidAmount}
          previousCredit={attachedClient.credit}
          newCredit={attachedClient.credit + (total - paidAmount)}
          onConfirm={submitConfirm}
          isConfirming={confirmSale.isPending || isSyncing}
        />
      )}
    </div>
  );
}
