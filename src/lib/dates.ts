/** Tanggal YYYY-MM-DD n hari lalu (UTC). */
export function isoDaysAgo(n: number): string {
  return new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
}
