import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  pressWithTouch,
  screen,
} from '#test-utils';

describe('<Select.List />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.List />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>{node}</Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  describe('native scrollbar', () => {
    it('is hidden while a scroll arrow is mounted, until the last arrow unmounts', async () => {
      const hasUpArrow = shallowRef(true);
      const hasDownArrow = shallowRef(true);

      await render(() => (
        <Select.Root open>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                {hasUpArrow.value && <Select.ScrollUpArrow keepMounted />}
                <Select.List data-testid="list">
                  <Select.Item value="a">a</Select.Item>
                </Select.List>
                {hasDownArrow.value && <Select.ScrollDownArrow keepMounted />}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();

      const list = screen.getByTestId('list');
      expect(list).toHaveClass('vase-ui-disable-scrollbar');

      hasUpArrow.value = false;
      await flushMicrotasks();
      expect(list).toHaveClass('vase-ui-disable-scrollbar');

      hasDownArrow.value = false;
      await flushMicrotasks();
      expect(list).not.toHaveClass('vase-ui-disable-scrollbar');
    });

    async function renderClosedSelect() {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">Open</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.ScrollUpArrow keepMounted />
                <Select.List>
                  <Select.Item value="a">a</Select.Item>
                </Select.List>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      return { user, trigger: screen.getByTestId('trigger') };
    }

    it('is hidden after a press of the mouse', async () => {
      const { user, trigger } = await renderClosedSelect();

      await user.click(trigger);
      const list = await screen.findByRole('listbox');
      await flushMicrotasks();

      expect(list).toHaveClass('vase-ui-disable-scrollbar');
    });

    it('is not hidden after a touch, which scrolls the list itself', async () => {
      const { trigger } = await renderClosedSelect();

      await pressWithTouch(trigger);
      const list = await screen.findByRole('listbox');
      await flushMicrotasks();

      expect(list).not.toHaveClass('vase-ui-disable-scrollbar');
    });
  });
});
