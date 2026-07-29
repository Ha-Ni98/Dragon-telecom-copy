import { useState, useCallback, useEffect } from "react";
import { Calendar, Filter, X, User, Activity, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/hooks/useTranslation";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import type { UserDto } from "@dragon-telecom/contract";

// Page-local — not a DTO. Maps to `LogsQuery` (observability.query.ts) at the Sprint 8 call
// site; `search`/`actionType` are free-form strings on the real query (AuditLogDto.actionType
// has no fixed enum), so the old view-model's numeric `ActionTypeCode` dropdown is dropped for
// a plain text filter.
export interface LogsFilterValues {
  search: string;
  page: number;
  limit: number;
  userId?: string;
  actionType?: string;
  dateFrom?: string;
  dateTo?: string;
}

interface AdminLogsFiltersProps {
  onFiltersChange: (filters: LogsFilterValues) => void;
  /** Real users come from `useUsers` (identity) per the plan — not the stub `usePlatformUsers`. */
  users?: UserDto[];
  loading?: boolean;
  className?: string;
}

// ADM-18 — retyped: `userId`/`actionType` are now free-form strings matched against
// AuditLogDto's real shape, not the old view-model's numeric codes; the user-filter source
// switches from the stub `usePlatformUsers` to `users` (real `UserDto[]`, passed in by the
// page — Sprint 8 wires it from `useUsers`).
export function AdminLogsFilters({
  onFiltersChange,
  users = [],
  loading = false,
  className = "",
}: AdminLogsFiltersProps) {
  const { t } = useTranslation();

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedUser, setSelectedUser] = useState("all");
  const [actionTypeQuery, setActionTypeQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const debouncedSearchQuery = useDebouncedValue(searchQuery, 300);
  const debouncedActionType = useDebouncedValue(actionTypeQuery, 300);

  const hasActiveFilters =
    selectedUser !== "all" ||
    debouncedActionType.trim() !== "" ||
    dateFrom !== "" ||
    dateTo !== "" ||
    debouncedSearchQuery.trim() !== "";

  const handleClearFilters = useCallback(() => {
    setSearchQuery("");
    setSelectedUser("all");
    setActionTypeQuery("");
    setDateFrom("");
    setDateTo("");
  }, []);

  useEffect(() => {
    onFiltersChange({
      search: debouncedSearchQuery,
      page: 1,
      limit: 20,
      userId: selectedUser !== "all" ? selectedUser : undefined,
      actionType: debouncedActionType.trim() !== "" ? debouncedActionType : undefined,
      dateFrom: dateFrom || undefined,
      dateTo: dateTo || undefined,
    });
  }, [debouncedSearchQuery, selectedUser, debouncedActionType, dateFrom, dateTo, onFiltersChange]);

  const getUserName = (userId: string): string => {
    if (userId === "all") return t("admin.logs.filters.allUsers");
    return users.find((u) => u.id === userId)?.username ?? "";
  };

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center space-x-2">
              <Filter className="h-5 w-5" />
              <span>{t("admin.logs.filters.title")}</span>
            </CardTitle>
            <CardDescription>{t("admin.logs.filters.description")}</CardDescription>
          </div>
          {hasActiveFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleClearFilters}
              className="flex items-center space-x-2"
            >
              <X className="h-4 w-4" />
              <span>{t("admin.logs.filters.clearAll")}</span>
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium">
              <Search className="h-4 w-4" />
              <span>{t("admin.logs.filters.search")}</span>
            </label>
            <Input
              placeholder={t("admin.logs.filters.searchPlaceholder")}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium">
              <User className="h-4 w-4" />
              <span>{t("admin.logs.filters.user")}</span>
            </label>
            <Select value={selectedUser} onValueChange={setSelectedUser} disabled={loading}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("admin.logs.filters.selectUser")} />
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
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium">
              <Activity className="h-4 w-4" />
              <span>{t("admin.logs.filters.actionType")}</span>
            </label>
            <Input
              placeholder={t("admin.logs.filters.selectActionType")}
              value={actionTypeQuery}
              onChange={(e) => setActionTypeQuery(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <label className="flex items-center space-x-2 text-sm font-medium">
              <Calendar className="h-4 w-4" />
              <span>{t("admin.logs.filters.dateRange")}</span>
            </label>
            <div className="flex gap-2">
              <Input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
                disabled={loading}
              />
              <Input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>
        </div>

        {hasActiveFilters && (
          <div className="mt-4 rounded-lg bg-muted/50 p-3">
            <div className="mb-2 flex items-center space-x-2">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">{t("admin.logs.filters.activeFilters")}:</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {debouncedSearchQuery && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Search className="h-3 w-3" />
                  <span>
                    {t("admin.logs.filters.search")}: "{debouncedSearchQuery}"
                  </span>
                </Badge>
              )}
              {selectedUser !== "all" && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <User className="h-3 w-3" />
                  <span>
                    {t("admin.logs.filters.user")}: {getUserName(selectedUser)}
                  </span>
                </Badge>
              )}
              {debouncedActionType && (
                <Badge variant="secondary" className="flex items-center space-x-1">
                  <Activity className="h-3 w-3" />
                  <span>
                    {t("admin.logs.filters.actionType")}: {debouncedActionType}
                  </span>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default AdminLogsFilters;
