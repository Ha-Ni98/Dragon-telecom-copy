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
import { CreditCard } from "lucide-react";
import {
  SupplierInvoiceStatus,
  type ConfirmResultDto,
  type UpdatePricingCommand,
} from "@dragon-telecom/contract";
import {
  supplierInvoiceSchema,
  type SupplierInvoiceFormValues,
} from "@/pages/admin/supplier-invoices/components/supplier-invoice.schema";
import { InvoiceHeaderForm } from "@/pages/admin/supplier-invoices/components/invoice-header-form";
import { AmountOnlySwitch } from "@/pages/admin/supplier-invoices/components/amount-only-switch";
import {
  InvoiceLineEditor,
  AddLineButton,
} from "@/pages/admin/supplier-invoices/components/invoice-line-editor";
import { ConfirmBar } from "@/pages/admin/supplier-invoices/components/confirm-bar";
import { RepricePrompt } from "@/pages/admin/supplier-invoices/components/reprice-prompt";
import { InlineCreateProductDialog } from "@/pages/admin/supplier-invoices/components/inline-create-product-dialog";
import type { InlineCreateProductFormValues } from "@/pages/admin/supplier-invoices/components/inline-create-product.schema";
import { SupplierPaymentDialog } from "@/pages/admin/invoices/components/SupplierPaymentDialog";
import type { RecordSupplierPaymentFormValues } from "@/pages/admin/invoices/components/record-supplier-payment.schema";
import type { AutocompleteOption } from "@/components/shared/autocomplete-input";
import {
  usePurchasingInvoiceDetail,
  useCreatePurchasingInvoice,
  useUpdatePurchasingInvoice,
  useConfirmPurchasingInvoice,
  useCancelPurchasingInvoice,
} from "@/hooks/usePurchasingInvoices";
import { useCreatePurchasingPayment } from "@/hooks/usePurchasingPayments";
import { usePurchasingSuppliers } from "@/hooks/usePurchasingSuppliers";
import {
  useAdminCatalogProducts,
  useCreateProduct,
  useUpdatePricing,
} from "@/hooks/useCatalogProducts";
import { useTranslation } from "@/hooks/useTranslation";

type RepriceCandidate = ConfirmResultDto["repriceCandidates"][number];

// ADM-08 (editor) — Sprint 6 wiring. `id === "new"` is the create-flow sentinel (Sprint 2
// §Risks); `?supplierId=` preselects the supplier from ADM-07's "Add invoice" link. The form's
// `values` option (not a `useEffect` reset) reactively syncs onto the fetched DRAFT/CONFIRMED
// DTO once it loads — same reactive-sync convention as EditPosClientDialog (set-04 Sprint 5).
export default function AdminSupplierInvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const isCreate = id === "new";

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [createProductLineIndex, setCreateProductLineIndex] = useState<number | null>(null);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
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

  const products = useAdminCatalogProducts({ page: 1, limit: 100 });
  const productOptions: AutocompleteOption[] = useMemo(
    () => (products.data?.items ?? []).map((p) => ({ value: p.id, label: p.name })),
    [products.data],
  );

  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceSchema(t)),
    defaultValues: {
      supplierId: searchParams.get("supplierId") ?? "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      lines: [{ productId: "", quantity: 1, unitCost: 0 }],
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
  const cancelInvoice = useCancelPurchasingInvoice();
  const createPayment = useCreatePurchasingPayment();
  const createProduct = useCreateProduct();
  const updatePricing = useUpdatePricing();

  const handleSaveDraft = handleSubmit((values) => {
    setAlreadyConfirmedError(false);
    if (isCreate) {
      createInvoice.mutate(values, {
        onSuccess: (dto) => navigate(`/admin/supplier-invoices/${dto.id}`, { replace: true }),
      });
    } else if (id) {
      updateInvoice.mutate(
        { id, command: values },
        {
          onError: (err) => {
            if (axios.isAxiosError(err) && err.response?.status === 409) {
              setAlreadyConfirmedError(true);
            }
          },
        },
      );
    }
  });

  const handleConfirm = () => {
    if (!id || isCreate) return;
    confirmInvoice.mutate(id, {
      onSuccess: (result) => setRepriceCandidates(result.repriceCandidates),
    });
  };

  const handleCancel = () => {
    if (!id || isCreate) return;
    cancelInvoice.mutate({ id, command: {} });
  };

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

  const handleCreateNewProduct = (index: number) => {
    setCreateProductLineIndex(index);
    setIsCreateProductOpen(true);
  };
  const handleSaveNewProduct = (values: InlineCreateProductFormValues) => {
    createProduct.mutate(
      { command: values, images: [] },
      {
        onSuccess: (product) => {
          if (createProductLineIndex !== null) {
            setValue(`lines.${createProductLineIndex}.productId`, product.id);
          }
          setIsCreateProductOpen(false);
        },
      },
    );
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
        {!isCreate && invoice && status !== SupplierInvoiceStatus.DRAFT && (
          <Button variant="outline" onClick={() => setIsPaymentOpen(true)}>
            <CreditCard className="mr-2 h-4 w-4" />
            {t("admin.supplierInvoices.payment.title")}
          </Button>
        )}
      </div>

      <form
        onSubmit={isEditable ? handleSaveDraft : (e) => e.preventDefault()}
        className="space-y-6"
      >
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
            {fields.map((field, index) => (
              <InvoiceLineEditor
                key={field.id}
                index={index}
                control={control}
                productOptions={productOptions}
                quantity={watchedLines?.[index]?.quantity ?? 0}
                unitCost={watchedLines?.[index]?.unitCost ?? 0}
                onRemove={() => remove(index)}
                onCreateNewProduct={isEditable ? () => handleCreateNewProduct(index) : undefined}
                disabled={!isEditable}
              />
            ))}
            {isEditable && (
              <AddLineButton onClick={() => append({ productId: "", quantity: 1, unitCost: 0 })} />
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
          status={status}
          onSaveDraft={isEditable ? handleSaveDraft : undefined}
          onConfirm={isEditable && !isCreate ? handleConfirm : undefined}
          onCancel={!isCreate ? handleCancel : undefined}
          isSaving={isCreate ? createInvoice.isPending : updateInvoice.isPending}
          isConfirming={confirmInvoice.isPending}
          isCancelling={cancelInvoice.isPending}
          alreadyConfirmedError={alreadyConfirmedError}
        />
      </form>

      <RepricePrompt
        candidates={repriceCandidates}
        onApply={handleApplyReprice}
        onSkip={handleSkipReprice}
        onSkipAll={handleSkipAllReprice}
        isApplying={updatePricing.isPending}
      />

      <InlineCreateProductDialog
        open={isCreateProductOpen}
        onOpenChange={setIsCreateProductOpen}
        onSave={handleSaveNewProduct}
        isSaving={createProduct.isPending}
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
          previousCredit={invoice.newCredit ?? 0}
          amount={paymentAmount}
          onAmountChange={setPaymentAmount}
          onSubmit={handleSubmitPayment}
          isSubmitting={createPayment.isPending}
        />
      )}
    </div>
  );
}
