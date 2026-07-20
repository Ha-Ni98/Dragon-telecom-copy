import StaffPos from "@/pages/staff/pos/StaffPos";

// ADM-05 — "the exact STF-02 component, mounted unscoped": admin reuses the same tree, not a
// fork, so everyone's drafts (grouped by staff) are visible instead of just the caller's own.
export default function AdminPos() {
  return <StaffPos scope="admin" />;
}
