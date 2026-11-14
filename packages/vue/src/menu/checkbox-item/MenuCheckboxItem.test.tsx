import { describe, expect, it, vi } from 'vitest';
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

  describe('state', () => {
    it.each([
      { name: 'true', checked: true, ariaChecked: 'true', dataState: 'checked' },
      { name: 'false', checked: false, ariaChecked: 'false', dataState: 'unchecked' },
    ])('has the role, the state and the ARIA attributes for checked=$name', async (testCase) => {
      await render(
        <Menu.Root open>
          <Menu.CheckboxItem checked={testCase.checked}>Item</Menu.CheckboxItem>
        </Menu.Root>,
      );

      const item = screen.getByRole('menuitemcheckbox');
      expect(item).toHaveAttribute('aria-checked', testCase.ariaChecked);
      expect(item).toHaveAttribute(`data-${testCase.dataState}`, '');
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
      const details = (onCheckedChange.mock.lastCall as unknown[])[1] as Menu.CheckboxItem.ChangeEventDetails;
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
                <Menu.CheckboxItem closeOnClick={testCase.closeOnClick}>Item</Menu.CheckboxItem>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await user.click(screen.getByRole('menuitemcheckbox'));

      if (testCase.closes) {
        expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        expect(screen.queryByRole('menu')).toBe(null);
      } else {
        expect(onOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).not.toBe(null);
      }
    });
  });
});
