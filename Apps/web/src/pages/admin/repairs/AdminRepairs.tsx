import StaffRepairs from "@/pages/staff/repairs/StaffRepairs";

// ADM-13 — same board/intake/ticket-detail tree as STF-07, unscoped (every technician's
// tickets, plus profit/cost columns gated on `scope`).
export default function AdminRepairs() {
  return <StaffRepairs scope="admin" />;
}
