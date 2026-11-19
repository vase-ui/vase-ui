import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { createRenderer, flushMicrotasks, holdPress, screen, waitForPositioned } from '#test-utils';

describe('<Combobox.Trigger />', () => {
  const { render } = createRenderer();

  it('VUE-68: keeps the popup open when the trigger moves at the open and the press ends at its point', async () => {
    const shifted = shallowRef(false);
    const onOpenChange = vi.fn((open: boolean) => {
      shifted.value = open;
    });
    await render(() => (
      <div>
        <div hidden={!shifted.value} style={{ height: '100px' }}>
          Status
        </div>
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Fruit</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner data-testid="positioner">
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="apple">Apple</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      </div>
    ));
    const trigger = screen.getByTestId('trigger');

    const { point, release } = await holdPress(trigger);
    await waitForPositioned(await screen.findByTestId('positioner'));
    // The trigger moved in the frame of the open. The point of the press is now on another element.
    expect(trigger.getBoundingClientRect().top).toBeGreaterThan(point.y + 5);
    const elementAtPoint = document.elementFromPoint(point.x, point.y);
    expect(screen.getByTestId('positioner').contains(elementAtPoint)).toBe(false);
    await release();
    await flushMicrotasks();

    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
  });
});
