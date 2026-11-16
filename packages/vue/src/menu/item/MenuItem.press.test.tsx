import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  holdPress,
  screen,
  wait,
  waitForLaterMillisecond,
  waitForPositioned,
} from '#test-utils';
import * as Menu from '../index.parts';

describe('<Menu.Item />', () => {
  const { render } = createRenderer();

  it('VUE-84: activates no item for a release at the point of the press that opened the menu', async () => {
    const shifted = shallowRef(false);
    const onClick = vi.fn();
    const onOpenChange = vi.fn((open: boolean) => {
      shifted.value = open;
    });
    await render(() => (
      <div>
        {!shifted.value && <div style={{ height: '100px' }}>Status</div>}
        <Menu.Root onOpenChange={onOpenChange}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup>
                {['One', 'Two', 'Three', 'Four', 'Five', 'Six'].map((name) => (
                  <Menu.Item key={name} onClick={onClick} style={{ height: '30px' }}>
                    {name}
                  </Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>
    ));
    const trigger = screen.getByRole('button', { name: 'Open' });

    const { point, release } = await waitForLaterMillisecond(async () => {
      const press = await holdPress(trigger);
      await waitForPositioned(await screen.findByTestId('positioner'));
      return press;
    });
    // The trigger arms the release over an item 200 ms after the press.
    await wait(300);
    // The trigger moved up at the open, so an item is now at the point of the press.
    expect(document.elementFromPoint(point.x, point.y)).toHaveAttribute('role', 'menuitem');
    await release();
    await flushMicrotasks();

    expect(onClick).not.toHaveBeenCalled();
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
  });
});
