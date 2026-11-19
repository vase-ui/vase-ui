import { expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import DateTimeFieldProbe from '../../../../test/fixtures/DateTimeFieldProbe.vue';
import { useTemporalPolyfill } from '../../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

const SERVER_CASES: Record<string, Record<string, unknown>> = {
  'a date in en-US': { defaultValue: '2026-11-14', locale: 'en-US', name: 'when' },
  'a date in ar-EG': { defaultValue: '2026-11-14', locale: 'ar-EG' },
  'a date in the Persian calendar': {
    defaultValue: '2026-11-14',
    locale: 'en-US',
    calendar: 'persian',
  },
  'a date and time in de-DE': { defaultValue: '2026-11-14T15:04', locale: 'de-DE' },
  'a zoned value': { defaultValue: '2026-11-14T15:04[Asia/Tokyo]', locale: 'en-US' },
  'a time in en-US': { family: 'time', defaultValue: '15:04:33', locale: 'en-US' },
  'a year and month': { defaultValue: '2026-11', locale: 'en-US', required: true },
  'an empty date': { locale: 'en-US', referenceDate: '2026-11-14' },
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, props] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(<DateTimeFieldProbe {...props} />);
  }
  return html;
}

// The native HTML comes before the polyfill.
const nativeHtml = await renderServerCases();

useTemporalPolyfill();

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainDate.from('2026-11-14')).not.toBeInstanceOf(nativeTemporal.PlainDate);
});

it('renders the same server HTML as the native Temporal', async () => {
  const polyfillHtml = await renderServerCases();

  expect(Object.keys(nativeHtml)).toEqual(Object.keys(SERVER_CASES));
  expect(polyfillHtml).toEqual(nativeHtml);
});

// Each module reads `Temporal` only in its cases, so the cases get the polyfill.
await import('./segmentLayout.test');
await import('./segmentLayout.ranges.test');
await import('./useDateTimeFieldRoot.validity.test');
