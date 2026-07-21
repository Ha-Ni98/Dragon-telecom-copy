import { PageHeader } from "@/components/shared/PageHeader";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-16 — route + shell only (Sprint 2, Foundation). The Users/Roles tabs, dialogs, and the
// permission matrix wire onto `useIdentity` (`useUsers`/`useRoles`/`usePages`) in Sprint 7.
export default function AdminUsers() {
  const { t } = useTranslation();
  return (
    <div className="space-y-6">
      <PageHeader title={t("admin.users.title")} subtitle={t("admin.users.description")} />
      <TableSkeleton />
    </div>
  );
}
