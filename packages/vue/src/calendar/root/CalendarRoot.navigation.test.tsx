import { describe, expect, it, vi } from 'vitest';
import { createRenderer, screen, takeReportedMessages, waitFor } from '#test-utils';
import CalendarNavigationAnatomy from './CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function cell(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"]`);
}

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string) => format({ month: 'long', year: 'numeric' }, iso);

// The names of the grids, one for each month that the calendar shows.
function gridNames() {
  return screen.getAllByRole('grid').map((grid) => grid.getAttribute('aria-label'));
}

// The weekdays that a header row shows.
function headers() {
  return screen.getAllByRole('columnheader').map((header) => header.getAttribute('abbr'));
}

function weeks() {
  return document.querySelectorAll('tbody tr');
}

describe('<Calendar.Root /> pages', () => {
  const { render } = createRenderer();

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  describe('numberOfMonths', () => {
    it('shows one grid for each month, one after the other, with a name for each', async () => {
      await renderCalendar({ numberOfMonths: 2 });

      expect(gridNames()).toEqual([monthName('2026-11-01'), monthName('2026-12-01')]);
      const range = new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        year: 'numeric',
      }).formatRange(Date.parse('2026-11-01'), Date.parse('2026-12-01'));
      expect(screen.getByRole('group', { name: range })).toHaveAttribute('data-multiple-months');
    });

    it('has the data attribute of the months only for more than one month', async () => {
      await renderCalendar();

      expect(screen.getByRole('group')).not.toHaveAttribute('data-multiple-months');
    });

    it('has one tab stop for all the grids', async () => {
      await renderCalendar({ numberOfMonths: 3 });

      expect(document.querySelectorAll('[data-date] button[tabindex="0"]')).toHaveLength(1);
      expect(button('2026-11-14')).toHaveAttribute('tabindex', '0');
    });

    it('gives each day of two grids that touch one button, with showOutsideDays', async () => {
      await renderCalendar({ numberOfMonths: 2, showOutsideDays: true });

      // December 1 to 5 are in the last week of November, and in the first week of December.
      expect(document.querySelectorAll('[data-date="2026-12-02"]')).toHaveLength(2);
      expect(document.querySelectorAll('[data-date="2026-12-02"] button')).toHaveLength(1);
      expect(button('2026-12-02')!.closest('table')).toBe(screen.getAllByRole('grid')[1]);
      // The month that the page owns shows its last day, and the last grid shows the days after it.
      expect(document.querySelectorAll('[data-date="2026-11-29"] button')).toHaveLength(1);
      expect(button('2026-11-29')!.closest('table')).toBe(screen.getAllByRole('grid')[0]);
      expect(button('2027-01-02')!.closest('table')).toBe(screen.getAllByRole('grid')[1]);
    });

    it('moves the focus to a day of the next grid with no change of the page', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({ numberOfMonths: 2, onMonthChange });
      button('2026-11-30')!.focus();

      await user.keyboard('{ArrowRight}');

      expect(button('2026-12-01')).toHaveFocus();
      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it.each([
      {
        name: 'after the last grid',
        props: { defaultMonth: Temporal.PlainYearMonth.from('2026-11') },
        from: '2026-12-31',
        keys: '{ArrowRight}',
        first: '2027-01-01',
        to: '2027-01-01',
      },
      {
        name: 'before the first grid',
        props: {},
        from: '2026-11-01',
        keys: '{ArrowLeft}',
        first: '2026-09-01',
        to: '2026-10-31',
      },
    ])(
      'shows the page that ends or starts with the day that a key reaches: $name',
      async ({ props, from, keys, first, to }) => {
        const { user } = await renderCalendar({ numberOfMonths: 2, ...props });
        button(from)!.focus();

        await user.keyboard(keys);

        await waitFor(() => {
          expect(button(to)).toHaveFocus();
        });
        expect(gridNames()[0]).toBe(monthName(first));
      },
    );
  });

  describe('pagedNavigation', () => {
    it.each([
      { name: 'one month', props: {}, expected: ['2026-12-01', '2027-01-01'] },
      {
        name: 'the count of months',
        props: { pagedNavigation: true },
        expected: ['2027-01-01', '2027-02-01'],
      },
    ])('moves the page by $name', async ({ props, expected }) => {
      const { user } = await renderCalendar({ numberOfMonths: 2, ...props });

      await user.click(screen.getByTestId('next'));

      expect(gridNames()).toEqual(expected.map(monthName));
    });

    it('stops with the last grid at maxDate', async () => {
      const { user } = await renderCalendar({
        numberOfMonths: 2,
        pagedNavigation: true,
        maxDate: day('2027-02-10'),
      });

      await user.click(screen.getByTestId('next'));
      expect(gridNames()).toEqual([monthName('2027-01-01'), monthName('2027-02-01')]);
      expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'true');
    });

    it('moves to the limit when the count of months passes it', async () => {
      const { user } = await renderCalendar({
        numberOfMonths: 3,
        pagedNavigation: true,
        minDate: day('2026-10-01'),
      });

      await user.click(screen.getByTestId('previous'));

      expect(gridNames()).toEqual([
        monthName('2026-10-01'),
        monthName('2026-11-01'),
        monthName('2026-12-01'),
      ]);
      expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'true');
    });
  });

  describe('fixedWeeks', () => {
    it.each([
      { name: 'a month of five weeks', props: {}, rows: 5 },
      { name: 'a month of five weeks, with fixedWeeks', props: { fixedWeeks: true }, rows: 6 },
      {
        name: 'two months, with fixedWeeks',
        props: { fixedWeeks: true, numberOfMonths: 2 },
        rows: 12,
      },
    ])('has the rows for $name', async ({ props, rows }) => {
      await renderCalendar(props);

      expect(weeks()).toHaveLength(rows);
    });

    it('hides the days of the sixth week, with no button, unless showOutsideDays', async () => {
      await renderCalendar({ fixedWeeks: true });

      expect(cell('2026-12-10')).not.toBe(null);
      expect(button('2026-12-10')).toBe(null);
    });
  });

  describe('showOutsideDays', () => {
    it('gives a day of the next month a button that is outside the month', async () => {
      await renderCalendar({ showOutsideDays: true });

      expect(button('2026-12-02')).toHaveAttribute('data-outside-month');
      expect(button('2026-12-02')).not.toHaveAttribute('data-hidden');
    });

    it('has no button for such a day by default', async () => {
      await renderCalendar();

      expect(cell('2026-12-02')).toHaveAttribute('data-hidden');
      expect(button('2026-12-02')).toBe(null);
    });

    it('selects the day that a press reaches, shows its month, and keeps the focus on it', async () => {
      const onValueChange = vi.fn();
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({
        showOutsideDays: true,
        onValueChange,
        onMonthChange,
      });

      await user.click(button('2026-12-02')!);

      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-12-02');
      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange.mock.calls[0]![0].toString()).toBe('2026-12');
      expect(onMonthChange.mock.calls[0]![1].reason).toBe('day-press');
      await waitFor(() => {
        expect(button('2026-12-02')).toHaveFocus();
      });
      await waitFor(() => {
        expect(gridNames()).toEqual([monthName('2026-12-01')]);
      });
      expect(button('2026-12-02')).not.toHaveAttribute('data-outside-month');
      expect(button('2026-12-02')).toHaveAttribute('data-selected');
    });

    it('does not change the month for a press on a day of a grid that is there', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({
        numberOfMonths: 2,
        showOutsideDays: true,
        onMonthChange,
      });

      await user.click(button('2026-12-02')!);

      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('shows the month of a press on an unavailable day, which it does not select', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderCalendar({
        showOutsideDays: true,
        unavailableDates: day('2026-12-02'),
        onValueChange,
      });

      await user.click(button('2026-12-02')!);

      expect(onValueChange).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(gridNames()).toEqual([monthName('2026-12-01')]);
      });
    });
  });

  describe('broadcastCalendar', () => {
    it('shows the weeks from the Monday of the week of the first day, to the last Sunday', async () => {
      await renderCalendar({ broadcastCalendar: true });

      expect(weeks()).toHaveLength(5);
      expect(button('2026-10-26')).not.toBe(null);
      expect(button('2026-11-29')).not.toBe(null);
      expect(cell('2026-11-30')).toBe(null);
      expect(gridNames()).toEqual([monthName('2026-11-01')]);
      expect(screen.getByRole('group')).toHaveAttribute('data-broadcast-calendar');
    });

    it('starts the week on Monday in a locale that starts it on Sunday', async () => {
      await renderCalendar({ broadcastCalendar: true });

      expect(headers()).toEqual(
        [2, 3, 4, 5, 6, 7, 8].map((dayOfMonth) =>
          format({ weekday: 'long' }, `2026-11-${String(dayOfMonth).padStart(2, '0')}`),
        ),
      );
    });

    it('shows the days of the weeks around the month as outside days, with a button', async () => {
      await renderCalendar({ broadcastCalendar: true });

      expect(button('2026-10-28')).toHaveAttribute('data-outside-month');
      expect(button('2026-11-01')).not.toHaveAttribute('data-outside-month');
    });

    it('hides the outside days when showOutsideDays is false', async () => {
      await renderCalendar({ broadcastCalendar: true, showOutsideDays: false });

      expect(cell('2026-10-28')).not.toBe(null);
      expect(button('2026-10-28')).toBe(null);
    });

    it('has 4 weeks for a month of 4 weeks', async () => {
      const defaultMonth = Temporal.PlainYearMonth.from('2026-10');
      await renderCalendar({ broadcastCalendar: true, defaultMonth });

      expect(weeks()).toHaveLength(4);
    });

    it('has 5 weeks with fixedWeeks', async () => {
      await renderCalendar({
        broadcastCalendar: true,
        fixedWeeks: true,
        defaultMonth: Temporal.PlainYearMonth.from('2026-10'),
      });

      expect(weeks()).toHaveLength(5);
    });

    it('moves from a day of the next broadcast month to that month', async () => {
      const { user } = await renderCalendar({
        broadcastCalendar: true,
        defaultFocusedDate: day('2026-11-29'),
      });
      button('2026-11-29')!.focus();

      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(button('2026-11-30')).toHaveFocus();
      });
      expect(gridNames()).toEqual([monthName('2026-12-01')]);
    });

    it('moves by a broadcast month', async () => {
      const { user } = await renderCalendar({ broadcastCalendar: true });

      await user.click(screen.getByTestId('next'));

      expect(gridNames()).toEqual([monthName('2026-12-01')]);
      expect(button('2026-11-30')).not.toBe(null);
      expect(button('2026-11-29')).toBe(null);
    });
  });

  describe('visibleDuration', () => {
    const iso = (date: Element | null) => date?.closest('[data-date]')?.getAttribute('data-date');

    // The text of the caption, in the format of a page of weeks or days.
    function range(from: string, to: string) {
      return new Intl.DateTimeFormat('en-US', {
        timeZone: 'UTC',
        month: 'long',
        day: 'numeric',
        year: 'numeric',
      }).formatRange(Date.parse(from), Date.parse(to));
    }

    it('shows whole weeks, from the week of the focused day, and names the range', async () => {
      await renderCalendar({ visibleDuration: { weeks: 2 } });

      expect(weeks()).toHaveLength(2);
      expect(iso(document.querySelector('[data-date] button'))).toBe('2026-11-08');
      expect(document.querySelectorAll('[data-date] button')).toHaveLength(14);
      expect(gridNames()).toEqual([range('2026-11-08', '2026-11-21')]);
      expect(headers()).toHaveLength(7);
    });

    it('shows the days of one row, from the focused day, with the names of those days', async () => {
      await renderCalendar({ visibleDuration: { days: 5 } });

      expect(weeks()).toHaveLength(1);
      expect(
        [...document.querySelectorAll('[data-date]')].map((item) => item.getAttribute('data-date')),
      ).toEqual(['2026-11-14', '2026-11-15', '2026-11-16', '2026-11-17', '2026-11-18']);
      expect(headers()).toEqual(
        [14, 15, 16, 17, 18].map((dayOfMonth) =>
          format({ weekday: 'long' }, `2026-11-${dayOfMonth}`),
        ),
      );
      expect(gridNames()).toEqual([range('2026-11-14', '2026-11-18')]);
    });

    it('has no day outside the month, and one tab stop', async () => {
      await renderCalendar({
        visibleDuration: { weeks: 2 },
        defaultFocusedDate: day('2026-11-25'),
      });

      // The page of 2026-11-22 to 2026-12-05 has days of two months and no outside day.
      expect(document.querySelectorAll('[data-outside-month]')).toHaveLength(0);
      expect(document.querySelectorAll('[data-date] button')).toHaveLength(14);
      expect(document.querySelectorAll('[data-date] button[tabindex="0"]')).toHaveLength(1);
      expect(button('2026-11-25')).toHaveAttribute('tabindex', '0');
    });

    it('moves the page by the duration with the buttons, and names them', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({ visibleDuration: { weeks: 2 }, onMonthChange });
      expect(screen.getByTestId('next')).toHaveAccessibleName('Next 2 weeks');
      expect(screen.getByTestId('previous')).toHaveAccessibleName('Previous 2 weeks');

      await user.click(screen.getByTestId('next'));
      expect(gridNames()).toEqual([range('2026-11-22', '2026-12-05')]);
      expect(onMonthChange).not.toHaveBeenCalled();

      await user.click(screen.getByTestId('next'));
      expect(gridNames()).toEqual([range('2026-12-06', '2026-12-19')]);
      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange.mock.calls[0]![0].toString()).toBe('2026-12');

      await user.click(screen.getByTestId('previous'));
      await user.click(screen.getByTestId('previous'));
      expect(gridNames()).toEqual([range('2026-11-08', '2026-11-21')]);
    });

    it('moves a page of days by its days', async () => {
      const { user } = await renderCalendar({ visibleDuration: { days: 5 } });
      expect(screen.getByTestId('next')).toHaveAccessibleName('Next 5 days');

      await user.click(screen.getByTestId('next'));

      expect(gridNames()).toEqual([range('2026-11-19', '2026-11-23')]);
    });

    it('does not move to a page that has no day that the user can reach', async () => {
      await renderCalendar({
        visibleDuration: { weeks: 1 },
        minDate: day('2026-11-10'),
        maxDate: day('2026-11-14'),
      });

      expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'true');
      expect(screen.getByTestId('next')).toHaveAttribute('aria-disabled', 'true');
    });

    it.each([
      {
        name: 'after the page',
        visibleDuration: { days: 5 },
        from: '2026-11-18',
        keys: '{ArrowRight}',
        page: ['2026-11-19', '2026-11-23'],
        to: '2026-11-19',
      },
      {
        name: 'before the page',
        visibleDuration: { days: 5 },
        from: '2026-11-14',
        keys: '{ArrowLeft}',
        page: ['2026-11-09', '2026-11-13'],
        to: '2026-11-13',
      },
      {
        name: 'a week after the page',
        visibleDuration: { weeks: 1 },
        from: '2026-11-14',
        keys: '{ArrowDown}',
        page: ['2026-11-15', '2026-11-21'],
        to: '2026-11-21',
      },
      {
        name: 'a month after the page',
        visibleDuration: { weeks: 2 },
        from: '2026-11-14',
        keys: '{PageDown}',
        page: ['2026-12-13', '2026-12-26'],
        to: '2026-12-14',
      },
    ])(
      'shows the page that holds the day that a key reaches: $name',
      async ({ visibleDuration, from, keys, page, to }) => {
        const { user } = await renderCalendar({ visibleDuration });
        button(from)!.focus();

        await user.keyboard(keys);

        await waitFor(() => {
          expect(button(to)).toHaveFocus();
        });
        expect(gridNames()).toEqual([range(page[0]!, page[1]!)]);
      },
    );
  });

  describe('the footer', () => {
    it('shows a message in a live region', async () => {
      await renderCalendar({ footer: 'Select a day.' });

      expect(screen.getByRole('status')).toHaveTextContent('Select a day.');
    });
  });

  // This case is the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case then gets a warning about a slot.
  it('throws when the broadcast calendar has another calendar than the Gregorian one', async () => {
    await expect(renderCalendar({ broadcastCalendar: true, calendar: 'persian' })).rejects.toThrow(
      'Vase UI: <Calendar.Root> has `broadcastCalendar` and shows the calendar `persian`. The broadcast calendar is made of Gregorian months, so no other calendar can show it. Remove `broadcastCalendar`, or set `calendar="gregory"`.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
