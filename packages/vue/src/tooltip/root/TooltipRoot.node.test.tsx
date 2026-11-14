import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import * as Tooltip from '../index.parts';

function button(id: string, attributes: string) {
  return `<button ${attributes} type="button"><!--[-->${id}<!--]--></button>`;
}

function tooltip(rootProps: Record<string, unknown>, portalProps: Record<string, unknown>) {
  return (
    <Tooltip.Root {...rootProps}>
      <Tooltip.Trigger id="one">one</Tooltip.Trigger>
      <Tooltip.Trigger id="two">two</Tooltip.Trigger>
      <Tooltip.Portal {...portalProps}>
        <Tooltip.Positioner>
          <Tooltip.Popup>Content</Tooltip.Popup>
        </Tooltip.Positioner>
      </Tooltip.Portal>
    </Tooltip.Root>
  );
}

describe('<Tooltip.Root />', () => {
  describe('server render', () => {
    // The portal renders after the mount, so it writes one comment in each state.
    it.each([
      { name: 'a closed tooltip', root: {}, portal: {}, two: 'id="two"' },
      {
        name: 'an open tooltip with no trigger id',
        root: { defaultOpen: true },
        portal: {},
        two: 'id="two"',
      },
      {
        name: 'an open tooltip with a trigger id',
        root: { defaultOpen: true, defaultTriggerId: 'two' },
        portal: {},
        two: 'data-popup-open id="two"',
      },
      {
        name: 'a disabled tooltip',
        root: { disabled: true },
        portal: {},
        two: 'id="two" data-trigger-disabled',
      },
      {
        name: 'a closed tooltip that stays mounted',
        root: {},
        portal: { keepMounted: true },
        two: 'id="two"',
      },
    ])(
      'writes the triggers and one comment for the portal of $name',
      async ({ root, portal, two }) => {
        const one = two.replace('data-popup-open ', '').replace('"two"', '"one"');

        expect(typeof document).toBe('undefined');
        expect(await renderToString(tooltip(root, portal))).toBe(
          `<!--[-->${button('one', one)}${button('two', two)}<!----><!--]-->`,
        );
      },
    );

    it('writes nothing to a handle, and calls no listener', async () => {
      const handle = Tooltip.createHandle();
      const calls: unknown[] = [];

      const html = await renderToString(
        <>
          <Tooltip.Trigger handle={handle} id="one">
            one
          </Tooltip.Trigger>
          <Tooltip.Root
            handle={handle}
            defaultOpen
            defaultTriggerId="one"
            disabled
            onOpenChange={(open: boolean) => calls.push(open)}
          />
        </>,
      );

      expect(html).toBe(`<!--[-->${button('one', 'id="one"')}<!--[--><!--]--><!--]-->`);
      expect(handle.isOpen).toBe(false);
      expect(calls).toEqual([]);
    });
  });
});
