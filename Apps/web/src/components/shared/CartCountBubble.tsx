// S37 — the cart's count bubble (header on md+, bottom nav on phones). Filled highlight →
// highlight-foreground text, never text-white (dark-mode vermilion fails AA with white).
// Hidden at 0. Decorative: the parent link carries the count in its aria-label.
export function CartCountBubble({ count }: { count: number }) {
  if (count <= 0) return null;
  return (
    <span
      aria-hidden="true"
      className="pointer-events-none absolute -right-1 -top-1 flex h-[1.125rem] min-w-[1.125rem] items-center justify-center rounded-full bg-highlight px-1 text-[10px] font-bold leading-none text-highlight-foreground"
    >
      {count > 9 ? "9+" : count}
    </span>
  );
}
