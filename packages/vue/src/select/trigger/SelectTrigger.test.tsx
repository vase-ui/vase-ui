import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, defineComponent, nextTick, onMounted, shallowRef } from 'vue';
import { Field } from '@vase-ui/vue/field';
import { Select } from '@vase-ui/vue/select';
import type { HTMLProps } from '../../internals/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  removedPartHydrationTests,
  screen,
  takeReportedMessages,
  isJSDOM,
  wait,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import type { SelectStore } from '../store';
import SelectRootHydration from '../root/SelectRootHydration.test.vue';
import SelectTriggerReplacement from './SelectTriggerReplacement.test.vue';

describe('<Select.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  it.skipIf(isJSDOM)(
    'closes an aligned popup when focus lands on the trigger so it is not obscured',
    async () => {
      const onOpenChange = vi.fn();

      await render(
        <div style={{ paddingTop: '200px', minHeight: '600px' }}>
          <Select.Root defaultOpen defaultValue="a" onOpenChange={onOpenChange}>
            <Select.Trigger data-testid="trigger">
              <Select.Value />
            </Select.Trigger>
            <Select.Portal>
              <Select.Positioner data-testid="positioner" alignItemWithTrigger>
                <Select.Popup>
                  <Select.Item value="a">a</Select.Item>
                  <Select.Item value="b">b</Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        </div>,
      );

      const trigger = screen.getByTestId('trigger');

      // `data-side="none"` proves the popup is still item-aligned over the trigger.
      await waitFor(() => {
        expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
      });

      await fireEvent.focusIn(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      expect(onOpenChange).toHaveBeenCalledWith(false, expect.objectContaining({ reason: 'none' }));
    },
  );

  it('keeps a non-aligned popup open when focus lands on the trigger', async () => {
    const onOpenChange = vi.fn();

    await render(
      <Select.Root defaultOpen onOpenChange={onOpenChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner alignItemWithTrigger={false}>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );

    const trigger = screen.getByTestId('trigger');

    await fireEvent.focusIn(trigger);

    await waitFor(() => {
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    expect(onOpenChange).not.toHaveBeenCalled();
  });

  it('mounts the items of a closed select when it gets the focus', async () => {
    await render(
      <Select.Root>
        <Select.Trigger data-testid="trigger" />
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">a</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>,
    );
    expect(document.querySelector('[role="option"]')).toBe(null);

    screen.getByTestId('trigger').focus();

    await waitFor(() => {
      expect(document.querySelector('[role="option"]')).not.toBe(null);
    });
    expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'false');
  });

  describe('releasing the opening press', () => {
    async function pressTrigger(
      options: {
        container?: ShadowRoot;
        onOpenChange?: (open: boolean, details: Select.Root.OpenChangeEventDetails) => void;
        release?: boolean;
      } = {},
    ) {
      await render(
        <Select.Root onOpenChange={options.onOpenChange}>
          <Select.Trigger data-testid="trigger">
            <Select.Value />
          </Select.Trigger>
          <Select.Portal to={options.container}>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      await waitForLaterMillisecond(async () => {
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0 });
        if (options.release) {
          await fireEvent.mouseUp(trigger, { button: 0, clientX: 150, clientY: 120 });
        }
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });
      });
      return trigger;
    }

    it('ignores a later release when the opening press was released immediately', async () => {
      const onOpenChange = vi.fn();
      const trigger = await pressTrigger({ onOpenChange, release: true });
      await wait(20);
      onOpenChange.mockClear();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      // e.g. a press that started inside the popup and was dragged off it
      await fireEvent.mouseUp(document.body, { button: 0, clientX: 10, clientY: 10 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('keeps the popup open when the press slips up to 5px off the trigger', async () => {
      const trigger = await pressTrigger();

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 96, clientY: 120 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes the popup when the press is dragged off the trigger and released', async () => {
      const trigger = await pressTrigger();

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 94, clientY: 120 });

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
    });

    it.each([
      {
        name: '8px right and down of a moved trigger',
        pressX: 150,
        moves: true,
        dx: 8,
        dy: 8,
        open: true,
      },
      { name: '9px right of a moved trigger', pressX: 150, moves: true, dx: 9, dy: 0, open: false },
      { name: '9px down of a moved trigger', pressX: 150, moves: true, dx: 0, dy: 9, open: false },
      // The press is 2 px from the right edge of the trigger, and the margin of the trigger is 5 px.
      {
        name: '8px right, 6px off a still trigger',
        pressX: 198,
        moves: false,
        dx: 8,
        dy: 0,
        open: true,
      },
      {
        name: '9px right, 7px off a still trigger',
        pressX: 198,
        moves: false,
        dx: 9,
        dy: 0,
        open: false,
      },
    ])('VUE-68: a release $name', async ({ pressX, moves, dx, dy, open }) => {
      const onOpenChange = vi.fn();
      await render(
        <Select.Root onOpenChange={onOpenChange}>
          <Select.Trigger data-testid="trigger">Fruit</Select.Trigger>
          <Select.Portal>
            <Select.Positioner alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      await waitForLaterMillisecond(async () => {
        await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
        await fireEvent.mouseDown(trigger, { button: 0, clientX: pressX, clientY: 120 });
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });
      });
      if (moves) {
        trigger.getBoundingClientRect = () =>
          DOMRect.fromRect({ x: 100, y: 300, width: 100, height: 40 });
      }
      await fireEvent.mouseUp(document.body, {
        button: 0,
        clientX: pressX + dx,
        clientY: 120 + dy,
      });

      expect(trigger).toHaveAttribute('aria-expanded', String(open));
      expect(onOpenChange).toHaveBeenCalledTimes(open ? 1 : 2);
    });

    it('keeps the popup open when the press is released inside a popup in a shadow root', async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });

      try {
        const trigger = await pressTrigger({ container: shadowRoot });
        await flushMicrotasks();
        const popup = shadowRoot.querySelector('[role="listbox"]');
        expect(popup).not.toBe(null);

        await fireEvent.mouseUp(popup!, { button: 0, clientX: 500, clientY: 500 });
        await wait(20);

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      } finally {
        host.remove();
      }
    });
  });

  describe('disabled state', () => {
    it('is removed from the tab order when disabled and not rendered as a button', async () => {
      await render(
        <Select.Root disabled>
          <Select.Trigger data-testid="trigger" nativeButton={false} as="div">
            <Select.Value />
          </Select.Trigger>
        </Select.Root>,
      );

      expect(screen.getByTestId('trigger')).toHaveAttribute('tabindex', '-1');
    });

    it('cannot be focused when disabled', async () => {
      const { user } = await render(
        <Select.Root defaultValue="b">
          <Select.Trigger data-testid="trigger" disabled>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('data-disabled');

      await user.keyboard('[Tab]');

      expect(trigger).not.toHaveFocus();
    });

    it('does not toggle the popup when disabled', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Select.Root defaultValue="b" onOpenChange={handleOpenChange}>
          <Select.Trigger data-testid="trigger" disabled>
            <Select.Value />
          </Select.Trigger>
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
                <Select.Item value="b">b</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByRole('listbox')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
    });
  });

  describe('placeholder state', () => {
    it('should have the data-placeholder attribute when provided `null` value', async () => {
      await render(
        <Select.Root modelValue={null}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>

          <Select.Portal>
            <Select.Positioner>
              <Select.Popup>
                <Select.Item value="a">a</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
    });

    it('should have the data-placeholder attribute when provided custom property with `itemToStringValue`', async () => {
      const shippingMethods = [
        { id: '', name: 'Default' },
        { id: 'standard', name: 'Standard' },
        { id: 'express', name: 'Express' },
        { id: 'overnight', name: 'Overnight' },
      ];

      await render(
        <Select.Root
          defaultValue={shippingMethods[0]}
          itemToStringValue={(item) => item.id}
          itemToStringLabel={(item) => item.name}
        >
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Default');
    });

    it('should have the data-placeholder attribute when provided { value: null }', async () => {
      const fonts = [{ label: 'Select font', value: null }];

      await render(
        <Select.Root items={fonts}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).toHaveAttribute('data-placeholder');
      expect(value).toHaveAttribute('data-placeholder');
      expect(value.textContent).toBe('Select font');
    });

    it('should not have the data-placeholder attribute when provided a value', async () => {
      await render(
        <Select.Root defaultValue="a">
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });

    it('should not have the data-placeholder attribute when multiple mode has a default value', async () => {
      await render(
        <Select.Root multiple defaultValue={['a']}>
          <Select.Trigger data-testid="trigger">
            <Select.Value data-testid="value" />
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      const value = screen.getByTestId('value');

      expect(trigger).not.toHaveAttribute('data-placeholder');
      expect(value).not.toHaveAttribute('data-placeholder');
    });
  });

  describe('style hooks', () => {
    it.skipIf(isJSDOM)('sets data-popup-side to the current popup side', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger">Trigger</Select.Trigger>
          <Select.Portal>
            <Select.Positioner side="right" alignItemWithTrigger={false}>
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-popup-side');

      await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        await waitFor(() => expect(screen.getByRole('listbox')).not.toBe(null));
      });
      await waitFor(() => expect(trigger).toHaveAttribute('data-popup-side', 'right'));

      await user.click(document.body);

      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(trigger).not.toHaveAttribute('data-popup-side');
    });

    it.skipIf(isJSDOM)(
      'sets data-popup-side to the resolved side when alignItemWithTrigger is active',
      async () => {
        const { user } = await render(
          <div style={{ paddingTop: '100px', paddingLeft: '10px' }}>
            <Select.Root defaultValue="apple">
              <Select.Trigger data-testid="trigger" style={{ width: '120px', height: '36px' }}>
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner data-testid="positioner">
                  <Select.Popup style={{ maxHeight: 'none' }}>
                    <Select.Item value="apple">apple</Select.Item>
                    <Select.Item value="orange">orange</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          </div>,
        );

        const trigger = screen.getByTestId('trigger');

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByTestId('positioner')).toHaveAttribute('data-side', 'none');
        });
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-side', 'bottom');
        });
      },
    );

    it('should have the data-popup-open and data-pressed attributes when open', async () => {
      const { user } = await render(
        <Select.Root>
          <Select.Trigger />
        </Select.Root>,
      );

      const trigger = screen.getByRole('combobox');

      await user.click(trigger);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-popup-open');
      });
      expect(trigger).toHaveAttribute('data-pressed');
    });
  });

  describe('prop: required', () => {
    it('sets aria-required attribute when required', async () => {
      await render(
        <Select.Root required>
          <Select.Trigger data-testid="trigger" />
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-required', 'true');
    });
  });

  describe('the release of the opening press', () => {
    async function pressTrigger(onOpenChange?: (open: boolean, details: any) => void) {
      await render(
        <Select.Root onOpenChange={onOpenChange}>
          <Select.Trigger data-testid="trigger">
            <span data-testid="text">Font</span>
          </Select.Trigger>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      trigger.getBoundingClientRect = () =>
        DOMRect.fromRect({ x: 100, y: 100, width: 100, height: 40 });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      return trigger;
    }

    it('closes the popup with the reason cancel-open when the press is released more than 5px off the trigger', async () => {
      const onOpenChange = vi.fn();
      const trigger = await pressTrigger(onOpenChange);

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 94, clientY: 120 });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('cancel-open');
    });

    it('keeps the popup open when the press is released on the content of the trigger', async () => {
      const trigger = await pressTrigger();

      await fireEvent.mouseUp(screen.getByTestId('text'), { button: 0, clientX: 10, clientY: 120 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('VUE-5: KeepAlive', () => {
    it('does not mount the popup after KeepAlive deactivates a focused trigger', async () => {
      const active = shallowRef(true);
      const onMount = vi.fn();
      const Content = defineComponent(() => {
        onMounted(onMount);
        return () => <span>Popup content</span>;
      });
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Select.Root key="select">
              <Select.Trigger data-testid="trigger" />
              <Select.Portal>
                <Content />
              </Select.Portal>
            </Select.Root>
          ) : null}
        </KeepAlive>
      ));
      const trigger = screen.getByTestId('trigger');
      expect(onMount).not.toHaveBeenCalled();

      trigger.focus();
      active.value = false;
      await nextTick();
      expect(trigger).not.toBeInTheDocument();
      // A shown trigger mounts the popup content in a 0 ms timer after its focus.
      await wait(0);
      expect(onMount).not.toHaveBeenCalled();

      active.value = true;
      await flushMicrotasks();
      trigger.focus();

      await waitFor(() => expect(onMount).toHaveBeenCalledOnce());
    });

    it('VUE-5: ignores the release of the opening press while KeepAlive holds the select', async () => {
      const active = shallowRef(true);
      const onOpenChange = vi.fn();
      await render(() => (
        <KeepAlive>
          {active.value ? (
            <Select.Root key="select" onOpenChange={onOpenChange}>
              <Select.Trigger data-testid="trigger" />
            </Select.Root>
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

    it.each([
      { name: 'mounted open', initialOpen: true },
      { name: 'opened while held', initialOpen: false },
    ])('VUE-5: starts the mouseup guard at activation: $name', async ({ initialOpen }) => {
      vi.useFakeTimers();
      try {
        const open = shallowRef(initialOpen);
        const onValueChange = vi.fn();
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
          <Select.Root open={open.value} onValueChange={onValueChange}>
            <Select.Trigger data-testid="trigger" />
            <Select.Portal>
              <Select.Positioner>
                <Select.Popup>
                  <Select.Item value="one">One</Select.Item>
                  <Select.Item value="two" data-testid="two">
                    Two
                  </Select.Item>
                </Select.Popup>
              </Select.Positioner>
            </Select.Portal>
          </Select.Root>
        ));
        await render(<HeldBranch />);
        await mountWhileHeld();
        open.value = true;
        await flushMicrotasks();
        await vi.advanceTimersByTimeAsync(450);
        expect(onValueChange).not.toHaveBeenCalled();

        await show();
        await fireEvent.mouseUp(screen.getByTestId('two'), { button: 0 });
        expect(onValueChange).not.toHaveBeenCalled();

        await vi.advanceTimersByTimeAsync(450);
        await fireEvent.mouseUp(screen.getByTestId('two'), { button: 0 });
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange.mock.lastCall?.[0]).toBe('two');
      } finally {
        vi.useRealTimers();
      }
    });
  });

  // The compiled template of the fixture mounts the new trigger before it unmounts the old
  // trigger. A render function in TSX reuses the trigger component, so it does not show this
  // order.
  it('keeps the element of the new trigger in the store when a template replaces the trigger', async () => {
    let store!: SelectStore;
    const { setProps } = await render(
      <SelectTriggerReplacement first onStore={(value: SelectStore) => (store = value)} />,
    );
    expect(store.select('triggerElement')).toBe(screen.getByTestId('first'));

    await setProps({ first: false });

    expect(store.select('triggerElement')).toBe(screen.getByTestId('second'));
  });

  describe('Field', () => {
    it('marks the field as touched and validates it when the trigger loses the focus', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root data-testid="field" validate={validate} validationMode="blur">
          <Select.Root defaultValue="sans">
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await flushMicrotasks();
      expect(field).not.toHaveAttribute('data-touched');

      trigger.blur();
      await flushMicrotasks();

      expect(field).toHaveAttribute('data-touched', '');
      // The field validates after the blur listeners of the developer.
      await waitFor(() => expect(validate).toHaveBeenCalledTimes(1));
      expect(validate.mock.lastCall?.[0]).toBe('sans');
    });
  });

  describe('BUG-1425: a required select with no value after blur', () => {
    function renderSelect(validationMode?: 'blur') {
      return render(
        <div>
          <Field.Root validationMode={validationMode} data-testid="field">
            <Select.Root required>
              <Select.Trigger data-testid="trigger" />
            </Select.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
    }

    it('stays valid when the focus leaves the trigger, with the default validation mode', async () => {
      const { user } = await renderSelect();
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('field')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
      expect(trigger).not.toHaveAttribute('aria-invalid');
    });
  });

  describe('labels', () => {
    it('is named by Select.Label that comes after it', async () => {
      await render(
        <Select.Root>
          <Select.Trigger data-testid="trigger" />
          <Select.Label data-testid="label">Font</Select.Label>
        </Select.Root>,
      );

      const labelId = screen.getByTestId('label').id;
      expect(labelId).not.toBe('');
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-labelledby', labelId);
    });
  });

  describe('VUE-73: aria-controls names only an element in the document', () => {
    // An empty `id` of the part counts as no `id` (VUE-93). Only the `#render` slot can give the
    // element an empty `id`.
    const emptyIdSlot = {
      render: ({ props }: { props: HTMLProps }) => (
        <div {...props} id="">
          <Select.Item value="a">A</Select.Item>
        </div>
      ),
    };

    it.each([
      {
        name: 'popup',
        parts: () => <Select.Popup data-testid="named" v-slots={emptyIdSlot} />,
      },
      {
        name: 'list',
        parts: () => (
          <Select.Popup>
            <Select.List data-testid="named" v-slots={emptyIdSlot} />
          </Select.Popup>
        ),
      },
    ])('has no aria-controls while the $name has an empty id', async ({ parts }) => {
      await render(
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>{parts()}</Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(screen.getByTestId('named').id).toBe('');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('follows the id of the popup element', async () => {
      const id = shallowRef('first');
      await render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup id={id.value} data-testid="popup">
                <Select.Item value="a">A</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-controls', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('popup').id).toBe('second');
      expect(trigger).toHaveAttribute('aria-controls', 'second');
    });

    it.each([
      {
        name: 'popup',
        parts: () => (
          <Select.Popup data-testid="named">
            <Select.Item value="a">A</Select.Item>
          </Select.Popup>
        ),
      },
      {
        name: 'popup with a list',
        parts: () => (
          <Select.Popup>
            <Select.List data-testid="named">
              <Select.Item value="a">A</Select.Item>
            </Select.List>
          </Select.Popup>
        ),
      },
    ])('has no aria-controls while KeepAlive holds the $name', async ({ parts }) => {
      const Popup = defineComponent({
        setup: () => () => (
          <Select.Portal>
            <Select.Positioner>{parts()}</Select.Positioner>
          </Select.Portal>
        ),
      });
      const Other = defineComponent({ setup: () => () => <span /> });
      const visible = shallowRef(true);
      await render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <KeepAlive>{visible.value ? <Popup key="popup" /> : <Other key="other" />}</KeepAlive>
        </Select.Root>
      ));
      await flushMicrotasks();
      const trigger = screen.getByTestId('trigger');
      const named = screen.getByTestId('named');
      expect(named.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', named.id);

      visible.value = false;
      await flushMicrotasks();

      expect(named.isConnected).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');

      visible.value = true;
      await flushMicrotasks();

      expect(named.isConnected).toBe(true);
      expect(trigger).toHaveAttribute('aria-controls', named.id);
    });

    it('has no aria-controls while the popup mounts in a branch that KeepAlive holds', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => (
          <Select.Popup data-testid="popup">
            <Select.Item value="a">A</Select.Item>
          </Select.Popup>
        ),
        { renderBranch: (part) => part },
      );
      await render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <HeldBranch />
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
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

    it('names the popup while the list mounts in a branch that KeepAlive holds', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => (
          <Select.List data-testid="list">
            <Select.Item value="a">A</Select.Item>
          </Select.List>
        ),
        { renderBranch: (part) => part },
      );
      await render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup data-testid="popup">
                <HeldBranch />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));

      await mountWhileHeld();

      const trigger = screen.getByTestId('trigger');
      const popup = screen.getByTestId('popup');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);

      await show();

      const list = screen.getByTestId('list');
      expect(list.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', list.id);
    });
  });

  describe('VUE-86: aria-controls follows the id of the list', () => {
    it('follows the id of the list while the popup is open', async () => {
      const id = shallowRef('first');
      // The popup has an id too, so a trigger that names the popup in place of a list with an empty
      // `id` fails the case.
      await render(() => (
        <Select.Root defaultOpen>
          <Select.Trigger data-testid="trigger" />
          <Select.Portal>
            <Select.Positioner>
              <Select.Popup id="popup">
                <Select.List
                  data-testid="list"
                  v-slots={{
                    // An empty `id` of the part counts as no `id` (VUE-93). Only the `#render`
                    // slot can give the element an empty `id`.
                    render: ({ props }: { props: HTMLProps }) => (
                      <div {...props} id={id.value}>
                        <Select.Item value="a">A</Select.Item>
                      </div>
                    ),
                  }}
                />
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>
      ));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-controls', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('list').id).toBe('second');
      expect(trigger).toHaveAttribute('aria-controls', 'second');

      id.value = '';
      await flushMicrotasks();

      expect(screen.getByTestId('list').id).toBe('');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });
  });

  it('throws a descriptive error when rendered outside <Select.Root>', async () => {
    await expect(render(<Select.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Select must be inside <Select.Root>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });

  describe('hydration', () => {
    removedPartHydrationTests({
      file: 'src/select/root/SelectRootHydration.test.vue',
      component: SelectRootHydration,
      cases: [
        {
          name: 'a removed label part',
          props: { id: 'font', label: 'after', laterRemovedAtMount: true },
          selector: '[role="combobox"]',
          attribute: 'aria-labelledby',
          serverValue: 'font-label',
          clientValue: null,
        },
        {
          name: 'a removed field label',
          props: { field: true, laterRemovedAtMount: true },
          selector: '[role="combobox"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: null,
        },
        {
          name: 'a removed description',
          props: { field: true, laterRemovedAtMount: true },
          selector: '[role="combobox"]',
          attribute: 'aria-describedby',
          serverValue: 'desc-a',
          clientValue: null,
        },
        {
          name: 'a label part and a removed field label',
          props: { label: 'before', field: true, laterRemovedAtMount: true },
          selector: '[role="combobox"]',
          attribute: 'aria-labelledby',
          serverValue: 'label-a',
          clientValue: { idOf: '[data-testid="label"]' },
        },
      ],
    });
  });
});
