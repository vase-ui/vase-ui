import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, holdPress, screen, waitForPositioned } from '#test-utils';
import * as Menu from '../index.parts';

describe('<Menu.Trigger />', () => {
  const { render } = createRenderer();

  it('VUE-68: keeps the menu open when the trigger moves at the open and the press ends at its point', async () => {
    const shifted = shallowRef(false);
    const onOpenChange = vi.fn((open: boolean) => {
      shifted.value = open;
    });
    await render(() => (
      <div>
        <div hidden={!shifted.value} style={{ height: '100px' }}>
          Status
        </div>
        <Menu.Root onOpenChange={onOpenChange}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    ));
    const trigger = screen.getByRole('button', { name: 'Open' });

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
