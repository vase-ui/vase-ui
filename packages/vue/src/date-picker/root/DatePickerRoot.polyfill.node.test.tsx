import { expect, it } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs, so the values come from the native `Temporal` first and
// from the polyfill after `useTemporalPolyfill()`.
const SERVER_CASES: Record<string, () => VNode> = {
  'a date in en-US': () => (
    <DatePicker.Root
      defaultValue={Temporal.PlainDate.from('2026-11-14')}
      locale="en-US"
      name="when"
    >
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
      <DatePicker.Trigger>Open</DatePicker.Trigger>
    </DatePicker.Root>
  ),
  'a date and time in a zone': () => (
    <DatePicker.Root
      defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}
      locale="de-DE"
    >
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
      <DatePicker.Trigger>Open</DatePicker.Trigger>
    </DatePicker.Root>
  ),
  'a year and month': () => (
    <DatePicker.Root defaultValue={Temporal.PlainYearMonth.from('2026-11')} locale="en-US">
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
      <DatePicker.Trigger>Open</DatePicker.Trigger>
    </DatePicker.Root>
  ),
  'a Persian year and month with no value': () => (
    <DatePicker.Root granularity="month" calendar="persian" locale="en-US" timeZone="UTC">
      <DatePicker.Field>
        <DateField.Input />
      </DatePicker.Field>
      <DatePicker.Trigger>Open</DatePicker.Trigger>
    </DatePicker.Root>
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
