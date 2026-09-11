// KNOWN_RISKS.md HIGH-6: every "list everything" endpoint this project had
// (the audit trail, workflow listings) used a plain repository.find() with
// no take/skip and no ceiling - harmless at today's prototype data volume
// (hundreds of rows, per the audit), but a real deployment running for
// months has no bound on response size or query time. Shared here so every
// call site gets the same default/ceiling instead of drifting per-endpoint.
//
// The default (200) is deliberately generous rather than a tight "page
// size" (e.g. the audit's suggested 50) - these are all "recent activity"
// views (newest-first) that today's UI renders as one long scrollable list,
// not a paged one; the goal here is closing the unbounded-growth risk
// without changing what an admin/officer currently sees. `limit`/`offset`
// are still accepted for a future paged UI to opt into.
export const DEFAULT_PAGE_LIMIT = 200;
export const MAX_PAGE_LIMIT = 500;

export function resolvePagination(limit?: number, offset?: number): { take: number; skip: number } {
  const parsedLimit = Number(limit);
  const take = Number.isFinite(parsedLimit) && parsedLimit > 0 ? Math.min(parsedLimit, MAX_PAGE_LIMIT) : DEFAULT_PAGE_LIMIT;

  const parsedOffset = Number(offset);
  const skip = Number.isFinite(parsedOffset) && parsedOffset > 0 ? parsedOffset : 0;

  return { take, skip };
}
