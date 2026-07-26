import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ClientStatusBadge } from "@/components/shared/StatusBadge";
import { ArrowLeft, CheckCircle, KeyRound } from "lucide-react";
import { ClientStatus, type AdminClientDto } from "@dragon-telecom/contract";
import { useTranslation } from "@/hooks/useTranslation";

interface ClientDetailHeaderProps {
  client: AdminClientDto;
  onApprove?: () => void;
  onResetPassword?: () => void;
}

// ADM-12b — client-detail-header. Approve/reject action only shows for PENDING clients;
// reset-password only for APPROVED (a pending client has no credentials to reset yet).
export function ClientDetailHeader({
  client,
  onApprove,
  onResetPassword,
}: ClientDetailHeaderProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate("/admin/clients")}
          className="p-2"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{client.fullName}</h1>
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>{client.phone}</span>
            <ClientStatusBadge status={client.status} />
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        {client.status === ClientStatus.PENDING && onApprove && (
          <Button onClick={onApprove} size="sm" className="gap-2">
            <CheckCircle className="h-4 w-4" />
            {t("admin.clients.approval.approve")}
          </Button>
        )}
        {client.status === ClientStatus.APPROVED && onResetPassword && (
          <Button onClick={onResetPassword} variant="outline" size="sm" className="gap-2">
            <KeyRound className="h-4 w-4" />
            {t("admin.clients.resetPassword.title")}
          </Button>
        )}
      </div>
    </div>
  );
}
