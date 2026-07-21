import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-12b — route + shell only (Sprint 2, Foundation), mounted at `/admin/clients/:id`
// (declared after the static `/admin/clients` list route so the two never collide). The
// Overview/Orders/Invoices/Payments/Browsing tabs wire onto `useClientDirectoryEntry` +
// `useClientActivity` in Sprint 7.
export default function AdminClientDetail() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.clients.detail.title")} />
      <TableSkeleton rows={3} />
    </div>
  );
}
