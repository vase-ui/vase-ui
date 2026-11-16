import { expect, it, onTestFinished, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';
import RangeCalendarRootHydration from './RangeCalendarRootHydration.test.vue';

const nativeTemporal = globalThis.Temporal;

useTemporalPolyfill();

const polyfillTemporal = globalThis.Temporal;

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(polyfillTemporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainDate.from('2026-11-14')).not.toBeInstanceOf(nativeTemporal.PlainDate);
});

it.each([
  { name: 'today only', props: { today: '2026-11-14' } },
  { name: 'a range', props: { today: '2026-11-14', start: '2026-11-10', end: '2026-11-14' } },
  { name: 'a range in progress', props: { today: '2026-11-14', start: '2026-11-10' } },
  {
    name: 'a disabled day',
    props: {
      today: '2026-11-14',
      start: '2026-11-10',
      end: '2026-11-14',
      disabledDate: '2026-11-12',
    },
  },
  { name: 'a locale that starts on Monday', props: { today: '2026-11-14', locale: 'fr' } },
  { name: 'the Persian calendar', props: { today: '2026-11-14', calendar: 'persian' } },
])('renders the HTML of the native run for $name', async ({ props }) => {
  const polyfillHtml = await renderToString(<RangeCalendarRootHydration {...props} />);

  vi.stubGlobal('Temporal', nativeTemporal);
  onTestFinished(() => {
    vi.stubGlobal('Temporal', polyfillTemporal);
  });
  const nativeHtml = await renderToString(<RangeCalendarRootHydration {...props} />);

  expect(polyfillHtml).toBe(nativeHtml);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./RangeCalendarRoot.node.test');
