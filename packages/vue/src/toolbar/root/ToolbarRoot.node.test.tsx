import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import ToolbarRootHydration from './ToolbarRootHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readAttribute(html: string, testId: string, name: string) {
  const tag = new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0];
  return tag?.match(new RegExp(` ${name}="([^"]*)"`))?.[1];
}

function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) => readAttribute(html, testId, 'tabindex'));
}

describe('<Toolbar.Root />', () => {
  describe('server-side rendering', () => {
    it('renders the toolbar with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<ToolbarRootHydration />);

      expect(html).toMatch(/^<div[^>]* role="toolbar"/);
      expect(html).toMatch(/^<div[^>]* aria-orientation="horizontal"/);
    });

    it.each([
      { name: 'the first button', props: {}, tabindexes: ['0', '-1', '-1'] },
      {
        name: 'the second button when the first is disabled and not focusable',
        props: { first: 'disabled' },
        tabindexes: ['-1', '0', '-1'],
      },
      {
        name: 'the first button when it is disabled and focusable',
        props: { first: 'focusable' },
        tabindexes: ['0', '-1', '-1'],
      },
      {
        name: 'the first button of a disabled toolbar',
        props: { disabled: true },
        tabindexes: ['0', '-1', '-1'],
      },
    ] as const)('gives the tab stop to $name', async ({ props, tabindexes }) => {
      const html = await renderToString(<ToolbarRootHydration {...props} />);

      expect(readTabindexes(html)).toEqual(tabindexes);
    });
  });
});
