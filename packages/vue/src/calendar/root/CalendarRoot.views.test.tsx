import { describe, expect, it, vi } from 'vitest';
import { createRenderer, flushMicrotasks, screen, waitFor } from '#test-utils';
import CalendarViewsAnatomy from './CalendarViewsAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const yearMonth = (text: string) => Temporal.PlainYearMonth.from(text);

// 2026-11-14 is a Saturday. The page of years that holds 2026 has 2016 to 2027.
const today = () => day('2026-11-14');

function format(
  options: Intl.DateTimeFormatOptions,
  iso: string,
  locale = 'en-US',
  calendar?: string,
) {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', calendar, ...options }).format(
    Date.parse(iso),
  );
}

const monthLabel = (iso: string, locale = 'en-US', calendar?: string) =>
  format({ month: 'long', year: 'numeric' }, iso, locale, calendar);

const years = (from: string, to: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' }).formatRange(
    Date.parse(from),
    Date.parse(to),
  );

const fieldName = (field: 'month' | 'year') =>
  new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(field);

const monthCell = (iso: string) => screen.getByRole('gridcell', { name: monthLabel(iso) });
const yearCell = (year: number) => screen.getByRole('gridcell', { name: String(year) });
const root = () => screen.getByRole('group');
const yearTrigger = () => screen.getByTestId('year-trigger');
const monthTrigger = () => screen.getByTestId('month-trigger');

