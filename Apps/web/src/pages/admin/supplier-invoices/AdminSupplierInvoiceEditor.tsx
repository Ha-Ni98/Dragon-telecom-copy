import { useMemo, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import axios from "axios";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/PageHeader";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { CreditCard, Plus, Printer } from "lucide-react";
import {
  SupplierInvoiceStatus,
  type AdminProductDto,
  type ConfirmResultDto,
  type UpdatePricingCommand,
} from "@dragon-telecom/contract";
import {
  supplierInvoiceSchema,
  type SupplierInvoiceFormValues,
} from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { InvoiceHeaderForm } from "@/pages/admin/supplier-invoices/components/invoice-header-form";
import { AmountOnlySwitch } from "@/pages/admin/supplier-invoices/components/amount-only-switch";
import { InvoiceLineEditor } from "@/pages/admin/supplier-invoices/components/invoice-line-editor";
import { InvoiceProductPickerDialog } from "@/pages/admin/supplier-invoices/components/invoice-product-picker-dialog";
import { ConfirmBar } from "@/pages/admin/supplier-invoices/components/confirm-bar";
import { RepricePrompt } from "@/pages/admin/supplier-invoices/components/reprice-prompt";
import { SupplierPaymentDialog } from "@/pages/admin/invoices/components/SupplierPaymentDialog";
import type { RecordSupplierPaymentFormValues } from "@/pages/admin/invoices/components/record-supplier-payment.schema";
import { BarcodeLabelsDialog } from "@/pages/admin/supplier-invoices/components/barcode-labels-dialog";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  usePurchasingInvoiceDetail,
  useCreatePurchasingInvoice,
  useUpdatePurchasingInvoice,
  useConfirmPurchasingInvoice,
} from "@/hooks/usePurchasingInvoices";
import { useCreatePurchasingPayment } from "@/hooks/usePurchasingPayments";
import { usePurchasingSuppliers } from "@/hooks/usePurchasingSuppliers";
import { useUpdatePricing } from "@/hooks/useCatalogProducts";
import { useCatalogClientCategories } from "@/hooks/useClientCategories";
import { useTranslation } from "@/hooks/useTranslation";
import { FieldError } from "@/components/shared/FieldError";

type RepriceCandidate = ConfirmResultDto["repriceCandidates"][number];

