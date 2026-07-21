import { useState } from "react";
import { PageHeader } from "@/components/shared/PageHeader";
import {
  StaffSearchFilters,
  type StaffSearchFiltersValue,
} from "@/pages/admin/staff-searches/components/staff-search-filters";
import { StaffSearchesTable } from "@/pages/admin/staff-searches/components/staff-searches-table";
import { useTranslation } from "@/hooks/useTranslation";

// ADM-19 — page-local primitives assembled (Sprint 4, no data yet). Sprint 5 wires
// `useStaffSearches` + `useUsers` (identity, for the user filter).
export default function AdminStaffSearches() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState<StaffSearchFiltersValue>({});

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("admin.staffSearches.title")}
        subtitle={t("admin.staffSearches.description")}
      />
      <StaffSearchFilters value={filters} onChange={setFilters} />
      <StaffSearchesTable data={[]} isLoading={false} />
    </div>
  );
}
