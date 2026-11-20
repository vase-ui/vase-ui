import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Field } from '@vase-ui/vue/field';
import { createRenderer, screen, waitFor } from '#test-utils';
import DateRangePickerAnatomy from '../root/DateRangePickerAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string) => [day(start), day(end)] as const;
const ends = (call: readonly unknown[] | undefined) =>
  (call?.[0] as (Temporal.PlainDate | null)[]).map((end) => end?.toString() ?? null);

const segmentOf = (container: Element, type: string) =>
  container.querySelector<HTMLInputElement>(`input[data-type="${type}"]`)!;
const hiddenInputOf = (container: Element) =>
  container.querySelector<HTMLInputElement>('input[aria-hidden]')!;

describe('<DateRangePicker.EndField />', () => {
  const { render } = createRenderer();

  it('shows the last day of the range in its segments, and gives it to the hidden input', async () => {
    const { container } = await render(
      <DateRangePicker.Root
        defaultValue={range('2026-11-18', '2026-11-20')}
        locale="en-US"
        startName="from"
        endName="to"
      >
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    expect(segmentOf(container, 'month').value).toBe('11');
    expect(segmentOf(container, 'day').value).toBe('20');
    expect(segmentOf(container, 'year').value).toBe('2026');
    expect(hiddenInputOf(container)).toHaveAttribute('name', 'to');
    expect(hiddenInputOf(container).value).toBe('2026-11-20');
  });

  it('is empty while the range has no last day', async () => {
    const { container } = await render(
      <DateRangePicker.Root defaultValue={[day('2026-11-18'), null]} locale="en-US">
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    expect(segmentOf(container, 'day').value).toBe('');
    expect(hiddenInputOf(container).value).toBe('');
  });

  it('gives a change of a segment to the picker, and the first day stays', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DateRangePicker.Root
        defaultValue={range('2026-11-18', '2026-11-20')}
        locale="en-US"
        onValueChange={onValueChange}
      >
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    segmentOf(container, 'day').focus();
    await user.keyboard('{ArrowUp}');

    expect(ends(onValueChange.mock.lastCall)).toEqual(['2026-11-18', '2026-11-21']);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
  });

  it('makes a value of the kind of the first day when the user fills the empty field', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DateRangePicker.Root
        defaultValue={[Temporal.PlainDateTime.from('2026-11-18T09:30'), null]}
        locale="en-US"
        hourCycle={24}
        referenceDate={Temporal.PlainDateTime.from('2026-11-20T17:00')}
        onValueChange={onValueChange}
      >
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    segmentOf(container, 'month').focus();
    await user.keyboard('{ArrowUp}');
    await user.keyboard(
      '{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}{ArrowRight}{ArrowUp}',
    );

    const value = onValueChange.mock.lastCall?.[0] as (Temporal.PlainDateTime | null)[];
    expect(value[1]).toBeInstanceOf(Temporal.PlainDateTime);
  });

  it('limits its day to the first day of the range, and to the limit of the root', async () => {
    const { container, setProps } = await render(
      <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')} locale="en-US">
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );
    expect(hiddenInputOf(container)).toHaveAttribute('min', '2026-11-18');

    await setProps({ minDate: day('2026-11-19') });
    expect(hiddenInputOf(container)).toHaveAttribute('min', '2026-11-19');

    await setProps({ minDate: day('2026-11-10') });
    expect(hiddenInputOf(container)).toHaveAttribute('min', '2026-11-18');
  });

  it('has no lower limit while the range has no first day, and the limit of the root stays', async () => {
    const { container } = await render(
      <DateRangePicker.Root
        defaultValue={[null, day('2026-11-20')]}
        minDate={day('2026-11-10')}
        locale="en-US"
      >
        <DateRangePicker.EndField>
          <DateField.Input />
        </DateRangePicker.EndField>
      </DateRangePicker.Root>,
    );

    expect(hiddenInputOf(container)).toHaveAttribute('min', '2026-11-10');
  });

  describe('in a Field', () => {
    function renderInField(extra: unknown = null) {
      return render(
        <Field.Root>
          <Field.Label>Trip dates</Field.Label>
          {extra}
          <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')} locale="en-US">
            <DateRangePicker.StartField data-testid="start">
              <DateField.Input />
            </DateRangePicker.StartField>
            <DateRangePicker.EndField data-testid="end">
              <DateField.Input />
            </DateRangePicker.EndField>
          </DateRangePicker.Root>
        </Field.Root>,
      );
    }

    it('has an id of its own, so the two fields have no id in common', async () => {
      const { container } = await renderInField();

      const ids = [...container.querySelectorAll('[id]')].map((element) => element.id);
      // The label, and the group and the first segment of each field.
      expect(ids.length).toBeGreaterThan(4);
      expect(new Set(ids).size).toBe(ids.length);
    });

    // The label of the Field names the picker, so it joins the own name of each field.
    it('is named by its own name and by the label of the Field, as the start field is', async () => {
      const { user } = await renderInField();
      const label = screen.getByText('Trip dates');
      const start = screen.getByTestId('start');
      const end = screen.getByTestId('end');

      expect(screen.getByRole('group', { name: 'Start date Trip dates' })).toBe(start);
      expect(screen.getByRole('group', { name: 'End date Trip dates' })).toBe(end);
      expect(start).toHaveAttribute('aria-labelledby', `${start.id} ${label.id}`);
      expect(end).toHaveAttribute('aria-labelledby', `${end.id} ${label.id}`);

      // The label is the label of the control of the Field, which is the start field.
      await user.click(label);

      expect(start.querySelector('input[data-type="month"]')).toHaveFocus();
    });

    it('gets the description of the Field, as the start field does', async () => {
      await renderInField(
        <Field.Description data-testid="description">Pick two days.</Field.Description>,
      );

      const description = screen.getByTestId('description');
      await waitFor(() => {
        expect(screen.getByTestId('end')).toHaveAttribute('aria-describedby', description.id);
      });
      expect(screen.getByTestId('start')).toHaveAttribute('aria-describedby', description.id);
    });
  });

  it('exposes its element, the hidden input and `clear()`, which empties the last day', async () => {
    const onValueChange = vi.fn();
    let fixture:
      | { endField: { element: HTMLElement; inputElement: HTMLInputElement; clear: () => void } }
      | undefined;
    const { container } = await render(() => (
      <DateRangePickerAnatomy
        ref={(value: unknown) => {
          fixture = (value as typeof fixture | null) ?? fixture;
        }}
        {...{
          defaultValue: range('2026-11-18', '2026-11-20'),
          locale: 'en-US',
          onValueChange,
        }}
      />
    ));
    const { endField } = fixture!;
    const endInput = container.querySelectorAll<HTMLInputElement>('input[aria-hidden]')[1]!;

    expect(endField.element).toBe(screen.getByTestId('end-field'));
    expect(endField.inputElement).toBe(endInput);

    endField.clear();

    await waitFor(() => {
      expect(endInput.value).toBe('');
    });
    expect(ends(onValueChange.mock.lastCall)).toEqual(['2026-11-18', null]);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
  });
});
