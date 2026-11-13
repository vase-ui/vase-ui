import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import TabsRootHydration from './TabsRootHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, selector: string, name: string) {
  const tag = html.match(new RegExp(`<[^>]*${selector}[^>]*>`))?.[0];
  return tag?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) =>
    readAttribute(html, `data-testid="${testId}"`, 'tabindex'),
  );
}

describe('<Tabs.Root />', () => {
  describe('server-side rendering', () => {
    it('renders the tabs with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<TabsRootHydration defaultValue="b" />);

      expect(html).toContain('role="tablist"');
      expect(readAttribute(html, 'data-testid="b"', 'aria-selected')).toBe('true');
    });

    it.each([
      { name: 'an explicit default value', props: { defaultValue: 'b' }, stop: 1 },
      {
        name: 'a controlled value, vertical',
        props: { value: 'c', orientation: 'vertical' },
        stop: 2,
      },
      { name: 'a selected disabled tab', props: { value: 'a', firstDisabled: true }, stop: 0 },
      { name: 'a value of null', props: { value: null }, stop: 0 },
      { name: 'the implicit default, numbers', props: { numeric: true }, stop: 0 },
      { name: 'the implicit default, strings', props: {}, stop: 0 },
      { name: 'the implicit default, first disabled', props: { firstDisabled: true }, stop: 1 },
      // A server cannot tell which tab a value names when no tab has that value.
      { name: 'a value that names no tab', props: { value: 'zzz' }, stop: undefined },
    ] as const)('gives the tab stop for $name', async ({ props, stop }) => {
      const html = await renderToString(<TabsRootHydration {...props} />);

      expect(readTabindexes(html)).toEqual([0, 1, 2].map((index) => (index === stop ? '0' : '-1')));
    });

    it.each([
      { name: 'a panel after the list', panel: 'after', controls: undefined, labelledby: 'tab-a' },
      {
        name: 'a panel before the list',
        panel: 'before',
        controls: 'panel-a',
        labelledby: undefined,
      },
    ] as const)(
      'gives only the second part the id of the first part, $name',
      async ({ panel, controls, labelledby }) => {
        const html = await renderToString(<TabsRootHydration defaultValue="a" panel={panel} />);

        expect(readAttribute(html, 'data-testid="a"', 'aria-controls')).toBe(controls);
        expect(readAttribute(html, 'id="panel-a"', 'aria-labelledby')).toBe(labelledby);
      },
    );
  });
});
