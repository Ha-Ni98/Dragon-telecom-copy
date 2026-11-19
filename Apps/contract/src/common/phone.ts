// S38 — the one Algerian phone rule, moved here from web's phone.schema.ts (S15/R3) so the API
// validates the store's WhatsApp number with the same pattern the storefront forms use.
// Optional +213 / 00213 prefix or a leading 0, then 9 digits (first non-zero). Callers strip
// spaces, dots and dashes first (stripPhoneSeparators).
export const DZ_PHONE_PATTERN = /^(?:(?:\+|00)213|0)[1-9]\d{8}$/;

export const stripPhoneSeparators = (raw: string): string => raw.replace(/[\s.-]/g, '');

export const isDzPhone = (raw: string): boolean => DZ_PHONE_PATTERN.test(stripPhoneSeparators(raw));

// '+213XXXXXXXXX', or null when `raw` is not an Algerian number. Used for tel: and wa.me links.
export function toInternationalDzPhone(raw: string): string | null {
  const digits = stripPhoneSeparators(raw);
  if (!DZ_PHONE_PATTERN.test(digits)) return null;
  const national = digits.replace(/^(?:\+213|00213|0)/, '');
  return `+213${national}`;
}
