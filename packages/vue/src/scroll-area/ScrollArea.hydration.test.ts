import { describe, expect, test } from 'vitest';
import ScrollAreaOnServer from '../../test/fixtures/ScrollAreaOnServer.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { styleDisableScrollbar } from '../utils/styles';

function disableScrollbarStyles(root: ParentNode) {
  return [...root.querySelectorAll('style')].filter((style) =>
    style.textContent?.includes(styleDisableScrollbar.className),
  );
}

describe('server render and hydration', () => {
  test('the server HTML has the style element, the viewport, the content and a kept scrollbar, and the hydration keeps them', async () => {
    const props = { nonce: 'test-nonce' };
    const page = await renderOnServer('ScrollAreaOnServer', props);
    const root = page.querySelector<HTMLElement>('.root')!;
    const style = root.firstElementChild!;
    expect(style.localName).toBe('style');
    expect(style).toHaveAttribute('nonce', 'test-nonce');
    expect(style.textContent).toBe(styleDisableScrollbar.css);
    const viewport = page.querySelector<HTMLElement>('.viewport')!;
    const content = page.querySelector<HTMLElement>('.content')!;
    const scrollbar = page.querySelector<HTMLElement>('.vertical')!;
    const thumb = page.querySelector<HTMLElement>('.thumb-y')!;
    expect(viewport).toHaveAttribute('tabindex', '-1');
    expect(viewport).toHaveClass(styleDisableScrollbar.className);
    expect(viewport.style.getPropertyValue('--scroll-area-overflow-y-end')).toBe('');
    expect(scrollbar).toHaveAttribute('aria-hidden', 'true');
    expect(scrollbar.style.getPropertyValue('--scroll-area-thumb-height')).toBe('0px');
    expect(thumb.style.visibility).toBe('hidden');
    expect(page.querySelector('.horizontal')).toBeNull();
    expect(page.querySelector('.corner')).toBeNull();
    for (const part of [root, viewport, content, scrollbar]) {
      expect(part.getAttributeNames().filter((name) => name.startsWith('data-has'))).toEqual([]);
    }

    hydrate(ScrollAreaOnServer, props, page);
    await waitFor(() => expect(page.querySelector('.corner')).not.toBeNull());
    expect(page.querySelector('.viewport')).toBe(viewport);
    expect(page.querySelector('.thumb-y')).toBe(thumb);
    expect(viewport.tabIndex).toBe(0);
    expect(thumb.style.visibility).toBe('');
    expect(thumb.offsetHeight).toBe(38);
    // After the mount, one style element in the document serves each scroll area.
    expect(disableScrollbarStyles(root)).toEqual([]);
    const shared = disableScrollbarStyles(document.head);
    expect(shared).toHaveLength(1);
    expect(shared[0]).toHaveAttribute('nonce', 'test-nonce');
  });

  test('with disableStyleElements, the server HTML and the document have no style element', async () => {
    const props = { disableStyleElements: true };
    const page = await renderOnServer('ScrollAreaOnServer', props);
    expect(disableScrollbarStyles(page)).toEqual([]);
    hydrate(ScrollAreaOnServer, props, page);
    await settle();
    expect(disableScrollbarStyles(document)).toEqual([]);
  });
});
