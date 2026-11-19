import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import AvatarParts from '../../test/fixtures/AvatarParts.vue';
import { pictureThatBrowserHas } from '../../test/pictures';
import { hydrate, renderOnServer, settle } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML has the fallback and no image; a fallback with a delay is not in it', async () => {
    const image = { src: await pictureThatBrowserHas(), alt: 'Jane Doe' };
    const root = await renderOnServer('AvatarParts', { image });
    expect(root.querySelector('img')).toBeNull();
    expect(root.querySelector('span > span')).toHaveTextContent('JD idle');
    const delayed = await renderOnServer('AvatarParts', { image, fallback: { delay: 600 } });
    expect(delayed.querySelector('span > span')).toBeNull();
  });

  test('the server HTML of keepMounted has the image, hidden from assistive technology, and the fallback', async () => {
    const image = { src: await pictureThatBrowserHas(), alt: 'Jane Doe', keepMounted: true };
    const root = await renderOnServer('AvatarParts', { image });
    const img = root.querySelector('img')!;
    expect(img.getAttributeNames().sort()).toEqual(['alt', 'aria-hidden', 'src']);
    expect(img).toHaveAttribute('aria-hidden', 'true');
    expect(root.querySelector('span > span')).toHaveTextContent('JD idle');
  });

  test.each([false, true])(
    'the hydration over a picture that the browser has removes the fallback in the first update, and the image never has data-loading (keepMounted: %s)',
    async (keepMounted) => {
      const image = { src: await pictureThatBrowserHas(), alt: 'Jane Doe', keepMounted };
      const root = await renderOnServer('AvatarParts', { image });
      const loading: Element[] = [];
      new MutationObserver((records) => {
        for (const { target } of records) {
          if ((target as Element).hasAttribute('data-loading')) loading.push(target as Element);
        }
      }).observe(root, { subtree: true, attributeFilter: ['data-loading'] });
      const events: string[] = [];
      hydrate(
        AvatarParts,
        { image: { ...image, onLoadingStatusChange: (status: string) => events.push(status) } },
        root,
      );
      await nextTick();
      expect(root.querySelector('span > span')).toBeNull();
      expect(root.querySelector('img')).not.toHaveAttribute('aria-hidden');
      expect(events).toEqual(['loaded']);
      await settle();
      expect(loading).toEqual([]);
    },
  );

  test.each([
    { name: 'an image with no source', props: { image: {} } },
    { name: 'a kept image with no source', props: { image: { keepMounted: true } } },
    { name: 'a fallback with a delay', props: { image: {}, fallback: { delay: 600 } } },
  ])('$name hydrates with no mismatch', async ({ props }) => {
    const root = await renderOnServer('AvatarParts', props);
    hydrate(AvatarParts, props, root);
    await settle();
    expect(root.querySelector('.status')).toHaveTextContent('error');
  });
});
