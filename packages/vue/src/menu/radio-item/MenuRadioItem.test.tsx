import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, provide } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
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

  describe('state management', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds the state and ARIA attributes when selected', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');
    });

    it('calls `onValueChange` when the item is clicked', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0} onValueChange={onValueChange}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe(1);
    });

    it('does not select when `onValueChange` cancels the event', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup
                  defaultValue={0}
                  onValueChange={(_: unknown, eventDetails: Menu.RadioGroup.ChangeEventDetails) => {
                    eventDetails.cancel();
                  }}
                >
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
    });

    it('keeps the state when closed and reopened', async () => {
      const { user } = await render(
        <Menu.Root modal={false}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal keepMounted>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      await user.click(trigger); // close the menu

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      await user.click(trigger); // reopen the menu

      const itemAfterReopen = await screen.findByRole('menuitemradio');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked', '');
    });
  });

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

    it('is disabled by a disabled root', async () => {
      await render(
        <Menu.Root open disabled>
          <Menu.RadioGroup>
            <Menu.RadioItem value="a">A</Menu.RadioItem>
          </Menu.RadioGroup>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemradio');
      expect(item).toHaveAttribute('data-disabled');
      expect(item).toHaveAttribute('aria-disabled', 'true');
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
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('when `closeOnClick=true`, closes the menu when the item is clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem closeOnClick value={1}>
                    Item
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('does not close the menu when the item is clicked by default', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.RadioGroup defaultValue={0}>
                  <Menu.RadioItem value={1}>Item</Menu.RadioItem>
                </Menu.RadioGroup>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemradio');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
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
