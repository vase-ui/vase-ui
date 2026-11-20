import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Field } from '@vase-ui/vue/field';
import { TimeField } from '@vase-ui/vue/time-field';
import { createRenderer, screen, takeReportedMessages, waitFor } from '#test-utils';
import { createPartRef } from '../root/test-utils';

const dateTime = Temporal.PlainDateTime.from('2026-11-14T15:04');

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputsOf = (container: Element) =>
  Array.from(container.querySelectorAll<HTMLInputElement>('input[aria-hidden]'));

describe('<DatePicker.TimeField />', () => {
  const { render } = createRenderer();

  it('gives the form no input for a name attribute on the time field', async () => {
    await render(
      <DatePicker.Root defaultValue={dateTime}>
        <DatePicker.TimeField {...{ name: 'time' }}>
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );

    expect(document.querySelector('input[name="time"]')).toBeNull();
  });

  it('shows the time of the value of the picker, and gives back a value of its kind with its date', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DatePicker.Root
        defaultValue={Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]')}
        locale="en-US"
        hourCycle={24}
        onValueChange={onValueChange}
      >
        <DatePicker.TimeField aria-label="Time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );

    expect(segmentOf(container, 'hour').value).toBe('15');
    expect(segmentOf(container, 'minute').value).toBe('04');

    segmentOf(container, 'hour').focus();
    await user.keyboard('{ArrowUp}');

    expect(onValueChange.mock.lastCall?.[0].toString()).toBe(
      '2026-11-14T16:04:00+09:00[Asia/Tokyo]',
    );
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
  });

  it('`clear()` empties the time and gives `null` with the reason `none`', async () => {
    const onValueChange = vi.fn();
    const timeField = createPartRef<{ clear: () => void }>();
    const { container } = await render(() => (
      <DatePicker.Root
        defaultValue={dateTime}
        locale="en-US"
        hourCycle={24}
        onValueChange={onValueChange}
      >
        <DatePicker.TimeField ref={timeField.ref} aria-label="Time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>
    ));

    timeField.current.clear();

    await waitFor(() => {
      expect(segmentOf(container, 'hour').value).toBe('');
    });
    expect(onValueChange.mock.lastCall?.[0]).toBe(null);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
  });

  it('shares one value with the field of the picker', async () => {
    const { container, user } = await render(
      <DatePicker.Root defaultValue={dateTime} locale="en-US" hourCycle={24} name="when">
        <DatePicker.Field>
          <DateField.Input />
        </DatePicker.Field>
        <DatePicker.TimeField aria-label="Time" data-testid="time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );
    const timeOf = (type: string) =>
      screen.getByTestId('time').querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;

    timeOf('minute').focus();
    await user.keyboard('{ArrowUp}');

    expect(timeOf('minute').value).toBe('05');
    expect(hiddenInputsOf(container)[0]?.value).toBe('2026-11-14T15:05');
    expect(
      Array.from(container.querySelectorAll<HTMLInputElement>('input[data-type="minute"]')).map(
        (input) => input.value,
      ),
    ).toEqual(['05', '05']);
  });

  it('makes a value of the picker when the picker has none', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DatePicker.Root
        granularity="minute"
        locale="en-US"
        hourCycle={24}
        timeZone="UTC"
        onValueChange={onValueChange}
      >
        <DatePicker.TimeField aria-label="Time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );

    segmentOf(container, 'hour').focus();
    await user.keyboard('0930');

    const value = onValueChange.mock.lastCall?.[0] as Temporal.PlainDateTime;
    expect(Object.prototype.toString.call(value)).toBe('[object Temporal.PlainDateTime]');
    expect(value.toPlainTime().toString()).toBe('09:30:00');
  });

  it('names the group with the elements of `aria-labelledby`', async () => {
    await render(
      <DatePicker.Root defaultValue={dateTime}>
        <span id="time-name">Start time</span>
        <DatePicker.TimeField aria-labelledby="time-name" data-testid="time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );

    expect(screen.getByRole('group', { name: 'Start time' })).toBe(screen.getByTestId('time'));
  });

  it('is disabled and read-only with the picker', async () => {
    const { container } = await render(
      <DatePicker.Root defaultValue={dateTime} disabled>
        <DatePicker.TimeField aria-label="Time" data-testid="time">
          <TimeField.Input />
        </DatePicker.TimeField>
      </DatePicker.Root>,
    );

    expect(screen.getByTestId('time')).toHaveAttribute('data-disabled');
    expect(segmentOf(container, 'hour')).toBeDisabled();
  });

  // The popup is below the field of the picker in the component tree, so a time field in it would
  // be a second control of that field without this part.
  describe('in a Field', () => {
    it('is not a control of the field: the label and the id belong to the field of the picker', async () => {
      const { container } = await render(
        <Field.Root name="when">
          <Field.Label data-testid="label">Departure</Field.Label>
          <DatePicker.Root defaultValue={dateTime} locale="en-US" hourCycle={24} name="when">
            <DatePicker.Field>
              <DateField.Input />
            </DatePicker.Field>
            <DatePicker.TimeField aria-label="Time" data-testid="time">
              <TimeField.Input />
            </DatePicker.TimeField>
          </DatePicker.Root>
        </Field.Root>,
      );

      const fieldSegments = screen
        .getAllByRole('spinbutton')
        .filter((segment) => !screen.getByTestId('time').contains(segment));
      const label = screen.getByTestId('label');
      // The group of the segments of the picker is the control of the field.
      expect(fieldSegments[0]!.closest('[role="group"]')).toHaveAttribute(
        'aria-labelledby',
        label.id,
      );
      // The time field has no label of the field, and no id of the field.
      expect(screen.getByTestId('time')).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByTestId('time')).toHaveAttribute('aria-label', 'Time');
      // The first segment of each field has an id.
      const ids = screen
        .getAllByRole('spinbutton')
        .map((segment) => segment.id)
        .filter(Boolean);
      expect(ids).toHaveLength(2);
      expect(new Set(ids).size).toBe(ids.length);
      // Only the field of the picker names the form entry.
      const names = hiddenInputsOf(container).map((input) => input.getAttribute('name'));
      expect(names.filter((name) => name === 'when')).toHaveLength(1);
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws for a picker whose value has no time', async () => {
    await expect(
      render(
        <DatePicker.Root defaultValue={Temporal.PlainDate.from('2026-11-14')}>
          <DatePicker.TimeField aria-label="Time">
            <TimeField.Input />
          </DatePicker.TimeField>
        </DatePicker.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <DatePicker.TimeField> needs a picker whose value has a time. Without a time the field has no segments to show. Set `granularity` to `hour`, `minute` or `second`, or give the picker a `Temporal.PlainDateTime` or a `Temporal.ZonedDateTime`.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
