import { describe, expect, it, vi } from 'vitest';
import { nextTick, shallowRef } from 'vue';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import CalendarNavigationAnatomy from './CalendarNavigationAnatomy.test.vue';
import CalendarRootHydration from './CalendarRootHydration.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);
const yearMonth = (text: string) => Temporal.PlainYearMonth.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string) => format({ month: 'long', year: 'numeric' }, iso);

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

// The dates of the buttons that have the tab stop.
function tabStops() {
  return [...document.querySelectorAll<HTMLElement>('[data-date] button[tabindex="0"]')].map(
    (item) => item.closest<HTMLElement>('[data-date]')!.dataset.date,
  );
}

const months = (mock: ReturnType<typeof vi.fn>) => mock.mock.calls.map(([month]) => String(month));

describe('<Calendar.Root /> the page of the focused day', () => {
  const { render } = createRenderer();

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarNavigationAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  // A consumer with `v-model:focusedDate`, and with `v-model:month` when `month` is given.
  async function renderWithModels({
    focusedDate: firstFocusedDate,
    month: firstMonth,
    keepMonth = false,
    ...props
  }: Record<string, unknown> & {
    focusedDate: Temporal.PlainDate | null;
    month?: Temporal.PlainYearMonth;
    keepMonth?: boolean;
  }) {
    const focusedDate = shallowRef(firstFocusedDate);
    const month = shallowRef(firstMonth);
    const onMonthChange = vi.fn();
    const result = await render(() => (
      <CalendarNavigationAnatomy
        {...{
          today: today(),
          locale: 'en-US',
          ...props,
          focusedDate: focusedDate.value,
          'onUpdate:focusedDate': (date: Temporal.PlainDate) => {
            focusedDate.value = date;
          },
          ...(firstMonth && {
            month: month.value,
            'onUpdate:month': (next: Temporal.PlainYearMonth) => {
              if (!keepMonth) {
                month.value = next;
              }
            },
          }),
          onMonthChange,
        }}
      />
    ));
    return { ...result, focusedDate, month, onMonthChange };
  }

  describe('a controlled focused day', () => {
    it('shows the month of a focused day that the consumer sets off the page, and tells the listeners', async () => {
      const onMonthChange = vi.fn();
      const onUpdateMonth = vi.fn();
      const { setProps } = await renderCalendar({
        focusedDate: day('2026-11-12'),
        onMonthChange,
        'onUpdate:month': onUpdateMonth,
      });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(gridNames()).toEqual([monthName('2026-12-24')]);
      expect(tabStops()).toEqual(['2026-12-24']);
      expect(onMonthChange).toHaveBeenCalledTimes(1);
      const [month, details] = onMonthChange.mock.calls[0]!;
      expect(month.toString()).toBe('2026-12');
      expect(details.reason).toBe('none');
      expect(details.event).toBeInstanceOf(Event);
      expect(months(onUpdateMonth)).toEqual(['2026-12']);
    });

    it('keeps the page for a focused day that the page shows', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12'), onMonthChange });

      await setProps({ focusedDate: day('2026-11-30') });

      expect(tabStops()).toEqual(['2026-11-30']);
      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('keeps the page when a listener cancels the change of the month', async () => {
      const onMonthChange = vi.fn((_month: unknown, details: { cancel: () => void }) => {
        details.cancel();
      });
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12'), onMonthChange });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(gridNames()).toEqual([monthName('2026-11-12')]);
    });

    it('does not ask again for a new object of the same day', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        month: yearMonth('2026-11'),
        focusedDate: day('2026-12-24'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('keeps the page for a day of the page that has no button', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        numberOfMonths: 2,
        focusedDate: day('2026-11-12'),
        hiddenDates: day('2026-12-24'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(gridNames()).toEqual([monthName('2026-11-01'), monthName('2026-12-01')]);
      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('keeps the page for a day of the next month that has a button, with showOutsideDays', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        showOutsideDays: true,
        focusedDate: day('2026-11-12'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-12-02') });

      expect(gridNames()).toEqual([monthName('2026-11-01')]);
      expect(tabStops()).toEqual(['2026-12-02']);
      expect(onMonthChange).not.toHaveBeenCalled();
    });
  });

  describe('v-model:focusedDate', () => {
    it('shows the month of the day that the consumer writes', async () => {
      const { focusedDate, onMonthChange } = await renderWithModels({
        focusedDate: day('2026-11-12'),
      });

      focusedDate.value = day('2027-02-10');
      await flushMicrotasks();

      expect(gridNames()).toEqual([monthName('2027-02-10')]);
      expect(tabStops()).toEqual(['2027-02-10']);
      expect(months(onMonthChange)).toEqual(['2027-02']);
    });

    it('tells the listeners one time for a key that leaves the page', async () => {
      const { user, focusedDate, onMonthChange } = await renderWithModels({
        focusedDate: day('2026-11-12'),
      });
      button('2026-11-12')!.focus();

      await user.keyboard('{PageDown}');

      await waitFor(() => {
        expect(button('2026-12-12')).toHaveFocus();
      });
      expect(String(focusedDate.value)).toBe('2026-12-12');
      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(onMonthChange.mock.calls[0]![1].reason).toBe('keyboard');
    });
  });

  describe('a controlled month', () => {
    it('tells the listeners, and keeps the page until the consumer gives the month', async () => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        month: yearMonth('2026-11'),
        focusedDate: day('2026-11-12'),
        onMonthChange,
      });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(months(onMonthChange)).toEqual(['2026-12']);
      expect(gridNames()).toEqual([monthName('2026-11-01')]);
      expect(button('2026-12-24')).toBe(null);

      // `setProps` starts from the first props, so it gets the two of them.
      await setProps({ focusedDate: day('2026-12-24'), month: yearMonth('2026-12') });

      expect(gridNames()).toEqual([monthName('2026-12-01')]);
      expect(tabStops()).toEqual(['2026-12-24']);
      expect(onMonthChange).toHaveBeenCalledTimes(1);
    });

    it('shows the month when the consumer takes it with v-model:month', async () => {
      const { focusedDate, month, onMonthChange } = await renderWithModels({
        focusedDate: day('2026-11-12'),
        month: yearMonth('2026-11'),
      });

      focusedDate.value = day('2026-12-24');
      await flushMicrotasks();

      expect(String(month.value)).toBe('2026-12');
      expect(gridNames()).toEqual([monthName('2026-12-01')]);
      expect(onMonthChange).toHaveBeenCalledTimes(1);
    });
  });

  describe('more than one month', () => {
    it.each([
      {
        name: 'a day of the second month keeps the page',
        to: '2026-12-24',
        grids: ['2026-11-01', '2026-12-01'],
        changes: [],
      },
      {
        name: 'a day after the page starts the new page',
        to: '2027-02-10',
        grids: ['2027-02-01', '2027-03-01'],
        changes: ['2027-02'],
      },
      {
        name: 'a day before the page ends the new page',
        to: '2026-08-10',
        grids: ['2026-07-01', '2026-08-01'],
        changes: ['2026-07'],
      },
    ])('$name', async ({ to, grids, changes }) => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        numberOfMonths: 2,
        focusedDate: day('2026-11-12'),
        onMonthChange,
      });

      await setProps({ focusedDate: day(to) });

      expect(gridNames()).toEqual(grids.map((iso) => monthName(iso)));
      expect(months(onMonthChange)).toEqual(changes);
    });
  });

  describe('minDate and maxDate', () => {
    it.each([
      {
        name: 'after maxDate',
        to: '2027-06-10',
        props: { maxDate: day('2027-01-20') },
        grids: ['2027-01-01'],
        changes: ['2027-01'],
      },
      {
        name: 'before minDate',
        to: '2026-02-10',
        props: { minDate: day('2026-09-05') },
        grids: ['2026-09-01'],
        changes: ['2026-09'],
      },
      {
        name: 'after maxDate, with two months',
        to: '2027-06-10',
        props: { maxDate: day('2027-01-20'), numberOfMonths: 2 },
        grids: ['2026-12-01', '2027-01-01'],
        changes: ['2026-12'],
      },
      {
        name: 'before minDate, with two months',
        to: '2026-02-10',
        props: { minDate: day('2026-09-05'), numberOfMonths: 2 },
        grids: ['2026-09-01', '2026-10-01'],
        changes: ['2026-09'],
      },
      {
        name: 'after maxDate, from the last month',
        to: '2027-06-10',
        props: { maxDate: day('2026-11-20') },
        grids: ['2026-11-01'],
        changes: [],
      },
    ])('stops at the month of the limit for a day $name', async ({ to, props, grids, changes }) => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        focusedDate: day('2026-11-12'),
        onMonthChange,
        ...props,
      });

      await setProps({ focusedDate: day(to) });

      expect(gridNames()).toEqual(grids.map((iso) => monthName(iso)));
      expect(months(onMonthChange)).toEqual(changes);
    });

    it('stops a page of weeks at the week of maxDate', async () => {
      const { setProps } = await renderCalendar({
        visibleDuration: { weeks: 1 },
        focusedDate: day('2026-11-12'),
        maxDate: day('2026-12-09'),
      });

      await setProps({ focusedDate: day('2027-06-10') });

      expect(gridNames()).toEqual([range('2026-12-06', '2026-12-12')]);
    });

    it('keeps the first month at the month of minDate for a key, with two months', async () => {
      const { user } = await renderCalendar({
        numberOfMonths: 2,
        defaultMonth: yearMonth('2026-12'),
        minDate: day('2026-11-05'),
      });
      button('2026-12-05')!.focus();

      await user.keyboard('{PageUp}');

      await waitFor(() => {
        expect(button('2026-11-05')).toHaveFocus();
      });
      expect(gridNames()).toEqual([monthName('2026-11-01'), monthName('2026-12-01')]);
    });
  });

  describe('visibleDuration', () => {
    it.each([
      {
        name: 'a week after the page, in the same month',
        to: '2026-11-25',
        page: ['2026-11-22', '2026-11-28'],
        changes: [],
      },
      {
        name: 'a week before the page, in another month',
        to: '2026-10-20',
        page: ['2026-10-18', '2026-10-24'],
        changes: ['2026-10'],
      },
    ])('shows the page of weeks that holds the day: $name', async ({ to, page, changes }) => {
      const onMonthChange = vi.fn();
      const { setProps } = await renderCalendar({
        visibleDuration: { weeks: 1 },
        focusedDate: day('2026-11-12'),
        onMonthChange,
      });
      expect(gridNames()).toEqual([range('2026-11-08', '2026-11-14')]);

      await setProps({ focusedDate: day(to) });

      expect(gridNames()).toEqual([range(page[0]!, page[1]!)]);
      expect(months(onMonthChange)).toEqual(changes);
    });
  });

  describe('the focus', () => {
    it('moves the focus to the new day when a day of the grid has the focus', async () => {
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12') });
      button('2026-11-12')!.focus();

      await setProps({ focusedDate: day('2026-12-24') });

      await waitFor(() => {
        expect(button('2026-12-24')).toHaveFocus();
      });
    });

    it('moves the focus to a new day of the same page', async () => {
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12') });
      button('2026-11-12')!.focus();

      await setProps({ focusedDate: day('2026-11-20') });

      await waitFor(() => {
        expect(button('2026-11-20')).toHaveFocus();
      });
    });

    it('moves the focus to the tab stop of the new page when the new day cannot take the focus', async () => {
      const { setProps } = await renderCalendar({
        focusedDate: day('2026-11-12'),
        disabledDates: day('2026-12-24'),
      });
      button('2026-11-12')!.focus();

      await setProps({ focusedDate: day('2026-12-24') });

      await waitFor(() => {
        expect(button('2026-12-01')).toHaveFocus();
      });
    });

    it('moves the focus to the tab stop when the consumer changes the month', async () => {
      const { setProps } = await renderCalendar({ month: yearMonth('2026-11') });
      button('2026-11-12')!.focus();

      await setProps({ month: yearMonth('2026-12') });

      await waitFor(() => {
        expect(button('2026-12-01')).toHaveFocus();
      });
    });

    it('moves the focus to the new day when the consumer takes the month with v-model:month', async () => {
      const { focusedDate } = await renderWithModels({
        focusedDate: day('2026-11-12'),
        month: yearMonth('2026-11'),
      });
      button('2026-11-12')!.focus();

      focusedDate.value = day('2026-12-24');

      await waitFor(() => {
        expect(button('2026-12-24')).toHaveFocus();
      });
    });

    it('keeps the focus and the focused day when the consumer keeps the month', async () => {
      const { focusedDate } = await renderWithModels({
        focusedDate: day('2026-11-12'),
        month: yearMonth('2026-11'),
        keepMonth: true,
      });
      button('2026-11-12')!.focus();

      focusedDate.value = day('2026-12-24');
      await flushMicrotasks();

      expect(button('2026-11-12')).toHaveFocus();
      expect(String(focusedDate.value)).toBe('2026-12-24');
    });

    it('does not take the focus when no day of the grid has it', async () => {
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12') });
      screen.getByTestId('next').focus();

      await setProps({ focusedDate: day('2026-12-24') });
      await flushMicrotasks();

      expect(screen.getByTestId('next')).toHaveFocus();
    });

    it('keeps a focus that the consumer moves out of the grid after the flush', async () => {
      const { focusedDate } = await renderWithModels({ focusedDate: day('2026-11-12') });
      button('2026-11-12')!.focus();

      focusedDate.value = day('2026-12-24');
      await nextTick();
      screen.getByTestId('next').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('next')).toHaveFocus();
      expect(gridNames()).toEqual([monthName('2026-12-24')]);
    });
  });

  describe('the first render', () => {
    const file = 'src/calendar/root/CalendarRootHydration.test.vue';

    it('shows the month of the focused day on the server, and hydrates it with no event', async () => {
      const props = { today: '2026-11-14', focusedDate: '2027-02-10' };
      const serverHtml = await renderOnServer(file, props);
      expect(serverHtml).toContain(monthName('2027-02-10'));
      const onMonthChange = vi.fn();

      await hydrate(CalendarRootHydration, {
        serverHtml,
        props: { ...props, onMonthChange },
      });

      expect(gridNames()).toEqual([monthName('2027-02-10')]);
      expect(tabStops()).toEqual(['2027-02-10']);
      expect(onMonthChange).not.toHaveBeenCalled();
    });

    it('shows defaultMonth first, with no event, when the focused day is in another month', async () => {
      const onMonthChange = vi.fn();
      await renderCalendar({
        defaultMonth: yearMonth('2026-11'),
        focusedDate: day('2027-02-10'),
        onMonthChange,
      });

      expect(gridNames()).toEqual([monthName('2026-11-01')]);
      expect(onMonthChange).not.toHaveBeenCalled();
    });
  });
});
