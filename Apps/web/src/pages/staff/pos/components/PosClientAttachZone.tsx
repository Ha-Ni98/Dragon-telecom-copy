import { UserPlus, UserX, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useTranslation } from "@/hooks/useTranslation";
import { formatDZD } from "@/lib/utils";
import type { PosClientDto } from "@dragon-telecom/contract";
import { FieldError } from "@/components/shared/FieldError";

interface PosClientAttachZoneProps {
  attachedClient?: PosClientDto;
  query: string;
  onQueryChange: (query: string) => void;
  results?: PosClientDto[];
  isSearching?: boolean;
  onAttach: (client: PosClientDto) => void;
  onDetach: () => void;
  onQuickAdd: () => void;
  /** CREDIT_REQUIRES_CLIENT — surfaced here per STF-02 §Forms ("underpayment with no client
   * attached surfaces CREDIT_REQUIRES_CLIENT on the client zone"). */
  error?: string;
}

// Dumb, props-only (Sprint 4) — Sprint 7 wires usePosClientSearch()/useQuickCreatePosClient().
export function PosClientAttachZone({
  attachedClient,
  query,
  onQueryChange,
  results,
  isSearching,
  onAttach,
  onDetach,
  onQuickAdd,
  error,
}: PosClientAttachZoneProps) {
  const { t, language } = useTranslation();

  if (attachedClient) {
    return (
      <div className="rounded-xl border border-border bg-card p-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="font-medium">{attachedClient.name}</div>
            <div className="text-xs text-muted-foreground">
              {attachedClient.phone} · {attachedClient.categoryName ?? "—"} ·{" "}
              {formatDZD(attachedClient.credit, language)}
            </div>
          </div>
          <Button variant="outline" size="sm" onClick={onDetach}>
            <UserX className="mr-1 h-3.5 w-3.5" />
            {t("staff.pos.clientZone.detach")}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={query}
            onChange={(e) => onQueryChange(e.target.value)}
            placeholder={t("staff.pos.clientZone.searchPlaceholder")}
            className="pl-9"
          />
        </div>
        <Button variant="outline" onClick={onQuickAdd}>
          <UserPlus className="mr-1 h-3.5 w-3.5" />
          {t("staff.pos.clientZone.quickAdd")}
        </Button>
      </div>

      {isSearching && <Skeleton className="h-10 w-full rounded-lg" />}

      {!isSearching && results && results.length > 0 && (
        <div className="max-h-40 space-y-1 overflow-y-auto">
          {results.map((client) => (
            <button
              key={client.id}
              type="button"
              onClick={() => onAttach(client)}
              className="flex w-full items-center justify-between rounded-lg border border-border p-2 text-left text-sm hover:bg-accent"
            >
              <span>{client.name}</span>
              <span className="text-xs text-muted-foreground">{client.phone}</span>
            </button>
          ))}
        </div>
      )}

      {error && <FieldError>{error}</FieldError>}
    </div>
  );
}
