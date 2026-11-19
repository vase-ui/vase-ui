import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { CSPProvider } from '@vase-ui/vue/csp-provider';
import { ScrollArea } from '@vase-ui/vue/scroll-area';

describe('StyleDisableScrollbar on a server, in ScrollArea.Root', () => {
  it('renders the style element with the nonce as the first node of the root', async () => {
    const html = await renderToString(
      <CSPProvider nonce="test-nonce">
        <ScrollArea.Root>Content</ScrollArea.Root>
      </CSPProvider>,
    );

    expect(html).toBe(
      [
        '<!--[--><div style="position:relative;--scroll-area-corner-width:0px;--scroll-area-corner-height:0px;">',
        '<style nonce="test-nonce">.vase-ui-disable-scrollbar{scrollbar-width:none}.vase-ui-disable-scrollbar::-webkit-scrollbar{display:none}</style>',
        '<!--[-->Content<!--]--></div><!--]-->',
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
});
