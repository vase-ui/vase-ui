import { expect, vi, describe, it } from 'vitest';
import { KeepAlive, defineComponent, onMounted, shallowRef } from 'vue';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import {
  clientCenter,
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isInaccessible,
  isJSDOM,
  pressWithScreenReader,
  removedPartHydrationTests,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useComboboxRootContext } from '../root/ComboboxRootContext';
import type { ComboboxStore } from '../store';
import ComboboxTriggerLabelHydration from './ComboboxTriggerLabelHydration.test.vue';
import ComboboxTriggerOpenHydration from './ComboboxTriggerOpenHydration.test.vue';
import ComboboxTriggerReplacement from './ComboboxTriggerReplacement.test.vue';

const HYDRATION_FIXTURE = 'src/combobox/trigger/ComboboxTriggerOpenHydration.test.vue';

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
      await waitSingleFrame();
      await flushMicrotasks();

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
      control: () => (
        <Combobox.Root defaultValue="apple">
          <Combobox.Trigger data-testid="trigger" />
        </Combobox.Root>
      ),
      expectedValue: 'apple',
    },
    {
      name: 'no selection',
      control: () => (
        <Autocomplete.Root defaultValue="query">
          <Autocomplete.Trigger data-testid="trigger" />
        </Autocomplete.Root>
      ),
      expectedValue: 'query',
    },
  ])('validates the $name value when blurred', async ({ control, expectedValue }) => {
    const validate = vi.fn();
    await render(
      <Field.Root validationMode="blur" validate={validate}>
        {control()}
      </Field.Root>,
    );

    const trigger = screen.getByTestId('trigger');
    await fireEvent.focusIn(trigger);
    await fireEvent.focusOut(trigger);
    await wait(0);

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
      const listbox = await screen.findByRole('listbox');
      expect(listbox).not.toBe(null);

      await user.click(trigger);
      await waitFor(() => {
        expect(isInaccessible(listbox)).toBe(true);
      });
      expect(screen.queryByRole('listbox')).toBe(null);
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
      const listbox = await screen.findByRole('listbox');
      expect(listbox).not.toBe(null);

      await user.click(screen.getByTestId('trigger'));
      await waitFor(() => {
        expect(isInaccessible(listbox)).toBe(true);
      });
      expect(screen.queryByRole('listbox')).toBe(null);
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
        <Combobox.Root items={['alpha', 'beta']}>
          <Combobox.Trigger>Open</Combobox.Trigger>
          <Combobox.Input as="textarea" aria-label="notes" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List>
                  {{
                    item: ({ item }: ItemSlotProps) => (
                      <Combobox.Item key={item} value={item}>
                        {item}
                      </Combobox.Item>
                    ),
                  }}
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );

      // A press of the trigger opens the popup. The keys thus go to the textarea while the popup
      // is closed.
      screen.getByRole('textbox', { name: 'notes' }).focus();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.keyboard('{ArrowDown}');
      await waitSingleFrame();
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);

      await user.keyboard('{ArrowUp}');
      await waitSingleFrame();
      await flushMicrotasks();
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
      const option = await waitForLaterMillisecond(async () => {
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
        await screen.findByRole('listbox');
        return screen.findByRole('option', { name: 'Beta' });
      });

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
      const option = await waitForLaterMillisecond(async () => {
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
        await screen.findByRole('listbox');
        return screen.findByRole('option', { name: 'Beta' });
      });

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
        const alpha = await waitForLaterMillisecond(async () => {
          await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
          await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
          await screen.findByRole('listbox');
          return screen.findByRole('option', { name: 'Alpha' });
        });
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
        const alpha = await waitForLaterMillisecond(async () => {
          await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
          await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
          await screen.findByRole('listbox');
          return screen.findByRole('option', { name: 'Alpha' });
        });
        await fireEvent.pointerDown(alpha, { pointerType: 'touch', isPrimary: true, button: 0 });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('listbox')).toBe(null);

        // Reopen and drag-select onto Alpha (gesture starts on the trigger).
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
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
      const option = await waitForLaterMillisecond(async () => {
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0, ...clientCenter(trigger) });
        await screen.findByRole('listbox');
        return screen.findByRole('option', { name: 'Beta' });
      });

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

      expect(screen.queryByRole('listbox')).toBe(null);
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

    it('keeps the popup open for a release up to 5px off the trigger, away from the point of the press', async () => {
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
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0, clientX: 110, clientY: 120 });
      await screen.findByRole('listbox');

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 205, clientY: 120 });

      expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
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

      expect(screen.queryByRole('listbox')).toBe(null);
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

    describe('VUE-73: aria-controls names only an element that exists', () => {
      it('has no aria-controls while the popup has an empty id', async () => {
        await render(
          <Combobox.Root defaultOpen>
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup
                  data-testid="popup"
                  v-slots={{
                    // An empty `id` of the part counts as no `id` (VUE-93). Only the `#render`
                    // slot can give the element an empty `id`.
                    render: ({ props }: { props: HTMLProps }) => (
                      <div {...props} id="">
                        <Combobox.Input />
                      </div>
                    ),
                  }}
                />
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );
        await flushMicrotasks();

        const trigger = screen.getByTestId('trigger');
        expect(screen.getByTestId('popup').id).toBe('');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).not.toHaveAttribute('aria-controls');
      });

      it('follows the id of the popup element', async () => {
        const id = shallowRef<string | undefined>(undefined);
        await render(() => (
          <Combobox.Root defaultOpen>
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup
                  v-slots={{
                    render: ({ props }: { props: HTMLProps }) => (
                      <div {...props} id={id.value} data-testid="popup">
                        <Combobox.Input />
                      </div>
                    ),
                  }}
                />
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));
        await flushMicrotasks();

        const trigger = screen.getByTestId('trigger');
        expect(trigger).not.toHaveAttribute('aria-controls');

        id.value = 'fruits';
        await flushMicrotasks();

        expect(screen.getByTestId('popup').id).toBe('fruits');
        expect(trigger).toHaveAttribute('aria-controls', 'fruits');

        id.value = undefined;
        await flushMicrotasks();

        expect(screen.getByTestId('popup').id).toBe('');
        expect(trigger).not.toHaveAttribute('aria-controls');
      });

      it('has no aria-controls while no popup is mounted', async () => {
        await render(
          <Combobox.Root defaultOpen>
            <Combobox.Trigger data-testid="trigger" />
          </Combobox.Root>,
        );
        await flushMicrotasks();

        const trigger = screen.getByTestId('trigger');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
        expect(trigger).not.toHaveAttribute('aria-controls');
      });

      it('has no aria-controls while the list element has no id', async () => {
        await render(
          <Combobox.Root defaultOpen>
            <Combobox.Input />
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup>
                  <Combobox.List
                    v-slots={{
                      render: ({ props }: { props: HTMLProps }) => (
                        <div {...props} id={undefined} data-testid="list" />
                      ),
                    }}
                  />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>,
        );
        await flushMicrotasks();

        const trigger = screen.getByTestId('trigger');
        expect(screen.getByTestId('list').id).toBe('');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).toHaveAttribute('aria-haspopup', 'listbox');
        expect(trigger).not.toHaveAttribute('aria-controls');
      });

      it('names the popup after the hydration of an open root', async () => {
        const serverHtml = await renderOnServer(HYDRATION_FIXTURE);
        const server = document.createElement('template');
        server.innerHTML = serverHtml;
        const serverTrigger = server.content.querySelector('[data-testid="trigger"]');
        expect(serverTrigger?.getAttribute('aria-expanded')).toBe('true');
        expect(serverTrigger?.hasAttribute('aria-controls')).toBe(false);

        await hydrate(ComboboxTriggerOpenHydration, { serverHtml });

        const popup = await screen.findByTestId('popup');
        await flushMicrotasks();

        expect(popup.id).not.toBe('');
        expect(screen.getByTestId('trigger')).toHaveAttribute('aria-controls', popup.id);
      });

      it('has no aria-controls while KeepAlive holds the popup', async () => {
        const Popup = defineComponent({
          setup: () => () => (
            <Combobox.Portal>
              <Combobox.Positioner>
                <Combobox.Popup data-testid="popup">
                  <Combobox.Input />
                </Combobox.Popup>
              </Combobox.Positioner>
            </Combobox.Portal>
          ),
        });
        const Other = defineComponent({ setup: () => () => <span /> });
        const visible = shallowRef(true);
        await render(() => (
          <Combobox.Root defaultOpen>
            <Combobox.Trigger data-testid="trigger" />
            <KeepAlive>{visible.value ? <Popup key="popup" /> : <Other key="other" />}</KeepAlive>
          </Combobox.Root>
        ));
        await flushMicrotasks();
        const trigger = screen.getByTestId('trigger');
        const popup = screen.getByTestId('popup');
        expect(popup.id).not.toBe('');
        expect(trigger).toHaveAttribute('aria-controls', popup.id);

        visible.value = false;
        await flushMicrotasks();

        expect(popup.isConnected).toBe(false);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).not.toHaveAttribute('aria-controls');

        visible.value = true;
        await flushMicrotasks();

        expect(popup.isConnected).toBe(true);
        expect(trigger).toHaveAttribute('aria-controls', popup.id);
      });

      it('has no aria-controls while the popup mounts in a branch that KeepAlive holds', async () => {
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
          () => (
            <Combobox.Popup data-testid="popup">
              <Combobox.Input />
            </Combobox.Popup>
          ),
          { renderBranch: (part) => part },
        );
        await render(() => (
          <Combobox.Root defaultOpen>
            <Combobox.Trigger data-testid="trigger" />
            <Combobox.Portal>
              <Combobox.Positioner>
                <HeldBranch />
              </Combobox.Positioner>
            </Combobox.Portal>
          </Combobox.Root>
        ));

        await mountWhileHeld();

        const trigger = screen.getByTestId('trigger');
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger).not.toHaveAttribute('aria-controls');

        await show();

        const popup = screen.getByTestId('popup');
        expect(popup.id).not.toBe('');
        expect(trigger).toHaveAttribute('aria-controls', popup.id);
      });
    });

    it('VUE-77: follows the id of the list beside the input', async () => {
      const id = shallowRef('first');
      await render(() => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Trigger data-testid="trigger" />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.List id={id.value} data-testid="list" />
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-controls', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('list').id).toBe('second');
      expect(trigger).toHaveAttribute('aria-controls', 'second');
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
        expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('listbox')).toBe(null);
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
      expect(screen.queryByRole('option', { name: 'Banana' })).toBe(null);
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).toBe(null);

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

      await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      expect(trigger).toHaveAttribute('data-popup-side', 'right');

      await user.click(document.body);

      expect(screen.queryByRole('listbox')).toBe(null);
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

  it('does not mount the popup after focus on a disabled custom trigger', async () => {
    const disabled = shallowRef(true);
    const onMount = vi.fn();
    const Content = defineComponent(() => {
      onMounted(onMount);
      return () => <span>Popup content</span>;
    });
    await render(() => (
      <Combobox.Root>
        <Combobox.Trigger as="div" nativeButton={false} disabled={disabled.value}>
          Trigger
        </Combobox.Trigger>
        <Combobox.Portal>
          <Content />
        </Combobox.Portal>
      </Combobox.Root>
    ));
    const trigger = screen.getByRole('combobox');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');

    trigger.focus();
    expect(trigger).toHaveFocus();
    // An enabled trigger mounts the popup content in a 0 ms timer after its focus.
    await wait(0);
    expect(onMount).not.toHaveBeenCalled();

    disabled.value = false;
    await flushMicrotasks();
    trigger.blur();
    await wait(0);
    trigger.focus();

    await waitFor(() => expect(onMount).toHaveBeenCalledOnce());
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

  describe('hydration', () => {
    removedPartHydrationTests({
      file: 'src/combobox/trigger/ComboboxTriggerLabelHydration.test.vue',
      component: ComboboxTriggerLabelHydration,
      cases: [
        {
          name: 'a removed label part',
          props: { label: 'after', laterRemovedAtMount: true },
          selector: '[data-testid="trigger"]',
          attribute: 'aria-labelledby',
          serverValue: 'fruit-label',
          clientValue: null,
        },
        {
          name: 'a removed field label',
          props: { field: true, laterRemovedAtMount: true },
          selector: '[data-testid="trigger"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: null,
        },
        {
          name: 'a removed description',
          props: { field: true, laterRemovedAtMount: true },
          selector: '[data-testid="trigger"]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
        {
          name: 'a label part and a removed field label',
          props: { label: 'before', field: true, laterRemovedAtMount: true },
          selector: '[data-testid="trigger"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: { idOf: '[data-testid="label"]' },
        },
      ],
    });
  });
});
