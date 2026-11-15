import { computed, shallowRef, watch } from 'vue';
import type { ComputedRef } from 'vue';
import { compareDates } from '../temporal';
import { getPageKey } from './monthGrid';
import type { CalendarPage } from './monthGrid';

/** The side of the last change of the page: `none` until the page changes after the mount. */
export type NavigationDirection = 'previous' | 'next' | 'none';

/**
 * The side of the last change of the pages, and the pages that left. A page that left stays in
 * `renderedPages` until its animations end, so that the part can play the exit.
 *
 * A change of `layoutKey` gives other pages for the same place of the calendar: the runtime locale
 * has another first day of the week, or another calendar, than the locale of a server. It is not a
 * move of the page, so it has no side and no page leaves.
 *
 * The watcher is synchronous, so a page is in `renderedPages` in the render that removes it from
 * `pages`.
 */
export function usePageTransition(
  pages: ComputedRef<CalendarPage[]>,
  layoutKey: ComputedRef<string>,
) {
  const navigationDirection = shallowRef<NavigationDirection>('none');
  const leaving = shallowRef<CalendarPage[]>([]);
  let lastLayoutKey = layoutKey.value;

  watch(
    pages,
    (next, previous) => {
      const isSameLayout = layoutKey.value === lastLayoutKey;
      lastLayoutKey = layoutKey.value;
      if (!isSameLayout) {
        leaving.value = [];
        return;
      }

      const first = next[0];
      const wasFirst = previous[0];
      if (first && wasFirst && compareDates(first.first, wasFirst.first) !== 0) {
        navigationDirection.value =
          compareDates(first.first, wasFirst.first) < 0 ? 'previous' : 'next';
      }
      const shown = new Set(next.map((page) => getPageKey(page)));
      leaving.value = [...leaving.value, ...previous].filter(
        (page) => !shown.has(getPageKey(page)),
      );
    },
    { flush: 'sync' },
  );

  const renderedPages = computed(() =>
    [...pages.value, ...leaving.value].toSorted((a, b) => compareDates(a.first, b.first)),
  );

  return {
    navigationDirection,
    renderedPages,
    isLeaving: (page: CalendarPage) =>
      leaving.value.some((left) => getPageKey(left) === getPageKey(page)),
    finishLeaving: (page: CalendarPage) => {
      leaving.value = leaving.value.filter((left) => getPageKey(left) !== getPageKey(page));
    },
  };
}
