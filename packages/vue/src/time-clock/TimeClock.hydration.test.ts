import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import TimeClockOnServer from '../../test/fixtures/TimeClockOnServer.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

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
      const root = await renderOnServer('TimeClockOnServer', { value: '15:30', locale: 'ar-EG', content });
      hydrate(TimeClockOnServer, { value: '15:30', locale: 'en-US', content }, root);
      await nextTick();
      const texts = textsOf(root);
      expect(texts.slice(0, 2)).toEqual(content ? ['Hour', 'Morning'] : ['03', 'AM']);
      expect(texts.at(-1)).toBe('11');
      expect(takeReportedMessages()).toEqual([]);
    },
  );
});
