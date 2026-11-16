import { expect, it } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs, so the values come from the native `Temporal` first and
// from the polyfill after `useTemporalPolyfill()`.
const SERVER_CASES: Record<string, () => VNode> = {
  'dates in en-US': () => (
    <DateRangePicker.Root
      defaultValue={[Temporal.PlainDate.from('2026-11-14'), Temporal.PlainDate.from('2026-11-20')]}
      locale="en-US"
      startName="from"
      endName="to"
    >
      <DateRangePicker.StartField>
        <DateField.Input />
      </DateRangePicker.StartField>
      <DateRangePicker.EndField>
        <DateField.Input />
      </DateRangePicker.EndField>
      <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
    </DateRangePicker.Root>
  ),
  'dates and times in a zone': () => (
    <DateRangePicker.Root
      defaultValue={[
        Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]'),
        Temporal.ZonedDateTime.from('2026-11-20T09:30[Asia/Tokyo]'),
      ]}
      locale="de-DE"
    >
      <DateRangePicker.StartField>
        <DateField.Input />
      </DateRangePicker.StartField>
      <DateRangePicker.EndField>
        <DateField.Input />
      </DateRangePicker.EndField>
      <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
    </DateRangePicker.Root>
  ),
  'a range with one end': () => (
    <DateRangePicker.Root
      defaultValue={[Temporal.PlainDate.from('2026-11-14'), null]}
      locale="en-US"
      timeZone="UTC"
    >
      <DateRangePicker.StartField>
        <DateField.Input />
      </DateRangePicker.StartField>
      <DateRangePicker.EndField>
        <DateField.Input />
      </DateRangePicker.EndField>
      <DateRangePicker.Trigger>Open</DateRangePicker.Trigger>
    </DateRangePicker.Root>
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
