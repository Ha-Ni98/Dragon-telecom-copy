import { Outlet } from "react-router-dom";
import { StaffHeader } from "@/components/layout/StaffHeader";
import { StaffSidebar } from "@/components/layout/StaffSidebar";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { useWorkspaceFocus } from "@/components/providers/WorkspaceFocusProvider";
import { cn } from "@/lib/utils";

// Mirrors AdminLayout.tsx — the third shell (rules §6C: Public/Admin/Staff, never mixed). No
// `children` override prop like AdminLayout's — nothing outside the router mounts this
// directly. CatchAllRoute (S2) no longer picks any layout at all — a 404 under /staff renders
// shell-less, like every other 404, not inside this shell.
export function StaffLayout() {
  const { chromeHidden } = useWorkspaceFocus();
  return (
    <div className="min-h-screen bg-surface">
      <ScrollToTop />
      {!chromeHidden && <StaffHeader />}
      <div className="flex w-full pl-2">
        {!chromeHidden && <StaffSidebar />}
        <main className={cn("min-w-0 flex-1", chromeHidden ? "p-2" : "p-4 sm:p-6 lg:p-8")}>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
