import { expect, it } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs, so the values come from the native `Temporal` first and
// from the polyfill after `useTemporalPolyfill()`.
const SERVER_CASES: Record<string, () => VNode> = {
  'a date in en-US': () => (
    <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="en-US" name="when">
      <DateField.Input />
    </DateField.Root>
  ),
  'a date in the Persian calendar': () => (
    <DateField.Root
      defaultValue={Temporal.PlainDate.from('2026-11-14')}
      locale="en-US"
      calendar="persian"
    >
      <DateField.Input />
    </DateField.Root>
  ),
  'a date in ar-EG': () => (
    <DateField.Root defaultValue={Temporal.PlainDate.from('2026-11-14')} locale="ar-EG">
      <DateField.Input />
    </DateField.Root>
  ),
  'a date and time in a zone': () => (
    <DateField.Root
      defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}
      locale="de-DE"
    >
      <DateField.Input />
    </DateField.Root>
  ),
  'a year and month': () => (
    <DateField.Root defaultValue={Temporal.PlainYearMonth.from('2026-11')} locale="en-US">
      <DateField.Input />
    </DateField.Root>
  ),
  'an empty date with a Clear button': () => (
    <DateField.Root locale="en-US" referenceDate={Temporal.PlainDate.from('2026-11-14')}>
      <DateField.Input />
      <DateField.Clear />
    </DateField.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, createCase] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(createCase());
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
