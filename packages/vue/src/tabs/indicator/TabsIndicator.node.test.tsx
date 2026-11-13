import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { Tabs } from '@vase-ui/vue/tabs';
import { script } from './prehydrationScript.min';
import TabsIndicatorHydration from './TabsIndicatorHydration.test.vue';

function readIndicatorTag(html: string) {
  const tag = html.match(/<span [^>]*data-testid="indicator"[^>]*>/)?.[0];
  if (tag === undefined) {
    throw new Error(`The HTML has no indicator:\n${html}`);
  }
  return tag;
}

// Vue writes a Boolean attribute, and an attribute with an empty value, with no `=` on a server.
function hasBareAttribute(tag: string, name: string) {
  return new RegExp(` ${name}(?=[ >/])`).test(tag);
}

describe('<Tabs.Indicator />', () => {
  describe('pre-hydration rendering', () => {
    it('renders the inline pre-hydration script during server-side rendering', async () => {
      const html = await renderToString(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Indicator renderBeforeHydration />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(html).toContain('<script');
    });

    it('inlines the script contents during server-side rendering', async () => {
      const html = await renderToString(
        <Tabs.Root value={1}>
          <Tabs.List>
            <Tabs.Tab value={1}>One</Tabs.Tab>
            <Tabs.Indicator renderBeforeHydration />
          </Tabs.List>
        </Tabs.Root>,
      );

      expect(script).not.toBe('');
      expect(html).toContain(`<script>${script}</script>`);
    });

    it('applies the CSP nonce to the pre-hydration script', async () => {
      const html = await renderToString(
        <CSPProvider nonce="test-nonce">
          <Tabs.Root value={1}>
            <Tabs.List>
              <Tabs.Tab value={1}>One</Tabs.Tab>
              <Tabs.Indicator renderBeforeHydration />
            </Tabs.List>
          </Tabs.Root>
        </CSPProvider>,
      );

      expect(html).toContain('<script nonce="test-nonce">');
    });
  });

  describe('server-side rendering', () => {
    it('renders a hidden indicator with no style, and the script directly after it', async () => {
      const html = await renderToString(<TabsIndicatorHydration renderBeforeHydration />);
      const tag = readIndicatorTag(html);

      expect(tag).toContain(' role="presentation"');
      expect(hasBareAttribute(tag, 'hidden')).toBe(true);
      expect(tag).not.toContain(' style=');
      expect(html).toMatch(
        /<span [^>]*data-testid="indicator"[^>]*>(<!--[[\]]-->)*<\/span><script>/,
      );
    });

    it('allows the style and the attributes that the script changes, only with the script', async () => {
      const withScript = readIndicatorTag(
        await renderToString(<TabsIndicatorHydration renderBeforeHydration />),
      );
      const withoutScript = readIndicatorTag(await renderToString(<TabsIndicatorHydration />));

      expect(withScript).toContain(' data-allow-mismatch="style,attribute"');
      expect(withoutScript).not.toContain('data-allow-mismatch');
    });

    it('renders no script without `renderBeforeHydration`', async () => {
      const html = await renderToString(<TabsIndicatorHydration />);

      expect(html).toContain('data-testid="indicator"');
      expect(html).not.toContain('<script');
    });

    it('renders no indicator and no script when the value is null', async () => {
      const html = await renderToString(
        <TabsIndicatorHydration value={null} renderBeforeHydration />,
      );

      expect(html).toContain('role="tablist"');
      expect(html).not.toContain('data-testid="indicator"');
      expect(html).not.toContain('<script');
    });

    it('sets the orientation and the activation direction', async () => {
      const html = await renderToString(<TabsIndicatorHydration />);
      const tag = readIndicatorTag(html);

      expect(tag).toContain(' data-orientation="horizontal"');
      expect(tag).toContain(' data-activation-direction="none"');
    });
  });

  describe('prehydrationScript.min', () => {
    // A script element ends at its first `</script`, so a text that holds it would break the page.
    it('has no closing script tag in its text', () => {
      expect(script).not.toMatch(/<\/script/i);
    });
  });
});
