import { stripPhoneSeparators, toInternationalDzPhone } from "@dragon-telecom/contract";

// S38 — tappable contact links (storefront footer). tel: prefers the +213 form; a free-text
// number that is not Algerian (the store phones are not validated) still dials, with its
// separators removed.
export const telHref = (raw: string): string =>
  `tel:${toInternationalDzPhone(raw) ?? stripPhoneSeparators(raw)}`;

// wa.me needs the international number, digits only. null when the number is not Algerian (the
// admin form validates WhatsApp, so this only guards legacy or hand-edited data).
export const whatsappHref = (raw: string): string | null => {
  const international = toInternationalDzPhone(raw);
  return international ? `https://wa.me/${international.slice(1)}` : null;
};

export const mailtoHref = (email: string): string => `mailto:${email}`;
