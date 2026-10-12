// S32 — the store's business day. Every "today" and every date-range filter on a money document
// is an Africa/Algiers calendar day, never a UTC day: a sale at 00:30 local belongs to that local
// day. Shared by the API (query bounds) and the web (what "today" is). Pure Intl — no library.
export const STORE_TIME_ZONE = 'Africa/Algiers';

// Offset (ms) of the store zone from UTC at a given instant.
function storeOffsetMs(at: Date): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: STORE_TIME_ZONE,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(at);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find((p) => p.type === type)?.value ?? 0);
  const asUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return asUtc - Math.floor(at.getTime() / 1000) * 1000;
}

// 'YYYY-MM-DD' of the store-local day containing `at` (default: now).
export function storeLocalDate(at: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: STORE_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(at);
}

// The UTC instant at which store-local day `isoDate` ('YYYY-MM-DD') begins.
export function storeDayStartUtc(isoDate: string): Date {
  const [y, m, d] = isoDate.split('-').map(Number);
  const utcMidnight = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);
  return new Date(utcMidnight - storeOffsetMs(new Date(utcMidnight)));
}

// Half-open UTC bounds for an inclusive store-local day range — `to` includes its whole day.
// Use as a Prisma DateTime filter: `{ soldAt: storeDayRangeUtc(from, to) }`.
export function storeDayRangeUtc(from?: string, to?: string): { gte?: Date; lt?: Date } {
  const range: { gte?: Date; lt?: Date } = {};
  if (from != null) range.gte = storeDayStartUtc(from);
  if (to != null) {
    const [y, m, d] = to.split('-').map(Number);
    const next = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, (d ?? 1) + 1)).toISOString().slice(0, 10);
    range.lt = storeDayStartUtc(next);
  }
  return range;
}
