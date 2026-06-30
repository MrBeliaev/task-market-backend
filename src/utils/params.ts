/** Parses an Express route/query param (string or string[] in Express 5) into an integer. */
export function parseIntParam (value: string | string[] | undefined): number | null {
  const raw: string | undefined = Array.isArray(value) ? value[0] : value;
  if (raw === undefined) {
    return null;
  }

  const n: number = parseInt(raw, 10);
  return isNaN(n) ? null : n;
}
