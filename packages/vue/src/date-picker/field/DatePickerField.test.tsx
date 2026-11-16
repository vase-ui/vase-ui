import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Field } from '@vase-ui/vue/field';
import {
  createFormDataSpy,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import DatePickerAnatomy from '../root/DatePickerAnatomy.test.vue';
import { createPartRef } from '../root/test-utils';

const day = Temporal.PlainDate.from('2026-11-14');

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;

describe('<DatePicker.Field />', () => {
  const { render } = createRenderer();

  describeConformance(<DatePicker.Field />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<DatePicker.Root defaultValue={day}>{node}</DatePicker.Root>);
    },
  }));

  it('shows the value of the picker in its segments, and gives it to the hidden input', async () => {
    const { container } = await render(
      <DatePicker.Root defaultValue={day} locale="en-US" name="when">
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
      </DatePicker.Root>,
    );

    expect(segmentOf(container, 'month').value).toBe('11');
    expect(segmentOf(container, 'day').value).toBe('14');
    expect(segmentOf(container, 'year').value).toBe('2026');
    expect(hiddenInputOf(container)).toHaveAttribute('name', 'when');
    expect(hiddenInputOf(container).value).toBe('2026-11-14');
  });

  it('follows a new value of a controlled picker', async () => {
    const { container, setProps } = await render(
      <DatePicker.Root value={day} locale="en-US">
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
      </DatePicker.Root>,
    );

    await setProps({ value: Temporal.PlainDate.from('2026-12-24') });

    expect(segmentOf(container, 'month').value).toBe('12');
    expect(segmentOf(container, 'day').value).toBe('24');
    expect(hiddenInputOf(container).value).toBe('2026-12-24');
  });

  it('exposes its element, the hidden input and `clear()`, which gives `null` with the reason `none`', async () => {
    const onValueChange = vi.fn();
    const fixture = createPartRef<{
      field: { element: HTMLElement; inputElement: HTMLInputElement; clear: () => void };
    }>();
    const { container } = await render(() => (
      <DatePickerAnatomy
        ref={fixture.ref}
        {...{ defaultValue: day, locale: 'en-US', onValueChange }}
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
    expect(segmentOf(container, 'day').value).toBe('');
  });

  // The part has no prop for the names. The attribute reaches `DateField.Root`, which reads it.
  it('names the group with the elements of `aria-labelledby`, and not with the label of the field', async () => {
    await render(
      <Field.Root name="when">
        <Field.Label>Departure</Field.Label>
        <span id="other">Trip</span>
        <DatePicker.Root defaultValue={day} locale="en-US">
          <DatePicker.Field aria-labelledby="other" data-testid="field">
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>
      </Field.Root>,
    );

    expect(screen.getByTestId('field')).toHaveAttribute('aria-labelledby', 'other');
    expect(screen.getByRole('group', { name: 'Trip' })).toBe(screen.getByTestId('field'));
  });

  describe('value changes', () => {
    it('gives each change of a segment to the picker, with the details of the field', async () => {
      const onValueChange = vi.fn();
      const onUpdateValue = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root
          defaultValue={day}
          locale="en-US"
          onValueChange={onValueChange}
          {...{ 'onUpdate:value': onUpdateValue }}
        >
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');

      const [value, details] = onValueChange.mock.lastCall as [Temporal.PlainDate, any];
      expect(value.toString()).toBe('2026-11-15');
      expect(details.reason).toBe('keyboard');
      expect(onUpdateValue).toHaveBeenCalledWith(value);
      expect(segmentOf(container, 'day').value).toBe('15');
    });

    it('keeps the value when a listener cancels the change', async () => {
      const onUpdateValue = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root
          defaultValue={day}
          locale="en-US"
          onValueChange={(_value: unknown, details: { cancel: () => void }) => {
            details.cancel();
          }}
          {...{ 'onUpdate:value': onUpdateValue }}
        >
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');

      expect(onUpdateValue).not.toHaveBeenCalled();
      expect(segmentOf(container, 'day').value).toBe('14');
      expect(hiddenInputOf(container).value).toBe('2026-11-14');
    });

    it('is `null` while a segment is empty, and the picker gives a value when it is full', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root
          locale="en-US"
          timeZone="UTC"
          referenceDate={day}
          onValueChange={onValueChange}
        >
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'month').focus();
      await user.keyboard('11');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.keyboard('14');
      expect(onValueChange).not.toHaveBeenCalled();

      await user.keyboard('2026');
      expect(onValueChange.mock.lastCall?.[0].toString()).toBe('2026-11-14');
    });
  });

  // The field of the picker keeps its kind when the user empties it, as the calendar does.
  it('makes a value of the kind of the last value when a segment is full again', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DatePicker.Root
        defaultValue={Temporal.ZonedDateTime.from('2026-11-18T09:30[Asia/Tokyo]')}
        locale="en-US"
        hourCycle={24}
        onValueChange={onValueChange}
      >
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
      </DatePicker.Root>,
    );

    segmentOf(container, 'month').focus();
    await user.keyboard('{Backspace}{Backspace}');
    expect(onValueChange.mock.lastCall?.[0]).toBe(null);
    await user.keyboard('12');

    expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
      '2026-12-18T09:30:00+09:00[Asia/Tokyo]',
    );
    expect(segmentOf(container, 'hour').value).toBe('09');
  });

  describe('Alt+Down', () => {
    it('opens the popup from a segment', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} onOpenChange={onOpenChange}>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
          <DatePicker.Trigger>Open</DatePicker.Trigger>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('trigger-press');
      expect(onOpenChange.mock.lastCall?.[1].event.type).toBe('keydown');
      // The popup belongs to the trigger, as for a press.
      expect(screen.getByRole('button', { name: /Change date/ })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      // The key does not change the value of the segment.
      expect(segmentOf(container, 'day').value).toBe('14');
    });

    it('opens a popup that has no trigger, with no trigger in the details', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} onOpenChange={onOpenChange}>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange.mock.lastCall?.[0]).toBe(true);
      expect(onOpenChange.mock.lastCall?.[1].trigger).toBeUndefined();
    });

    it('does nothing for the arrow key alone, and for the key with Shift or Control', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} onOpenChange={onOpenChange}>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
          <DatePicker.Trigger>Open</DatePicker.Trigger>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowDown}');
      await user.keyboard('{Shift>}{ArrowDown}{/Shift}');
      await user.keyboard('{Control>}{ArrowDown}{/Control}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('does nothing while the popup is open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} defaultOpen onOpenChange={onOpenChange}>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'disabled', props: { disabled: true } },
      { name: 'read-only', props: { readOnly: true } },
    ])('does nothing in a picker that is $name', async ({ props }) => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} onOpenChange={onOpenChange} {...props}>
          <DatePicker.Field>
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('runs the listener of the consumer first, and it can prevent the open', async () => {
      const onOpenChange = vi.fn();
      const { container, user } = await render(
        <DatePicker.Root defaultValue={day} onOpenChange={onOpenChange}>
          <DatePicker.Field
            onKeydown={(event: KeyboardEvent) => {
              event.preventDefault();
            }}
          >
            <DateField.Input />
          </DatePicker.Field>
        </DatePicker.Root>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{Alt>}{ArrowDown}{/Alt}');

      expect(onOpenChange).not.toHaveBeenCalled();
    });
  });

  describe('form', () => {
    it('submits one entry with the ISO text of the value', async () => {
      const onSubmit = createFormDataSpy('when');
      const { container } = await render(
        <form onSubmit={onSubmit}>
          <DatePicker.Root defaultValue={day} name="when" locale="en-US">
            <DatePicker.Field>
              <DateField.Input />
            </DatePicker.Field>
            <DatePicker.Trigger>Open</DatePicker.Trigger>
          </DatePicker.Root>
        </form>,
      );

      container.querySelector('form')!.requestSubmit();

      expect(onSubmit.mock.results.at(-1)?.value).toBe('2026-11-14');
      expect(new FormData(container.querySelector('form')!).getAll('when')).toEqual(['2026-11-14']);
    });

    it('goes back to its default value at a reset of the form, when it is not controlled', async () => {
      const onValueChange = vi.fn();
      const { container, user } = await render(
        <form>
          <DatePicker.Root
            defaultValue={day}
            name="when"
            locale="en-US"
            onValueChange={onValueChange}
          >
            <DatePicker.Field>
              <DateField.Input />
            </DatePicker.Field>
          </DatePicker.Root>
        </form>,
      );

      segmentOf(container, 'day').focus();
      await user.keyboard('{ArrowUp}');
      expect(hiddenInputOf(container).value).toBe('2026-11-15');

      container.querySelector('form')!.reset();

      await waitFor(() => {
        expect(hiddenInputOf(container).value).toBe('2026-11-14');
      });
      expect(segmentOf(container, 'day').value).toBe('14');
      const [value, details] = onValueChange.mock.lastCall as [Temporal.PlainDate, any];
      expect(value.toString()).toBe('2026-11-14');
      expect(details.reason).toBe('none');
      expect(details.event.type).toBe('reset');
    });

    it('does not change at a reset of the form, when it is controlled', async () => {
      const onValueChange = vi.fn();
      const { container } = await render(
        <form>
          <DatePicker.Root
            value={Temporal.PlainDate.from('2026-12-24')}
            defaultValue={day}
            name="when"
            locale="en-US"
            onValueChange={onValueChange}
          >
            <DatePicker.Field>
              <DateField.Input />
            </DatePicker.Field>
          </DatePicker.Root>
        </form>,
      );

      container.querySelector('form')!.reset();
      await flushMicrotasks();
      // The reset of the form comes in a timeout of 0 ms, and this timeout starts after it.
      await wait(0);

      expect(onValueChange).not.toHaveBeenCalled();
      expect(hiddenInputOf(container).value).toBe('2026-12-24');
    });
  });

  describe('in a Field', () => {
    it('is the control of the field: the label names it, and the form gets one entry', async () => {
      const { container, user } = await render(
        <form>
          <Field.Root name="when">
            <Field.Label>Departure</Field.Label>
            <DatePicker.Root locale="en-US" referenceDate={day}>
              <DatePicker.Field>
                <DateField.Input />
              </DatePicker.Field>
              <DatePicker.Trigger>Open</DatePicker.Trigger>
            </DatePicker.Root>
          </Field.Root>
        </form>,
      );

      await user.click(screen.getByText('Departure'));

      expect(segmentOf(container, 'month')).toHaveFocus();
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
        name: 'a date before `minDate`',
        props: { defaultValue: Temporal.PlainDate.from('2026-11-01'), minDate: day },
        flag: 'rangeUnderflow',
      },
      {
        name: 'a date after `maxDate`',
        props: { defaultValue: Temporal.PlainDate.from('2026-12-01'), maxDate: day },
        flag: 'rangeOverflow',
      },
    ])('gives $name to the field through the hidden input', async ({ props, flag }) => {
      const { container } = await render(
        <Field.Root name="when">
          <DatePicker.Root locale="en-US" {...props}>
            <DatePicker.Field>
              <DateField.Input />
            </DatePicker.Field>
          </DatePicker.Root>
        </Field.Root>,
      );

      expect(hiddenInputOf(container).validity[flag as 'valueMissing']).toBe(true);
    });
  });
});
