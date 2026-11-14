import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as ContextMenu from '../index.parts';

describe('<ContextMenu.Root /> on a server', () => {
  it.each([
    {
      name: 'a closed root',
      node: (
        <ContextMenu.Root>
          <ContextMenu.Trigger>area</ContextMenu.Trigger>
        </ContextMenu.Root>
      ),
      html: '<!--[--><!--[--><div style="-webkit-touch-callout:none;"><!--[-->area<!--]--></div><!--]--><!--]-->',
    },
    {
      name: 'an open root, with a class and a style',
      node: (
        <ContextMenu.Root defaultOpen>
          <ContextMenu.Trigger class="a" style={{ color: 'red' }}>
            area
          </ContextMenu.Trigger>
        </ContextMenu.Root>
      ),
      html: '<!--[--><!--[--><div data-popup-open data-pressed style="-webkit-touch-callout:none;color:red;" class="a"><!--[-->area<!--]--></div><!--]--><!--]-->',
    },
    {
      name: 'a disabled root, with a button',
      node: (
        <ContextMenu.Root disabled>
          <ContextMenu.Trigger as="button">area</ContextMenu.Trigger>
        </ContextMenu.Root>
      ),
      html: '<!--[--><!--[--><button style="-webkit-touch-callout:none;"><!--[-->area<!--]--></button><!--]--><!--]-->',
    },
  ])('renders the trigger of $name', async ({ node, html }) => {
    expect(await renderToString(node)).toBe(html);
  });
});
