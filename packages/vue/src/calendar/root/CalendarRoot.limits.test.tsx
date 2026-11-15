import { describe, expect, it, vi } from 'vitest';
import { createRenderer, screen, waitFor } from '#test-utils';
import type { CalendarPage } from '../../internals/date-time/calendar/monthGrid';
import * as Calendar from '../index.parts';
import CalendarNavigationAnatomy from './CalendarNavigationAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const yearMonth = (text: string) => Temporal.PlainYearMonth.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

const monthName = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    Date.parse(iso),
  );

const range = (start: string, end: string) =>
  new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  }).formatRange(Date.parse(start), Date.parse(end));

// The names of the grids, one for each page that the calendar shows.
function gridNames() {
  return screen.getAllByRole('grid').map((grid) => grid.getAttribute('aria-label'));
}

const months = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.map(([month]) => String(month));

// Two months between the limits, and three pages.
const shortRange = () => ({
  numberOfMonths: 3,
  minDate: day('2026-11-05'),
  maxDate: day('2026-12-20'),
});

// The pages that end with the month of maxDate.
const lastPages = ['2026-10-01', '2026-11-01', '2026-12-01'];

describe('<Calendar.Root /> pages at minDate and maxDate', () => {
  const { render } = createRenderer();

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  describe('the first render', () => {
    it.each([
      { name: 'from today', props: shortRange(), grids: lastPages },
      {
        name: 'from the focused day',
        props: { ...shortRange(), focusedDate: day('2026-12-10') },
        grids: lastPages,
      },
      {
        name: 'from today after maxDate',
        props: { maxDate: day('2026-09-20') },
        grids: ['2026-09-01'],
      },
      {
        name: 'from today before minDate',
        props: { minDate: day('2027-02-03') },
        grids: ['2027-02-01'],
      },
    ])('shows the pages that minDate and maxDate allow, $name', async ({ props, grids }) => {
      const onMonthChange = vi.fn();
      await renderCalendar({ ...props, onMonthChange });

      expect(gridNames()).toEqual(grids.map(monthName));
      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('shows defaultMonth as the consumer gives it', async () => {
      await renderCalendar({ ...shortRange(), defaultMonth: yearMonth('2026-11') });

      expect(gridNames()).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'].map(monthName));
    });

    it('ends a page of weeks with the week of maxDate', async () => {
      await renderCalendar({
        visibleDuration: { weeks: 4 },
        minDate: day('2026-11-05'),
        maxDate: day('2026-11-18'),
      });

      expect(gridNames()).toEqual([range('2026-10-25', '2026-11-21')]);
    });
  });

  describe('fewer months between the limits than the pages', () => {
    it('ends the pages with the month of maxDate for a month select of a later page', async () => {
      const onMonthChange = vi.fn();
      const { user } = await render(
        <Calendar.Root
          today={today()}
          locale="en-US"
          numberOfMonths={3}
          minDate={day('2026-11-05')}
          maxDate={day('2026-12-20')}
          defaultMonth={yearMonth('2026-11')}
          onMonthChange={onMonthChange}
        >
          <Calendar.Months
            v-slots={{
              month: ({ month, index }: { month: CalendarPage; index: number }) => (
                <Calendar.Month month={month}>
                  <Calendar.Caption data-testid="caption" />
                  <Calendar.MonthSelect data-testid={`month-select-${index}`} />
                </Calendar.Month>
              ),
            }}
          />
        </Calendar.Root>,
      );
      const captions = () => screen.getAllByTestId('caption').map((caption) => caption.textContent);
      expect(captions()).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'].map(monthName));

      // November in the second page asks for October as the first page.
      await user.selectOptions(screen.getByTestId('month-select-1'), 'M11');

      expect(months(onMonthChange)).toEqual(['2026-10']);
      await waitFor(() => {
        expect(captions()).toEqual(lastPages.map(monthName));
      });
    });

    it('ends the pages with the month of maxDate for the year select', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({
        selects: true,
        numberOfMonths: 3,
        minDate: day('2026-12-05'),
        maxDate: day('2027-01-20'),
        defaultMonth: yearMonth('2027-01'),
        onMonthChange,
      });

      await user.selectOptions(screen.getByTestId('year-select'), '2026');

      expect(months(onMonthChange)).toEqual(['2026-11']);
      expect(gridNames()).toEqual(['2026-11-01', '2026-12-01', '2027-01-01'].map(monthName));
    });

    it('ends the pages with the month of maxDate for a key at minDate', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({
        ...shortRange(),
        defaultMonth: yearMonth('2026-12'),
        onMonthChange,
      });
      button('2026-12-05')!.focus();

      await user.keyboard('{PageUp}');

      await waitFor(() => {
        expect(button('2026-11-05')).toHaveFocus();
      });
      expect(gridNames()).toEqual(lastPages.map(monthName));
      expect(months(onMonthChange)).toEqual(['2026-10']);
      expect(onMonthChange.mock.calls[0]![1].reason).toBe('keyboard');
    });

    it('ends the pages with the month of maxDate for a focused day', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        ...shortRange(),
        defaultMonth: yearMonth('2026-12'),
        focusedDate: day('2026-12-10'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-11-10') });

      expect(gridNames()).toEqual(lastPages.map(monthName));
      expect(months(onMonthChange)).toEqual(['2026-10']);
    });

    it('ends the pages with the month of maxDate for a navigation button', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({
        ...shortRange(),
        pagedNavigation: true,
        defaultMonth: yearMonth('2026-12'),
        onMonthChange,
      });

      await user.click(screen.getByTestId('previous'));

      expect(gridNames()).toEqual(lastPages.map(monthName));
      expect(months(onMonthChange)).toEqual(['2026-10']);
    });
  });

  describe('a page of weeks', () => {
    it('stops at the week of minDate for the previous button', async () => {
      const { user } = await renderCalendar({
        visibleDuration: { weeks: 4 },
        minDate: day('2026-11-05'),
      });
      expect(gridNames()).toEqual([range('2026-11-08', '2026-12-05')]);

      await user.click(screen.getByTestId('previous'));

      expect(gridNames()).toEqual([range('2026-11-01', '2026-11-28')]);
      expect(screen.getByTestId('previous')).toHaveAttribute('aria-disabled', 'true');
    });

    it('stops at the week of minDate for a key', async () => {
      const { user } = await renderCalendar({
        visibleDuration: { weeks: 4 },
        minDate: day('2026-11-05'),
      });
      button('2026-11-08')!.focus();

      await user.keyboard('{ArrowLeft}');

      await waitFor(() => {
        expect(button('2026-11-07')).toHaveFocus();
      });
      expect(gridNames()).toEqual([range('2026-11-01', '2026-11-28')]);
    });

    it('stops at the week of maxDate for the month select', async () => {
      const { user } = await renderCalendar({
        selects: true,
        visibleDuration: { weeks: 4 },
        minDate: day('2026-11-05'),
        maxDate: day('2026-12-02'),
      });

      await user.selectOptions(screen.getByTestId('month-select'), 'M12');

      // The page ends with the week of 2026-12-02.
      expect(gridNames()).toEqual([range('2026-11-08', '2026-12-05')]);
    });
  });
});
