import { describe, expect, inject, test } from 'vitest';
import { nextTick } from 'vue';
import DateTimeFieldsOnServer from '../../test/fixtures/DateTimeFieldsOnServer.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

// The parts compile as Vapor components in these setups of `vitest.vue-3.6.config.ts`.
const isVaporParts = ['vapor', 'vdom-interop'].includes(inject('app'));

const segmentsOf = (root: Element) => [...root.querySelectorAll<HTMLInputElement>('[role="spinbutton"]')];
const layoutOf = (root: Element) =>
  [...root.querySelectorAll('[role="group"] > div > *')].map((element) =>
    element.localName === 'input'
      ? `${element.getAttribute('data-type')} ${element.getAttribute('aria-label')}`
      : JSON.stringify(element.textContent),
  );

describe('server render and hydration', () => {
  test('the server HTML has each segment with its text and attributes, each literal and the form input; the hydration keeps each element', async () => {
    const props = { family: 'date', value: '2026-11-14', name: 'when' };
    const root = await renderOnServer('DateTimeFieldsOnServer', props);
    const segments = segmentsOf(root);
    expect(segments.map((segment) => segment.getAttribute('value'))).toEqual(['11', '14', '2026']);
    expect(segments[0]).toHaveAttribute('id', 'when');
    expect(segments[0]).toHaveAttribute('aria-valuetext', 'November');
    expect(root.querySelector('input[aria-hidden]')).toHaveAttribute('value', '2026-11-14');
    // A native label names the group only after the mount.
    expect(root.querySelector('[role="group"]')).not.toHaveAttribute('aria-labelledby');
    hydrate(DateTimeFieldsOnServer, props, root);
    await nextTick();
    expect(segmentsOf(root)).toEqual(segments);
    await nextTick();
    expect(root.querySelector('[role="group"]')).toHaveAttribute('aria-labelledby', 'when-label');
  });

  // Node can have other `Intl` data than the browser. The server here renders `de-DE`, and the
  // browser `en-US`: another order and another literal text, with the same count.
  test('a server with another order and text: the segments and literals of the browser after the mount, with no message', async () => {
    const root = await renderOnServer('DateTimeFieldsOnServer', {
      family: 'date',
      value: '2026-11-14',
      locale: 'de-DE',
    });
    expect(layoutOf(root)).toEqual(['day Tag', '"."', 'month Monat', '"."', 'year Jahr']);
    hydrate(DateTimeFieldsOnServer, { family: 'date', value: '2026-11-14', locale: 'en-US' }, root);
    await nextTick();
    expect(layoutOf(root)).toEqual(['month month', '"/"', 'day day', '"/"', 'year year']);
    expect(segmentsOf(root).map((segment) => segment.value)).toEqual(['11', '14', '2026']);
    expect(segmentsOf(root)[0]).toHaveAttribute('id', 'when');
    expect(segmentsOf(root)[1]).not.toHaveAttribute('id');
    expect(segmentsOf(root)[0]).toHaveAttribute('aria-valuetext', 'November');
    expect(takeReportedMessages()).toEqual([]);
  });

  // A virtual DOM part logs one message for a list with another count, also under
  // `data-allow-mismatch` (test/measurements/date-time-field.test.ts). A Vapor part logs none.
  test('a server with another count of items: the layout of the browser, and one message of a virtual DOM part', async () => {
    const root = await renderOnServer('DateTimeFieldsOnServer', {
      family: 'date',
      value: '2026-11-14T15:04',
      locale: 'en-GB',
    });
    expect(segmentsOf(root)).toHaveLength(5);
    hydrate(DateTimeFieldsOnServer, { family: 'date', value: '2026-11-14T15:04', locale: 'en-US' }, root);
    await nextTick();
    expect(layoutOf(root)).toEqual([
      'month month',
      '"/"',
      'day day',
      '"/"',
      'year year',
      '", "',
      'hour hour',
      '":"',
      'minute minute',
      '" "',
      'dayPeriod AM/PM',
    ]);
    expect(takeReportedMessages()).toEqual(
      isVaporParts ? [] : ['console.error: Hydration completed but contains mismatches.'],
    );
  });
});
