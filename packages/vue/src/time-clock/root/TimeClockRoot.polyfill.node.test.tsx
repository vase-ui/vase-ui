import { expect, it } from 'vitest';
import type { VNode } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockFaceNumber } from '@vase-ui/vue/time-clock';
import { useTemporalPolyfill } from '../../../test/temporalPolyfill';

const nativeTemporal = globalThis.Temporal;

function parts() {
  return (
    <>
      <TimeClock.ViewTrigger view="hour" />
      <TimeClock.ViewTrigger view="minute" />
      <TimeClock.DayPeriod value="am" />
      <TimeClock.DayPeriod value="pm" />
      <TimeClock.Face
        v-slots={{
          default: () => <TimeClock.Hand />,
          number: ({ number }: { number: TimeClockFaceNumber }) => (
            <TimeClock.Number number={number} />
          ),
        }}
      />
    </>
  );
}

// Each case makes its value when it renders, so that the polyfill makes the values of its render.
const SERVER_CASES: Record<string, () => VNode> = {
  'a time on a 12-hour face': () => (
    <TimeClock.Root locale="en-US" hourCycle={12} defaultValue={Temporal.PlainTime.from('10:30')}>
      {parts()}
    </TimeClock.Root>
  ),
  'a time in a zone on a 24-hour face': () => (
    <TimeClock.Root
      locale="de-DE"
      defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:45[Asia/Tokyo]')}
    >
      {parts()}
    </TimeClock.Root>
  ),
  'the minutes of a date and time in ar-EG': () => (
    <TimeClock.Root
      locale="ar-EG"
      defaultView="minute"
      minuteStep={5}
      defaultValue={Temporal.PlainDateTime.from('2026-11-14T09:35')}
    >
      {parts()}
    </TimeClock.Root>
  ),
  'a clock with no value in ja-JP': () => (
    <TimeClock.Root locale="ja-JP" hourCycle={12} referenceDate={Temporal.PlainTime.from('21:00')}>
      {parts()}
    </TimeClock.Root>
  ),
};

async function renderServerCases() {
  const html: Record<string, string> = {};
  for (const [name, render] of Object.entries(SERVER_CASES)) {
    html[name] = await renderToString(render());
  }
  return html;
}

// The native HTML comes before the polyfill.
const nativeHtml = await renderServerCases();

useTemporalPolyfill();

it('runs the cases on the polyfill and not on the native Temporal', () => {
  expect(Temporal).not.toBe(nativeTemporal);
  expect(Temporal.PlainTime.from('10:30')).not.toBeInstanceOf(nativeTemporal.PlainTime);
});

it('renders the same server HTML as the native Temporal', async () => {
  const polyfillHtml = await renderServerCases();

  expect(Object.keys(nativeHtml)).toEqual(Object.keys(SERVER_CASES));
  expect(polyfillHtml).toEqual(nativeHtml);
});
