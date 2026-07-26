import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// Every client-side navigation lands at the top of the page. Keyed on `pathname` only — not on
// `search` — so changing a filter, a page number or a tab query param keeps the reader where they
// are, while moving to a different route always resets.
//
// Deliberately NOT React Router's <ScrollRestoration>: that component *restores* each entry's
// saved offset, which is exactly the behavior being fixed here.
export function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [pathname]);
  return null;
}