function dayButton(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

// The names of the cells that have an attribute.
function cellsWith(attribute: string) {
  return screen
    .getAllByRole('gridcell')
    .filter((cell) => cell.hasAttribute(attribute))
    .map((cell) => cell.getAttribute('aria-label') ?? cell.textContent);
}

describe('<Calendar.Root /> views', () => {
  const { render } = createRenderer();

  function renderViews(props: Record<string, unknown> = {}) {
    return render(<CalendarViewsAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  describe('the view', () => {
    it.each([
      { view: 'day', grid: monthLabel('2026-11-01'), cells: 0 },
      { view: 'month', grid: fieldName('month'), cells: 12 },
      { view: 'year', grid: fieldName('year'), cells: 12 },
    ])('shows only the grid of the view $view', async ({ view, grid, cells }) => {
      await renderViews({ defaultView: view });

      expect(screen.getAllByRole('grid')).toHaveLength(1);
      expect(screen.getByRole('grid', { name: grid })).not.toBe(null);
      // The days are in cells of the table, and the other views have a button in each cell.
      expect(
        screen.queryAllByRole('gridcell').filter((cell) => cell.tagName === 'BUTTON'),
      ).toHaveLength(cells);
      expect(root()).toHaveAttribute('data-view', view);
    });

    it.each([
      { view: 'month', name: '2026' },
      { view: 'year', name: years('2016-01-01', '2027-01-01') },
    ])('names the root by what the view $view shows', async ({ view, name }) => {
      await renderViews({ defaultView: view });

      expect(root()).toHaveAttribute('aria-label', name);
    });

    it('starts with defaultView, and an uncontrolled root keeps the view that a press gives', async () => {
      const { user } = await renderViews({ defaultView: 'month' });
      expect(root()).toHaveAttribute('data-view', 'month');

      await user.click(yearTrigger());

      expect(root()).toHaveAttribute('data-view', 'year');
    });

    it('shows the view of the consumer, and changes it only when the consumer does', async () => {
      const onViewChange = vi.fn();
      const { user, setProps } = await renderViews({ view: 'month', onViewChange });

      await user.click(yearTrigger());

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0]![0]).toBe('year');
      expect(root()).toHaveAttribute('data-view', 'month');

      await setProps({ view: 'year' });

      expect(root()).toHaveAttribute('data-view', 'year');
    });

    it('emits viewChange before update:view, and a cancel keeps the view', async () => {
      const calls: string[] = [];
      const onViewChange = vi.fn((_view: string, details: { cancel: () => void }) => {
        calls.push('viewChange');
        details.cancel();
      });
      const { user } = await renderViews({
        onViewChange,
        'onUpdate:view': () => {
          calls.push('update:view');
        },
      });

      await user.click(yearTrigger());

      expect(calls).toEqual(['viewChange']);
      expect(root()).toHaveAttribute('data-view', 'day');
    });

    it('emits update:view with the view after viewChange', async () => {
      const calls: string[] = [];
      const { user } = await renderViews({
        onViewChange: (view: string) => calls.push(`viewChange ${view}`),
        'onUpdate:view': (view: string) => calls.push(`update:view ${view}`),
      });

      await user.click(yearTrigger());

      expect(calls).toEqual(['viewChange year', 'update:view year']);
    });

    it('shows the days only with visibleDuration, whatever the view', async () => {
      await renderViews({ defaultView: 'year', visibleDuration: { weeks: 2 } });

      expect(root()).toHaveAttribute('data-view', 'day');
      expect(screen.getAllByRole('grid')).toHaveLength(1);
    });
  });

  describe('Calendar.ViewTrigger', () => {
    it('names its button by the view that it shows, and shows the name of the page', async () => {
      await renderViews();

      expect(yearTrigger()).toHaveAttribute(
        'aria-label',
        `${monthLabel('2026-11-01')}, choose the year`,
      );
      expect(monthTrigger()).toHaveAttribute(
        'aria-label',
        `${monthLabel('2026-11-01')}, choose the month`,
      );
      expect(yearTrigger()).toHaveAttribute('aria-live', 'polite');
      expect(yearTrigger()).toHaveTextContent(monthLabel('2026-11-01'));
    });

    it('shows each view in turn, and shows the first view again for a second press', async () => {
      const { user } = await renderViews();

      await user.click(yearTrigger());
      expect(root()).toHaveAttribute('data-view', 'year');
      expect(yearTrigger()).toHaveTextContent(years('2016-01-01', '2027-01-01'));
      expect(yearTrigger()).toHaveAttribute('data-active');
      expect(yearTrigger()).toHaveAttribute('data-view', 'year');
      expect(monthTrigger()).not.toHaveAttribute('data-active');

      await user.click(monthTrigger());
      expect(root()).toHaveAttribute('data-view', 'month');
      expect(monthTrigger()).toHaveTextContent('2026');
      expect(monthTrigger()).toHaveAttribute('data-active');

      await user.click(monthTrigger());
      expect(root()).toHaveAttribute('data-view', 'day');
      expect(yearTrigger()).not.toHaveAttribute('data-active');
    });

    it('shows the months again, and not the days, for a value that is a year and month', async () => {
      const { user } = await renderViews({ defaultValue: yearMonth('2026-11') });
      expect(root()).toHaveAttribute('data-view', 'month');

      await user.click(yearTrigger());
      expect(root()).toHaveAttribute('data-view', 'year');

      await user.click(yearTrigger());
      expect(root()).toHaveAttribute('data-view', 'month');
    });

    it('keeps the focus on the trigger when the view changes', async () => {
      const { user } = await renderViews();

      await user.click(yearTrigger());
      await flushMicrotasks();

      expect(yearTrigger()).toHaveFocus();
    });
  });

  describe('the flow from the years to the days', () => {
    it('shows the months of a year that a press gives, and then the days of a month', async () => {
      const onViewChange = vi.fn();
      const onMonthChange = vi.fn();
      const { user } = await renderViews({ onViewChange, onMonthChange });

      await user.click(yearTrigger());
      await user.click(yearCell(2027));

      expect(root()).toHaveAttribute('data-view', 'month');
      expect(monthTrigger()).toHaveTextContent('2027');
      await user.click(monthCell('2027-03-01'));

      expect(root()).toHaveAttribute('data-view', 'day');
      expect(screen.getByRole('grid', { name: monthLabel('2027-03-01') })).not.toBe(null);
      expect(onViewChange.mock.calls.map(([view, { reason }]) => [view, reason])).toEqual([
        ['year', 'trigger-press'],
        ['month', 'year-press'],
        ['day', 'month-press'],
      ]);
      // A year press keeps the month of the page. A month press gives the month of the cell.
      expect(
        onMonthChange.mock.calls.map(([month, { reason }]) => [month.toString(), reason]),
      ).toEqual([
        ['2027-11', 'year-press'],
        ['2027-03', 'month-press'],
      ]);
    });

    it('does not select a day for a press on a month or a year', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({ defaultView: 'month', onValueChange });

      await user.click(monthCell('2026-03-01'));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(root()).toHaveAttribute('data-empty');
    });

    it('emits no month change for a press on the month that the root has', async () => {
      const onMonthChange = vi.fn();
      const onViewChange = vi.fn();
      const { user } = await renderViews({ defaultView: 'month', onMonthChange, onViewChange });

      await user.click(monthCell('2026-11-01'));

      expect(onMonthChange).not.toHaveBeenCalled();
      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(root()).toHaveAttribute('data-view', 'day');
    });

    it('keeps the view and the month when a listener cancels the month change', async () => {
      const onViewChange = vi.fn();
      const { user } = await renderViews({
        defaultView: 'month',
        onViewChange,
        onMonthChange: (_month: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });

      await user.click(monthCell('2026-03-01'));

      expect(onViewChange).not.toHaveBeenCalled();
      expect(root()).toHaveAttribute('data-view', 'month');
      expect(root()).toHaveAttribute('aria-label', '2026');
    });

    it('shows the days of a month with a press, also when the calendar is read-only', async () => {
      const { user } = await renderViews({ defaultView: 'month', readOnly: true });

      await user.click(monthCell('2026-03-01'));

      expect(root()).toHaveAttribute('data-view', 'day');
    });

    it('moves the focus to the same day of the month in the days of the month that a key gives', async () => {
      const { user } = await renderViews({ defaultView: 'month', defaultValue: day('2026-11-10') });
      monthCell('2026-03-01').focus();

      await user.keyboard('{Enter}');

      await waitFor(() => {
        expect(dayButton('2026-03-10')).toHaveFocus();
      });
    });

    it('has no leaving month and no direction after the pages changed while no day showed', async () => {
      const { user } = await renderViews({ defaultView: 'month' });

      await user.click(screen.getByTestId('next'));
      await user.click(monthCell('2027-03-01'));

      expect(root()).toHaveAttribute('data-navigation-direction', 'none');
      expect(screen.getAllByRole('grid')).toHaveLength(1);
      expect(document.querySelectorAll('[data-ending-style], [inert]')).toHaveLength(0);
    });
  });

  describe('a value that is a year and month', () => {
    it('shows the grid of months, with the month of the value selected', async () => {
      await renderViews({ defaultValue: yearMonth('2026-03') });

      expect(root()).toHaveAttribute('data-view', 'month');
      expect(screen.getByRole('grid', { name: fieldName('month') })).not.toHaveAttribute(
        'aria-multiselectable',
      );
      expect(cellsWith('data-selected')).toEqual([monthLabel('2026-03-01')]);
      expect(monthCell('2026-03-01')).toHaveAttribute('aria-selected', 'true');
      expect(monthCell('2026-04-01')).toHaveAttribute('aria-selected', 'false');
    });

    it('selects a month with a press, and gives a year and month', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({ defaultValue: yearMonth('2026-11'), onValueChange });

      await user.click(monthCell('2026-03-01'));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      const [value, details] = onValueChange.mock.calls[0]!;
      expect(value).toBeInstanceOf(Temporal.PlainYearMonth);
      expect(value.toString()).toBe('2026-03');
      expect(details.reason).toBe('month-press');
      expect(cellsWith('data-selected')).toEqual([monthLabel('2026-03-01')]);
      // The grid stays: a month press selects, and does not show days.
      expect(root()).toHaveAttribute('data-view', 'month');
    });

    it('changes nothing for a press on the selected month', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({ defaultValue: yearMonth('2026-11'), onValueChange });

      await user.click(monthCell('2026-11-01'));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('selects nothing when the calendar is read-only, and the cells still take focus', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({
        defaultValue: yearMonth('2026-11'),
        readOnly: true,
        onValueChange,
      });

      await user.click(monthCell('2026-03-01'));

      expect(onValueChange).not.toHaveBeenCalled();
      expect(monthCell('2026-03-01')).toHaveFocus();
    });

    it('selects the month that the consumer gives, and waits for the consumer', async () => {
      const onValueChange = vi.fn();
      const { user, setProps } = await renderViews({
        value: yearMonth('2026-11'),
        onValueChange,
      });

      await user.click(monthCell('2026-03-01'));

      expect(cellsWith('data-selected')).toEqual([monthLabel('2026-11-01')]);
      await setProps({ value: onValueChange.mock.calls[0]![0] });
      expect(cellsWith('data-selected')).toEqual([monthLabel('2026-03-01')]);
    });

    it('has no month selected for a value of null, and keeps the kind of the default value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({
        value: null,
        defaultValue: yearMonth('2026-11'),
        onValueChange,
      });

      await user.click(monthCell('2026-03-01'));

      expect(cellsWith('data-selected')).toEqual([]);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-03');
    });

    describe('with multiple', () => {
      it('adds a month, and removes a month that a press reaches again', async () => {
        const onValueChange = vi.fn();
        const { user } = await renderViews({
          multiple: true,
          defaultValue: [yearMonth('2026-11')],
          onValueChange,
        });
        expect(screen.getByRole('grid', { name: fieldName('month') })).toHaveAttribute(
          'aria-multiselectable',
          'true',
        );

        await user.click(monthCell('2026-03-01'));
        expect(onValueChange.mock.lastCall![0].map(String)).toEqual(['2026-11', '2026-03']);

        await user.click(monthCell('2026-11-01'));
        expect(onValueChange.mock.lastCall![0].map(String)).toEqual(['2026-03']);
        expect(cellsWith('data-selected')).toEqual([monthLabel('2026-03-01')]);
      });

      it('keeps minDays months, and adds no month past maxDays', async () => {
        const onValueChange = vi.fn();
        const { user } = await renderViews({
          multiple: true,
          minDays: 1,
          maxDays: 2,
          defaultValue: [yearMonth('2026-11')],
          onValueChange,
        });

        await user.click(monthCell('2026-11-01'));
        expect(onValueChange).not.toHaveBeenCalled();

        await user.click(monthCell('2026-03-01'));
        await user.click(monthCell('2026-04-01'));
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(cellsWith('data-selected')).toEqual([
          monthLabel('2026-03-01'),
          monthLabel('2026-11-01'),
        ]);
      });
    });

    it('shows an ISO value in the Buddhist calendar of its locale, and gives an ISO value', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({
        locale: 'th-TH',
        defaultValue: yearMonth('2026-11'),
        onValueChange,
      });
      const label = (iso: string) => monthLabel(iso, 'th-TH', 'buddhist');

      expect(screen.getByRole('gridcell', { name: label('2026-11-01') })).toHaveAttribute(
        'aria-selected',
        'true',
      );
      expect(yearTrigger()).toHaveTextContent(
        format({ year: 'numeric' }, '2026-11-01', 'th-TH', 'buddhist'),
      );

      await user.click(screen.getByRole('gridcell', { name: label('2026-03-01') }));

      const value = onValueChange.mock.calls[0]![0] as Temporal.PlainYearMonth;
      expect(value.toString()).toBe('2026-03');
      expect(value.calendarId).toBe('iso8601');
    });

    it('shows a Persian value in its own months, and gives a Persian value', async () => {
      const persian = day('2026-11-14').withCalendar('persian').toPlainYearMonth();
      const onValueChange = vi.fn();
      const { user } = await renderViews({ defaultValue: persian, onValueChange });
      const label = (cell: Temporal.PlainYearMonth) =>
        monthLabel(
          cell.toPlainDate({ day: 1 }).withCalendar('iso8601').toString(),
          'en-US',
          'persian',
        );

      expect(screen.getAllByRole('gridcell')).toHaveLength(12);
      expect(screen.getByRole('gridcell', { name: label(persian) })).toHaveAttribute(
        'aria-selected',
        'true',
      );

      await user.click(screen.getByRole('gridcell', { name: label(persian.add({ months: 1 })) }));

      const value = onValueChange.mock.calls[0]![0] as Temporal.PlainYearMonth;
      expect(value.calendarId).toBe('persian');
      expect(value.toString()).toBe(persian.add({ months: 1 }).toString());
    });

    it('shows the 13 months of a Hebrew leap year', async () => {
      const hebrew = Temporal.PlainYearMonth.from({ year: 5787, month: 1, calendar: 'hebrew' });

      await renderViews({ defaultValue: hebrew });

      expect(screen.getAllByRole('gridcell')).toHaveLength(13);
    });
  });

  describe('the buttons that move the pages', () => {
    it('moves a year in the grid of months, with a label for it', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderViews({ defaultView: 'month', onMonthChange });
      expect(screen.getByTestId('previous')).toHaveAttribute('aria-label', 'Previous year');

      await user.click(screen.getByTestId('next'));

      expect(monthTrigger()).toHaveTextContent('2027');
      expect(monthCell('2027-03-01')).not.toBe(null);
      const [month, details] = onMonthChange.mock.calls[0]!;
      expect(month.toString()).toBe('2027-11');
      expect(details.reason).toBe('month-change');
      expect(screen.getByTestId('next')).toHaveAttribute('aria-label', 'Next year');
    });

    it('moves the years of a page in the grid of years, with a label for them', async () => {
      const { user } = await renderViews({ defaultView: 'year' });
      expect(screen.getByTestId('previous')).toHaveAttribute('aria-label', 'Previous 12 years');

      await user.click(screen.getByTestId('next'));

      expect(yearTrigger()).toHaveTextContent(years('2028-01-01', '2039-01-01'));
      await user.click(screen.getByTestId('previous'));
      await user.click(screen.getByTestId('previous'));
      expect(yearTrigger()).toHaveTextContent(years('2004-01-01', '2015-01-01'));
    });

    it('moves the days again after the view comes back to the days', async () => {
      const { user } = await renderViews();
      await user.click(yearTrigger());
      expect(screen.getByTestId('next')).toHaveAttribute('aria-label', 'Next 12 years');

      await user.click(yearTrigger());

      expect(screen.getByTestId('next')).toHaveAttribute('aria-label', 'Next month');
    });

    it.each([
      {
        name: 'the grid of months, at minDate',
        props: { defaultView: 'month', minDate: day('2026-02-01') },
        previous: true,
        next: false,
      },
      {
        name: 'the grid of months, at maxDate',
        props: { defaultView: 'month', maxDate: day('2026-12-31') },
        previous: false,
        next: true,
      },
      {
        name: 'the grid of years, at minDate',
        props: { defaultView: 'year', minDate: day('2016-01-01') },
        previous: true,
        next: false,
      },
    ])('disables a button at a limit: $name', async ({ props, previous, next }) => {
      await renderViews(props);

      expect(screen.getByTestId('previous').getAttribute('aria-disabled') === 'true').toBe(
        previous,
      );
      expect(screen.getByTestId('next').getAttribute('aria-disabled') === 'true').toBe(next);
    });

    it('keeps the page inside the limits for a move past them', async () => {
      const { user } = await renderViews({ defaultView: 'month', minDate: day('2025-12-10') });

      await user.click(screen.getByTestId('previous'));

      expect(monthTrigger()).toHaveTextContent('2025');
      expect(cellsWith('data-disabled')).toEqual(
        Array.from({ length: 11 }, (_, index) =>
          monthLabel(`2025-${String(index + 1).padStart(2, '0')}-01`),
        ),
      );
    });
  });

  describe('visibleYears and columns', () => {
    it('shows the years of a page of visibleYears, that starts at a multiple of it', async () => {
      const { user } = await renderViews({ defaultView: 'year', visibleYears: 5 });

      expect(screen.getAllByRole('gridcell').map((cell) => cell.textContent)).toEqual([
        '2025',
        '2026',
        '2027',
        '2028',
        '2029',
      ]);
      expect(screen.getByTestId('next')).toHaveAttribute('aria-label', 'Next 5 years');

      await user.click(screen.getByTestId('next'));

      expect(yearTrigger()).toHaveTextContent(years('2030-01-01', '2034-01-01'));
    });

    it('gives each grid the rows of its columns', async () => {
      await renderViews({ defaultView: 'month', columns: 5 });

      const rows = screen.getAllByRole('row');
      expect(rows.map((row) => row.children.length)).toEqual([5, 5, 2]);
    });
  });

  describe('the cells', () => {
    it('limits the months and the years by minDate, maxDate and the functions', async () => {
      await renderViews({
        defaultView: 'month',
        minDate: day('2026-03-15'),
        maxDate: day('2026-09-10'),
        disabledMonths: (month: Temporal.PlainYearMonth) => month.month === 5,
      });

      expect(cellsWith('data-disabled')).toEqual(
        ['2026-01', '2026-02', '2026-05', '2026-10', '2026-11', '2026-12'].map((iso) =>
          monthLabel(`${iso}-01`),
        ),
      );
      expect(monthCell('2026-05-01')).toBeDisabled();
      expect(monthCell('2026-05-01')).toHaveAttribute('aria-disabled', 'true');
      expect(monthCell('2026-04-01')).toBeEnabled();
    });

    it('limits the years by minDate, maxDate and the function', async () => {
      await renderViews({
        defaultView: 'year',
        minDate: day('2018-05-05'),
        maxDate: day('2025-05-05'),
        disabledYears: (year: Temporal.PlainYearMonth) => year.year === 2020,
      });

      expect(cellsWith('data-disabled')).toEqual(['2016', '2017', '2020', '2026', '2027']);
      expect(yearCell(2020)).toBeDisabled();
    });

    it('does not show the days or give a press to a disabled cell', async () => {
      const onViewChange = vi.fn();
      const { user } = await renderViews({
        defaultView: 'month',
        disabledMonths: (month: Temporal.PlainYearMonth) => month.month === 5,
        onViewChange,
      });

      await user.click(monthCell('2026-05-01'));

      expect(onViewChange).not.toHaveBeenCalled();
    });

    it('disables each cell and the trigger for a disabled calendar', async () => {
      await renderViews({ defaultView: 'year', disabled: true });

      expect(screen.getAllByRole('gridcell').every((cell) => cell.hasAttribute('disabled'))).toBe(
        true,
      );
      expect(root()).toHaveAttribute('data-disabled');
      expect(yearTrigger()).toBeDisabled();
    });

    it('marks the month and the year of today, with aria-current', async () => {
      await renderViews({ defaultView: 'month' });

      expect(monthCell('2026-11-01')).toHaveAttribute('aria-current', 'date');
      expect(monthCell('2026-11-01')).toHaveAttribute('data-current');
      expect(monthCell('2026-10-01')).not.toHaveAttribute('aria-current');
    });

    it('selects the month and the year of a selected day, which a press does not change', async () => {
      await renderViews({ defaultView: 'month', defaultValue: day('2026-03-10') });

      expect(cellsWith('data-selected')).toEqual([monthLabel('2026-03-01')]);
    });
  });

  describe('the tab stop', () => {
    const tabStops = () =>
      screen
        .getAllByRole('gridcell')
        .filter((cell) => cell.getAttribute('tabindex') === '0')
        .map((cell) => cell.getAttribute('aria-label') ?? cell.textContent);

    it.each([
      { name: 'today', props: {}, expected: monthLabel('2026-11-01') },
      {
        name: 'the selected month',
        props: { defaultValue: day('2026-03-10') },
        expected: monthLabel('2026-03-01'),
      },
      {
        name: 'the focused month',
        props: { defaultValue: day('2026-03-10'), focusedDate: day('2026-08-01') },
        expected: monthLabel('2026-08-01'),
      },
      {
        name: 'the first month when today is disabled',
        props: { disabledMonths: (month: Temporal.PlainYearMonth) => month.month === 11 },
        expected: monthLabel('2026-01-01'),
      },
    ])('is on $name in the grid of months', async ({ props, expected }) => {
      await renderViews({ defaultView: 'month', ...props });

      expect(tabStops()).toEqual([expected]);
    });

    it('moves to the first year of a page that has neither the selected year nor today', async () => {
      const { user } = await renderViews({ defaultView: 'year' });

      await user.click(screen.getByTestId('next'));

      expect(tabStops()).toEqual(['2028']);
    });

    it('has no tab stop when each cell is disabled', async () => {
      await renderViews({ defaultView: 'month', disabled: true });

      expect(tabStops()).toEqual([]);
    });
  });

  describe('the focused date', () => {
    it('shows the year of a focused date that the grid of months does not show', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderViews({
        defaultView: 'month',
        focusedDate: day('2026-11-14'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2030-02-01') });

      await waitFor(() => {
        expect(monthTrigger()).toHaveTextContent('2030');
      });
      expect(onMonthChange.mock.calls[0]![0].toString()).toBe('2030-02');
      expect(onMonthChange.mock.calls[0]![1].reason).toBe('none');
    });

    it('shows no other page for a focused date in the year that the grid shows', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderViews({
        defaultView: 'month',
        focusedDate: day('2026-11-14'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-02-01') });

      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('shows the page of years that holds a focused date', async () => {
      const { setProps } = await renderViews({
        defaultView: 'year',
        focusedDate: day('2026-11-14'),
      });

      await setProps({ focusedDate: day('2040-02-01') });

      await waitFor(() => {
        expect(yearTrigger()).toHaveTextContent(years('2040-01-01', '2051-01-01'));
      });
    });
  });

  describe('focus', () => {
    async function renderWithApi(props: Record<string, unknown> = {}) {
      let api: { root: { focus: (date?: Temporal.PlainDate) => void } } | null = null;
      await render(() => (
        <CalendarViewsAnatomy
          {...{ today: today(), locale: 'en-US', ...props }}
          ref={(instance: unknown) => {
            api = instance as typeof api;
          }}
        />
      ));
      return api!.root;
    }

    it('focuses the tab stop of the grid that shows', async () => {
      const root = await renderWithApi({ defaultView: 'month', defaultValue: day('2026-03-10') });

      root.focus();

      await waitFor(() => {
        expect(monthCell('2026-03-01')).toHaveFocus();
      });
    });

    it('focuses the cell of a date, and shows its page first', async () => {
      const root = await renderWithApi({ defaultView: 'month' });

      root.focus(day('2027-06-20'));

      await waitFor(() => {
        expect(monthCell('2027-06-01')).toHaveFocus();
      });
      expect(monthTrigger()).toHaveTextContent('2027');
    });

    it('focuses the cell of a year, and shows its page first', async () => {
      const root = await renderWithApi({ defaultView: 'year' });

      root.focus(day('2031-06-20'));

      await waitFor(() => {
        expect(yearCell(2031)).toHaveFocus();
      });
    });

    it('does not focus a cell that is disabled', async () => {
      const root = await renderWithApi({
        defaultView: 'month',
        disabledMonths: (month: Temporal.PlainYearMonth) => month.month === 3,
      });

      root.focus(day('2026-03-10'));
      await flushMicrotasks();

      expect(document.activeElement).toBe(document.body);
    });

    it('focuses the tab stop at the mount with autoFocus', async () => {
      await renderViews({ defaultView: 'month', autoFocus: true });

      await waitFor(() => {
        expect(monthCell('2026-11-01')).toHaveFocus();
      });
    });

    it('reports the focused date of a focus on a cell, in the month or the year of that cell', async () => {
      const onFocusedDateChange = vi.fn();
      await renderViews({
        defaultView: 'month',
        focusedDate: day('2026-11-30'),
        onFocusedDateChange,
      });

      monthCell('2026-02-01').focus();

      const [date, details] = onFocusedDateChange.mock.calls[0]!;
      expect(date.toString()).toBe('2026-02-28');
      expect(details.reason).toBe('none');
    });
  });
});
