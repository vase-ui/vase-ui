import { describe, expect, it } from 'vitest';
import { renderToString } from 'vue/server-renderer';
import { Tooltip } from '@vase-ui/vue/tooltip';

function button(id: string, attributes: string) {
  return `<button ${attributes} type="button"><!--[-->${id}<!--]--></button>`;
}

function tooltip(rootProps: Record<string, unknown>) {
  return (
    <Tooltip.Root {...rootProps}>
      <Tooltip.Trigger id="one">one</Tooltip.Trigger>
      <Tooltip.Trigger id="two">two</Tooltip.Trigger>
    </Tooltip.Root>
  );
}

describe('<Tooltip.Root />', () => {
  describe('server render', () => {
    it.each([
      { name: 'a closed tooltip', root: {}, two: 'id="two"' },
      {
        name: 'an open tooltip with no trigger id',
        root: { defaultOpen: true },
        two: 'id="two"',
      },
      {
        name: 'an open tooltip with a trigger id',
        root: { defaultOpen: true, defaultTriggerId: 'two' },
        two: 'data-popup-open id="two"',
      },
      {
        name: 'a disabled tooltip',
        root: { disabled: true },
        two: 'id="two" data-trigger-disabled',
      },
    ])('writes the triggers of $name', async ({ root, two }) => {
      const one = two.replace('data-popup-open ', '').replace('"two"', '"one"');

      expect(typeof document).toBe('undefined');
      expect(await renderToString(tooltip(root))).toBe(
        `<!--[-->${button('one', one)}${button('two', two)}<!--]-->`,
      );
    });

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
