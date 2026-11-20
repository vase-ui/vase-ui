import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { createRenderer, describeConformance, screen, waitFor } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';
import DateRangePickerAnatomy from '../root/DateRangePickerAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string) => [day(start), day(end)] as const;
const today = () => day('2026-11-14');

const dayButton = (iso: string) =>
  document.querySelector<HTMLElement>(`[data-date="${iso}"] button`)!;
const startCells = () =>
  [...document.querySelectorAll('td[data-range-start]')].map((cell) =>
    cell.getAttribute('data-date'),
  );

describe('<DateRangePicker.Calendar />', () => {
  const { render } = createRenderer();

  it('keeps focus on the trigger with an auto-focus attribute', async () => {
    const { user } = await renderPicker(
      { defaultOpen: false, popupProps: { initialFocus: false } },
      { 'auto-focus': '' },
    );
    const trigger = screen.getByTestId('trigger');
    await user.click(trigger);

    await screen.findByRole('grid');
    expect(trigger).toHaveFocus();
  });

  describeConformance(<DateRangePicker.Calendar today={today()} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')}>
          {node}
        </DateRangePicker.Root>,
      );
    },
  }));

  function renderPicker(props: Record<string, unknown> = {}, calendarProps = {}) {
    return render(
      <DateRangePickerAnatomy
        {...{
          locale: 'en-US',
          timeZone: 'UTC',
          defaultOpen: true,
          calendarProps: { today: today(), ...calendarProps },
          ...props,
        }}
      />,
    );
  }

  it('shows the calendar of the locale of the picker, as the fields do', async () => {
    await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20'), locale: 'fa-IR' });
    const month = day('2026-11-18').withCalendar('persian').toPlainYearMonth();

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toHaveAttribute(
        'aria-label',
        formatText(month, { month: 'long', year: 'numeric' }, 'fa-IR'),
      );
    });
  });

  it('shows the locale of the browser with no locale, as the fields do', async () => {
    const resolvedOptions = Intl.DateTimeFormat.prototype.resolvedOptions;
    // The browser of the test has the locale `fr`.
    const spy = vi
      .spyOn(Intl.DateTimeFormat.prototype, 'resolvedOptions')
      .mockImplementation(function (this: Intl.DateTimeFormat) {
        return { ...resolvedOptions.call(this), locale: 'fr' };
      });
    onTestFinished(() => spy.mockRestore());
    await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20'), locale: undefined });
    const month = Temporal.PlainYearMonth.from('2026-11');

    await waitFor(() => {
      expect(screen.getByTestId('calendar')).toHaveAttribute(
        'aria-label',
        formatText(month, { month: 'long', year: 'numeric' }, 'fr'),
      );
    });
  });

  it('shows the range of the picker', async () => {
    await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20') });

    await waitFor(() => {
      expect(startCells()).toEqual(['2026-11-18']);
    });
    expect(document.querySelector('td[data-range-end]')).toHaveAttribute('data-date', '2026-11-20');
  });

  it('follows a new range of a controlled picker', async () => {
    const { setProps } = await renderPicker({ modelValue: range('2026-11-18', '2026-11-20') });
    await waitFor(() => {
      expect(startCells()).toEqual(['2026-11-18']);
    });

    await setProps({ modelValue: range('2026-11-22', '2026-11-24') });

    expect(startCells()).toEqual(['2026-11-22']);
  });

  it('gives each change of the range to the picker, with the details of the calendar', async () => {
    const onValueChange = vi.fn();
    const onUpdateValue = vi.fn();
    const { user } = await renderPicker({
      defaultValue: range('2026-11-18', '2026-11-20'),
      onValueChange,
      'onUpdate:modelValue': onUpdateValue,
    });
    await waitFor(() => {
      expect(dayButton('2026-11-24')).not.toBe(null);
    });

    await user.click(dayButton('2026-11-24'));

    const [value, details] = onValueChange.mock.lastCall as [Temporal.PlainDate[], any];
    expect(value.map(String)).toEqual(['2026-11-24', 'null']);
    expect(details.reason).toBe('day-press');
    expect(onUpdateValue).toHaveBeenCalledWith(value);
  });

  it('has the props of the range calendar that the picker does not own', async () => {
    const { user } = await renderPicker({}, { maxDays: 3 });
    await waitFor(() => {
      expect(dayButton('2026-11-16')).not.toBe(null);
    });

    // A range of five days is longer than `maxDays`, so the second press starts a new range.
    await user.click(dayButton('2026-11-16'));
    await user.click(dayButton('2026-11-20'));

    expect(startCells()).toEqual(['2026-11-20']);
    expect(screen.getByRole('dialog')).not.toBe(null);
  });

  it('emits the events of the month again, and a listener can cancel the change', async () => {
    const onMonthChange = vi.fn((_month: unknown, details: { cancel: () => void }) => {
      details.cancel();
    });
    const onUpdateMonth = vi.fn();
    const { user } = await renderPicker(
      { defaultValue: range('2026-11-18', '2026-11-20') },
      { onMonthChange, 'onUpdate:month': onUpdateMonth },
    );
    await waitFor(() => {
      expect(screen.getByTestId('next')).not.toBe(null);
    });

    await user.click(screen.getByTestId('next'));

    expect(String(onMonthChange.mock.lastCall?.[0])).toBe('2026-12');
    expect(onMonthChange.mock.lastCall?.[1]).toMatchObject({ reason: 'month-change' });
    expect(onUpdateMonth).not.toHaveBeenCalled();
    expect(dayButton('2026-11-18')).not.toBe(null);

    onMonthChange.mockImplementation(() => undefined);
    await user.click(screen.getByTestId('next'));

    expect(onUpdateMonth.mock.lastCall?.[0].toString()).toBe('2026-12');
  });

  it('emits the events of the day that has the tab stop again', async () => {
    const onFocusedDateChange = vi.fn();
    const onUpdateFocusedDate = vi.fn();
    const { user } = await renderPicker(
      { defaultValue: range('2026-11-18', '2026-11-20') },
      { onFocusedDateChange, 'onUpdate:focusedDate': onUpdateFocusedDate },
    );
    await waitFor(() => {
      expect(dayButton('2026-11-18')).toHaveFocus();
    });

    await user.keyboard('{ArrowRight}');

    expect(String(onFocusedDateChange.mock.lastCall?.[0])).toBe('2026-11-19');
    expect(onFocusedDateChange.mock.lastCall?.[1]).toMatchObject({ reason: 'keyboard' });
    expect(String(onUpdateFocusedDate.mock.lastCall?.[0])).toBe('2026-11-19');
  });

  // Vue gives an absent Boolean prop the value `false`, and a broadcast calendar shows the days of
  // the weeks that it shares with the months around it.
  it('shows the outside days of a broadcast calendar with no `showOutsideDays`', async () => {
    await renderPicker({}, { broadcastCalendar: true });

    await waitFor(() => {
      expect(dayButton('2026-10-26')).not.toBe(null);
    });
  });

  it('gets the limits from the root of the picker', async () => {
    await renderPicker({ minDate: day('2026-11-12'), maxDate: day('2026-11-24') });
    await waitFor(() => {
      expect(dayButton('2026-11-10')).not.toBe(null);
    });

    expect(dayButton('2026-11-10')).toBeDisabled();
    expect(dayButton('2026-11-12')).not.toBeDisabled();
    expect(dayButton('2026-11-26')).toBeDisabled();
  });

  it('is disabled with the picker', async () => {
    await renderPicker({ defaultValue: range('2026-11-18', '2026-11-20'), disabled: true });
    await waitFor(() => {
      expect(dayButton('2026-11-24')).not.toBe(null);
    });

    expect(screen.getByTestId('calendar')).toHaveAttribute('data-disabled');
    expect(dayButton('2026-11-24')).toBeDisabled();
  });

  it('is read-only with the picker', async () => {
    const { user } = await renderPicker({
      defaultValue: range('2026-11-18', '2026-11-20'),
      readOnly: true,
    });
    await waitFor(() => {
      expect(dayButton('2026-11-24')).not.toBe(null);
    });

    await user.click(dayButton('2026-11-24'));

    expect(startCells()).toEqual(['2026-11-18']);
  });

  it('exposes its element and `focus()`', async () => {
    let fixture: { calendar: { element: HTMLElement; focus: (date?: Temporal.PlainDate) => void } };
    await render(() => (
      <DateRangePickerAnatomy
        ref={(value: unknown) => {
          fixture = (value as typeof fixture | null) ?? fixture;
        }}
        {...{
          locale: 'en-US',
          defaultOpen: true,
          defaultValue: range('2026-11-18', '2026-11-20'),
          calendarProps: { today: today() },
        }}
      />
    ));
    await waitFor(() => {
      expect(dayButton('2026-11-22')).not.toBe(null);
    });

    expect(fixture!.calendar.element).toBe(screen.getByTestId('calendar'));

    fixture!.calendar.focus(day('2026-11-22'));

    await waitFor(() => {
      expect(dayButton('2026-11-22')).toHaveFocus();
    });
  });
});
