import { useEffect, useState } from "react";

interface UseLoadMoreOptions {
  initialCount?: number;
  increment?: number;
  /** Optional extra reset trigger, for callers whose filtered array isn't reference-stable across renders. */
  resetKey?: string | number;
}

/**
 * Drives a "Load More" list (as opposed to page-number pagination): reveals `initialCount`
 * items, then reveals `increment` more each time `loadMore` is called. Resets back to
 * `initialCount` whenever `items` (or `resetKey`) changes, matching this app's existing
 * pattern of recomputing a filtered array only when the filter actually changes.
 */
export function useLoadMore<T>(items: T[], options: UseLoadMoreOptions = {}) {
  const { initialCount = 10, increment = 10, resetKey } = options;
  const [visibleCount, setVisibleCount] = useState(initialCount);

  useEffect(() => {
    setVisibleCount(initialCount);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items, resetKey]);

  const visibleItems = items.slice(0, visibleCount);
  const hasMore = visibleCount < items.length;
  const loadMore = () => setVisibleCount((count) => count + increment);

  return { visibleItems, hasMore, loadMore, visibleCount };
}
