import { describe, expect, it, vi } from 'vitest';
import { createRenderer, describeConformance, screen } from '#test-utils';
import * as Calendar from '../index.parts';
import CalendarAncestors from '../root/CalendarAncestors.test.vue';
import CalendarNavigationAnatomy from '../root/CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday.
const today = () => day('2026-11-14');

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

describe('<Calendar.YearSelect />', () => {
  const { render } = createRenderer();

  describeConformance(<Calendar.YearSelect />, () => ({
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

  const select = () => screen.getByTestId('year-select') as HTMLSelectElement;
  const years = () => [...select().options].map((option) => Number(option.value));

  it('has an option for each year between minDate and maxDate, and shows the year of the page', async () => {
    await renderCalendar({ minDate: day('2024-05-01'), maxDate: day('2028-02-01') });

    expect(years()).toEqual([2024, 2025, 2026, 2027, 2028]);
    expect(select().value).toBe('2026');
    expect(select().selectedOptions[0]!.textContent).toBe(
      format({ year: 'numeric' }, '2026-01-01'),
    );
    expect(select()).toHaveAccessibleName('year');
  });

  it('has the years around today when the calendar has no limit', async () => {
    await renderCalendar();

    expect(years()[0]).toBe(2026 - 100);
    expect(years().at(-1)).toBe(2026 + 100);
    expect(years()).toHaveLength(201);
  });

  it('lists the years from the last to the first with order desc', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.YearSelect order="desc" data-testid="year-select" />
      </CalendarAncestors>,
    );

    expect(years()[0]).toBeGreaterThan(years().at(-1)!);
  });

  it('writes the years in the format of the consumer', async () => {
    await render(
      <CalendarAncestors level="root">
        <Calendar.YearSelect format="2-digit" data-testid="year-select" />
      </CalendarAncestors>,
    );

    expect([...select().options].find((option) => option.value === '2026')!.textContent).toBe(
      format({ year: '2-digit' }, '2026-01-01'),
    );
  });

  it('shows the year of the page, and disables it, when it is out of the limits', async () => {
    await renderCalendar({
      minDate: day('2024-05-01'),
      maxDate: day('2025-02-01'),
      defaultMonth: Temporal.PlainYearMonth.from('2026-11'),
    });

    const options = [...select().options];
    expect(options.map((option) => [Number(option.value), option.disabled])).toEqual([
      [2024, false],
      [2025, false],
      [2026, true],
    ]);
    expect(select().value).toBe('2026');
  });

  it('does not disable the year of the page when the calendar has no limit', async () => {
    await renderCalendar({ defaultMonth: Temporal.PlainYearMonth.from('1800-03') });

    expect(select().value).toBe('1800');
    expect(select().selectedOptions[0]!.disabled).toBe(false);
    expect([...select().options].some((option) => option.disabled)).toBe(false);
  });

  it('moves the page to the year that the user picks, in the same month', async () => {
    const onMonthChange = vi.fn();
    const { user } = await renderCalendar({
      minDate: day('2020-01-01'),
      maxDate: day('2030-12-31'),
      onMonthChange,
    });

    await user.selectOptions(select(), '2028');

    expect(select().value).toBe('2028');
    expect(onMonthChange).toHaveBeenCalledTimes(1);
    const [value, details] = onMonthChange.mock.calls[0]!;
    expect(value.toString()).toBe('2028-11');
    expect(details.reason).toBe('month-change');
    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe(
      format({ month: 'long', year: 'numeric' }, '2028-11-01'),
    );
  });

  it('stops at maxDate when the new year has no such month', async () => {
    const { user } = await renderCalendar({
      minDate: day('2020-01-01'),
      maxDate: day('2028-03-10'),
    });

    await user.selectOptions(select(), '2028');

    expect(screen.getByRole('grid').getAttribute('aria-label')).toBe(
      format({ month: 'long', year: 'numeric' }, '2028-03-01'),
    );
  });

  it('shows the years of the calendar of the grid', async () => {
    await renderCalendar({
      calendar: 'buddhist',
      minDate: day('2026-01-01'),
      maxDate: day('2027-12-31'),
    });

    expect(years()).toEqual([2569, 2570]);
    expect(select().value).toBe('2569');
  });
});
