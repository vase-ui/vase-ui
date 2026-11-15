import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  flushMicrotasks,
  holdPress,
  screen,
  wait,
  waitForPositioned,
} from '#test-utils';

describe('<Select.Item />', () => {
  const { render } = createRenderer();

  it.each([
    { name: 'the trigger moved at the open', alignItemWithTrigger: false, value: 'one' },
    { name: 'aligned with no value', alignItemWithTrigger: true, value: null },
    { name: 'aligned with a value', alignItemWithTrigger: true, value: 'four' },
  ])(
    'VUE-84: selects no item for a release at the point of the press, $name',
    async ({ alignItemWithTrigger, value }) => {
      const shifted = shallowRef(false);
      const onValueChange = vi.fn();
      const onOpenChange = vi.fn((open: boolean) => {
        shifted.value = open;
      });
      await render(() => (
        // The aligned popup needs room above the trigger.
        <div style={{ paddingTop: '150px' }}>
          {!alignItemWithTrigger && !shifted.value && <div style={{ height: '100px' }}>Status</div>}
          <Select.Root
            defaultValue={value}
            onOpenChange={onOpenChange}
            onValueChange={onValueChange}
          >
            <Select.Trigger data-testid="trigger">
              <Select.Value placeholder="Pick" />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner
                alignItemWithTrigger={alignItemWithTrigger}
                data-testid="positioner"
              >
                <Select.Popup>
                  {['one', 'two', 'three', 'four', 'five', 'six'].map((name) => (
                    <Select.Item key={name} value={name} style={{ height: '30px' }}>
                      <Select.ItemText>{name}</Select.ItemText>
                    </Select.Item>
                  ))}
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>
      ));
      const trigger = screen.getByTestId('trigger');

      const { point, release } = await holdPress(trigger);
      await waitForPositioned(await screen.findByTestId('positioner'));
      // The trigger arms the release over an item 400 ms after the open.
      await wait(500);
      expect(document.elementFromPoint(point.x, point.y)?.closest('[role="option"]')).not.toBe(
        null,
      );
      await release();
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    },
  );
});
