import { useMemo, useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StaffSearchFilters,
  type StaffSearchFiltersValue,
} from "@/pages/admin/staff-searches/components/staff-search-filters";
import { StaffSearchesTable } from "@/pages/admin/staff-searches/components/staff-searches-table";
import { useStaffSearches } from "@/hooks/useObservability";
import { useUsers } from "@/hooks/useIdentity";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-19 — Sprint 5 wiring. `StaffSearchesQuery` carries no page/limit (observability.query.ts —
// unpaginated by design), so there is no `SimplePagination` here, only filters.
export default function AdminStaffSearches() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<StaffSearchFiltersValue>({});

  const searchesQuery = useMemo(
    () => ({ userId: filters.userId, q: filters.query, from: filters.from, to: filters.to }),
    [filters],
  );
  const searches = useStaffSearches(searchesQuery);
  const users = useUsers({ page: 1, limit: 100 });

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.staffSearches.title")}
        subtitle={t("admin.staffSearches.description")}
      />
      <StaffSearchFilters value={filters} onChange={setFilters} users={users.data?.items} />
      <StaffSearchesTable
        data={searches.data ?? []}
        isLoading={searches.isLoading}
        isError={searches.isError}
        onRetry={() => searches.refetch()}
      />
    </div>
  );
}
