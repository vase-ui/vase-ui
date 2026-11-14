import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as PreviewCard from '../index.parts';

describe('<PreviewCard.Root />', () => {
  describe('server render', () => {
    it.each([
      {
        name: 'a closed card',
        props: {},
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a id="two" href="/two"><!--[-->Two<!--]--></a><!--]-->',
      },
      {
        name: 'an open card with no trigger id',
        props: { defaultOpen: true },
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a id="two" href="/two"><!--[-->Two<!--]--></a><!--]-->',
      },
      {
        name: 'an open card with a trigger id',
        props: { defaultOpen: true, defaultTriggerId: 'two' },
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a data-popup-open id="two" href="/two"><!--[-->Two<!--]--></a><!--]-->',
      },
    ])('writes the links of $name', async ({ props, html }) => {
      const output = await renderToString(
        <PreviewCard.Root {...props}>
          <PreviewCard.Trigger id="one" href="/one">
            One
          </PreviewCard.Trigger>
          <PreviewCard.Trigger id="two" href="/two">
            Two
          </PreviewCard.Trigger>
        </PreviewCard.Root>,
      );

      expect(output).toBe(html);
    });

    it('writes nothing to a handle, and calls no listener', async () => {
      const handle = PreviewCard.createHandle();
      const onOpenChange = vi.fn();

      const output = await renderToString(
        <div>
          <PreviewCard.Trigger handle={handle} id="detached" href="/detached">
            Detached
          </PreviewCard.Trigger>
          <PreviewCard.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="detached"
            onOpenChange={onOpenChange}
          />
        </div>,
      );

      expect(output).toBe(
        '<div><a id="detached" href="/detached"><!--[-->Detached<!--]--></a><!--[--><!--]--></div>',
      );
      expect(handle.isOpen).toBe(false);
      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });
});
