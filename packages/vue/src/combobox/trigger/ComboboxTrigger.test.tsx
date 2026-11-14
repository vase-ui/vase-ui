import { expect, vi, describe, it } from 'vitest';
import { KeepAlive, defineComponent, onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  pressWithScreenReader,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import * as Autocomplete from '../../autocomplete/index.parts';
import { REASONS } from '../../internals/reasons';
import * as Combobox from '../index.parts';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';
import ComboboxTriggerReplacement from './ComboboxTriggerReplacement.test.vue';

type ItemSlotProps = { item: string };

describe('<Combobox.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('sets tabIndex to -1 when not used as the main anchor', async () => {
    const { user } = await render(
      <Combobox.Root>
        <Combobox.Input />
        <Combobox.Trigger data-testid="trigger" />
      </Combobox.Root>,
    );

    const input = screen.getByRole('combobox');
    const trigger = screen.getByTestId('trigger');

    expect(trigger).toHaveAttribute('tabindex', '-1');

    await user.click(input);
    expect(trigger).toHaveAttribute('tabindex', '-1');

    await user.click(trigger);
    expect(trigger).toHaveAttribute('tabindex', '-1');
  });

  describe('prop: disabled', () => {
    it('should render aria-disabled attribute when disabled', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from ComboboxRoot', async () => {
      await render(
        <Combobox.Root disabled>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should inherit disabled state from Field.Root', async () => {
      await render(
        <Field.Root disabled>
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          </Combobox.Root>
        </Field.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });

    it('should not open popup when disabled', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('ignores native keydown events on a disabled non-native trigger', async () => {
      const onOpenChange = vi.fn();
      await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger disabled nativeButton={false} as="div" data-testid="trigger" />
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
      );
      await flushMicrotasks();

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('should prioritize local disabled over root disabled', async () => {
      await render(
        <Combobox.Root disabled={false}>
          <Combobox.Trigger disabled data-testid="trigger">
            Open
          </Combobox.Trigger>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('disabled');
    });
  });

  it.each([
    {
      name: 'single selection',
      control: (
        <Combobox.Root defaultValue="apple">
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ),
      expectedValue: 'apple',
    },
    {
      name: 'no selection',
      control: (
        <Autocomplete.Root defaultValue="query">
          <Autocomplete.Trigger data-testid="trigger" />
        </Autocomplete.Root>
      ),
      expectedValue: 'query',
    },
  ])('validates the $name value when blurred', async ({ control, expectedValue }) => {
    const validate = vi.fn();
    await render(
      <Field.Root validationMode="onBlur" validate={validate}>
        {control}
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.focusIn(trigger);
    await fireEvent.focusOut(trigger);

    expect(validate).toHaveBeenCalledWith(expectedValue, expect.anything());
  });

  it('ignores a pending mouseup after the trigger unmounts', async () => {
    const onOpenChange = vi.fn();
    const showTrigger = shallowRef(true);

    await render(() => (
      <Combobox.Root onOpenChange={onOpenChange}>
        {showTrigger.value && <Combobox.Trigger data-testid="trigger" />}
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Input />
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
    ));
    await fireEvent.mouseDown(screen.getByTestId('trigger'));

    await waitFor(() => expect(onOpenChange).toHaveBeenCalledWith(true, expect.anything()));
    onOpenChange.mockClear();

    showTrigger.value = false;
    await flushMicrotasks();

    await fireEvent.mouseUp(document.body, { clientX: 100, clientY: 100 });
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('does not select when closed typeahead matches a sparse label without a value', async () => {
    const onValueChange = vi.fn();

    const SparseRegistry = defineComponent(() => {
      const store = useComboboxRootContext();
      onMounted(() => {
        store.context.labelsRef.value[0] = 'apple';
        // eslint-disable-next-line @typescript-eslint/no-array-delete -- As in the Base UI case, the slot stays and has no value. `splice` would remove the slot.
        delete store.context.valuesRef.value[0];
      });
      return () => null;
    });

    const { user } = await render(
      <Combobox.Root onValueChange={onValueChange}>
        <SparseRegistry />
        <Combobox.Trigger>Open</Combobox.Trigger>
      </Combobox.Root>,
    );

    const trigger = screen.getByRole('combobox');
    trigger.focus();
    await user.keyboard('a');

    expect(onValueChange).not.toHaveBeenCalled();
  });

  describe('prop: readOnly', () => {
    it('applies the data-readonly style hook only when readOnly', async () => {
      const { setProps } = await render(
        <Combobox.Root readOnly>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-readonly', '');

      await setProps({ readOnly: false });
      expect(trigger).not.toHaveAttribute('data-readonly');
    });

    it('opens the popup when readOnly', async () => {
      const { user } = await render(
        <Combobox.Root readOnly>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      expect(await screen.findByRole('listbox')).toHaveAttribute('aria-readonly', 'true');
    });

    it.each([
      { name: 'ArrowDown', key: '{ArrowDown}' },
      { name: 'ArrowUp', key: '{ArrowUp}' },
      { name: 'Enter', key: '{Enter}' },
      { name: 'Space', key: '[Space]' },
    ])('opens on $name when readOnly', async ({ key }) => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await user.keyboard(key);

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });

    it('does not commit a value with typeahead on a closed trigger', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <Combobox.Root readOnly onValueChange={onValueChange}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="apple">apple</Combobox.Item>
                  <Combobox.Item value="banana">banana</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await user.keyboard('b');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('should not toggle when readOnly=false (control)', async () => {
      const { user } = await render(
        <Combobox.Root readOnly={false}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);
      expect(await screen.findByRole('listbox')).not.toBe(null);
    });
  });

  describe('interaction behavior', () => {
    it('should toggle popup when enabled', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('closes a popup opened with an arrow key', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByRole('combobox');
      input.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      expect(await screen.findByRole('listbox')).not.toBe(null);

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });

    it('should call onOpenChange when toggling', async () => {
      const handleOpenChange = vi.fn();
      const { user } = await render(
        <Combobox.Root onOpenChange={handleOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                  <Combobox.Item value="b">b</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });
      expect(handleOpenChange.mock.calls[0][0]).toBe(true);
    });

    it('opens popup when pressing ArrowDown or ArrowUp', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');
      expect(screen.getByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('combobox')).toHaveFocus();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);

      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowUp}');
      expect(screen.queryByRole('listbox')).not.toBe(null);
      expect(screen.getByRole('combobox')).toHaveFocus();
    });

    it('does not open on ArrowDown/ArrowUp when reference is a textarea', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <textarea aria-label="notes" />
        </Combobox.Root>,
      );

      const trigger = screen.getByRole('combobox');
      await user.click(trigger);
      await user.keyboard('{ArrowDown}');
      expect(screen.queryByRole('listbox')).toBe(null);
      await user.keyboard('{ArrowUp}');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('fires with reason trigger-press when Trigger is clicked', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await waitFor(() => {
        expect(onOpenChange.mock.calls.length).toBe(1);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.triggerPress);
    });

    it.skipIf(isJSDOM)('keeps focus on the input after a screen reader press', async () => {
      await render(
        <Combobox.Root items={['Apple', 'Banana']}>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await pressWithScreenReader(trigger);

      expect(await screen.findByRole('listbox')).not.toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('combobox')).toHaveFocus();
      });
    });
  });

  describe('drag selection', () => {
    it('commits selection when the input is outside the popup', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      await fireEvent.mouseMove(option, { pointerType: 'mouse', movementX: 1 });
      await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));

      await fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('beta');
    });

    it('commits selection when the input is inside the popup and the pointer is released over an item', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      await fireEvent.mouseMove(option, { pointerType: 'mouse', movementX: 1 });
      await waitFor(() => expect(option).toHaveAttribute('data-highlighted'));

      await fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(1);
      });
      expect(handleValueChange.mock.calls[0][0]).toBe('beta');
    });

    it.skipIf(isJSDOM)(
      'does not double-commit when a non-primary touch lands on another item',
      async () => {
        const handleValueChange = vi.fn();

        await render(
          <Combobox.Root onValueChange={handleValueChange}>
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.Input />
                  <Combobox.List>
                    <Combobox.Item value="alpha">Alpha</Combobox.Item>
                    <Combobox.Item value="beta">Beta</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0 });

        await screen.findByRole('listbox');
        const alpha = await screen.findByRole('option', { name: 'Alpha' });
        const beta = await screen.findByRole('option', { name: 'Beta' });

        // Highlight Alpha so a stray drag-select would be able to commit it.
        await fireEvent.mouseMove(alpha, { pointerType: 'mouse', movementX: 1 });
        await waitFor(() => expect(alpha).toHaveAttribute('data-highlighted'));

        // Primary touch presses Alpha; a second, non-primary touch lands on Beta.
        // Without the `isPrimary` guard the shared ref would flip to Beta, making
        // Alpha's release read as a drag-select and commit once on `mouseup` and
        // again on the following `click`.
        await fireEvent.pointerDown(alpha, { pointerType: 'touch', isPrimary: true, button: 0 });
        await fireEvent.pointerDown(beta, { pointerType: 'touch', isPrimary: false, button: 0 });
        await fireEvent.mouseUp(alpha, { button: 0 });
        await fireEvent.click(alpha, { button: 0 });

        await waitFor(() => {
          expect(handleValueChange.mock.calls.length).toBe(1);
        });
        expect(handleValueChange.mock.calls[0][0]).toBe('alpha');
      },
    );

    it.skipIf(isJSDOM)(
      'commits a later drag-select onto an item whose earlier pointerdown never released',
      async () => {
        const handleValueChange = vi.fn();

        const { user } = await render(
          <Combobox.Root onValueChange={handleValueChange}>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="alpha">Alpha</Combobox.Item>
                    <Combobox.Item value="beta">Beta</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        // Press an item, then close before any matching `mouseup` arrives. The
        // closed-state effect must clear the shared pointerdown ref, otherwise the
        // stale entry makes the next drag-select onto Alpha read as a same-item tap
        // and never commit.
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0 });
        await screen.findByRole('listbox');
        const alpha = await screen.findByRole('option', { name: 'Alpha' });
        await fireEvent.pointerDown(alpha, { pointerType: 'touch', isPrimary: true, button: 0 });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });

        // Reopen and drag-select onto Alpha (gesture starts on the trigger).
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0 });
        await screen.findByRole('listbox');
        const alphaReopened = await screen.findByRole('option', { name: 'Alpha' });
        await fireEvent.mouseMove(alphaReopened, { pointerType: 'mouse', movementX: 1 });
        await waitFor(() => expect(alphaReopened).toHaveAttribute('data-highlighted'));
        await fireEvent.mouseUp(alphaReopened, { button: 0 });

        await waitFor(() => {
          expect(handleValueChange.mock.calls.length).toBe(1);
        });
        expect(handleValueChange.mock.calls[0][0]).toBe('alpha');
      },
    );

    it('does not commit selection if the pointer never hovers the item', async () => {
      const handleValueChange = vi.fn();

      await render(
        <Combobox.Root onValueChange={handleValueChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Input />
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                  <Combobox.Item value="beta">Beta</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');
      const option = await screen.findByRole('option', { name: 'Beta' });

      await fireEvent.mouseUp(option, { button: 0 });

      await waitFor(() => {
        expect(handleValueChange.mock.calls.length).toBe(0);
      });
    });
  });

  describe('cancel-open', () => {
    it('closes the popup when mouseup occurs outside the trigger bounds', async () => {
      const onOpenChange = vi.fn();

      await render(
        <Combobox.Root onOpenChange={onOpenChange}>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 999, clientY: 999 });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.cancelOpen);
    });

    it('keeps the popup open when mouseup remains near the trigger bounds', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        ({
          left: 0,
          top: 0,
          right: 100,
          bottom: 40,
          width: 100,
          height: 40,
          x: 0,
          y: 0,
          toJSON() {
            return {};
          },
        }) as DOMRect;

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      const listbox = await screen.findByRole('listbox');

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 1, clientY: 1 });

      expect(listbox.isConnected).toBe(true);
    });

    it('closes the popup when the release is more than 5px outside the trigger bounds', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">Open</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="alpha">Alpha</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });

      await screen.findByRole('listbox');

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 94, clientY: 120 });

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
    });
  });

  describe('aria attributes', () => {
    it('sets aria-required attribute when required (input inside popup)', async () => {
      await render(
        <Combobox.Root required>
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });

    it('does not set aria-required attribute when the input is outside the popup', async () => {
      await render(
        <Combobox.Root required>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('aria-required');
    });

    it('sets aria-readonly attribute when readOnly (input inside popup)', async () => {
      await render(
        <Combobox.Root readOnly>
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('role', 'combobox');
      expect(trigger).toHaveAttribute('aria-readonly', 'true');
    });

    it('does not set aria-readonly attribute when the input is outside the popup', async () => {
      await render(
        <Combobox.Root readOnly>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>,
      );

      // Without the `combobox` role the trigger is a plain button, so `aria-readonly` wouldn't
      // apply to it. The input carries the state instead.
      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('role');
      expect(trigger).not.toHaveAttribute('aria-readonly');
      expect(screen.getByTestId('input')).toHaveAttribute('aria-readonly', 'true');
    });

    it('sets all aria attributes on the input when closed', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('sets all aria attributes on the trigger when open', async () => {
      const { user } = await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await user.click(trigger);

      await screen.findByRole('listbox');
      const popup = screen.getByRole('dialog');

      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  describe('typeahead', () => {
    it('selects item when typing on focused trigger (input inside popup)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      expect(trigger).not.toHaveTextContent('apple');

      trigger.focus();
      // The trigger gives the typeahead the labels of `items` in a timer of 0 ms after the focus.
      await wait(0);
      await user.keyboard('a');

      expect(trigger).toHaveTextContent('apple');
      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it('selects item when typing after the popup has been opened and closed (items prop, strict: %s)', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana', 'cherry']}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      // Opening mounts the list (rendered labels overwrite the derived ones) and closing
      // unmounts it, clearing the registered labels. Typeahead must still work afterwards.
      await user.click(trigger);
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      // Focus returns to the trigger asynchronously after close.
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('b');

      await waitFor(() => {
        expect(trigger).toHaveTextContent('banana');
      });
    });

    it.each([false, true])(
      'cycles to the next matching item when typing after open/close (no items prop, keepMounted %s)',
      async (keepMounted) => {
        const { user } = await render(
          <Combobox.Root defaultValue="apple">
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <Combobox.Portal keepMounted={keepMounted}>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple">apple</Combobox.Item>
                    <Combobox.Item value="apricot">apricot</Combobox.Item>
                    <Combobox.Item value="banana">banana</Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);
        await screen.findByRole('listbox');
        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('listbox')).toBe(null);
        });
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        // Typeahead starts matching after the selected item, like a native select.
        await user.keyboard('a');
        await waitFor(() => {
          expect(trigger).toHaveTextContent('apricot');
        });
      },
    );

    it('cycles from the selected item after reordering items while closed (no items prop)', async () => {
      const App = defineComponent(() => {
        const order = shallowRef(['apple', 'apricot', 'banana']);

        return () => (
          <div>
            <Combobox.Root defaultValue="apple">
              <Combobox.Trigger data-testid="trigger">
                <Combobox.Value />
              </Combobox.Trigger>
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.List>
                      {order.value.map((item) => (
                        <Combobox.Item key={item} value={item}>
                          {item}
                        </Combobox.Item>
                      ))}
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <button
              type="button"
              data-testid="reorder"
              onClick={() => (order.value = ['apricot', 'apple', 'banana'])}
            >
              reorder
            </button>
          </div>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByTestId('trigger');

      // Open and close so the trigger path force-mounts the list.
      await user.click(trigger);
      await screen.findByRole('listbox');
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      // Reorder while closed: apple moves from index 0 to index 1.
      await fireEvent.click(screen.getByTestId('reorder'));
      await flushMicrotasks();

      // Typeahead starts after the selected item; from apple it wraps to apricot.
      await user.keyboard('a');
      await waitFor(() => {
        expect(trigger).toHaveTextContent('apricot');
      });
    });

    it('only matches mounted indexed item labels when typing on the focused trigger', async () => {
      const TestComponent = defineComponent(() => {
        const showBanana = shallowRef(true);

        return () => (
          <Combobox.Root>
            <Combobox.Trigger data-testid="trigger">
              <Combobox.Value />
            </Combobox.Trigger>
            <button type="button" onClick={() => (showBanana.value = false)}>
              Remove banana
            </button>
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List>
                    <Combobox.Item value="apple" index={0}>
                      Apple
                    </Combobox.Item>
                    {showBanana.value && (
                      <Combobox.Item value="banana" index={1}>
                        Banana
                      </Combobox.Item>
                    )}
                    <Combobox.Item value="blueberry" index={2}>
                      Blueberry
                    </Combobox.Item>
                  </Combobox.List>
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        );
      });

      const { user } = await render(<TestComponent />);
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);
      await screen.findByRole('listbox');

      await user.click(screen.getByRole('button', { name: 'Remove banana' }));
      await waitFor(() => {
        expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      });
      await user.keyboard('{Escape}');
      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });

      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('b');

      await waitFor(() => {
        expect(trigger).toHaveTextContent('blueberry');
      });
    });
  });

  describe('data state attributes', () => {
    it.skipIf(isJSDOM)('sets data-popup-side to the current popup side', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple']}>
          <Combobox.Trigger data-testid="trigger">Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner side="right">
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-popup-side');

      await user.click(trigger);

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
      expect(trigger).toHaveAttribute('data-popup-side', 'right');

      await user.click(document.body);

      await waitFor(() => expect(screen.queryByRole('listbox')).toBe(null));
      expect(trigger).not.toHaveAttribute('data-popup-side');
    });

    it('toggles data-list-empty when the filtered list is empty', async () => {
      const { user } = await render(
        <Combobox.Root items={['apple', 'banana']}>
          <Combobox.Input data-testid="input" />
          <Combobox.Trigger data-testid="trigger">Trigger</Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List
                  v-slots={{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const input = screen.getByTestId('input');
      const trigger = screen.getByTestId('trigger');

      await user.click(trigger);

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(trigger).not.toHaveAttribute('data-list-empty');

      await user.type(input, 'zzz');

      expect(trigger).toHaveAttribute('data-list-empty');

      await user.clear(input);

      expect(trigger).not.toHaveAttribute('data-list-empty');
    });

    it('has data-placeholder when no value is selected', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('does not have data-placeholder when value is selected', async () => {
      await render(
        <Combobox.Root defaultValue="a">
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-placeholder');
    });

    it('has data-placeholder when multiple mode has empty array', async () => {
      await render(
        <Combobox.Root multiple defaultValue={[]}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-placeholder');
    });

    it('does not have data-placeholder when multiple mode has a default value', async () => {
      await render(
        <Combobox.Root multiple defaultValue={['a']}>
          <Combobox.Trigger data-testid="trigger">
            <Combobox.Value placeholder="Select" />
          </Combobox.Trigger>
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-placeholder');
    });
  });

  it('BUG-5776: skips a disabled item with typeahead on a closed trigger', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(
      <Combobox.Root onValueChange={onValueChange}>
        <Combobox.Trigger data-testid="trigger">
          <Combobox.Value />
        </Combobox.Trigger>
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <Combobox.Item value="apple" disabled>
                  apple
                </Combobox.Item>
                <Combobox.Item value="apricot">apricot</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );
    const trigger = screen.getByTestId('trigger');

    trigger.focus();
    // The focus mounts the items in a timer of 0 ms, and they register their labels.
    await waitFor(() => {
      expect(screen.getByRole('option', { name: 'apple', hidden: true })).toHaveAttribute(
        'aria-disabled',
        'true',
      );
    });
    await user.keyboard('a');

    expect(onValueChange).toHaveBeenCalledTimes(1);
    expect(onValueChange.mock.lastCall?.[0]).toBe('apricot');
    expect(trigger).toHaveTextContent('apricot');
  });

  describe('BUG-1425: a required combobox with no value after blur', () => {
    it('is invalid when the focus leaves the trigger, with no change before', async () => {
      const { user } = await render(
        <div>
          <Field.Root validationMode="onBlur" data-testid="field">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger" />
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await flushMicrotasks();

      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');

      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-dirty');
    });

    it('is invalid when an outside press closes the popup, with no change before', async () => {
      const { user } = await render(
        <div>
          <Field.Root validationMode="onBlur" data-testid="field">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger" />
              <Combobox.Portal>
                <Combobox.Positioner>
                  <Combobox.Popup>
                    <Combobox.Input data-testid="input" />
                    <Combobox.List>
                      <Combobox.Item value="a">a</Combobox.Item>
                    </Combobox.List>
                  </Combobox.Popup>
                </Combobox.Positioner>
              </Combobox.Portal>
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">Outside</button>
        </div>,
      );
      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(screen.getByTestId('input')).toHaveFocus();
      });
      expect(screen.queryByTestId('error')).toBe(null);

      // The press closes the popup before the focus leaves the input in the popup.
      await user.click(screen.getByRole('button', { name: 'Outside' }));

      await waitFor(() => {
        expect(screen.queryByRole('listbox')).toBe(null);
      });
      expect(screen.getByRole('button', { name: 'Outside' })).toHaveFocus();
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('field')).not.toHaveAttribute('data-dirty');
    });

    it('stays valid when the focus leaves an input outside the popup, with no change before', async () => {
      const { user } = await render(
        <div>
          <Field.Root validationMode="onBlur" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
      const input = screen.getByTestId('input');

      input.focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(input).not.toHaveAttribute('aria-invalid');
    });

    it('stays valid when the focus leaves a trigger beside an input outside the popup', async () => {
      const { user } = await render(
        <div>
          <Field.Root validationMode="onBlur" data-testid="field">
            <Combobox.Root required>
              <Combobox.Input data-testid="input" />
              <Combobox.Trigger data-testid="trigger" />
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );

      screen.getByTestId('trigger').focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('input')).not.toHaveAttribute('aria-invalid');
    });

    it('stays valid when the focus leaves the trigger, with the default validation mode', async () => {
      const { user } = await render(
        <div>
          <Field.Root data-testid="field">
            <Combobox.Root required>
              <Combobox.Trigger data-testid="trigger" />
            </Combobox.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });

    it('stays valid when the focus leaves the trigger of a root with no selection mode', async () => {
      const { user } = await render(
        <div>
          <Field.Root validationMode="onBlur" data-testid="field">
            <Autocomplete.Root required>
              <Combobox.Trigger data-testid="trigger" />
            </Autocomplete.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('KeepAlive', () => {
    it('ignores the release of the opening press while KeepAlive holds the combobox', async () => {
      const active = shallowRef(true);
      const onOpenChange = vi.fn();
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Combobox.Root key="combobox" onOpenChange={onOpenChange}>
              <Combobox.Trigger data-testid="trigger" />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      const trigger = screen.getByTestId('trigger');

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      expect(onOpenChange).toHaveBeenCalledTimes(1);

      active.value = false;
      await flushMicrotasks();
      expect(trigger.isConnected).toBe(false);

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 300, clientY: 300 });
      await wait(20);

      expect(onOpenChange).toHaveBeenCalledTimes(1);

      active.value = true;
      await flushMicrotasks();

      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
    });

    it('stops the timer of the focus while KeepAlive holds the combobox', async () => {
      const active = shallowRef(true);
      let store!: ComboboxStore;
      const StoreProbe = defineComponent(() => {
        store = useComboboxRootContext();
        return () => null;
      });
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Combobox.Root key="combobox">
              <StoreProbe />
              <Combobox.Trigger data-testid="trigger" />
            </Combobox.Root>
          ) : null}
        </KeepAlive>
      ));
      const trigger = screen.getByTestId('trigger');

      // The focus starts a timer of 0 ms that mounts the items.
      trigger.focus();
      active.value = false;
      await flushMicrotasks();
      expect(trigger.isConnected).toBe(false);
      // A timer of 20 ms ends after a timer of 0 ms that started before it.
      await wait(20);

      expect(store.select('forceMounted')).toBe(false);

      active.value = true;
      await flushMicrotasks();
      screen.getByTestId('trigger').focus();

      await waitFor(() => {
        expect(store.select('forceMounted')).toBe(true);
      });
    });
  });

  // The compiled template of the fixture mounts the new trigger before it unmounts the old
  // trigger. A render function in TSX reuses the trigger component, so it does not show this
  // order.
  it('keeps the element of the new trigger in the store when a template replaces the trigger', async () => {
    let store!: ComboboxStore;
    const { setProps } = await render(
      <ComboboxTriggerReplacement first onStore={(value: ComboboxStore) => (store = value)} />,
    );
    expect(store.select('triggerElement')).toBe(screen.getByTestId('first'));

    await setProps({ first: false });

    expect(store.select('triggerElement')).toBe(screen.getByTestId('second'));
  });

  describe('labels', () => {
    it('is named by Combobox.Label that comes after it', async () => {
      await render(
        <Combobox.Root>
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Label data-testid="label">Fruit</Combobox.Label>
        </Combobox.Root>,
      );

      const labelId = screen.getByTestId('label').id;
      expect(labelId).not.toBe('');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', labelId);
    });
  });
});
