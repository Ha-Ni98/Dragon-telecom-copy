import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { Button } from "@/components/ui/button";
import { ShieldCheck, Edit } from "lucide-react";
import type { RoleDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

// System roles that ship pre-seeded and cannot be edited (mirrors the identity module's own
// seeded-role convention) — matched by code since the DTO carries no `isSystem` flag.
const SYSTEM_ROLE_CODES = new Set(["ADMIN", "SUPER_ADMIN"]);

interface RolesTableProps {
  data: RoleDto[];
  isLoading?: boolean;
  onEdit: (role: RoleDto) => void;
}

export function RolesTable({ data, isLoading = false, onEdit }: RolesTableProps) {
  const { t } = useTranslation();

  const columns = useMemo<ColumnDef<RoleDto>[]>(
    () => [
      { accessorKey: "code", header: t("admin.users.roles.table.code") },
      { accessorKey: "name", header: t("admin.users.roles.table.name") },
      {
        accessorKey: "description",
        header: t("admin.users.roles.table.description"),
        cell: ({ row }) => row.original.description ?? "-",
      },
      {
        id: "pages",
        header: t("admin.users.roles.table.pages"),
        cell: ({ row }) => row.original.pageKeys.length,
      },
      {
        accessorKey: "isEnabled",
        header: t("admin.users.roles.table.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) =>
          SYSTEM_ROLE_CODES.has(row.original.code) ? (
            <span className="text-xs text-muted-foreground">
              {t("admin.users.roleForm.systemRoleReadOnly")}
            </span>
          ) : (
            <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
              <Edit className="h-4 w-4" />
            </Button>
          ),
      },
    ],
    [t, onEdit],
  );

  const renderMobileRow = (role: RoleDto) => (
    <div className="space-y-1 p-4">
      <div className="flex items-center justify-between">
        <span className="font-medium">{role.name}</span>
        <EnabledBadge isEnabled={role.isEnabled} />
      </div>
      <div className="text-sm text-muted-foreground">{role.code}</div>
    </div>
  );

  if (isLoading) return <TableSkeleton rows={4} columns={5} />;

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(role) => role.id}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState
          icon={<ShieldCheck className="h-6 w-6" />}
          title={t("admin.users.roles.empty")}
          body=""
        />
      }
    />
  );
}
