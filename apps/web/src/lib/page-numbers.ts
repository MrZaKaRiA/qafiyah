const POSITIVE_INTEGER_RE = /^\d+$/;

export function parsePageParam(raw: string | undefined): number | null {
  if (raw === undefined || !POSITIVE_INTEGER_RE.test(raw)) return null;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 1 ? page : null;
}

export function parsePageQuery(raw: string | null): number | null {
  if (raw === null) return 1;
  if (!POSITIVE_INTEGER_RE.test(raw)) return null;
  const page = Number(raw);
  return Number.isInteger(page) && page >= 2 ? page : null;
}
