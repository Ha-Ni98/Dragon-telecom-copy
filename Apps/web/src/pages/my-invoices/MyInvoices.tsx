import { useCallback, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { InvoicesTable } from "@/pages/my-invoices/components/InvoicesTable";
import { SimplePagination } from "@/components/shared/SimplePagination";
import { useMyInvoices } from "@/hooks/useBilling";
import { useTranslation } from "@/hooks/useTranslation";
import type { InvoiceDto } from "@dragon-telecom/contract";
import { SectionTitle } from "@/components/shared/SectionTitle";

// PUB-10 — first client-facing consumer of the billing domain (Tier 5). Page is server-side
// paginated via ?page= (InvoiceListQuery.page), same URL-as-state pattern as the Catalog page.
export default function MyInvoices() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const page = useMemo(() => {
    const parsed = Number(searchParams.get("page"));
    return Number.isInteger(parsed) && parsed >= 1 ? parsed : 1;
  }, [searchParams]);

  // limit matches InvoiceListQuerySchema's own default (20) — the schema's `.default()` only
  // makes `limit` optional on the *input* side; the inferred TS type still requires it on a
  // plain object literal like this one (no `.parse()` call here to apply the default for us).
  const { data, isLoading, isError, refetch } = useMyInvoices({ page, limit: 20 });

  const handlePageChange = useCallback(
    (nextPage: number) => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (nextPage <= 1) next.delete("page");
          else next.set("page", String(nextPage));
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const handleRowClick = useCallback(
    (invoice: InvoiceDto) => navigate(`/invoices/${invoice.number}`),
    [navigate],
  );

  return (
    <div className="container mx-auto max-w-5xl space-y-6 px-4 py-8">
      <div>
        <SectionTitle as="h1" className="text-2xl font-bold">
          {t("invoices.title")}
        </SectionTitle>
        <p className="text-muted-foreground">{t("invoices.subtitle")}</p>
      </div>

      <InvoicesTable
        invoices={data?.items}
        isLoading={isLoading}
        isError={isError}
        onRetry={() => refetch()}
        onRowClick={handleRowClick}
      />

      {data && data.meta.totalPages > 1 && (
        <SimplePagination
          page={data.meta.page}
          totalPages={data.meta.totalPages}
          onPageChange={handlePageChange}
        />
      )}
    </div>
  );
}
