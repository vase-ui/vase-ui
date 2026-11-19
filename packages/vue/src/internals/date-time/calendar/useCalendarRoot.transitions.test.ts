import { expect, it, onTestFinished } from 'vitest';
import { effectScope, shallowRef } from 'vue';
import { getMonthPage } from './monthGrid';
import { usePageTransition } from './useCalendarRoot';

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

it('drops outgoing pages on a layout change and keeps the last navigation direction', () => {
  const november = getMonthPage(Temporal.PlainYearMonth.from('2026-11'), 1);
  const december = getMonthPage(Temporal.PlainYearMonth.from('2026-12'), 1);
  const pages = shallowRef([november]);
  const layout = shallowRef('iso8601');
  const scope = effectScope();
  onTestFinished(() => scope.stop());
  const transition = scope.run(() => usePageTransition(pages, layout, shallowRef(true)))!;

  pages.value = [december];
  expect(transition.navigationDirection.value).toBe('next');
  expect(transition.isLeaving(november)).toBe(true);

  layout.value = 'persian';
  expect(transition.renderedPages.value).toEqual([december]);
  expect(transition.navigationDirection.value).toBe('next');

  pages.value = [november];
  expect(transition.isLeaving(december)).toBe(true);
  expect(transition.navigationDirection.value).toBe('previous');
});
