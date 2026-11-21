import { useEffect } from "react";
import { useLocation } from "react-router-dom";

// How long a #hash target is kept in view while the page is still settling (lazy home sections and
// images load after mount and push the footer down). Any user scroll ends it sooner.
const HASH_SETTLE_MS = 2000;

// Every client-side navigation lands at the top of the page. Keyed on `pathname` only — not on
// `search` — so changing a filter, a page number or a tab query param keeps the reader where they
// are, while moving to a different route always resets.
//
// Owner change after S39 — a URL with a hash (/#footer, /#header) lands on that element instead.
// A single-page app gets no native jump: the target may not exist yet, and content rendered later
// (lazy sections, images) moves it. So the element is scrolled into view, then kept there by a
// ResizeObserver on <body> for up to HASH_SETTLE_MS — and the moment the visitor scrolls, presses a
// key or touches the screen, it lets go so it never fights them.
//
// Deliberately NOT React Router's <ScrollRestoration>: that component *restores* each entry's
// saved offset, which is exactly the behavior being fixed here.
export function ScrollToTop() {
  const { pathname, hash } = useLocation();
  useEffect(() => {
    if (!hash) {
      window.scrollTo({ top: 0, left: 0, behavior: "instant" });
      return;
    }

    const id = decodeURIComponent(hash.slice(1));
    const align = () => document.getElementById(id)?.scrollIntoView({ block: "start" });

    let done = false;
    const observer = new ResizeObserver(() => {
      if (!done) align();
    });
    const stop = () => {
      done = true;
      observer.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener("wheel", stop);
      window.removeEventListener("touchstart", stop);
      window.removeEventListener("keydown", stop);
    };

    align();
    observer.observe(document.body);
    const timer = window.setTimeout(stop, HASH_SETTLE_MS);
    window.addEventListener("wheel", stop, { passive: true });
    window.addEventListener("touchstart", stop, { passive: true });
    window.addEventListener("keydown", stop);
    return stop;
  }, [pathname, hash]);
  return null;
}
