import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';

describe('<ScrollArea.Root /> on a server', () => {
  it('renders the style element with the nonce as the first node of the root', async () => {
    const html = await renderToString(
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root>Content</ScrollArea.Root>
      </CSPProvider>,
    );

    expect(html).toBe(
      [
        '<!--[--><div role="presentation" style="position:relative;--scroll-area-corner-height:0px;--scroll-area-corner-width:0px;">',
        '<!--[--><style nonce="test-nonce">.vase-ui-disable-scrollbar{scrollbar-width:none}.vase-ui-disable-scrollbar::-webkit-scrollbar{display:none}</style>',
        '<!--[--><!--[-->Content<!--]--><!--]--><!--]--></div><!--]-->',
      ].join(''),
    );
  });

  it('renders no style element when disableStyleElements is true', async () => {
    const html = await renderToString(
      <CSPProvider disableStyleElements>
        <ScrollArea.Root>Content</ScrollArea.Root>
      </CSPProvider>,
    );

    expect(html).not.toContain('<style');
    expect(html).toContain('Content');
  });

  it('renders the style element in the element of the #render slot', async () => {
    const html = await renderToString(
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root
          v-slots={{
            render: ({ props, children: Children }: any) => (
              <section {...props}>
                <Children>Content</Children>
              </section>
            ),
          }}
        />
      </CSPProvider>,
    );

    expect(html).toBe(
      [
        '<!--[--><!--[--><section role="presentation" style="position:relative;--scroll-area-corner-height:0px;--scroll-area-corner-width:0px;">',
        '<!--[--><style nonce="test-nonce">.vase-ui-disable-scrollbar{scrollbar-width:none}.vase-ui-disable-scrollbar::-webkit-scrollbar{display:none}</style>',
        '<!--[-->Content<!--]--><!--]--></section><!--]--><!--]-->',
      ].join(''),
    );
  });

  it('renders the viewport out of the tab order, with the class that hides the native scrollbar', async () => {
    const html = await renderToString(
      <ScrollArea.Root>
        <ScrollArea.Viewport>Content</ScrollArea.Viewport>
      </ScrollArea.Root>,
    );

    const [startTag, dataId] = /<div data-id="([^"]*)"[^>]*>/.exec(html) ?? [];
    expect(dataId).toMatch(/-viewport$/);
    expect(startTag).toBe(
      `<div data-id="${dataId}" tabindex="-1" class="vase-ui-disable-scrollbar" style="overflow:scroll;">`,
    );
  });
});
