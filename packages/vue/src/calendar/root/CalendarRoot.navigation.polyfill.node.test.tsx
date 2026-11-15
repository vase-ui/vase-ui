import { expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';
import CalendarNavigationHydration from './CalendarNavigationHydration.test.vue';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

const polyfillTemporal = globalThis.Temporal;

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(polyfillTemporal).not.toBe(nativeTemporal);
});

it.each([
  {
    name: 'two months, with the outside days',
    props: { numberOfMonths: 2, showOutsideDays: true },
  },
  { name: 'fixed weeks and week numbers', props: { fixedWeeks: true, weekNumbers: true } },
  { name: 'the ISO weeks of a locale', props: { weekNumbers: true, isoWeek: true, locale: 'fr' } },
  { name: 'the broadcast calendar', props: { broadcastCalendar: true } },
  { name: 'a page of two weeks', props: { duration: 'weeks:2' } },
  { name: 'a page of five days', props: { duration: 'days:5' } },
  {
    name: 'the selects, with limits',
    props: { selects: true, minDate: '2025-01-01', maxDate: '2027-12-31' },
  },
  { name: 'the Buddhist calendar of a locale', props: { selects: true, locale: 'th-TH' } },
])('renders the HTML of the native run for $name', async ({ props }) => {
  const polyfillHtml = await renderToString(
    <CalendarNavigationHydration today="2026-11-14" {...props} />,
  );

  vi.stubGlobal('Temporal', nativeTemporal);
  onTestFinished(() => {
    vi.stubGlobal('Temporal', polyfillTemporal);
  });
  const nativeHtml = await renderToString(
    <CalendarNavigationHydration today="2026-11-14" {...props} />,
  );

  expect(polyfillHtml).toBe(nativeHtml);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./CalendarRoot.navigation.node.test');
