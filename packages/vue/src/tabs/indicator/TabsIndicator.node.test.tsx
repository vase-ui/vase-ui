import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { Tabs } from '@vase-ui/vue/tabs';
import { script } from './prehydrationScript.min';

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

  describe('prehydrationScript.min', () => {
    // A script element ends at its first `</script`, so a text that holds it would break the page.
    it('has no closing script tag in its text', () => {
      expect(script).not.toMatch(/<\/script/i);
    });
  });
});
