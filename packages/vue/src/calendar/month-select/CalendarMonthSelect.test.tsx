import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, screen, waitFor } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday.
const today = () => day('2026-11-14');

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

describe('<Calendar.MonthSelect />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.MonthSelect />, () => ({
    refInstanceof: window.HTMLSelectElement,
    childrenSelector: 'option',
    render: (node) => render(<CalendarAncestors level="root">{node}</CalendarAncestors>),
  }));

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(
      <CalendarNavigationAnatomy
        {...{ today: today(), locale: 'en-US', selects: true, ...props }}
      />,
    );
  }

  const select = () => screen.getByTestId('month-select') as HTMLSelectElement;
  const options = () => [...select().options];
  const monthName = (month: number) =>
    format({ month: 'long' }, `2026-${String(month).padStart(2, '0')}-01`);

  it('has an option for each month of the year, and shows the month of the page', async () => {
    await renderCalendar();

    expect(options().map((option) => option.textContent)).toEqual(
      Array.from({ length: 12 }, (_, index) => monthName(index + 1)),
    );
    expect(select().value).toBe('M11');
    expect(select().selectedOptions[0]!.textContent).toBe(monthName(11));
    expect(select()).toHaveAccessibleName('month');
  });

  it('writes the names of the months in the format of the consumer', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.MonthSelect format="short" data-testid="month-select" />
      </CalendarAncestors>,
    );

    expect(options()[0]!.textContent).toBe(format({ month: 'short' }, '2026-01-01'));
  });

  it('has 13 options for a year of the Hebrew calendar that has a leap month', async () => {
    await renderCalendar({
      calendar: 'hebrew',
      defaultMonth: day('2024-02-10').withCalendar('hebrew').toPlainYearMonth(),
    });

    expect(options()).toHaveLength(13);
    expect(options().map((option) => option.value)).toContain('M05L');
    expect(select().value).toBe('M05L');
  });

  it('disables the months that are outside minDate and maxDate', async () => {
    await renderCalendar({ minDate: day('2026-03-15'), maxDate: day('2026-11-20') });

    expect(options().map((option) => option.disabled)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      false,
      true,
    ]);
  });

  it('disables a month that the broadcast calendar has wholly before minDate', async () => {
    // The broadcast October 2026 ends on 2026-10-25, and 2026-10-28 is in the broadcast November.
    await renderCalendar({ broadcastCalendar: true, minDate: day('2026-10-28') });

    expect(options().find((option) => option.value === 'M10')!.disabled).toBe(true);
    expect(options().find((option) => option.value === 'M11')!.disabled).toBe(false);
  });

  it('shows the month that the user picks in a page of weeks, from the week of its first day', async () => {
    const onMonthChange = vi.fn();
    const { user } = await renderCalendar({ visibleDuration: { weeks: 2 }, onMonthChange });

    await user.selectOptions(select(), 'M12');

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(onMonthChange.mock.calls[0]![0].toString()).toBe('2026-12');
    expect(select().value).toBe('M12');
    // 2026-12-01 is a Tuesday, and the weeks start on Sunday.
    expect(document.querySelector('[data-index="0"] [data-date]')).toHaveAttribute(
      'data-date',
      '2026-11-29',
    );
  });

  it('moves the page to the month that the user picks, and gives the change its reason', async () => {
    const onMonthChange = vi.fn();
    const { user } = await renderCalendar({ onMonthChange });

    await user.selectOptions(select(), 'M03');

    expect(select().value).toBe('M03');
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    const [value, details] = onMonthChange.mock.calls[0]!;
    expect(value.toString()).toBe('2026-03');
    expect(details.reason).toBe('month-change');
    expect(details.event).toBeInstanceOf(Event);
    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe(
      format({ month: 'long', year: 'numeric' }, '2026-03-01'),
    );
  });

  it('shows the month of the root again when a listener cancels the change', async () => {
    const onMonthChange = vi.fn((_month: unknown, details: { cancel: () => void }) => {
      details.cancel();
    });
    const { user } = await renderCalendar({ onMonthChange });

    await user.selectOptions(select(), 'M03');

    expect(onMonthChange).toHaveBeenCalledTimes(1);
    expect(select().value).toBe('M11');
  });

  it('follows a month that the consumer gives', async () => {
    const { user, setProps } = await renderCalendar({
      month: Temporal.PlainYearMonth.from('2026-11'),
    });

    await user.selectOptions(select(), 'M03');
    expect(select().value).toBe('M11');

    await setProps({ month: Temporal.PlainYearMonth.from('2026-03') });
    expect(select().value).toBe('M03');
  });

  it('is disabled with the calendar', async () => {
    await renderCalendar({ disabled: true });

    expect(select()).toBeDisabled();
  });

  it('shows the month of its own page, and a change moves the pages that follow it', async () => {
    const { user } = await render(
      <CalendarAncestors level="month">
        <Calendar.MonthSelect data-testid="month-select" />
      </CalendarAncestors>,
    );

    expect(select().value).toBe('M11');
    await user.selectOptions(select(), 'M12');

    // The month that left is gone, and the select of the new month shows December.
    await waitFor(() => {
      expect(screen.getAllByTestId('month-select')).toHaveLength(1);
    });
    expect(select().value).toBe('M12');
  });
});
