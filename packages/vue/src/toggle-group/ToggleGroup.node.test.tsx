import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import ToggleGroupHydration from './ToggleGroupHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, testId: string, name: string) {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0];
  return tag?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function readAttributes(html: string, name: string) {
  return ['before', 'a', 'b', 'c', 'after'].map((testId) => readAttribute(html, testId, name));
}

describe('<ToggleGroup />', () => {
  describe('server-side rendering', () => {
    it('renders the group and the pressed state with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<ToggleGroupHydration defaultValue={['b']} />);

      expect(html).toMatch(/^<div[^>]* role="group"/);
      expect(html).toMatch(/^<div[^>]* data-orientation="horizontal"/);
      expect(readAttributes(html, 'aria-pressed')).toEqual([
        undefined,
        'false',
        'true',
        'false',
        undefined,
      ]);
      expect(html).toMatch(/<button[^>]* data-pressed[^>]* data-testid="b"/);
      expect(html.match(/ data-pressed/g)).toHaveLength(1);
    });

    it.each([
      {
        name: 'the first toggle, also when another toggle is pressed',
        props: { defaultValue: ['b'] },
        tabindexes: [undefined, '0', '-1', '-1', undefined],
      },
      {
        name: 'the second toggle when the first is disabled',
        props: { firstDisabled: true },
        tabindexes: [undefined, '-1', '0', '-1', undefined],
      },
      {
        name: 'no toggle of a disabled group',
        props: { disabled: true },
        tabindexes: [undefined, '-1', '-1', '-1', undefined],
      },
      {
        name: 'the first item of the toolbar and no toggle',
        props: { toolbar: true },
        tabindexes: ['0', '-1', '-1', '-1', '-1'],
      },
      {
        name: 'the first item of a disabled toolbar and no toggle',
        props: { toolbar: true, toolbarDisabled: true },
        tabindexes: ['0', '-1', '-1', '-1', '-1'],
      },
    ])('gives the tab stop to $name', async ({ props, tabindexes }) => {
      const html = await renderToString(<ToggleGroupHydration {...props} />);

      expect(readAttributes(html, 'tabindex')).toEqual(tabindexes);
    });
  });
});
