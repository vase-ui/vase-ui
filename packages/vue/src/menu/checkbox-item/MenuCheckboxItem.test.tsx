import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';

describe('<Menu.CheckboxItem />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.CheckboxItem />, () => ({
    render: (node) => {
      return render(<Menu.Root open>{node}</Menu.Root>);
    },
    refInstanceof: window.HTMLDivElement,
  }));

  describe('prop: focusableWhenDisabled', () => {
    it('can be focused but not interacted with when disabled', async () => {
      const handleCheckedChange = vi.fn();
      const handleClick = vi.fn();
      const handleKeyDown = vi.fn();
      const handleKeyUp = vi.fn();

      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  disabled
                  onCheckedChange={handleCheckedChange}
                  onClick={handleClick}
                  onKeydown={handleKeyDown}
                  onKeyup={handleKeyUp}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      item.focus();
      await flushMicrotasks();
      expect(item).toHaveFocus();

      await fireEvent.keyDown(item, { key: 'Enter' });
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      await fireEvent.keyUp(item, { key: 'Space' });
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);

      await fireEvent.click(item);
      expect(handleKeyDown.mock.calls.length).toBe(0);
      expect(handleKeyUp.mock.calls.length).toBe(0);
      expect(handleClick.mock.calls.length).toBe(0);
      expect(handleCheckedChange.mock.calls.length).toBe(0);
    });
  });

  describe('state management', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it.each([
      { checked: true, ariaChecked: 'true', dataState: 'checked' },
      { checked: false, ariaChecked: 'false', dataState: 'unchecked' },
    ])(
      'adds the state and ARIA attributes when checked=$checked',
      async ({ checked, ariaChecked, dataState }) => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.CheckboxItem checked={checked}>Item</Menu.CheckboxItem>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = screen.getByRole('button', { name: 'Open' });
        await user.click(trigger);

        const item = screen.getByRole('menuitemcheckbox');
        expect(item).toHaveAttribute('aria-checked', ariaChecked);
        expect(item).toHaveAttribute(`data-${dataState}`, '');
      },
    );

    it('toggles the checked state when clicked', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).toHaveAttribute('data-unchecked', '');
    });

    it('calls `onCheckedChange` when the item is clicked', async () => {
      const onCheckedChange = vi.fn();
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem onCheckedChange={onCheckedChange}>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(1);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(true);

      await user.click(item);

      expect(onCheckedChange.mock.calls.length).toBe(2);
      expect(onCheckedChange.mock.lastCall?.[0]).toBe(false);
    });

    it('does not toggle when `onCheckedChange` cancels the event', async () => {
      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.CheckboxItem
                  onCheckedChange={(
                    _: boolean,
                    eventDetails: Menu.CheckboxItem.ChangeEventDetails,
                  ) => {
                    eventDetails.cancel();
                  }}
                >
                  Item
                </Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
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
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{Enter}');

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      await user.keyboard('{Enter}');
      await user.keyboard('{Enter}');

      const itemAfterReopen = screen.getByRole('menuitemcheckbox');
      expect(itemAfterReopen).toHaveAttribute('aria-checked', 'true');
      expect(itemAfterReopen).toHaveAttribute('data-checked');
    });
  });

  describe('state', () => {
    it('is disabled by a disabled root', async () => {
      await render(
        <Menu.Root open disabled>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      expect(item).toHaveAttribute('data-disabled');
      expect(item).toHaveAttribute('aria-disabled', 'true');
    });

    it('toggles on a click, and emits checkedChange and then update:checked', async () => {
      const events: string[] = [];
      const onCheckedChange = vi.fn(() => events.push('checkedChange'));
      const onUpdateChecked = vi.fn(() => events.push('update:checked'));
      const { user } = await render(
        <Menu.Root open>
          <Menu.CheckboxItem
            onCheckedChange={onCheckedChange}
            {...{ 'onUpdate:checked': onUpdateChecked }}
          >
            Item
          </Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'true');
      expect(item).toHaveAttribute('data-checked', '');
      expect(events).toEqual(['checkedChange', 'update:checked']);
      expect(onCheckedChange.mock.lastCall).toEqual([true, expect.anything()]);
      const details = (
        onCheckedChange.mock.lastCall as unknown[]
      )[1] as Menu.CheckboxItem.ChangeEventDetails;
      expect(details.reason).toBe(REASONS.itemPress);
      expect(details.event.type).toBe('click');
      expect(onUpdateChecked).toHaveBeenLastCalledWith(true);

      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).toHaveAttribute('data-unchecked', '');
      expect(onUpdateChecked).toHaveBeenLastCalledWith(false);
    });

    it('does not toggle when checkedChange cancels the change', async () => {
      const onUpdateChecked = vi.fn();
      const { user } = await render(
        <Menu.Root open>
          <Menu.CheckboxItem
            onCheckedChange={(_: boolean, details: Menu.CheckboxItem.ChangeEventDetails) =>
              details.cancel()
            }
            {...{ 'onUpdate:checked': onUpdateChecked }}
          >
            Item
          </Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
      expect(item).not.toHaveAttribute('data-checked');
      expect(onUpdateChecked).not.toHaveBeenCalled();
    });

    it('follows v-model:checked', async () => {
      const checked = shallowRef(false);
      const Test = defineComponent(() => () => (
        <Menu.Root open>
          <Menu.CheckboxItem
            checked={checked.value}
            {...{
              'onUpdate:checked': (value: boolean) => {
                checked.value = value;
              },
            }}
          >
            Item
          </Menu.CheckboxItem>
        </Menu.Root>
      ));

      const { user } = await render(<Test />);
      const item = screen.getByRole('menuitemcheckbox');

      await user.click(item);
      expect(checked.value).toBe(true);
      expect(item).toHaveAttribute('aria-checked', 'true');

      checked.value = false;
      await flushMicrotasks();
      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('stays unchecked when a controlled parent keeps the value', async () => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.CheckboxItem checked={false}>Item</Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it.each([
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: ' ' },
    ])('toggles with $name on the focused item', async ({ key }) => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.CheckboxItem>Item</Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      item.focus();
      await user.keyboard(key);

      expect(item).toHaveAttribute('aria-checked', 'true');
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
                <Menu.CheckboxItem closeOnClick>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
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
                <Menu.CheckboxItem>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      const item = screen.getByRole('menuitemcheckbox');
      await user.click(item);

      expect(screen.queryByRole('menu')).not.toBe(null);
    });
  });
});
