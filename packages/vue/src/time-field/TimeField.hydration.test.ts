import { describe, expect, inject, test } from 'vitest';
import { nextTick } from 'vue';
import DateTimeFieldsOnServer from '../../test/fixtures/DateTimeFieldsOnServer.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

// The parts compile as Vapor components in these setups of `vitest.vue-3.6.config.ts`.
const isVaporParts = ['vapor', 'vdom-interop'].includes(inject('app'));

const segmentsOf = (root: Element) => [
  ...root.querySelectorAll<HTMLInputElement>('[role="spinbutton"]'),
];

describe('server render and hydration', () => {
  test('the server HTML has the segments of the time and the form input; the hydration keeps each element', async () => {
    const props = { family: 'time', value: '15:04', name: 'start' };
    const root = await renderOnServer('DateTimeFieldsOnServer', props);
    const segments = segmentsOf(root);
    expect(segments.map((segment) => segment.getAttribute('value'))).toEqual(['3', '04', 'PM']);
    expect(root.querySelector('input[aria-hidden]')).toHaveAttribute('value', '15:04');
    hydrate(DateTimeFieldsOnServer, props, root);
    await nextTick();
    expect(segmentsOf(root)).toEqual(segments);
    expect(takeReportedMessages()).toEqual([]);
  });

  // The server renders `de-DE` with a 24-hour cycle: hour, minute and zone name. The browser renders
  // `ja-JP` with a 12-hour cycle: day period, hour, minute, and a literal where the server had the
  // zone name.
  test('a server with another count of segments: the segments and literals of the browser, with their attributes, and one message of a virtual DOM part', async () => {
    const value = '2026-11-14T15:04[America/New_York]';
    const root = await renderOnServer('DateTimeFieldsOnServer', {
      family: 'time',
      value,
      locale: 'de-DE',
      hourCycle: 24,
    });
    expect(segmentsOf(root)).toHaveLength(2);
    hydrate(
      DateTimeFieldsOnServer,
      { family: 'time', value, locale: 'ja-JP', hourCycle: 12 },
      root,
    );
    await nextTick();
    const [period, hour, minute] = segmentsOf(root);
    expect([period!.value, hour!.value, minute!.value]).toEqual(['午後', '3', '04']);
    expect(hour).toHaveAttribute('aria-valuemax', '12');
    expect(hour).toHaveAttribute('aria-valuemin', '1');
    const spans = [...root.querySelectorAll('[role="group"] span')];
    expect(
      spans.map((span) => [
        span.textContent,
        span.getAttribute('data-type'),
        span.getAttribute('aria-hidden'),
      ]),
    ).toEqual([
      [':', 'literal', 'true'],
      [' ', 'literal', 'true'],
      ['GMT-5', 'timeZoneName', null],
    ]);
    expect(takeReportedMessages()).toEqual(
      isVaporParts ? [] : ['console.error: Hydration completed but contains mismatches.'],
    );
  });
});
