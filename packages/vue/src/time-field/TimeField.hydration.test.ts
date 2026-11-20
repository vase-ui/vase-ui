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

  // A server that renders a 24-hour cycle has no day period, and the browser renders a 12-hour one.
  test('a server with another count of segments: the segments of the browser, with their attributes, and one message of a virtual DOM part', async () => {
    const root = await renderOnServer('DateTimeFieldsOnServer', {
      family: 'time',
      value: '15:04',
      hourCycle: 24,
    });
    expect(segmentsOf(root)).toHaveLength(2);
    hydrate(DateTimeFieldsOnServer, { family: 'time', value: '15:04', hourCycle: 12 }, root);
    await nextTick();
    const [hour, minute, period] = segmentsOf(root);
    expect([hour!.value, minute!.value, period!.value]).toEqual(['3', '04', 'PM']);
    expect(hour).toHaveAttribute('aria-valuemax', '12');
    expect(hour).toHaveAttribute('aria-valuemin', '1');
    expect(takeReportedMessages()).toEqual(
      isVaporParts ? [] : ['console.error: Hydration completed but contains mismatches.'],
    );
  });
});
