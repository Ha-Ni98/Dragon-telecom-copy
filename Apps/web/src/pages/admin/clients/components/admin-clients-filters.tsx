/**
 * Admin Clients Filters Component
 * Provides search and filter controls for the clients table
 */

import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Search, Filter, X, RefreshCw, Users, UserCheck, Clock, AlertTriangle } from "lucide-react";
import { ClientStatus } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

type StatusFilterValue = ClientStatus | "all";

interface AdminClientsFiltersProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedStatus: StatusFilterValue;
  onStatusChange: (status: StatusFilterValue) => void;
  onClearFilters?: () => void;
  loading?: boolean;
  className?: string;
  showClearFilters?: boolean;
  hasActiveFilters?: boolean;
}

// ADM-12 — retyped: filter values are now ClientStatus (PENDING/APPROVED/REJECTED, the real
// AdminClientListQuery.status enum), not the old view-model's invented "active"/"disabled"/
// "refused" strings.
const STATUS_OPTIONS: { value: StatusFilterValue; labelKey: string; icon: typeof Users }[] = [
  { value: "all", labelKey: "admin.clients.allStatus", icon: Users },
  { value: ClientStatus.PENDING, labelKey: "admin.clients.pending", icon: Clock },
  { value: ClientStatus.APPROVED, labelKey: "admin.clients.activeClients", icon: UserCheck },
  { value: ClientStatus.REJECTED, labelKey: "admin.clients.refused", icon: AlertTriangle },
];

/**
 * Main AdminClientsFilters component
 */
export const AdminClientsFilters = memo(function AdminClientsFilters({
  searchQuery,
  onSearchChange,
  selectedStatus,
  onStatusChange,
  onClearFilters,
  loading = false,
  className = "",
  showClearFilters = true,
  hasActiveFilters = false,
}: AdminClientsFiltersProps) {
  const { t } = useTranslation();

  return (
    <Card className={className}>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 min-w-0">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                id="search-input"
                type="text"
                placeholder={t("admin.clients.filters.searchPlaceholder")}
                value={searchQuery}
                onChange={(e) => onSearchChange(e.target.value)}
                disabled={loading}
                className="pl-10"
                aria-label={t("admin.clients.filters.searchAria")}
              />
              {searchQuery && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onSearchChange("")}
                  className="absolute right-1 top-1/2 transform -translate-y-1/2 h-8 w-8"
                  aria-label={t("common.actions.clearSearch")}
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Status Filter */}
          <div className="w-full sm:w-48">
            <Select
              value={selectedStatus}
              onValueChange={(value) => onStatusChange(value as StatusFilterValue)}
              disabled={loading}
            >
              <SelectTrigger id="status-filter" className="w-full">
                <SelectValue placeholder={t("admin.clients.filters.allStatus")} />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="h-4 w-4" />
                        <span>{t(option.labelKey)}</span>
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Clear Filters Button */}
          {showClearFilters && hasActiveFilters && onClearFilters && (
            <div className="flex items-center">
              <Button
                variant="outline"
                size="sm"
                onClick={onClearFilters}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <X className="h-4 w-4" />
                {t("common.actions.clear")}
              </Button>
            </div>
          )}

          {/* Loading State */}
          {loading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <RefreshCw className="h-4 w-4 animate-spin" />
              <span>{t("common.loading")}</span>
            </div>
          )}
        </div>

        {/* Active Filters Display */}
        {hasActiveFilters && (
          <div className="mt-3 pt-3 border-t">
            <div className="flex flex-wrap gap-2">
              {searchQuery && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Search className="h-3 w-3" />
                  {t("common.labels.search")}: "{searchQuery}"
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onSearchChange("")}
                    className="h-4 w-4 p-0 ml-1"
                    aria-label={t("products.filters.removeSearch")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
              {selectedStatus !== "all" && (
                <Badge variant="secondary" className="flex items-center gap-1">
                  <Filter className="h-3 w-3" />
                  {t("common.labels.status")}:{" "}
                  {t(
                    STATUS_OPTIONS.find((o) => o.value === selectedStatus)?.labelKey ??
                      "admin.clients.allStatus",
                  )}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => onStatusChange("all")}
                    className="h-4 w-4 p-0 ml-1"
                    aria-label={t("admin.clients.filters.removeStatus")}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </Badge>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
});
