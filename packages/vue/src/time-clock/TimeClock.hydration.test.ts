import { describe, expect, inject, test } from 'vitest';
import { nextTick } from 'vue';
import TimeClockOnServer from '../../test/fixtures/TimeClockOnServer.vue';
import { hydrateInFrame } from '../../test/hydrateInFrame';
import { hydrate, mount, renderOnServer, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

// The parts compile as Vapor components in these setups of `vitest.vue-3.6.config.ts`.
const isVaporParts = ['vapor', 'vdom-interop'].includes(inject('app'));

/** Each element of the clock, with its attributes in order of name, its text and its value. */
const elementsOf = (root: Element) =>
  [...root.querySelectorAll('[role="group"] *')].map((element) => {
    // The server writes a style with no spaces, and the browser with spaces.
    const attributes = [...element.attributes]
      .filter((attribute) => attribute.name !== 'id')
      .map(({ name, value }) =>
        name === 'style' ? `style=${(element as HTMLElement).style.cssText}` : `${name}=${value}`,
      )
      .sort();
    const text = element.children.length === 0 ? element.textContent : '';
    // An element of the frame is not an instance of the classes of this page.
    const value =
      element.localName === 'input' ? ` value ${(element as HTMLInputElement).value}` : '';
    return `${element.localName} ${attributes.join(' ')} ${text}${value}`;
  });

const textsOf = (root: Element) =>
  [...root.querySelectorAll('button, [aria-hidden="true"]')].map((element) => element.textContent);

describe('server render and hydration', () => {
  test('the server HTML has the numbers, the hand, the buttons and the range input; the hydration keeps each element', async () => {
    const props = { value: '15:30' };
    const root = await renderOnServer('TimeClockOnServer', props);
    const range = root.querySelector('input[type="range"]')!;
    expect(range).toHaveAttribute('value', '3');
    expect(range).toHaveAttribute('aria-valuetext', '3 hours');
    expect(root.querySelector('[style*="--time-clock-hand-angle"]')).not.toBe(null);
    hydrate(TimeClockOnServer, props, root);
    await nextTick();
    expect(root.querySelector('input[type="range"]')).toBe(range);
    expect(takeReportedMessages()).toEqual([]);
  });

  // The server here renders the Arabic digits and day periods of `ar-EG`, and the browser `en-US`.
  test.each([{ content: false }, { content: true }])(
    'a server with other texts: the texts of the browser with no message, content $content',
    async ({ content }) => {
      const root = await renderOnServer('TimeClockOnServer', {
        value: '15:30',
        locale: 'ar-EG',
        content,
      });
      hydrate(TimeClockOnServer, { value: '15:30', locale: 'en-US', content }, root);
      await nextTick();
      const texts = textsOf(root);
      expect(texts.slice(0, 2)).toEqual(content ? ['Hour', 'Morning'] : ['03', 'AM']);
      expect(texts.at(-1)).toBe('11');
      const range = root.querySelector('input[type="range"]')!;
      expect(range).toHaveAttribute('aria-label', 'hour');
      expect(range).toHaveAttribute('aria-valuetext', '3 hours');
      expect(takeReportedMessages()).toEqual([]);
    },
  );

  // A locale that the browser lacks can give another hour cycle than on the server. Vue logs one
  // message for the other count of numbers, as for the segments of a field. It logs the message one
  // time for each copy of its module, so each run hydrates in a frame of its own.
  test('a server with another hour cycle: the elements of a client render after the mount', async () => {
    const root = await renderOnServer('TimeClockOnServer', { value: '13:45', hourCycle: 24 });
    expect(root.querySelectorAll('[style*="--time-clock-number-angle"]')).toHaveLength(24);
    const client = { value: '13:45', hourCycle: 12 };
    const hydrated = await hydrateInFrame('TimeClockOnServer', client, root);
    const { root: clientRoot } = mount(TimeClockOnServer, client);
    await settle();
    expect(elementsOf(hydrated)).toEqual(elementsOf(clientRoot));
    expect(takeReportedMessages()).toEqual(
      isVaporParts ? [] : ['console.error: Hydration completed but contains mismatches.'],
    );
  });

  // A range input of a server with the hours 1 to 12 clamps the hour 13 that Vue writes while it
  // hydrates, so the face writes the value again after the range.
  test.each([
    { server: 24, browser: 12, range: ['1', '12', '1'] },
    { server: 12, browser: 24, range: ['0', '23', '13'] },
  ] as const)(
    'a face with no numbers, $server hours on the server and $browser in the browser: the range input of the browser, with no message',
    async ({ server, browser, range: expected }) => {
      const props = { value: '13:45', withoutNumbers: true };
      const root = await renderOnServer('TimeClockOnServer', { ...props, hourCycle: server });
      const range = root.querySelector<HTMLInputElement>('input[type="range"]')!;
      hydrate(TimeClockOnServer, { ...props, hourCycle: browser }, root);
      await settle();
      expect(root.querySelector('input[type="range"]')).toBe(range);
      expect([range.getAttribute('min'), range.getAttribute('max'), range.value]).toEqual(expected);
      expect(takeReportedMessages()).toEqual([]);
    },
  );
});
