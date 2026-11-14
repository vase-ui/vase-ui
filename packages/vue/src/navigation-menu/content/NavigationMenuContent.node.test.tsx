import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';

function countTestId(html: string, testId: string) {
  return html.match(new RegExp(`data-testid="${testId}"`, 'g'))?.length ?? 0;
}

describe('<NavigationMenu.Content />', () => {
  describe('server-side rendering', () => {
    it('keeps the content mounted (hidden) in the DOM when keepMounted is true', async () => {
      const html = await renderToString(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content keepMounted data-testid="content-1">
                <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      expect(countTestId(html, 'content-1')).toBe(1);
    });

    it('does not keep the content mounted in the DOM when keepMounted is false', async () => {
      const html = await renderToString(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="content-1">
                <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      expect(countTestId(html, 'content-1')).toBe(0);
    });
  });
});
