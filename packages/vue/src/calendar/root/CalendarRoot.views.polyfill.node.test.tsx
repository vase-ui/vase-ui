import { expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';
import CalendarViewsHydration from './CalendarViewsHydration.test.vue';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

const polyfillTemporal = globalThis.Temporal;

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(polyfillTemporal).not.toBe(nativeTemporal);
});

it.each([
  { name: 'the grid of months', props: { view: 'month' as const } },
  {
    name: 'the grid of years, with limits',
    props: { view: 'year' as const, minDate: '2018-01-01' },
  },
  { name: 'a year and month, selected', props: { value: '2026-03' } },
  { name: 'the Buddhist calendar of a locale', props: { view: 'month' as const, locale: 'th-TH' } },
  {
    name: 'the Persian calendar of a prop',
    props: { view: 'month' as const, calendar: 'persian' },
  },
])('renders the HTML of the native run for $name', async ({ props }) => {
  const polyfillHtml = await renderToString(
    <CalendarViewsHydration today="2026-11-14" {...props} />,
  );

  vi.stubGlobal('Temporal', nativeTemporal);
  onTestFinished(() => {
    vi.stubGlobal('Temporal', polyfillTemporal);
  });
  const nativeHtml = await renderToString(<CalendarViewsHydration today="2026-11-14" {...props} />);

  expect(polyfillHtml).toBe(nativeHtml);
});
