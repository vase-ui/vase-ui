import { expect, it, onTestFinished } from 'vitest';
import { effectScope, shallowRef } from 'vue';
import { getMonthPage } from './monthGrid';
import { usePageTransition } from './usePageTransition';

it('retains the old day page until the view leaves days, even within one task', () => {
  const november = getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 1);
  const december = getMonthPage(Temporal.PlainYearMonth.from('2026-12'), 1);
  const pages = shallowRef([november]);
  const days = shallowRef(true);
  const scope = effectScope();
  onTestFinished(() => scope.stop());
  const transition = scope.run(() => usePageTransition(pages, shallowRef('iso8601'), days))!;

  pages.value = [december];
  expect(transition.renderedPages.value).toEqual([november, december]);
  expect(transition.navigationDirection.value).toBe('next');

  days.value = false;
  expect(transition.renderedPages.value).toEqual([december]);
  expect(transition.navigationDirection.value).toBe('none');
});
