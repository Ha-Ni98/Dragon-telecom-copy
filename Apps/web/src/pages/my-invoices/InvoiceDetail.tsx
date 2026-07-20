import { useParams } from "react-router-dom";
import { toast } from "sonner";
import { InvoiceView } from "@/pages/my-invoices/components/InvoiceView";
import { useMyInvoice, useMyInvoicePdf } from "@/hooks/useBilling";
import { downloadBlob } from "@/lib/utils";
import { useTranslation } from "@/hooks/useTranslation";

// PUB-10 detail — row target from MyInvoices.tsx. 404 on a foreign/unknown number is local
// (InvoiceView's own isNotFound branch), never a global redirect (rules §4).
export default function InvoiceDetail() {
  const { t } = useTranslation();
  const { number = "" } = useParams<{ number: string }>();
  const { data: invoice, isLoading, isError } = useMyInvoice(number);
  const pdfMutation = useMyInvoicePdf();

  const handleDownloadPdf = () => {
    pdfMutation.mutate(number, {
      onSuccess: (blob) => downloadBlob(`${number}.pdf`, blob),
      onError: () => toast.error(t("invoices.errorLoading")),
    });
  };

  return (
    <div className="container mx-auto max-w-3xl px-4 py-8">
      <InvoiceView
        invoice={invoice}
        isLoading={isLoading}
        isNotFound={isError}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={pdfMutation.isPending}
      />
    </div>
  );
}
