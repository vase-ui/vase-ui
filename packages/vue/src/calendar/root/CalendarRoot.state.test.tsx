import { describe, expect, it, onTestFinished, vi } from 'vitest';
import {
  createRenderer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import CalendarAnatomy from './CalendarAnatomy.test.vue';
import CalendarRootHydration from './CalendarRootHydration.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

function format(options: Intl.DateTimeFormatOptions, iso: string, locale = 'en-US') {
  return new Intl.DateTimeFormat(locale, { timeZone: 'UTC', ...options }).format(Date.parse(iso));
}

const monthName = (iso: string, locale?: string, calendar?: string) =>
  format({ month: 'long', year: 'numeric', ...(calendar && { calendar }) }, iso, locale);

// The dates of the buttons that have the tab stop.
function tabStops() {
  return [...document.querySelectorAll<HTMLElement>('button[tabindex="0"]')].map(
    (item) => item.closest<HTMLElement>('[data-date]')!.dataset.date,
  );
}

describe('<Calendar.Root /> state', () => {
  const { render } = createRenderer();

  function renderCalendar(props: Record<string, unknown> = {}) {
    return render(<CalendarAnatomy {...{ today: today(), locale: 'en-US', ...props }} />);
  }

  describe('the tab stop', () => {
    // Each day that cannot take focus is skipped, and one day has the tab stop at most.
    it.each([
      { name: 'today', props: {}, expected: ['2026-11-14'] },
      {
        name: 'the first day, when today is not in the page',
        props: { defaultMonth: Temporal.PlainYearMonth.from('2026-12') },
        expected: ['2026-12-01'],
      },
      {
        name: 'the selected day, over today',
        props: { defaultValue: day('2026-11-10') },
        expected: ['2026-11-10'],
      },
      {
        name: 'the first selected day in the grid',
        props: { multiple: true, defaultValue: [day('2026-11-20'), day('2026-11-10')] },
        expected: ['2026-11-10'],
      },
      {
        name: 'the focused day, over the selected day',
        props: { defaultValue: day('2026-11-10'), defaultFocusedDate: day('2026-11-20') },
        expected: ['2026-11-20'],
      },
      {
        name: 'the selected day, when the focused day is off',
        props: {
          defaultValue: day('2026-11-10'),
          defaultFocusedDate: day('2026-11-20'),
          disabledDates: day('2026-11-20'),
        },
        expected: ['2026-11-10'],
      },
      {
        name: 'today, when the selected day is off',
        props: { defaultValue: day('2026-11-10'), disabledDates: day('2026-11-10') },
        expected: ['2026-11-14'],
      },
      {
        name: 'the first day, when today is off',
        props: { disabledDates: day('2026-11-14') },
        expected: ['2026-11-01'],
      },
      { name: 'no day, when the calendar is disabled', props: { disabled: true }, expected: [] },
    ])('gives the tab stop to $name', async ({ props, expected }) => {
      await renderCalendar(props);

      expect(tabStops()).toEqual(expected);
    });

    it('moves the tab stop to the day that got focus, and keeps it there', async () => {
      await renderCalendar();

      button('2026-11-20')!.focus();
      await waitFor(() => {
        expect(tabStops()).toEqual(['2026-11-20']);
      });
      button('2026-11-20')!.blur();

      expect(tabStops()).toEqual(['2026-11-20']);
    });
  });

  describe('the focused day', () => {
    it('sets the first month and the tab stop from defaultFocusedDate', async () => {
      await renderCalendar({ defaultFocusedDate: day('2026-02-10') });

      expect(screen.getByRole('group', { name: monthName('2026-02-10') })).not.toBe(null);
      expect(tabStops()).toEqual(['2026-02-10']);
    });

    it('tells a listener when a day gets focus, and waits for the value of a controlled day', async () => {
      const onFocusedDateChange = vi.fn();
      const { setProps } = await renderCalendar({
        focusedDate: day('2026-11-12'),
        onFocusedDateChange,
      });

      button('2026-11-15')!.focus();

      expect(onFocusedDateChange).toHaveBeenCalledTimes(1);
      const [date, details] = onFocusedDateChange.mock.calls[0]!;
      expect(date.toString()).toBe('2026-11-15');
      expect(details.reason).toBe('none');
      expect(details.event).toBeInstanceOf(FocusEvent);
      expect(tabStops()).toEqual(['2026-11-12']);

      await setProps({ focusedDate: day('2026-11-15') });

      expect(tabStops()).toEqual(['2026-11-15']);
    });

    it('does not change the month when a controlled focused day moves to another month', async () => {
      const { setProps } = await renderCalendar({ focusedDate: day('2026-11-12') });

      await setProps({ focusedDate: day('2026-12-24') });

      expect(screen.getByRole('group', { name: monthName('2026-11-12') })).not.toBe(null);
      expect(button('2026-12-24')).toBe(null);
    });
  });

  describe('focus and autoFocus', () => {
    async function renderWithApi(props: Record<string, unknown> = {}) {
      let api: { root: { focus: (date?: Temporal.PlainDate) => void } } | null = null;
      await render(() => (
        <CalendarAnatomy
          {...{ today: today(), locale: 'en-US', ...props }}
          ref={(instance: unknown) => {
            api = instance as typeof api;
          }}
        />
      ));
      return api!.root;
    }

    it('focuses the tab stop of the grid', async () => {
      const root = await renderWithApi({ defaultValue: day('2026-11-10') });

      root.focus();

      await waitFor(() => {
        expect(button('2026-11-10')).toHaveFocus();
      });
    });

    it('focuses a day, and shows its month first', async () => {
      const onMonthChange = vi.fn();
      const root = await renderWithApi({ onMonthChange });

      root.focus(day('2026-12-24'));

      await waitFor(() => {
        expect(button('2026-12-24')).toHaveFocus();
      });
      expect(screen.getByRole('group', { name: monthName('2026-12-24') })).not.toBe(null);
      const [month, details] = onMonthChange.mock.calls[0]!;
      expect(month.toString()).toBe('2026-12');
      expect(details.reason).toBe('none');
    });

    it('does not focus a day that cannot take focus', async () => {
      const root = await renderWithApi({ disabledDates: day('2026-11-20') });

      root.focus(day('2026-11-20'));
      await flushMicrotasks();

      expect(document.activeElement).toBe(document.body);
    });

    it('focuses the tab stop at the mount with autoFocus', async () => {
      await renderCalendar({ autoFocus: true });

      await waitFor(() => {
        expect(button('2026-11-14')).toHaveFocus();
      });
    });
  });

  describe('the month', () => {
    it.each([
      {
        name: 'defaultMonth',
        props: { defaultMonth: Temporal.PlainYearMonth.from('2027-02') },
        iso: '2027-02-10',
      },
      { name: 'the selected day', props: { defaultValue: day('2027-12-05') }, iso: '2027-12-05' },
      {
        name: 'the day of a zoned value',
        props: { defaultValue: Temporal.ZonedDateTime.from('2027-06-30T23:30[America/New_York]') },
        iso: '2027-06-30',
      },
      { name: 'today', props: {}, iso: '2026-11-14' },
    ])('shows the month of $name first', async ({ props, iso }) => {
      await renderCalendar(props);

      expect(screen.getByRole('group', { name: monthName(iso) })).not.toBe(null);
    });

    it('leaves the month of a controlled calendar to its value', async () => {
      const onMonthChange = vi.fn();
      const { user, setProps } = await renderCalendar({
        month: Temporal.PlainYearMonth.from('2026-11'),
        onMonthChange,
      });
      button('2026-11-11')!.focus();

      await user.keyboard('{PageDown}');

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expect(screen.getByRole('group', { name: monthName('2026-11-11') })).not.toBe(null);

      await setProps({ month: Temporal.PlainYearMonth.from('2026-12') });

      expect(screen.getByRole('group', { name: monthName('2026-12-11') })).not.toBe(null);
    });

    it('shows a month of another calendar by its first day', async () => {
      // The month Aban of the year 1405 starts on 2026-10-23.
      const month = day('2026-11-14').withCalendar('persian').toPlainYearMonth();
      await renderCalendar({ month, calendar: 'persian' });

      expect(
        screen.getByRole('group', { name: monthName('2026-11-14', 'en-US', 'persian') }),
      ).not.toBe(null);
      expect(button('2026-10-23')).not.toBe(null);
      expect(button('2026-10-22')).toBe(null);
    });

    it('gives the listeners an ISO month for an ISO grid', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderCalendar({ onMonthChange });
      button('2026-11-11')!.focus();

      await user.keyboard('{PageDown}');

      expect(onMonthChange.mock.calls[0]![0].calendarId).toBe('iso8601');
    });
  });

  describe('today and the time zone', () => {
    function spyOnClock() {
      const spy = vi.spyOn(Temporal.Now, 'plainDateISO').mockReturnValue(day('2026-11-14'));
      onTestFinished(() => {
        spy.mockRestore();
      });
      return spy;
    }

    it('reads the clock in the time zone of the consumer', async () => {
      const clock = spyOnClock();
      await render(<CalendarAnatomy {...{ locale: 'en-US', timeZone: 'Asia/Tokyo' }} />);

      expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
      expect(button('2026-11-14')).toHaveAttribute('aria-current', 'date');
    });

    it('reads the clock in the zone of a zoned value', async () => {
      const clock = spyOnClock();
      await render(
        <CalendarAnatomy
          {...{
            locale: 'en-US',
            defaultValue: Temporal.ZonedDateTime.from('2026-11-10T09:30[Asia/Tokyo]'),
          }}
        />,
      );

      expect(clock).toHaveBeenCalledWith('Asia/Tokyo');
    });

    it('reads the clock again when the month changes', async () => {
      const clock = spyOnClock();
      const { user } = await render(<CalendarAnatomy {...{ locale: 'en-US' }} />);
      const calls = clock.mock.calls.length;
      button('2026-11-14')!.focus();

      await user.keyboard('{PageDown}');

      await waitFor(() => {
        expect(clock.mock.calls.length).toBeGreaterThan(calls);
      });
    });

    it('shows the day of the prop today, and not the day of the clock', async () => {
      await renderCalendar({ today: day('2026-12-24') });

      expect(button('2026-12-24')).toHaveAttribute('aria-current', 'date');
      expect(screen.getByRole('group', { name: monthName('2026-12-24') })).not.toBe(null);
    });
  });

  describe('locales', () => {
    // A locale starts its week on the day that its week data gives, from 1 for Monday to 7.
    function weekdayNames(locale: string, firstDay: number) {
      return Array.from({ length: 7 }, (_, index) => {
        const weekday = ((firstDay - 1 + index) % 7) + 1;
        return format({ weekday: 'short' }, `2024-01-0${weekday}`, locale);
      });
    }

    it.each(['en-US', 'fr', 'ar-EG', 'he', 'ja'])(
      'shows the names, the numbers and the week of %s',
      async (locale) => {
        await renderCalendar({ locale });

        const { firstDay } = (
          new Intl.Locale(locale) as Intl.Locale & { getWeekInfo: () => { firstDay: number } }
        ).getWeekInfo();
        expect(screen.getByRole('group', { name: monthName('2026-11-14', locale) })).not.toBe(null);
        expect(screen.getAllByRole('columnheader').map((header) => header.textContent)).toEqual(
          weekdayNames(locale, firstDay),
        );
        expect(button('2026-11-14')).toHaveTextContent(
          format({ day: 'numeric' }, '2026-11-14', locale),
        );
        expect(document.querySelector('[data-date]')!.getAttribute('data-date')).toBe(
          Temporal.PlainDate.from('2026-11-01')
            .subtract({ days: (7 + 7 - firstDay) % 7 })
            .toString(),
        );
      },
    );

    it('starts the week on the day that firstDayOfWeek gives', async () => {
      await renderCalendar({ firstDayOfWeek: 1 });

      expect(screen.getAllByRole('columnheader')[0]).toHaveTextContent(
        format({ weekday: 'short' }, '2026-11-09'),
      );
      expect(button('2026-10-26')).toBe(null);
      expect(document.querySelector('[data-date]')!.getAttribute('data-date')).toBe('2026-10-26');
    });
  });

  describe('calendars', () => {
    it.each([
      {
        name: 'persian',
        props: { calendar: 'persian' },
        iso: '2026-11-14',
        days: 30,
        first: '2026-10-23',
      },
      {
        name: 'hebrew, a month of a leap year',
        props: {
          calendar: 'hebrew',
          defaultMonth: day('2024-02-10').withCalendar('hebrew').toPlainYearMonth(),
        },
        iso: '2024-02-10',
        days: 30,
        first: '2024-02-10',
      },
      {
        name: 'japanese',
        props: { calendar: 'japanese' },
        iso: '2026-11-14',
        days: 30,
        first: '2026-11-01',
      },
    ])('shows the month of the calendar $name', async ({ props, iso, days, first }) => {
      await renderCalendar(props);

      const { calendar } = props;
      expect(screen.getByRole('group', { name: monthName(iso, 'en-US', calendar) })).not.toBe(null);
      const buttons = [...document.querySelectorAll('button[data-date], [data-date] button')];
      expect(buttons).toHaveLength(days);
      expect(buttons[0]!.closest('[data-date]')!.getAttribute('data-date')).toBe(first);
    });

    it('shows the calendar of the locale, and gregory turns it off', async () => {
      const { unmount } = await renderCalendar({ locale: 'th-TH' });

      // `th-TH` has the Buddhist calendar, so the year is 2569.
      expect(screen.getByRole('group', { name: monthName('2026-11-14', 'th-TH') })).not.toBe(null);
      expect(monthName('2026-11-14', 'th-TH')).toContain('2569');
      unmount();

      await renderCalendar({ locale: 'th-TH', calendar: 'gregory' });

      expect(
        screen.getByRole('group', { name: monthName('2026-11-14', 'th-TH', 'gregory') }),
      ).not.toBe(null);
      expect(monthName('2026-11-14', 'th-TH', 'gregory')).toContain('2026');
    });

    it('shows a value in its own calendar, and gives the value back in that calendar', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderCalendar({
        defaultValue: day('2026-11-10').withCalendar('persian'),
        onValueChange,
      });

      expect(
        screen.getByRole('group', { name: monthName('2026-11-14', 'en-US', 'persian') }),
      ).not.toBe(null);
      await user.click(button('2026-11-12')!);

      expect(onValueChange.mock.calls[0]![0].calendarId).toBe('persian');
    });
  });

  describe('the server render', () => {
    const file = 'src/calendar/root/CalendarRootHydration.test.vue';

    it.each([
      { name: 'today only', props: { today: '2026-11-14' } },
      { name: 'a selected day', props: { today: '2026-11-14', value: '2026-11-10' } },
      {
        name: 'a list of days',
        props: { today: '2026-11-14', multiple: true, value: '2026-11-10,2026-11-20' },
      },
      { name: 'a disabled calendar', props: { today: '2026-11-14', disabled: true } },
      {
        name: 'limits and a disabled day',
        props: {
          today: '2026-11-14',
          minDate: '2026-11-05',
          maxDate: '2026-11-25',
          disabledDate: '2026-11-11',
        },
      },
      { name: 'a focused day', props: { today: '2026-11-14', focusedDate: '2026-11-20' } },
      { name: 'a locale that starts on Monday', props: { today: '2026-11-14', locale: 'fr' } },
      { name: 'the Persian calendar', props: { today: '2026-11-14', calendar: 'persian' } },
    ])('hydrates with $name with no warning and no difference', async ({ props }) => {
      const serverHtml = await renderOnServer(file, props);

      await hydrate(CalendarRootHydration, { serverHtml, props });
    });

    it('hydrates a tab stop that the server put on another day', async () => {
      const serverHtml = await renderOnServer(file, { today: '2026-11-14' });
      const props = { today: '2026-11-14', focusedDate: '2026-11-20' };

      await hydrate(CalendarRootHydration, { serverHtml, props });

      expect(tabStops()).toEqual(['2026-11-20']);
    });
  });
});
