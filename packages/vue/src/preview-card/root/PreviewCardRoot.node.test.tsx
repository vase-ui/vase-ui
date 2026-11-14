import { describe, expect, it, vi } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as PreviewCard from '../index.parts';

describe('<PreviewCard.Root />', () => {
  describe('server render', () => {
    // The portal renders after the mount, so it writes one comment in each state.
    it.each([
      {
        name: 'a closed card',
        root: {},
        portal: {},
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a id="two" href="/two"><!--[-->Two<!--]--></a><!----><!--]-->',
      },
      {
        name: 'an open card with no trigger id',
        root: { defaultOpen: true },
        portal: {},
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a id="two" href="/two"><!--[-->Two<!--]--></a><!----><!--]-->',
      },
      {
        name: 'an open card with a trigger id',
        root: { defaultOpen: true, defaultTriggerId: 'two' },
        portal: {},
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a data-popup-open id="two" href="/two"><!--[-->Two<!--]--></a><!----><!--]-->',
      },
      {
        name: 'a closed card that stays mounted',
        root: {},
        portal: { keepMounted: true },
        html: '<!--[--><a id="one" href="/one"><!--[-->One<!--]--></a><a id="two" href="/two"><!--[-->Two<!--]--></a><!----><!--]-->',
      },
    ])(
      'writes the links and one comment for the portal of $name',
      async ({ root, portal, html }) => {
        const output = await renderToString(
          <PreviewCard.Root {...root}>
            <PreviewCard.Trigger id="one" href="/one">
              One
            </PreviewCard.Trigger>
            <PreviewCard.Trigger id="two" href="/two">
              Two
            </PreviewCard.Trigger>
            <PreviewCard.Portal {...portal}>
              <PreviewCard.Positioner>
                <PreviewCard.Popup>Content</PreviewCard.Popup>
              </PreviewCard.Positioner>
            </PreviewCard.Portal>
          </PreviewCard.Root>,
        );

        expect(output).toBe(html);
      },
    );

    it('writes the style of a backdrop with the prefix of WebKit in its CSS form', async () => {
      const output = await renderToString(
        <PreviewCard.Root>
          <PreviewCard.Backdrop />
        </PreviewCard.Root>,
      );

      expect(output).toBe(
        '<!--[--><div data-closed role="presentation" hidden style="pointer-events:none;user-select:none;-webkit-user-select:none;"><!--[--><!--]--></div><!--]-->',
      );
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
