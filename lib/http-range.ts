export type ByteRange = { start: number; end: number };

/** Unsupported range units and multiple ranges are ignored; unsatisfiable byte ranges use 416. */
export function parseByteRange(header: string | null, size: number): ByteRange | null | "invalid" {
  if (!header || !/^bytes=/i.test(header.trim()) || header.includes(",")) return null;
  const match = /^bytes=(\d*)-(\d*)$/i.exec(header.trim());
  if (!match || (!match[1] && !match[2]) || size === 0) return "invalid";
  if (!match[1]) {
    const suffix = Number(match[2]);
    if (suffix <= 0) return "invalid";
    return { start: Math.max(0, size - suffix), end: size - 1 };
  }
  const start = Number(match[1]);
  const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
  if (!Number.isSafeInteger(start) || start >= size || start > end) return "invalid";
  return { start, end };
}

export function allowsRange(ifRange: string | null, etag: string, modifiedAt: string): boolean {
  if (!ifRange) return true;
  if (ifRange.startsWith('"')) return ifRange === etag;
  if (ifRange.startsWith("W/")) return false;
  const date = Date.parse(ifRange);
  return Number.isFinite(date) && Math.floor(Date.parse(modifiedAt) / 1000) * 1000 <= date;
}
