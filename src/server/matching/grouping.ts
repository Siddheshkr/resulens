export function takeDistinctCrossPostings<T extends { job: { cross_posting_key: string } }>(
  ranked: T[],
  limit: number,
) {
  const selected: T[] = [];
  const seen = new Set<string>();

  for (const item of ranked) {
    if (seen.has(item.job.cross_posting_key)) continue;
    seen.add(item.job.cross_posting_key);
    selected.push(item);
    if (selected.length >= limit) break;
  }

  return selected;
}
