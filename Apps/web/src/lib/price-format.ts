import { PRICE_CURRENCY_SUFFIX } from "@/config/constants";

// S37 — THE storefront & client-area price format: "3 200 DA", "12 500,50 DA".
// - thousands separator: a no-break space (U+00A0), so a price never wraps mid-number;
// - decimals: only when the amount has cents (prices are Decimal(12,2)), comma separator;
// - suffix: a no-break space + "DA".
// Deliberately NOT Intl.NumberFormat("fr-FR"): that emits a narrow no-break space (U+202F) and
// would vary with the runtime's ICU data. Language-independent by design — both locales show the
// same string. Scope: storefront + client pages only. Admin, staff, POS, receipts, back-office
// invoices and PDFs keep formatDZD — do not swap those call sites.
const NBSP = " ";

export function formatPrice(amount: number): string {
  const cents = Math.round(Math.abs(amount) * 100);
  const whole = Math.floor(cents / 100).toString();
  const fraction = cents % 100;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  const decimals = fraction === 0 ? "" : `,${fraction.toString().padStart(2, "0")}`;
  const sign = amount < 0 && cents !== 0 ? "-" : "";
  return `${sign}${grouped}${decimals}${NBSP}${PRICE_CURRENCY_SUFFIX}`;
}
