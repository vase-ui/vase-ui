import { describe, expect, it, vi } from 'vitest';
import { Field } from '@vase-ui/vue/field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
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
  });

  describe('placeholder state', () => {
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

    it.each([
      { name: 'up to 5px off the trigger', target: () => document.body, clientX: 96 },
      {
        name: 'on the content of the trigger',
        target: () => screen.getByTestId('text'),
        clientX: 10,
      },
    ])('keeps the popup open when the press is released $name', async ({ target, clientX }) => {
      const trigger = await pressTrigger();

      await fireEvent.mouseUp(target(), { button: 0, clientX, clientY: 120 });
      await wait(20);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('ignores a later release when the opening press was released on the trigger', async () => {
      const trigger = await pressTrigger();
      await fireEvent.mouseUp(trigger, { button: 0, clientX: 150, clientY: 120 });

      await fireEvent.mouseUp(document.body, { button: 0, clientX: 10, clientY: 10 });
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
