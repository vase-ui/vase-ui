import { expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';
import CalendarRootHydration from './CalendarRootHydration.test.vue';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

const polyfillTemporal = globalThis.Temporal;

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(polyfillTemporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainDate.from('2026-11-14')).not.toBeInstanceOf(nativeTemporal.PlainDate);
});

it.each([
  { name: 'today only', props: { today: '2026-11-14' } },
  { name: 'a selected day', props: { today: '2026-11-14', value: '2026-11-10' } },
  {
    name: 'a list of days',
    props: { today: '2026-11-14', multiple: true, value: '2026-11-10,2026-11-20' },
  },
  {
    name: 'limits and a disabled day',
    props: {
      today: '2026-11-14',
      minDate: '2026-11-05',
      maxDate: '2026-11-25',
      disabledDate: '2026-11-11',
    },
  },
  { name: 'a locale that starts on Monday', props: { today: '2026-11-14', locale: 'fr' } },
  { name: 'the Persian calendar', props: { today: '2026-11-14', calendar: 'persian' } },
  { name: 'the Buddhist calendar of a locale', props: { today: '2026-11-14', locale: 'th-TH' } },
])('renders the HTML of the native run for $name', async ({ props }) => {
  const polyfillHtml = await renderToString(<CalendarRootHydration {...props} />);

  vi.stubGlobal('Temporal', nativeTemporal);
  onTestFinished(() => {
    vi.stubGlobal('Temporal', polyfillTemporal);
  });
  const nativeHtml = await renderToString(<CalendarRootHydration {...props} />);

  expect(polyfillHtml).toBe(nativeHtml);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./CalendarRoot.node.test');
