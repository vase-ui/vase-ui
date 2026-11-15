import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import {
  createRenderer,
  flushMicrotasks,
  holdPress,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
} from '#test-utils';

const names = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight'];
const block = {
  display: 'block',
  width: '200px',
  height: '30px',
  boxSizing: 'border-box',
} as const;

type Anchor = 'trigger' | 'input and trigger' | 'input group';

function renderAnchor(anchor: Anchor) {
  if (anchor === 'input and trigger') {
    return (
      <>
        <Combobox.Input data-testid="input" style={block} />
        <Combobox.Trigger data-testid="trigger" style={block}>
          Pick
        </Combobox.Trigger>
      </>
    );
  }
  if (anchor === 'input group') {
    return (
      <Combobox.InputGroup style={{ display: 'block', width: '200px' }}>
        <span data-testid="icon" style={{ display: 'block', height: '30px' }}>
          Search
        </span>
        <Combobox.Input data-testid="input" style={block} />
      </Combobox.InputGroup>
    );
  }
  return (
    <Combobox.Trigger data-testid="trigger" style={block}>
      Pick
    </Combobox.Trigger>
  );
}

describe('<Combobox.Item />', () => {
  const { render } = createRenderer();

  async function renderShiftingCombobox(anchor: Anchor, value: string) {
    const shifted = shallowRef(false);
    const onValueChange = vi.fn();
    const onOpenChange = vi.fn((open: boolean) => {
      shifted.value = open;
    });
    const result = await render(() => (
      <div>
        {!shifted.value && <div style={{ height: '100px' }}>Status</div>}
        <Combobox.Root
          defaultValue={value}
          onOpenChange={onOpenChange}
          onValueChange={onValueChange}
        >
          {renderAnchor(anchor)}
          <Combobox.Portal>
            <Combobox.Positioner data-testid="positioner">
              <Combobox.Popup style={{ width: '200px' }}>
                {anchor === 'trigger' && <Combobox.Input style={block} />}
                <Combobox.List>
                  {names.map((name) => (
                    <Combobox.Item key={name} value={name} style={block}>
                      {name}
                    </Combobox.Item>
                  ))}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
        <button
          type="button"
          data-testid="outside"
          style={{ position: 'fixed', top: '0', right: '0' }}
        >
          Outside
        </button>
      </div>
    ));
    return { ...result, onValueChange, onOpenChange };
  }

  async function pressAtSelectedItem(target: HTMLElement) {
    const { point, release } = await waitForLaterMillisecond(() => holdPress(target));
    await waitForPositioned(await screen.findByTestId('positioner'));
    // The control above the anchor went at the open, so the selected item is now at the point of
    // the press. WebKit moves no highlight for a pointer that does not move: the item at the point
    // has the highlight because it is the selected item.
    await waitFor(() => {
      expect(
        document.elementFromPoint(point.x, point.y)?.closest('[role="option"]'),
      ).toHaveAttribute('data-highlighted');
    });
    return release;
  }

  it.each([
    {
      name: 'the input in the popup',
      anchor: 'trigger',
      press: 'trigger',
      value: 'two',
    },
    {
      name: 'the input outside the popup',
      anchor: 'input and trigger',
      press: 'trigger',
      value: 'four',
    },
    { name: 'a press of the input', anchor: 'input and trigger', press: 'input', value: 'three' },
    { name: 'a press of the input group', anchor: 'input group', press: 'icon', value: 'two' },
  ] as const)(
    'VUE-84: selects no item for a release at the point of the press that opened the popup, $name',
    async ({ anchor, press, value }) => {
      const { onValueChange, onOpenChange } = await renderShiftingCombobox(anchor, value);

      const release = await pressAtSelectedItem(screen.getByTestId(press));
      await release();
      await flushMicrotasks();

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
    },
  );

  it.each([
    { name: 'a click of the selected item', step: 'click' },
    { name: 'Escape', step: 'escape' },
    { name: 'an outside press', step: 'outside' },
  ] as const)(
    'VUE-84: closes the popup at the next step after a release at the point of the press, $name',
    async ({ step }) => {
      const { user, onValueChange, onOpenChange } = await renderShiftingCombobox('trigger', 'two');

      const release = await pressAtSelectedItem(screen.getByTestId('trigger'));
      await release();
      await flushMicrotasks();

      if (step === 'click') {
        await user.click(screen.getByRole('option', { name: 'two' }));
      } else if (step === 'escape') {
        await user.keyboard('{Escape}');
      } else {
        await user.click(screen.getByTestId('outside'));
      }

      await waitFor(() => {
        expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      });
      expect(onValueChange.mock.calls.map(([nextValue]) => nextValue)).toEqual(
        step === 'click' ? ['two'] : [],
      );
    },
  );
});
