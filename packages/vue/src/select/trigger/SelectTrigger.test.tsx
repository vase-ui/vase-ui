import { describe, expect, it, vi } from 'vitest';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  isJSDOM,
  wait,
  waitFor,
} from '#test-utils';
import * as Select from '../index.parts';

describe('<Select.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<Select.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    button: true,
    render(node) {
      return render(<Select.Root open>{node}</Select.Root>);
    },
  }));

  it('keeps a non-aligned popup open when focus lands on the trigger', async () => {
    const onOpenChange = vi.fn();

    await render(
      <Select.Root defaultOpen onOpenChange={onOpenChange}>
        <Select.Trigger data-testid="trigger">
          <Select.Value />
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
          <Select.Portal container={options.container}>
            <Select.Positioner>
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

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(trigger, { button: 0 });
      if (options.release) {
        await fireEvent.mouseUp(trigger, { button: 0, clientX: 150, clientY: 120 });
      }
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
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
        <Select.Root value={null}>
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
            <Select.Positioner side="right">
              <Select.Popup>
                <Select.Item value="apple">apple</Select.Item>
              </Select.Popup>
            </Select.Positioner>
          </Select.Portal>
        </Select.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      expect(trigger).not.toHaveAttribute('data-popup-side');

      await user.click(trigger);

      await waitFor(() => expect(screen.queryByRole('listbox')).not.toBe(null));
      await waitFor(() => expect(trigger).toHaveAttribute('data-popup-side', 'right'));

      await user.click(document.body);

      await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
      await flushMicrotasks();
      expect(screen.queryByRole('listbox')).toBe(null);
      expect(trigger).not.toHaveAttribute('data-popup-side');
    });

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

  describe('Field', () => {
    it('sets the focused state of the field, and marks it as touched and validates it on blur', async () => {
      const validate = vi.fn((_value: unknown) => null);
      await render(
        <Field.Root data-testid="field" validate={validate} validationMode="onBlur">
          <Select.Root defaultValue="sans">
            <Select.Trigger data-testid="trigger" />
          </Select.Root>
        </Field.Root>,
      );
      const field = screen.getByTestId('field');
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await flushMicrotasks();

      expect(field).toHaveAttribute('data-focused', '');
      expect(field).not.toHaveAttribute('data-touched');

      trigger.blur();
      await flushMicrotasks();

      expect(field).not.toHaveAttribute('data-focused');
      expect(field).toHaveAttribute('data-touched', '');
      expect(validate).toHaveBeenCalledTimes(1);
      expect(validate.mock.lastCall?.[0]).toBe('sans');
    });
  });

  describe('BUG-1425: a required select with no value after blur', () => {
    function renderSelect(validationMode?: 'onBlur' | 'onSubmit') {
      return render(
        <div>
          <Field.Root validationMode={validationMode} data-testid="root">
            <Select.Root required>
              <Select.Trigger data-testid="trigger">
                <Select.Value />
              </Select.Trigger>
              <Select.Portal>
                <Select.Positioner>
                  <Select.Popup>
                    <Select.Item value="a">a</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
            <Field.Error match="valueMissing" data-testid="error">
              required
            </Field.Error>
          </Field.Root>
          <button type="button">After</button>
        </div>,
      );
    }

    it('is invalid when the focus leaves the trigger, with no change before', async () => {
      const { user } = await renderSelect('onBlur');
      const trigger = screen.getByTestId('trigger');

      trigger.focus();
      await flushMicrotasks();
      expect(screen.queryByTestId('error')).toBe(null);

      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('error')).toHaveTextContent('required');
      expect(trigger).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dirty');
    });

    it('is valid again when the user picks an item', async () => {
      const { user } = await renderSelect('onBlur');

      screen.getByTestId('trigger').focus();
      await user.tab();
      expect(screen.getByTestId('error')).toBeInTheDocument();

      await user.click(screen.getByTestId('trigger'));
      await user.click(await screen.findByRole('option', { name: 'a' }));

      expect(screen.queryByTestId('error')).toBe(null);
      expect(screen.getByTestId('root')).toHaveAttribute('data-valid', '');
    });

    it('stays valid when the focus leaves the trigger, with the default validation mode', async () => {
      const { user } = await renderSelect();

      screen.getByTestId('trigger').focus();
      await user.tab();

      expect(screen.getByRole('button', { name: 'After' })).toHaveFocus();
      expect(screen.getByTestId('root')).toHaveAttribute('data-touched', '');
      expect(screen.queryByTestId('error')).toBe(null);
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

  it('throws a descriptive error when rendered outside <Select.Root>', async () => {
    await expect(render(<Select.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Select must be inside <Select.Root>.',
    );
    expect(takeReportedMessages()).toHaveLength(1);
  });
});
