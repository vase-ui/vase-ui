import { afterEach, beforeEach, expect, vi, describe, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Select from '../index.parts';
import type { VaseUIEvent } from '../../internals/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';

describe('<Select.Item />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Item value="" />, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  it('treats a null value as an empty selection in multiple mode', async () => {
    const handleValueChange = vi.fn();

    // A controlled multiple select can legitimately be handed `null` (for example while its
    // value is still loading) instead of an array.
    const { user } = await render(
      <Select.Root multiple value={null} onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two">two</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    await user.click(screen.getByTestId('trigger'));

    const option = await screen.findByRole('option', { name: 'one' });
    expect(option).toHaveAttribute('aria-selected', 'false');

    await user.click(option);

    expect(handleValueChange).toHaveBeenCalledWith(['one'], expect.anything());
  });

  it('keeps the selection while grouped items are reordered and inserted', async () => {
    // Each item guesses its index from the order of `setup` and the sort after the DOM update
    // corrects it. Grouping, reordering and late insertion all invalidate the guess, so this pins
    // that a corrected index still resolves back to the right item.
    const items = shallowRef(['b', 'c']);
    const reversed = shallowRef(false);
    const App = defineComponent({
      setup: () => () => {
        const ordered = reversed.value ? [...items.value].reverse() : items.value;

        return (
          <div>
            <Select.Root open defaultValue="b">
              <Select.Trigger>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Group>
                      <Select.GroupLabel>Group one</Select.GroupLabel>
                      {ordered.map((itemValue) => (
                        <Select.Item key={itemValue} value={itemValue}>
                          <Select.ItemText>{itemValue}</Select.ItemText>
                        </Select.Item>
                      ))}
                    </Select.Group>
                    <Select.Group>
                      <Select.GroupLabel>Group two</Select.GroupLabel>
                      <Select.Item value="z">
                        <Select.ItemText>z</Select.ItemText>
                      </Select.Item>
                    </Select.Group>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <button
              data-testid="prepend"
              onClick={() => {
                items.value = ['a', ...items.value];
              }}
            >
              Prepend
            </button>
            <button
              data-testid="reverse"
              onClick={() => {
                reversed.value = !reversed.value;
              }}
            >
              Reverse
            </button>
          </div>
        );
      },
    });

    const { user } = await render(<App />);
    await flushMicrotasks();

    await user.click(screen.getByTestId('prepend'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'a' })).not.toBe(null);
    });

    await user.click(screen.getByTestId('reverse'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected');
    });

    await user.click(screen.getByTestId('reverse'));
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'b' })).toHaveAttribute('data-selected');
    });
  });

  it('should not select disabled item', async () => {
    const handleValueChange = vi.fn();
    const { user } = await render(
      <Select.Root onValueChange={handleValueChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one">one</Select.Item>
              <Select.Item value="two" disabled>
                two
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    await user.click(screen.getByTestId('trigger'));
    await user.click(await screen.findByRole('option', { name: 'two' }));

    expect(handleValueChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('');
    expect(screen.getByRole('listbox')).toBeVisible();
  });

  it('inherits the disabled state from the root', async () => {
    const handleClick = vi.fn();

    const { user } = await render(
      <Select.Root open disabled>
        <Select.Trigger>
          <Select.Value data-testid="value" />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="one" onClick={handleClick}>
                one
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    await flushMicrotasks();

    const item = screen.getByRole('option', { name: 'one' });
    expect(item).toHaveAttribute('data-disabled');

    await user.click(item);

    expect(handleClick).not.toHaveBeenCalled();
    expect(screen.getByTestId('value').textContent).toBe('');
  });

  describe('quick selection', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function tick(ms: number) {
      await vi.advanceTimersByTimeAsync(ms);
      await flushMicrotasks();
    }

    async function openWithMouseDown(trigger: HTMLElement) {
      await fireEvent.mouseDown(trigger);
      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
    }

    it('calls onClick once for a click made after the opening delay', async () => {
      // Past the delay, a release over an item can select it on its own, so a regular click must
      // still only activate the item through its click event.
      const onClick = vi.fn();
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b" onClick={onClick}>
                  b
                </Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await user.click(screen.getByTestId('trigger'));
      const optionB = await screen.findByRole('option', { name: 'b' });
      await tick(500);
      await user.click(optionB);

      await waitFor(() => {
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
      });
      expect(onClick).toHaveBeenCalledTimes(1);
    });

    it('should not select an item on quick mouseup when showing a placeholder (no null item)', async () => {
      const fonts = [
        { label: 'Sans-serif', value: 'sans' },
        { label: 'Serif', value: 'serif' },
        { label: 'Monospace', value: 'mono' },
        { label: 'Cursive', value: 'cursive' },
      ];

      await render(
        <Select.Root items={fonts}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                {fonts.map(({ label, value }) => (
                  <Select.Item key={value} value={value}>
                    {label}
                  </Select.Item>
                ))}
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(value.textContent).toBe('Select font');

      // Open on mousedown and keep the mouse button "held" (no mouseup yet).
      await openWithMouseDown(trigger);

      const option = screen.getByRole('option', { name: 'Sans-serif' });
      await fireEvent.mouseMove(option);

      // Release quickly over an unselected option.
      await vi.advanceTimersByTimeAsync(250);
      await fireEvent.mouseUp(option);

      await waitFor(() => {
        expect(value.textContent).toBe('Select font');
      });
    });

    it('should call onClick when selecting via drag-to-select (mousedown on trigger, mouseup on item)', async () => {
      const handleClick = vi.fn();

      await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'one' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        await fireEvent.pointerMove(option, {
          pointerType: 'mouse',
          buttons: 1,
          movementY: 2,
        });
      }

      // Real pointer movement over the item allows drag-to-select before the opening delay elapses.
      await tick(100);
      await fireEvent.mouseUp(option);

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('one'));
      expect(handleClick).toHaveBeenCalledOnce();
    });

    it('does not fire click handlers on a disabled item during drag-to-select', async () => {
      const handleClick = vi.fn();

      await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" disabled onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'one' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        await fireEvent.pointerMove(option, { pointerType: 'mouse', buttons: 1, movementY: 2 });
      }

      await tick(100);
      await fireEvent.mouseUp(option);

      await flushMicrotasks();

      // Releasing over a disabled item must not synthesize a click on it at all.
      expect(handleClick).not.toHaveBeenCalled();
    });

    it('should not select a disabled item via drag-to-select', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" disabled>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'one' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      for (let i = 0; i < 4; i += 1) {
        await fireEvent.pointerMove(option, {
          pointerType: 'mouse',
          buttons: 1,
          movementY: 2,
        });
      }

      await tick(100);
      await fireEvent.mouseUp(option);

      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
    });

    it('should not select on mouseup that follows a touch interaction', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Select.Root onValueChange={handleValueChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'one' });
      // A touch drag over the item: the synthesized mouseup must not commit a selection,
      // otherwise scrolling the popup with a finger would pick whatever is released over.
      await fireEvent.pointerEnter(option, { pointerType: 'touch' });

      await tick(500);
      await fireEvent.mouseUp(option);

      await flushMicrotasks();

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
    });

    it('should accumulate drag-to-select movement across items', async () => {
      await render(
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
                <Select.Item value="three">three</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const optionTwo = screen.getByRole('option', { name: 'two' });
      await fireEvent.pointerEnter(optionTwo, { pointerType: 'mouse' });
      await fireEvent.pointerMove(optionTwo, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 4,
      });

      const optionThree = screen.getByRole('option', { name: 'three' });
      await fireEvent.pointerEnter(optionThree, { pointerType: 'mouse' });
      await fireEvent.pointerMove(optionThree, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 4,
      });

      await tick(100);
      await fireEvent.mouseUp(optionThree);

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('three'));
    });

    it('should not treat small pointer movement as drag-to-select', async () => {
      await render(
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const value = screen.getByTestId('value');

      expect(value.textContent).toBe('one');

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'two' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      await fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 2,
      });

      await tick(100);
      await fireEvent.mouseUp(option);

      expect(value.textContent).toBe('one');
    });

    it('should allow small pointer movement to select after the opening delay', async () => {
      await render(
        <Select.Root defaultValue="one">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one">one</Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'two' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      await fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 2,
      });

      await tick(500);
      await fireEvent.mouseUp(option);

      await waitFor(() => expect(screen.getByTestId('value').textContent).toBe('two'));
    });

    it('should not select item when onClick calls preventBaseUIHandler during drag-to-select', async () => {
      const handleClick = vi.fn((event: VaseUIEvent<MouseEvent>) => event.preventVaseUIHandler());

      await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" placeholder="Select font" />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="one" onClick={handleClick}>
                  one
                </Select.Item>
                <Select.Item value="two">two</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      await openWithMouseDown(screen.getByTestId('trigger'));

      const option = screen.getByRole('option', { name: 'one' });
      await fireEvent.pointerEnter(option, { pointerType: 'mouse' });
      await fireEvent.pointerMove(option, {
        pointerType: 'mouse',
        buttons: 1,
        movementY: 8,
      });

      // Wait past the delay gates and release the mouse over the option
      await tick(500);
      await fireEvent.mouseUp(option);

      expect(handleClick).toHaveBeenCalledOnce();
      expect(screen.getByTestId('value').textContent).toBe('Select font');
      expect(screen.queryByRole('listbox')).not.toBe(null);
    });
  });
});
