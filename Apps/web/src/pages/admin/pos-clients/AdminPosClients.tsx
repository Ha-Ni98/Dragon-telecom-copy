import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-11 — route + shell only (Sprint 2, Foundation). The table, add/edit dialogs, and the
// detail drawer (sales/payments/credit-history tabs) wire onto `usePosClients`/`useSales`/
// `useClientPayments` in Sprint 5.
export default function AdminPosClients() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.posClients.title")}
        subtitle={t("admin.posClients.description")}
      />
      <TableSkeleton />
    </div>
  );
}
