import { expect, it } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

// Each case reads `Temporal` when it runs, so the values come from the native `Temporal` first and
// from the polyfill after `useTemporalPolyfill()`.
const SERVER_CASES: Record<string, () => VNode> = {
  'a time in en-US': () => (
    <TimePicker.Root defaultValue={Temporal.PlainTime.from('15:04')} locale="en-US" name="start">
      <TimePicker.Field>
        <TimeField.Input />
      </TimePicker.Field>
      <TimePicker.Trigger>Open</TimePicker.Trigger>
    </TimePicker.Root>
  ),
  'a time in a zone': () => (
    <TimePicker.Root
      defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}
      locale="de-DE"
    >
      <TimePicker.Field>
        <TimeField.Input />
      </TimePicker.Field>
      <TimePicker.Trigger>Open</TimePicker.Trigger>
    </TimePicker.Root>
  ),
  'a list, a column and a clock with a value': () => (
    <TimePicker.Root defaultValue={Temporal.PlainTime.from('09:30')} locale="en-US" hourCycle={12}>
      <TimePicker.List step={60} />
      <TimePicker.Column unit="minute" step={30} />
      <TimePicker.Column unit="dayPeriod" />
      <TimePicker.Clock>
        <span>Clock</span>
      </TimePicker.Clock>
    </TimePicker.Root>
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
  expect(Temporal.PlainTime.from('15:04')).not.toBeInstanceOf(nativeTemporal.PlainTime);
});

it('renders the same server HTML as the native Temporal', async () => {
  const polyfillHtml = await renderServerCases();

  expect(Object.keys(nativeHtml)).toEqual(Object.keys(SERVER_CASES));
  expect(polyfillHtml).toEqual(nativeHtml);
});
