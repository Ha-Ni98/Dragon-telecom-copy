import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import type { UserDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

export interface StaffSearchFiltersValue {
  userId?: string;
  query?: string;
  from?: string;
  to?: string;
}

interface StaffSearchFiltersProps {
  value: StaffSearchFiltersValue;
  onChange: (value: StaffSearchFiltersValue) => void;
  users?: UserDto[];
  disabled?: boolean;
}

// ADM-19 — StaffSearchesQuery filters. User filter source is `useUsers` (identity), same
// convention as ADM-18's logs page.
export function StaffSearchFilters({
  value,
  onChange,
  users = [],
  disabled = false,
}: StaffSearchFiltersProps) {
  const { t } = useTranslation();

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Input
        placeholder={t("admin.staffSearches.filters.query")}
        value={value.query ?? ""}
        onChange={(e) => onChange({ ...value, query: e.target.value || undefined })}
        disabled={disabled}
        className="w-full sm:w-56"
      />
      <Select
        value={value.userId ?? "all"}
        onValueChange={(v) => onChange({ ...value, userId: v === "all" ? undefined : v })}
        disabled={disabled}
      >
        <SelectTrigger className="w-full sm:w-56">
          <SelectValue placeholder={t("admin.staffSearches.filters.user")} />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{t("admin.logs.filters.allUsers")}</SelectItem>
          {users.map((user) => (
            <SelectItem key={user.id} value={user.id}>
              {user.username}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Input
        type="date"
        value={value.from ?? ""}
        onChange={(e) => onChange({ ...value, from: e.target.value || undefined })}
        disabled={disabled}
        className="w-full sm:w-40"
      />
      <Input
        type="date"
        value={value.to ?? ""}
        onChange={(e) => onChange({ ...value, to: e.target.value || undefined })}
        disabled={disabled}
        className="w-full sm:w-40"
      />
    </div>
  );
}
