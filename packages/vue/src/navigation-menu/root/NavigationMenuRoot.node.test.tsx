import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as NavigationMenu from '../index.parts';
import NavigationMenuRootHydration from './NavigationMenuRootHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readTag(html: string, testId: string) {
  return new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`).exec(html)?.[0] ?? '';
}

// Vue writes comments around a fragment.
function readText(html: string, testId: string) {
  return new RegExp(`<span[^>]*data-testid="${testId}"[^>]*>(.*?)</span>`)
    .exec(html)?.[1]
    ?.replace(/<!--.*?-->/g, '');
}

describe('<NavigationMenu.Root />', () => {
  describe('server-side rendering', () => {
    it('renders the root, the list, the links and the icons with no DOM', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<NavigationMenuRootHydration />);

      expect(html).toMatch(/^<nav /);
      expect(readTag(html, 'root')).not.toContain('data-open');
      expect(readTag(html, 'list')).toMatch(/^<ul /);
      expect(readTag(html, 'link-1')).toContain('aria-current="page"');
      expect(readTag(html, 'link-1')).toContain('data-active');
      expect(readTag(html, 'link-2')).not.toContain('aria-current');
      expect(readTag(html, 'link-2')).not.toContain('data-active');
      expect(readTag(html, 'link-1')).not.toContain('tabindex');
      expect(readTag(html, 'link-2')).not.toContain('tabindex');
      expect(readTag(html, 'icon-1')).toContain('aria-hidden="true"');
      expect(readTag(html, 'icon-1')).not.toContain('data-popup-open');
      expect(readText(html, 'icon-1')).toBe('▼');
      expect(readText(html, 'icon-2')).toBe('▼');
    });

    it('opens the item of defaultValue', async () => {
      const html = await renderToString(<NavigationMenuRootHydration defaultValue="item-1" />);

      expect(readTag(html, 'root')).toContain('data-open');
      expect(readTag(html, 'icon-1')).toContain('data-popup-open');
      expect(readTag(html, 'icon-2')).not.toContain('data-popup-open');
    });

    it('VUE-104: gives no warning for a viewport with no positioner in a top-level root', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const html = await renderToString(
        <NavigationMenu.Root>
          <NavigationMenu.Viewport data-testid="viewport" />
        </NavigationMenu.Root>,
      );

      expect(readTag(html, 'viewport')).toMatch(/^<div /);
      expect(warn).not.toHaveBeenCalled();
    });
  });
});
