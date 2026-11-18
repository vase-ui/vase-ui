import { computed, shallowRef, watch } from 'vue';
import type { Ref } from 'vue';
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
 * has another first day of the week, or another calendar, than the locale of a server. After a
 * hydration, the first page also changes when the clock of the browser gives another day than the
 * clock of the server. A new layout drops outgoing pages and keeps the last navigation direction.
 *
 * Only the pages of days move, so `isEnabled` is `false` while the grid shows months or years. No
 * page leaves then, because no `Calendar.Month` is there to end its animation. The side is `none`.
 *
 * The watcher is synchronous, so a page is in `renderedPages` in the render that removes it from
 * `pages`.
 */
export function usePageTransition(
  pages: Readonly<Ref<CalendarPage[]>>,
  layoutKey: Readonly<Ref<string>>,
  isEnabled: Readonly<Ref<boolean>>,
) {
  const navigationDirection = shallowRef<NavigationDirection>('none');
  const leaving = shallowRef<CalendarPage[]>([]);

  watch(
    [pages, layoutKey, isEnabled],
    ([next, layout, enabled], [previous, previousLayout]) => {
      if (!enabled || layout !== previousLayout) {
        leaving.value = [];
        if (!enabled) {
          navigationDirection.value = 'none';
        }
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
    [...pages.value, ...leaving.value].sort((a, b) => compareDates(a.first, b.first)),
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