// ADM-08 (editor) — S7 R1 rewire: DRAFT is no longer a UI state. `id === "new"` is the
// create-flow sentinel (Sprint 2 §Risks); `?supplierId=` preselects the supplier from ADM-07's
// "Add invoice" link. Save now creates (or patches) the invoice and immediately confirms it in
// one click — stock, supplier credit and the real reference all land together — so the page
// only ever shows a CONFIRMED, read-only invoice once anything has been saved. The create/
// update/confirm endpoints and hooks are untouched; only this page's use of them changed
// (I1: "UI only"). The form's `values` option (not a `useEffect` reset) reactively syncs onto
// the fetched CONFIRMED DTO once it loads — same reactive-sync convention as
// EditPosClientDialog (set-04 Sprint 5).
// S22: a Print-barcodes action sits in the header on every saved invoice regardless of status —
// it opens a dialog listing the invoice's product lines with an editable label count per line and
// downloads a server-rendered PDF; lines whose product has no barcode are omitted and counted.
// S31: products are added only through the shared product-picker dialog
// (InvoiceProductPickerDialog — server-side search over the whole catalog, where the old per-row
// autocomplete filtered a first-100 slice in the browser), and the quick-add-product dialog moved
// into that picker. The form starts with no line; at least one product line is required.
export default function AdminSupplierInvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isCreate = id === "new";

  const [isPickerOpen, setIsPickerOpen] = useState(false);
  // S31 — name + the I6 helper figures of every product picked in this session, keyed by id. I6's
  // two helper texts read the *unweighted* avgPrice (D10 — the supplier-invoice-context figure),
  // never avgStockPrice, which drives margins instead.
  const [pickedById, setPickedById] = useState(
    () => new Map<string, { name: string; quantityOnHand: number; avgPrice: number }>(),
  );
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  // S22 — the print-barcodes dialog. Unlike the payment button below it is shown on *every* saved
  // invoice regardless of status: labels are about the goods received, not the money.
  const [isLabelsOpen, setIsLabelsOpen] = useState(false);
  const [paymentAmount, setPaymentAmount] = useState(0);
  const [alreadyConfirmedError, setAlreadyConfirmedError] = useState(false);
  const [repriceCandidates, setRepriceCandidates] = useState<RepriceCandidate[]>([]);

  const invoiceDetail = usePurchasingInvoiceDetail(isCreate ? "" : (id ?? ""));
  const invoice = invoiceDetail.data;
  const status = invoice?.status ?? SupplierInvoiceStatus.DRAFT;
  const isEditable = isCreate || status === SupplierInvoiceStatus.DRAFT;

  const suppliers = usePurchasingSuppliers({ page: 1, limit: 100 });
  const supplierOptions: AutocompleteOption[] = useMemo(
    () => (suppliers.data?.items ?? []).map((s) => ({ value: s.id, label: s.name })),
    [suppliers.data],
  );

  const clientCategories = useCatalogClientCategories();

  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceSchema(t)),
    defaultValues: {
      supplierId: searchParams.get("supplierId") ?? "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      shippingCost: 0,
      lines: [],
    },
    values:
      !isCreate && invoice
        ? {
            supplierId: invoice.supplierId,
            supplierReference: invoice.supplierReference,
            invoiceDate: invoice.invoiceDate,
            dueDate: invoice.dueDate,
            shippingCost: invoice.shippingCost,
            amountOnly: invoice.amountOnly,
            note: invoice.note,
            lines:
              invoice.amountOnly !== undefined
                ? undefined
                : invoice.lines.map((l) => ({
                    productId: l.productId,
                    quantity: l.quantity,
                    unitCost: l.unitCost,
                    serialNumbers: l.serialNumbers,
                  })),
          }
        : undefined,
  });
  const { control, watch, setValue, handleSubmit } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const isAmountOnly = watch("amountOnly") !== undefined;
  const watchedShipping = watch("shippingCost") ?? 0;

  // Recomputes per keystroke over every line — memoized per the plan's ADM-08 footer-math note.
  const footerSubtotal = useMemo(
    () =>
      (watchedLines ?? []).reduce(
        (sum, line) => sum + (line.quantity ?? 0) * (line.unitCost ?? 0),
        0,
      ),
    [watchedLines],
  );
  const footerTotal = footerSubtotal + watchedShipping;

  const createInvoice = useCreatePurchasingInvoice();
  const updateInvoice = useUpdatePurchasingInvoice();
  const confirmInvoice = useConfirmPurchasingInvoice();
  const createPayment = useCreatePurchasingPayment();
  const updatePricing = useUpdatePricing();

  // R1 — DRAFT is no longer a UI state: Save creates the invoice and immediately confirms it, so
  // stock, supplier credit and the real reference all land in one click. The create/update/
  // confirm endpoints and their hooks are untouched (I1: "UI only").
  const handleSave = handleSubmit((values) => {
    setAlreadyConfirmedError(false);
    if (isCreate) {
      createInvoice.mutate(values, {
        onSuccess: (dto) =>
          confirmInvoice.mutate(dto.id, {
            onSuccess: (result) => {
              setRepriceCandidates(result.repriceCandidates);
              toast.success(t("admin.supplierInvoices.editor.saveSuccess"));
              navigate(`/admin/supplier-invoices/${dto.id}`, { replace: true });
            },
          }),
      });
    } else if (id) {
      updateInvoice.mutate(
        { id, command: values },
        {
          onSuccess: () =>
            confirmInvoice.mutate(id, {
              onSuccess: (result) => {
                setRepriceCandidates(result.repriceCandidates);
                toast.success(t("admin.supplierInvoices.editor.saveSuccess"));
              },
            }),
          onError: (err) => {
            if (axios.isAxiosError(err) && err.response?.status === 409) {
              setAlreadyConfirmedError(true);
            }
          },
        },
      );
    }
  });

  // I1 — Cancel discards the in-progress form and returns to the list; it writes nothing.
  const handleCancelEdit = () => navigate("/admin/supplier-invoices");

  const handleApplyReprice = (productId: string, values: UpdatePricingCommand) => {
    updatePricing.mutate(
      { id: productId, command: values },
      {
        onSuccess: () =>
          setRepriceCandidates((prev) => prev.filter((c) => c.productId !== productId)),
      },
    );
  };
  const handleSkipReprice = (productId: string) =>
    setRepriceCandidates((prev) => prev.filter((c) => c.productId !== productId));
  const handleSkipAllReprice = () => setRepriceCandidates([]);

  // S31 — one new line per picked product (qty 1, unit cost 0 — plan P3: the buyer types the
  // cost; the picker only showed past costs for recall). A product already on a line is not added
  // twice (plan P4) — raise that line's quantity instead.
  const handlePickProducts = (products: AdminProductDto[]) => {
    setPickedById((prev) => {
      const next = new Map(prev);
      for (const p of products) {
        next.set(p.id, { name: p.name, quantityOnHand: p.quantityOnHand, avgPrice: p.avgPrice });
      }
      return next;
    });
    const onLines = new Set((form.getValues("lines") ?? []).map((line) => line.productId));
    for (const p of products) {
      if (onLines.has(p.id)) continue;
      append({ productId: p.id, quantity: 1, unitCost: 0 });
    }
  };

  const handleSubmitPayment = (values: RecordSupplierPaymentFormValues) => {
    createPayment.mutate(values, {
      onSuccess: () => {
        toast.success(t("admin.supplierInvoices.payment.success"));
        setIsPaymentOpen(false);
      },
    });
  };

  if (!isCreate && !id) {
    return (
      <NotFoundState
        title={t("admin.supplierInvoices.editor.notFound")}
        body={t("common.errors.notFoundBody")}
      />
    );
  }

  if (!isCreate && invoiceDetail.isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!isCreate && (invoiceDetail.isError || !invoice)) {
    return (
      <NotFoundState
        title={t("admin.supplierInvoices.editor.notFound")}
        body={t("common.errors.notFoundBody")}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <PageHeader
          title={t("admin.supplierInvoices.editor.title")}
          subtitle={invoice?.reference}
        />
        <div className="flex flex-wrap items-center gap-2">
          {!isCreate && invoice && (
            <Button variant="outline" onClick={() => setIsLabelsOpen(true)}>
              <Printer className="mr-2 h-4 w-4" />
              {t("admin.supplierInvoices.printLabels.action")}
            </Button>
          )}
          {!isCreate && invoice && status !== SupplierInvoiceStatus.DRAFT && (
            <Button variant="outline" onClick={() => setIsPaymentOpen(true)}>
              <CreditCard className="mr-2 h-4 w-4" />
              {t("admin.supplierInvoices.payment.title")}
            </Button>
          )}
        </div>
      </div>

      {/* I7 — the reprice section sits above the invoice information, not below it. */}
      <RepricePrompt
        candidates={repriceCandidates}
        categories={(clientCategories.data ?? []).map((c) => ({ id: c.id, name: c.name }))}
        onApply={handleApplyReprice}
        onSkip={handleSkipReprice}
        onSkipAll={handleSkipAllReprice}
        isApplying={updatePricing.isPending}
      />

      <form onSubmit={isEditable ? handleSave : (e) => e.preventDefault()} className="space-y-6">
        <InvoiceHeaderForm
          control={control}
          supplierOptions={supplierOptions}
          disabled={!isEditable}
        />
        <AmountOnlySwitch
          control={control}
          isAmountOnly={isAmountOnly}
          setValue={setValue}
          disabled={!isEditable}
        />

        {!isAmountOnly && (
          <div className="space-y-3">
            {fields.map((field, index) => {
              const productId = watchedLines?.[index]?.productId ?? "";
              const picked = pickedById.get(productId);
              return (
                <InvoiceLineEditor
                  key={field.id}
                  index={index}
                  control={control}
                  quantity={watchedLines?.[index]?.quantity ?? 0}
                  unitCost={watchedLines?.[index]?.unitCost ?? 0}
                  onRemove={() => remove(index)}
                  productStock={picked}
                  // Matched by productId, not by index: lines can now be removed and re-added.
                  productName={
                    picked?.name ??
                    invoice?.lines.find((line) => line.productId === productId)?.productNameSnapshot
                  }
                  disabled={!isEditable}
                />
              );
            })}
            {/* The resolver files an array-level refine under `lines` or `lines.root` depending
                on whether `lines` is registered as a field array — read both. */}
            {(form.formState.errors.lines?.message ??
              form.formState.errors.lines?.root?.message) && (
              <FieldError>
                {form.formState.errors.lines?.message ?? form.formState.errors.lines?.root?.message}
              </FieldError>
            )}
            {isEditable && (
              <Button type="button" variant="outline" onClick={() => setIsPickerOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                {t("admin.supplierInvoices.editor.addProducts")}
              </Button>
            )}
            <div className="space-y-1 text-right text-sm text-muted-foreground">
              <div>
                {t("admin.supplierInvoices.editor.subtotal")}: {footerSubtotal.toLocaleString()}
              </div>
              <div>
                {t("admin.supplierInvoices.editor.shippingCost")}:{" "}
                {watchedShipping.toLocaleString()}
              </div>
              <div className="font-medium text-foreground">{footerTotal.toLocaleString()}</div>
            </div>
          </div>
        )}

        <ConfirmBar
          onSave={isEditable ? handleSave : undefined}
          onCancel={handleCancelEdit}
          isSaving={
            isCreate
              ? createInvoice.isPending || confirmInvoice.isPending
              : updateInvoice.isPending || confirmInvoice.isPending
          }
          alreadyConfirmedError={alreadyConfirmedError}
        />
      </form>

      <InvoiceProductPickerDialog
        open={isPickerOpen}
        onOpenChange={setIsPickerOpen}
        onAdd={handlePickProducts}
      />

      {!isCreate && invoice && (
        <SupplierPaymentDialog
          // Forces a fresh mount per invoice — same defaultValues-frozen-at-first-render fix
          // StaffInvoices.tsx already applies to this same dialog.
          key={invoice.id}
          open={isPaymentOpen}
          onOpenChange={setIsPaymentOpen}
          supplierId={invoice.supplierId}
          supplierInvoiceReference={invoice.reference}
          previousCredit={invoice.supplierCredit}
          amount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onSubmit={handleSubmitPayment}
          isSubmitting={createPayment.isPending}
        />
      )}

      {!isCreate && invoice && (
        <BarcodeLabelsDialog
          // Fresh mount per invoice, same reason SupplierPaymentDialog is keyed.
          key={invoice.id}
          invoice={invoice}
          open={isLabelsOpen}
          onOpenChange={setIsLabelsOpen}
        />
      )}
    </div>
  );
}
