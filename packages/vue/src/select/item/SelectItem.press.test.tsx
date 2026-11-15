import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { userEvent } from 'vitest/browser';
import { Select } from '@vase-ui/vue/select';
import {
  createRenderer,
  flushMicrotasks,
  holdPress,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
} from '#test-utils';

interface Fixture {
  alignItemWithTrigger: boolean;
  value: string | null;
  /** Whether a control above the trigger goes at the open, which moves the trigger to the top. */
  movesTrigger: boolean;
}

describe('<Select.Item />', () => {
  const { render } = createRenderer();

  async function renderSelect({ alignItemWithTrigger, value, movesTrigger }: Fixture) {
    const shifted = shallowRef(false);
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn((open: boolean) => {
      shifted.value = open;
    });
    await render(() => (
      // The aligned popup needs room above a trigger that does not move.
      <div style={{ paddingTop: movesTrigger ? '0' : '150px' }}>
        {movesTrigger && !shifted.value && <div style={{ height: '100px' }}>Status</div>}
        <Select.Root defaultValue={value} onOpenChange={onOpenChange} onValueChange={onValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Pick" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={alignItemWithTrigger} data-testid="positioner">
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
    return { trigger: screen.getByTestId('trigger'), onValueChange };
  }

  async function releaseOverItemAtPressPoint(trigger: HTMLElement, side: string) {
    const { point, release } = await waitForLaterMillisecond(async () => {
      const press = await holdPress(trigger);
      await waitForPositioned(await screen.findByTestId('positioner'));
      return press;
    });
    const positioner = screen.getByTestId('positioner');
    // The trigger arms the release over an item 400 ms after the open.
    await wait(500);
    expect(positioner).toHaveAttribute('data-side', side);
    expect(document.elementFromPoint(point.x, point.y)?.closest('[role="option"]')).not.toBe(null);
    await release();
    await flushMicrotasks();
  }

  it.each([
    {
      name: 'the trigger moved at the open',
      fixture: { alignItemWithTrigger: false, value: 'one', movesTrigger: true },
      side: 'bottom',
    },
    {
      // A trigger within 20 px of the top of the viewport stops the alignment of the popup. The
      // popup then takes the place of an unaligned one.
      name: 'aligned at the top of the viewport',
      fixture: { alignItemWithTrigger: true, value: 'one', movesTrigger: true },
      side: 'bottom',
    },
    {
      name: 'aligned with no value',
      fixture: { alignItemWithTrigger: true, value: null, movesTrigger: false },
      side: 'none',
    },
    {
      name: 'aligned with a value',
      fixture: { alignItemWithTrigger: true, value: 'four', movesTrigger: false },
      side: 'none',
    },
  ])(
    'VUE-84: selects no item for a release at the point of the press, $name',
    async ({ fixture, side }) => {
      const { trigger, onValueChange } = await renderSelect(fixture);

      await releaseOverItemAtPressPoint(trigger, side);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    },
  );

  it.each([
    {
      name: 'a click on the selected item',
      close: () => userEvent.click(screen.getByRole('option', { name: 'four' })),
    },
    { name: 'Escape', close: () => userEvent.keyboard('{Escape}') },
    {
      name: 'an outside press',
      // The top right corner of the page is outside the popup.
      close: () =>
        userEvent.pointer({ coords: { x: window.innerWidth - 5, y: 5 }, keys: '[MouseLeft]' }),
    },
  ])('VUE-84: closes after a release at the point of the press, $name', async ({ close }) => {
    const { trigger } = await renderSelect({
      alignItemWithTrigger: true,
      value: 'four',
      movesTrigger: false,
    });
    await releaseOverItemAtPressPoint(trigger, 'none');
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await close();

    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(screen.getByTestId('value').textContent).toBe('four');
  });
});
