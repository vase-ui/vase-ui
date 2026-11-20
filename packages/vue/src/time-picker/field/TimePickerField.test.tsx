import { describe, expect, it, vi } from 'vitest';
import ErrorsForm from '../../../test/fixtures/ErrorsForm.vue';
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';
import { TimePicker } from '@vase-ui/vue/time-picker';
import {
  createFormDataSpy,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  heldMountFormResetTests,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import { createPartRef } from '../../date-picker/root/test-utils';
import TimePickerAnatomy from '../root/TimePickerAnatomy.test.vue';

const time = Temporal.PlainTime.from('14:30');

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;

describe('<TimePicker.Field />', () => {
  const { render } = createRenderer();

  it('shows the value of the picker in its segments, and gives it to the hidden input', async () => {
    const { container } = await render(
      <TimePicker.Root defaultValue={time} locale="en-US" hourCycle={24} name="when">
        <TimePicker.Field>
          <TimeField.Input />
        </TimePicker.Field>
      </TimePicker.Root>,
    );

    expect(segmentOf(container, 'hour').value).toBe('14');
    expect(segmentOf(container, 'minute').value).toBe('30');
    expect(hiddenInputOf(container)).toHaveAttribute('name', 'when');
    expect(hiddenInputOf(container)).toHaveAttribute('type', 'time');
    expect(hiddenInputOf(container).value).toBe('14:30');
  });

  it('follows a new value of a controlled picker', async () => {
    const { container, setProps } = await render(
      <TimePicker.Root modelValue={time} locale="en-US" hourCycle={24}>
        <TimePicker.Field>
          <TimeField.Input />
        </TimePicker.Field>
      </TimePicker.Root>,
    );

    await setProps({ modelValue: Temporal.PlainTime.from('09:05') });

    expect(segmentOf(container, 'hour').value).toBe('09');
    expect(segmentOf(container, 'minute').value).toBe('05');
    expect(hiddenInputOf(container).value).toBe('09:05');
  });

  it('exposes its element, the hidden input and `clear()`, which gives `null` with the reason `none`', async () => {
    const onValueChange = vi.fn();
    const fixture = createPartRef<{
      field: { element: HTMLElement; inputElement: HTMLInputElement; clear: () => void };
    }>();
    const { container } = await render(() => (
      <TimePickerAnatomy
        ref={fixture.ref}
        {...{ defaultValue: time, locale: 'en-US', onValueChange }}
      />
    ));
    const { field } = fixture.current;

    expect(field.element).toBe(screen.getByTestId('field'));
    expect(field.inputElement).toBe(hiddenInputOf(container));

    field.clear();

    await waitFor(() => {
      expect(hiddenInputOf(container).value).toBe('');
    });
    expect(onValueChange.mock.lastCall?.[0]).toBe(null);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
    expect(segmentOf(container, 'minute').value).toBe('');
  });

  // The part gives the names to `TimeField.Root`, which reads them.
  it('names the group with the elements of `aria-labelledby`, and not with the label of the field', async () => {
    await render(
      <Field.Root name="when">
        <Field.Label>Start</Field.Label>
        <span id="other">Meeting</span>
        <TimePicker.Root defaultValue={time} locale="en-US">
          <TimePicker.Field aria-labelledby="other" data-testid="field">
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>
      </Field.Root>,
    );

    expect(screen.getByTestId('field')).toHaveAttribute('aria-labelledby', 'other');
    expect(screen.getByRole('group', { name: 'Meeting' })).toBe(screen.getByTestId('field'));
  });

  describe('value changes', () => {
    it('gives each change of a segment to the picker, with the details of the field', async () => {
      const onValueChange = vi.fn();
      const onUpdateValue = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root
          defaultValue={time}
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
          {...{ 'onUpdate:modelValue': onUpdateValue }}
        >
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{ArrowUp}');

      const [value, details] = onValueChange.mock.lastCall as [Temporal.PlainTime, any];
      expect(value.toString()).toBe('14:31:00');
      expect(details.reason).toBe('keyboard');
      expect(onUpdateValue).toHaveBeenCalledWith(value);
      expect(segmentOf(container, 'minute').value).toBe('31');
    });

    it('keeps the value when a listener cancels the change', async () => {
      const onUpdateValue = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root
          defaultValue={time}
          locale="en-US"
          hourCycle={24}
          onValueChange={(_value: unknown, details: { cancel: () => void }) => {
            details.cancel();
          }}
          {...{ 'onUpdate:modelValue': onUpdateValue }}
        >
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{ArrowUp}');

      expect(onUpdateValue).not.toHaveBeenCalled();
      expect(segmentOf(container, 'minute').value).toBe('30');
      expect(hiddenInputOf(container).value).toBe('14:30');
    });

    it('is `null` while a segment is empty, and the picker gives a value when it is full', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root locale="en-US" hourCycle={24} onValueChange={onValueChange}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'hour').focus();
      await user.keyboard('09');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.keyboard('45');
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('09:45:00');
    });

    // The field of the picker keeps its kind when the user empties it.
    it('makes a value of the kind of the last value when a segment is full again', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root
          defaultValue={Temporal.ZonedDateTime.from('2026-11-18T09:30[Asia/Tokyo]')}
          locale="en-US"
          hourCycle={24}
          onValueChange={onValueChange}
        >
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'hour').focus();
      await user.keyboard('{Backspace}{Backspace}');
      expect(onValueChange.mock.lastCall?.[0]).toBe(null);
      await user.keyboard('12');

      expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
        '2026-11-18T12:30:00+09:00[Asia/Tokyo]',
      );
    });
  });

  describe('Alt+Down', () => {
    it('opens the popup from a segment', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root defaultValue={time} hourCycle={24} onOpenChange={onOpenChange}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
          <TimePicker.Trigger>Open</TimePicker.Trigger>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-press');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('keydown');
      // The popup belongs to the trigger, as for a press.
      expect(screen.getByRole('button', { name: /Change time/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      // The key does not change the value of the segment.
      expect(segmentOf(container, 'minute').value).toBe('30');
    });

    it('does nothing for the arrow key alone, and for the key with Shift or Control', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root defaultValue={time} onOpenChange={onOpenChange}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
          <TimePicker.Trigger>Open</TimePicker.Trigger>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
      await user.keyboard('{Control>}{ArrowDown}{/Control}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('does nothing while the popup is open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root defaultValue={time} defaultOpen onOpenChange={onOpenChange}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'disabled', props: { disabled: true } },
      { name: 'read-only', props: { readOnly: true } },
    ])('does nothing in a picker that is $name', async ({ props }) => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root defaultValue={time} onOpenChange={onOpenChange} {...props}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('runs the listener of the consumer first, and it can prevent the open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <TimePicker.Root defaultValue={time} onOpenChange={onOpenChange}>
          <TimePicker.Field
            onKeydown={(event: KeyboardEvent) => {
              event.preventDefault();
            }}
          >
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('form', () => {
    heldMountFormResetTests({
      render,
      renderControl: () => (
        <TimePicker.Root name="time" locale="en-US" defaultValue={Temporal.PlainTime.from('10:30')}>
          <TimePicker.Field>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>
      ),
      change: () => fireEvent.input(hiddenInputOf(document.body), { target: { value: '11:45' } }),
      readState: () =>
        screen.getAllByRole('spinbutton').map((segment) => segment.getAttribute('aria-valuenow')),
      defaultState: ['10', '30', '0'],
      changedState: ['11', '45', '0'],
    });

    it('submits one entry with the ISO text of the value', async () => {
      const onSubmit = createFormDataSpy('when');
      const { container } = await render(
        <form onSubmit={onSubmit}>
          <TimePicker.Root defaultValue={time} name="when" locale="en-US">
            <TimePicker.Field>
              <TimeField.Input />
            </TimePicker.Field>
            <TimePicker.Trigger>Open</TimePicker.Trigger>
          </TimePicker.Root>
        </form>,
      );

      container.querySelector('form')!.requestSubmit();

      expect(onSubmit.mock.results.at(-1)?.value).toBe('14:30');
      expect(new FormData(container.querySelector('form')!).getAll('when')).toEqual(['14:30']);
    });

    it('goes back to its default value at a reset of the form, when it is not controlled', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <form>
          <TimePicker.Root
            defaultValue={time}
            name="when"
            locale="en-US"
            hourCycle={24}
            onValueChange={onValueChange}
          >
            <TimePicker.Field>
              <TimeField.Input />
            </TimePicker.Field>
          </TimePicker.Root>
        </form>,
      );

      segmentOf(container, 'minute').focus();
      await user.keyboard('{ArrowUp}');
      expect(hiddenInputOf(container).value).toBe('14:31');

      container.querySelector('form')!.reset();

      await waitFor(() => {
        expect(hiddenInputOf(container).value).toBe('14:30');
      });
      expect(segmentOf(container, 'minute').value).toBe('30');
      const [value, details] = onValueChange.mock.lastCall as [Temporal.PlainTime, any];
      expect(value.toString()).toBe('14:30:00');
      expect(details.reason).toBe('none');
      expect(details.event.type).toBe('reset');
    });

    it('does not change at a reset of the form, when it is controlled', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <form>
          <TimePicker.Root
            modelValue={Temporal.PlainTime.from('09:05')}
            defaultValue={time}
            name="when"
            locale="en-US"
            onValueChange={onValueChange}
          >
            <TimePicker.Field>
              <TimeField.Input />
            </TimePicker.Field>
          </TimePicker.Root>
        </form>,
      );

      container.querySelector('form')!.reset();
      await flushMicrotasks();
      // The reset of the form comes in a timeout of 0 ms, and this timeout starts after it.
      await wait(0);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('09:05');
    });
  });

  describe('in a Field', () => {
    it('is the control of the field: the label names it, and the form gets one entry', async () => {
      const { container, user } = await render(
        <form>
          <Field.Root name="when">
            <Field.Label>Start</Field.Label>
            <TimePicker.Root locale="en-US">
              <TimePicker.Field>
                <TimeField.Input />
              </TimePicker.Field>
              <TimePicker.Trigger>Open</TimePicker.Trigger>
            </TimePicker.Root>
          </Field.Root>
        </form>,
      );

      await user.click(screen.getByText('Start'));

      expect(segmentOf(container, 'hour')).toHaveFocus();
      expect(hiddenInputOf(container)).toHaveAttribute('name', 'when');
      expect(new FormData(container.querySelector('form')!).getAll('when')).toEqual(['']);
    });

    it.each([
      {
        name: 'a missing value for a required picker',
        props: { required: true },
        flag: 'valueMissing',
      },
      {
        name: 'a time before `minTime`',
        props: { defaultValue: Temporal.PlainTime.from('08:00'), minTime: time },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a time after `maxTime`',
        props: { defaultValue: Temporal.PlainTime.from('18:00'), maxTime: time },
        flag: 'rangeOverflow',
      },
    ])('gives $name to the field through the hidden input', async ({ props, flag }) => {
      const { container } = await render(
        <Field.Root name="when">
          <TimePicker.Root locale="en-US" {...props}>
            <TimePicker.Field>
              <TimeField.Input />
            </TimePicker.Field>
          </TimePicker.Root>
        </Field.Root>,
      );

      expect(hiddenInputOf(container).validity[flag as 'valueMissing']).toBe(true);
    });

    // The step starts at `minTime`. With no `minTime`, it starts at the `value` attribute.
    it('gives the step of the hidden input in seconds', async () => {
      const { container } = await render(
        <TimePicker.Root
          locale="en-US"
          defaultValue={Temporal.PlainTime.from('14:31')}
          minTime={Temporal.PlainTime.from('09:00')}
        >
          <TimePicker.Field step={1800}>
            <TimeField.Input />
          </TimePicker.Field>
        </TimePicker.Root>,
      );

      expect(hiddenInputOf(container)).toHaveAttribute('step', '1800');
      expect(hiddenInputOf(container).validity.stepMismatch).toBe(true);
    });
  });

  // The root of the field and the field part of the picker each listen for the reset of the form.
  // The root listens on the form and the part on the document, so the root hears of it first.
  describe.each([{ order: 'the root first' }])(
    'VUE-21: a native reset clears the error of the field, with $order',
    () => {
      // The reset value, `null`, is also an error, so a validation after the reset shows.
      const createValidate = () =>
        vi.fn((value: unknown) => (value === null ? 'Choose a time' : 'Wrong time'));

      function renderForm(
        validate: ReturnType<typeof createValidate>,
        pickerProps: { defaultValue?: Temporal.PlainTime } = {},
        errors?: Record<string, string>,
      ) {
        return (
          <ErrorsForm data-testid="form" errors={errors}>
            <Field.Root data-testid="root" name="when" validate={validate} validationMode="change">
              <TimePicker.Root locale="en-US" hourCycle={24} referenceDate={time} {...pickerProps}>
                <TimePicker.Field>
                  <TimeField.Input />
                </TimePicker.Field>
              </TimePicker.Root>
              <Field.Error data-testid="error" />
            </Field.Root>
          </ErrorsForm>
        );
      }

      // A program that fills the form sends the whole time in one event.
      async function fill(container: Element, text: string) {
        const input = hiddenInputOf(container);
        input.value = text;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        await flushMicrotasks();
      }

      async function resetForm() {
        screen.getByTestId<HTMLFormElement>('form').reset();
        // Each timeout of the reset starts before this one, and a flush of Vue comes after each.
        await wait(0);
        await flushMicrotasks();
      }

      function expectNeutralField() {
        expect(screen.queryByTestId('error')).toBe(null);
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-invalid');
        expect(screen.getByTestId('root')).not.toHaveAttribute('data-valid');
      }

      it('starts no validation for the value of the reset, and validates the next entry', async () => {
        const validate = createValidate();
        const { container } = await render(renderForm(validate));
        await fill(container, '14:30');
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong time');
        validate.mockClear();

        await resetForm();

        expect(hiddenInputOf(container).value).toBe('');
        expect(segmentOf(container, 'hour').value).toBe('');
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        await fill(container, '15:30');

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong time');
      });

      it('clears the error of the form when the reset leaves the value, and validates the next entry', async () => {
        const validate = createValidate();
        const { container } = await render(
          renderForm(validate, { defaultValue: time }, { when: 'Server error' }),
        );
        expect(screen.getByTestId('error')).toHaveTextContent('Server error');

        await resetForm();

        expect(hiddenInputOf(container).value).toBe('14:30');
        expect(validate).not.toHaveBeenCalled();
        expectNeutralField();

        await fill(container, '15:30');

        expect(validate).toHaveBeenCalledTimes(1);
        expect(screen.getByTestId('error')).toHaveTextContent('Wrong time');
      });
    },
  );
});
