import { useMemo } from "react";
import type { ColumnDef } from "@tanstack/react-table";
import { DataTable } from "@/components/shared/DataTable";
import { TableSkeleton } from "@/components/shared/TableSkeleton";
import { EmptyState } from "@/components/shared/EmptyState";
import { EnabledBadge } from "@/components/shared/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, Edit } from "lucide-react";
import { UserType, type UserDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface UsersTableProps {
  data: UserDto[];
  isLoading?: boolean;
  onEdit: (user: UserDto) => void;
}

// ADM-16 Users tab — UserDto (identity.dtos.ts).
export function UsersTable({ data, isLoading = false, onEdit }: UsersTableProps) {
  const { t, language } = useTranslation();

  const columns = useMemo<ColumnDef<UserDto>[]>(
    () => [
      { accessorKey: "username", header: t("admin.users.table.username") },
      {
        id: "fullName",
        header: t("admin.users.table.fullName"),
        cell: ({ row }) => `${row.original.profile.firstName} ${row.original.profile.lastName}`,
      },
      {
        accessorKey: "profile.jobTitle",
        header: t("admin.users.table.jobTitle"),
        cell: ({ row }) => row.original.profile.jobTitle ?? "-",
      },
      {
        accessorKey: "type",
        header: t("admin.users.table.type"),
        cell: ({ row }) => (
          <Badge variant="outline">
            {t(
              row.original.type === UserType.ADMIN
                ? "admin.users.table.type.admin"
                : "admin.users.table.type.staff",
            )}
          </Badge>
        ),
      },
      {
        id: "roles",
        header: t("admin.users.table.roles"),
        cell: ({ row }) => row.original.roles.map((role) => role.name).join(", ") || "-",
      },
      {
        accessorKey: "isEnabled",
        header: t("admin.users.table.status"),
        cell: ({ row }) => <EnabledBadge isEnabled={row.original.isEnabled} />,
      },
      {
        accessorKey: "lastLoginAt",
        header: t("admin.users.table.lastLogin"),
        cell: ({ row }) =>
          row.original.lastLoginAt
            ? new Date(row.original.lastLoginAt).toLocaleString(language)
            : "-",
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => (
          <Button variant="ghost" size="sm" onClick={() => onEdit(row.original)}>
            <Edit className="h-4 w-4" />
          </Button>
        ),
      },
    ],
    [t, language, onEdit],
  );

  const renderMobileRow = (user: UserDto) => (
    <button type="button" onClick={() => onEdit(user)} className="w-full space-y-1 p-4 text-left">
      <div className="flex items-center justify-between">
        <span className="font-medium">{user.username}</span>
        <EnabledBadge isEnabled={user.isEnabled} />
      </div>
      <div className="text-sm text-muted-foreground">
        {user.profile.firstName} {user.profile.lastName}
      </div>
    </button>
  );

  if (isLoading) return <TableSkeleton rows={6} columns={7} />;

  return (
    <DataTable
      columns={columns}
      data={data}
      getRowKey={(user) => user.id}
      renderMobileRow={renderMobileRow}
      emptyState={
        <EmptyState icon={<Users className="h-6 w-6" />} title={t("admin.users.empty")} body="" />
      }
    />
  );
}
