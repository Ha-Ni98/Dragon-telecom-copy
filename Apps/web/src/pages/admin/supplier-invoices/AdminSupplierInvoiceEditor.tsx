import { useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { PageHeader } from "@/components/shared/PageHeader";
import { NotFoundState } from "@/components/shared/NotFoundState";
import { SupplierInvoiceStatus } from "@dragon-telecom/contract";
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
import { SupplierPaymentDialog } from "@/pages/admin/invoices/components/SupplierPaymentDialog";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-08 (editor) — page-local primitives assembled (Sprint 4, no data yet). `id === "new"` is
// the create-flow sentinel (Sprint 2 §Risks); `?supplierId=` preselects the supplier from
// ADM-07's future "Add invoice" link. Sprint 6 wires `usePurchasingInvoiceDetail`/
// `useCreate/UpdatePurchasingInvoice`/`useConfirmPurchasingInvoice`/`useCancelPurchasingInvoice`/
// `useCreatePurchasingPayment`/`useCreateProduct`/`useUpdatePricing`.
export default function AdminSupplierInvoiceEditor() {
  const { id } = useParams<{ id: string }>();
  const [searchParams] = useSearchParams();
  const { t } = useTranslation();
  const isCreate = id === "new";

  const [isCreateProductOpen, setIsCreateProductOpen] = useState(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);

  const form = useForm<SupplierInvoiceFormValues>({
    resolver: zodResolver(supplierInvoiceSchema(t)),
    defaultValues: {
      supplierId: searchParams.get("supplierId") ?? "",
      invoiceDate: new Date().toISOString().slice(0, 10),
      lines: [{ productId: "", quantity: 1, unitCost: 0 }],
    },
  });
  const { control, watch, setValue, handleSubmit } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const watchedLines = watch("lines");
  const isAmountOnly = watch("amountOnly") !== undefined;

  const footerTotal = (watchedLines ?? []).reduce(
    (sum, line) => sum + (line.quantity ?? 0) * (line.unitCost ?? 0),
    0,
  );

  if (!isCreate && !id) {
    return (
      <NotFoundState
        title={t("admin.supplierInvoices.editor.notFound")}
        body={t("common.errors.notFoundBody")}
      />
    );
  }

  const onSubmit = (_values: SupplierInvoiceFormValues) => {};

  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.supplierInvoices.editor.title")} />

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <InvoiceHeaderForm control={control} supplierOptions={[]} />
        <AmountOnlySwitch control={control} isAmountOnly={isAmountOnly} setValue={setValue} />

        {!isAmountOnly && (
          <div className="space-y-3">
            {fields.map((field, index) => (
              <InvoiceLineEditor
                key={field.id}
                index={index}
                control={control}
                productOptions={[]}
                quantity={watchedLines?.[index]?.quantity ?? 0}
                unitCost={watchedLines?.[index]?.unitCost ?? 0}
                onRemove={() => remove(index)}
                onCreateNewProduct={() => setIsCreateProductOpen(true)}
              />
            ))}
            <AddLineButton onClick={() => append({ productId: "", quantity: 1, unitCost: 0 })} />
            <div className="text-right text-sm text-muted-foreground">
              {t("admin.supplierInvoices.editor.subtotal")}: {footerTotal.toLocaleString()}
            </div>
          </div>
        )}

        <ConfirmBar status={SupplierInvoiceStatus.DRAFT} />
      </form>

      <RepricePrompt candidates={[]} onApply={() => {}} onSkip={() => {}} onSkipAll={() => {}} />

      <InlineCreateProductDialog
        open={isCreateProductOpen}
        onOpenChange={setIsCreateProductOpen}
        onSave={() => setIsCreateProductOpen(false)}
      />

      <SupplierPaymentDialog
        open={isPaymentOpen}
        onOpenChange={setIsPaymentOpen}
        supplierId={watch("supplierId") || ""}
        previousCredit={0}
        amount={0}
        onAmountChange={() => {}}
        onSubmit={() => setIsPaymentOpen(false)}
      />
    </div>
  );
}
