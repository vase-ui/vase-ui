import { describe, expect, it, vi } from 'vitest';
import { DateField } from '@vase-ui/vue/date-field';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
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

describe('<DateRangePicker.StartField />', () => {
  const { render } = createRenderer();

  it('shows the first day of the range in its segments, and gives it to the hidden input', async () => {
    const { container } = await render(
      <DateRangePicker.Root
        defaultValue={range('2026-11-18', '2026-11-20')}
        locale="en-US"
        startName="from"
        endName="to"
      >
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
      </DateRangePicker.Root>,
    );

    expect(segmentOf(container, 'month').value).toBe('11');
    expect(segmentOf(container, 'day').value).toBe('18');
    expect(segmentOf(container, 'year').value).toBe('2026');
    expect(hiddenInputOf(container)).toHaveAttribute('name', 'from');
    expect(hiddenInputOf(container).value).toBe('2026-11-18');
  });

  it('follows a new range of a controlled picker', async () => {
    const { container, setProps } = await render(
      <DateRangePicker.Root modelValue={range('2026-11-18', '2026-11-20')} locale="en-US">
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
      </DateRangePicker.Root>,
    );

    await setProps({ modelValue: range('2026-12-24', '2026-12-26') });

    expect(segmentOf(container, 'month').value).toBe('12');
    expect(segmentOf(container, 'day').value).toBe('24');
    expect(hiddenInputOf(container).value).toBe('2026-12-24');
  });

  it('gives a change of a segment to the picker, and the last day stays', async () => {
    const onValueChange = vi.fn();
    const onUpdateValue = vi.fn();
    const { container, user } = await render(
      <DateRangePicker.Root
        defaultValue={range('2026-11-18', '2026-11-20')}
        locale="en-US"
        onValueChange={onValueChange}
        {...{ 'onUpdate:modelValue': onUpdateValue }}
      >
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
      </DateRangePicker.Root>,
    );

    segmentOf(container, 'day').focus();
    await user.keyboard('{ArrowUp}');

    expect(ends(onValueChange.mock.lastCall)).toEqual(['2026-11-19', '2026-11-20']);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('keyboard');
    expect(onUpdateValue).toHaveBeenCalledWith(onValueChange.mock.lastCall?.[0]);
    expect(segmentOf(container, 'day').value).toBe('19');
  });

  it('gives `null` for the first day while a segment is empty, and the last day stays', async () => {
    const onValueChange = vi.fn();
    const { container, user } = await render(
      <DateRangePicker.Root
        defaultValue={range('2026-11-18', '2026-11-20')}
        locale="en-US"
        onValueChange={onValueChange}
      >
        <DateRangePicker.StartField>
          <DateField.Input />
        </DateRangePicker.StartField>
      </DateRangePicker.Root>,
    );

    segmentOf(container, 'day').focus();
    await user.keyboard('{Backspace}{Backspace}');

    expect(ends(onValueChange.mock.lastCall)).toEqual([null, '2026-11-20']);
  });

  it('exposes its element, the hidden input and `clear()`, which empties the first day', async () => {
    const onValueChange = vi.fn();
    let fixture:
      | { startField: { element: HTMLElement; inputElement: HTMLInputElement; clear: () => void } }
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
    const { startField } = fixture!;

    expect(startField.element).toBe(screen.getByTestId('start-field'));
    expect(startField.inputElement).toBe(hiddenInputOf(container));

    startField.clear();

    await waitFor(() => {
      expect(hiddenInputOf(container).value).toBe('');
    });
    expect(ends(onValueChange.mock.lastCall)).toEqual([null, '2026-11-20']);
    expect(onValueChange.mock.lastCall?.[1].reason).toBe('none');
  });
});
