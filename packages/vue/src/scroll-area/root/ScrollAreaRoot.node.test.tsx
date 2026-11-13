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

  it('renders a kept scrollbar, and no scrollbar that waits for the measurement', async () => {
    const html = await renderToString(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted />
        <ScrollArea.Scrollbar orientation="horizontal" />
      </ScrollArea.Root>,
    );

    // No measurement exists on a server, so each axis is hidden.
    expect(html.match(/data-id="[^"]*-scrollbar"/g)).toHaveLength(1);
    const [startTag, dataId] = /<div [^>]*data-id="([^"]*-scrollbar)"[^>]*>/.exec(html) ?? [];
    expect(startTag).toBe(
      `<div data-orientation="vertical" data-id="${dataId}" aria-hidden="true" style="position:absolute;touch-action:none;-webkit-user-select:none;user-select:none;top:0;bottom:var(--scroll-area-corner-height);inset-inline-end:0;--scroll-area-thumb-height:0px;">`,
    );
  });

  it('renders a thumb that is hidden until the first measurement', async () => {
    const html = await renderToString(
      <ScrollArea.Root>
        <ScrollArea.Scrollbar keepMounted>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
        <ScrollArea.Scrollbar orientation="horizontal" keepMounted>
          <ScrollArea.Thumb />
        </ScrollArea.Scrollbar>
      </ScrollArea.Root>,
    );

    // The start tag of a scrollbar has a `data-id` between these two attributes.
    expect(html.match(/<div data-orientation="[^"]*" style="[^"]*">/g)).toEqual([
      '<div data-orientation="vertical" style="visibility:hidden;height:var(--scroll-area-thumb-height);">',
      '<div data-orientation="horizontal" style="visibility:hidden;width:var(--scroll-area-thumb-width);">',
    ]);
  });
});
