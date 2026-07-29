import type { ReactNode } from "react";
import { Outlet } from "react-router-dom";
import { PublicHeader } from "@/components/layout/PublicHeader";
import { PublicFooter } from "@/components/layout/PublicFooter";
import { ScrollToTop } from "@/components/layout/ScrollToTop";

interface Props {
  /** Explicit children override <Outlet/>. Currently unused — CatchAllRoute (S2) no longer
   *  mounts this layout at all, since the 404 it renders is shell-less for every user. Kept for
   *  any future non-router caller that needs to render this shell around arbitrary content. */
  children?: ReactNode;
}

export function PublicLayout({ children }: Props) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <ScrollToTop />
      <PublicHeader />
      <main className="flex-1">{children ?? <Outlet />}</main>
      <PublicFooter />
    </div>
  );
}
