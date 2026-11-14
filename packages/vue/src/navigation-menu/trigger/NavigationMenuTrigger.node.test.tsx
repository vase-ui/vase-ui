import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import NavigationMenuTriggerHydration from './NavigationMenuTriggerHydration.test.vue';

// The attribute order in the HTML is not part of the test.
function readTag(html: string, testId: string) {
  return html.match(new RegExp(`<[^>]*data-testid="${testId}"[^>]*>`))?.[0] ?? '';
}

function countGuards(html: string) {
  return html.match(/data-vase-ui-focus-guard/g)?.length ?? 0;
}

describe('<NavigationMenu.Trigger />', () => {
  describe('server-side rendering', () => {
    it('renders a closed menu with no content and no focus guard', async () => {
      expect(typeof document).toBe('undefined');

      const html = await renderToString(<NavigationMenuTriggerHydration />);

      for (const id of ['trigger-one', 'trigger-two']) {
        const trigger = readTag(html, id);
        expect(trigger).toContain('aria-expanded="false"');
        expect(trigger).toContain('tabindex="0"');
        expect(trigger).not.toContain('data-popup-open');
      }
      expect(html).not.toContain('data-testid="content-one"');
      expect(html).not.toContain('data-testid="link-one"');
      expect(countGuards(html)).toBe(0);
    });

    it('renders the kept content hidden in its item', async () => {
      const html = await renderToString(<NavigationMenuTriggerHydration keepMounted />);

      expect(readTag(html, 'content-one')).toContain('hidden');
      expect(readTag(html, 'content-two')).toContain('hidden');
      expect(html).toMatch(/data-testid="item-one"[^>]*>.*data-testid="link-one"/);
      expect(html).toMatch(/data-testid="item-two"[^>]*>.*data-testid="link-two"/);
    });

    it('renders the open trigger of defaultValue with its focus guards, and no content', async () => {
      const html = await renderToString(<NavigationMenuTriggerHydration defaultValue="one" />);

      const trigger = readTag(html, 'trigger-one');
      expect(trigger).toContain('aria-expanded="true"');
      expect(trigger).toContain('data-popup-open');
      expect(readTag(html, 'trigger-two')).toContain('aria-expanded="false"');
      // Two guards follow the trigger, and two guards are in the viewport.
      expect(countGuards(html)).toBe(4);
      // The root knows the element of the viewport only after the mount, so the content has no
      // place on a server.
      expect(html).not.toContain('data-testid="content-one"');
    });
  });
});
