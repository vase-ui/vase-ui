import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { MenuRadioGroupContext } from '../radio-group/MenuRadioGroupContext';

const testRadioGroupContext: MenuRadioGroupContext = {
  value: computed(() => '0'),
  setValue: () => {},
  disabled: computed(() => false),
};

const TestRadioGroupProvider = defineComponent((_, { slots }) => {
  provide(MenuRadioGroupContext, testRadioGroupContext);
  return () => slots.default?.();
});

describe('<Menu.RadioItem />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.RadioItem value="0" />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <TestRadioGroupProvider>{node}</TestRadioGroupProvider>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('state', () => {
    it('has the role, the state and the ARIA attributes of a selected item', async () => {
      await render(
        <Menu.Root open>
          <Menu.RadioGroup defaultValue="a">
            <Menu.RadioItem value="a">A</Menu.RadioItem>
            <Menu.RadioItem value="b">B</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const [a, b] = screen.getAllByRole('menuitemradio');
      expect(a).toHaveAttribute('aria-checked', 'true');
      expect(a).toHaveAttribute('data-checked', '');
      expect(b).toHaveAttribute('aria-checked', 'false');
      expect(b).toHaveAttribute('data-unchecked', '');
    });

    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('selects the focused item with $name', async ({ key }) => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.RadioGroup>
            <Menu.RadioItem value="a">A</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemradio');
      item.focus();
      await user.keyboard(key);

      expect(item).toHaveAttribute('aria-checked', 'true');
    });

    it('selects nothing for a click on a disabled item', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Menu.Root open>
          <Menu.RadioGroup onValueChange={onValueChange}>
            <Menu.RadioItem value="a" disabled>
              A
            </Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(item).toHaveAttribute('data-disabled', '');
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: closeOnClick', () => {
    it.each([
      { name: 'by default', closeOnClick: undefined, closes: false },
      { name: 'with closeOnClick', closeOnClick: true, closes: true },
    ])('closes the menu for a click $name only when it must', async (testCase) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup>
                  <Menu.RadioItem value="a" closeOnClick={testCase.closeOnClick}>
                    A
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitemradio'));

      if (testCase.closes) {
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(screen.queryByRole('menu')).toBe(null);
      } else {
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBe(null);
      }
    });
  });

  it('throws when rendered outside Menu.RadioGroup', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.RadioItem value="one" />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.RadioItem> must be inside <Menu.RadioGroup>. Without a group the item has no value to select. Put the item inside <Menu.RadioGroup>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
