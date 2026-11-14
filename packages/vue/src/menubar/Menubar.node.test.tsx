import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import MenubarHydration from './MenubarHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readRootTag(html: string) {
  return /^<[^>]*>/.exec(html)?.[0] ?? '';
}

function hasAttribute(tag: string, name: string) {
  return new RegExp(` ${name}(?=[ =>])`).test(tag);
}

function readAttribute(tag: string, name: string) {
  return new RegExp(` ${name}="([^"]*)"`).exec(tag)?.[1];
}

function readTabindexes(html: string) {
  return ['a', 'b', 'c'].map((testId) =>
    readAttribute(
      new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '',
      'tabindex',
    ),
  );
}

describe('<Menubar />', () => {
  describe('server-side rendering', () => {
    it('renders the menubar with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const root = readRootTag(await renderToString(<MenubarHydration />));

      expect(root).toMatch(/^<div /);
      expect(readAttribute(root, 'role')).toBe('menubar');
      expect(readAttribute(root, 'aria-orientation')).toBe('horizontal');
      expect(readAttribute(root, 'data-orientation')).toBe('horizontal');
      expect(readAttribute(root, 'id')).toMatch(/^vase-ui-/);
      expect(hasAttribute(root, 'data-modal')).toBe(true);
      expect(hasAttribute(root, 'data-has-submenu-open')).toBe(false);
    });

    it('writes the id prop, the orientation and no data-modal for a menubar that is not modal', async () => {
      const root = readRootTag(
        await renderToString(
          <MenubarHydration id="file-menubar" orientation="vertical" modal={false} />,
        ),
      );

      expect(readAttribute(root, 'id')).toBe('file-menubar');
      expect(readAttribute(root, 'aria-orientation')).toBe('vertical');
      expect(readAttribute(root, 'data-orientation')).toBe('vertical');
      expect(hasAttribute(root, 'data-modal')).toBe(false);
    });

    it('gives the tab stop to the first item', async () => {
      const html = await renderToString(<MenubarHydration />);

      expect(readTabindexes(html)).toEqual(['0', '-1', '-1']);
    });
  });
});
