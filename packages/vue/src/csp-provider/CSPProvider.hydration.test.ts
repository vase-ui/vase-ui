import { describe, expect, test } from 'vitest';
import CSPProviders from '../../test/fixtures/CSPProviders.vue';
import CSPStyleElements from '../../test/fixtures/CSPStyleElements.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';
import { styleDisableScrollbar } from '../utils/styles';

describe('server render and hydration', () => {
  test('renders on a server: the provider renders no element, and the parts below it have its values', async () => {
    const props = { outer: { nonce: 'test-nonce' }, inner: { disableStyleElements: true } };
    const root = await renderOnServer('CSPProviders', props);
    const ancestor = root.querySelector('.Ancestor')!;
    expect([...ancestor.children].map((child) => `${child.localName}#${child.id}`)).toEqual([
      'output#none',
      'output#outer',
      'output#inner',
    ]);
    const texts = () => [...ancestor.children].map((child) => child.textContent);
    expect(texts()).toEqual(['no provider', 'test-nonce false', 'no nonce true']);
    const outputs = [...ancestor.children];
    hydrate(CSPProviders, props, root);
    await settle();
    expect([...ancestor.children]).toEqual(outputs);
    expect(texts()).toEqual(['no provider', 'test-nonce false', 'no nonce true']);
  });

  test.each([
    { part: 'scroll-area', tag: 'style' },
    { part: 'tabs', tag: 'script' },
  ])(
    'the $tag element of $part in the server HTML has the nonce, with no mismatch',
    async ({ part, tag }) => {
      const props = { part, csp: { nonce: 'test-nonce' } };
      const root = await renderOnServer('CSPStyleElements', props);
      const element = root.querySelector(tag)!;
      expect(element).toHaveAttribute('nonce', 'test-nonce');
      if (tag === 'style') expect(element.textContent).toBe(styleDisableScrollbar.css);
      hydrate(CSPStyleElements, props, root);
      await settle();
      // After the mount, the part needs the element no more.
      expect(root.querySelector(tag)).toBeNull();
    },
  );

  test('with disableStyleElements, the server HTML of a scroll area has no style element', async () => {
    const props = { part: 'scroll-area', csp: { disableStyleElements: true } };
    const root = await renderOnServer('CSPStyleElements', props);
    expect(root.querySelector('.Viewport')).toHaveClass(styleDisableScrollbar.className);
    expect(root.querySelector('style')).toBeNull();
    hydrate(CSPStyleElements, props, root);
    await settle();
    expect(root.querySelector('style')).toBeNull();
  });
});
