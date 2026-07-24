


export function normalizeEmptyStrings(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(normalizeEmptyStrings);
  }

  if (value !== null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map(([key, val]) => [
        key,
        normalizeEmptyStrings(val),
      ]),
    );
  }

  if (typeof value === "string") {
    const trimmed = value.trim();

    if (trimmed === "") return undefined;
    if (trimmed === "null") return null;
    if (trimmed === "undefined") return undefined;
  }

  return value;
}