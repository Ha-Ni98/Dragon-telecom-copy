import { TableSkeleton } from "@/components/shared/TableSkeleton";

interface Props {
  scope?: "staff" | "admin";
}

// Placeholder shell (Sprint 2 — routing/tsc only). Pure Skeleton markup, no hooks, no text —
// Sprint 4 adds the real table/tabs/dialog primitives, Sprint 6 wires them.
export default function StaffInvoices({ scope: _scope = "staff" }: Props) {
  return <TableSkeleton rows={8} columns={7} />;
}
