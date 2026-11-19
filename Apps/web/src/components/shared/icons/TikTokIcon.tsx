// S38 — lucide ships no TikTok glyph, and the footer's social links need one. A single-path inline
// SVG in currentColor, sized like a lucide icon by its className (h-4 w-4). Decorative: the
// surrounding link carries the accessible name.
export function TikTokIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className={className}>
      <path d="M19.6 6.7a4.9 4.9 0 0 1-3.8-4.2V2h-3.4v13.4a2.9 2.9 0 1 1-2-2.8V9.1a6.3 6.3 0 1 0 5.4 6.3V8.9a8.2 8.2 0 0 0 4.8 1.5V7a4.9 4.9 0 0 1-1-.3Z" />
    </svg>
  );
}
