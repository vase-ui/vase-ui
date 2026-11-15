import { describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { createRenderer, fireEvent, screen } from '#test-utils';
import CalendarAnatomy from './CalendarAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. With `en-US`, the weeks start on Sunday and 2026-11-01 is a Sunday.
const today = () => day('2026-11-14');

function button(iso: string) {
  return document.querySelector<HTMLElement>(`[data-date="${iso}"] button`);
}

const monthName = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    Date.parse(iso),
  );

describe('<Calendar.Root /> keys', () => {
  const { render } = createRenderer();

  async function renderCalendar(props: Record<string, unknown> = {}, direction?: 'rtl') {
    const calendar = <CalendarAnatomy {...{ today: today(), locale: 'en-US', ...props }} />;
    const result = await render(
      direction ? (
        <DirectionProvider direction={direction}>{calendar}</DirectionProvider>
      ) : (
        calendar
      ),
    );
    return result;
  }

  // Each case focuses a day, presses the keys, and then asserts the day that has the focus and the
  // month that the page shows.
  async function pressKeys({
    from,
    keys,
    props,
    direction,
  }: {
    from: string;
    keys: string;
    props?: Record<string, unknown>;
    direction?: 'rtl';
  }) {
    const { user } = await renderCalendar(props, direction);
    button(from)!.focus();
    await user.keyboard(keys);
  }

  function expectFocus(iso: string) {
    expect(document.activeElement).toBe(button(iso));
    expect(screen.getByRole('group', { name: monthName(iso) })).not.toBe(null);
  }

  describe('in a left-to-right page', () => {
    // 2026-11-11 is a Wednesday, in the week from Sunday 2026-11-08 to Saturday 2026-11-14.
    it.each([
      { keys: '{ArrowRight}', to: '2026-11-12' },
      { keys: '{ArrowLeft}', to: '2026-11-10' },
      { keys: '{ArrowDown}', to: '2026-11-18' },
      { keys: '{ArrowUp}', to: '2026-11-04' },
      { keys: '{Home}', to: '2026-11-08' },
      { keys: '{End}', to: '2026-11-14' },
      { keys: '{PageDown}', to: '2026-12-11' },
      { keys: '{PageUp}', to: '2026-10-11' },
      { keys: '{Shift>}{PageDown}{/Shift}', to: '2027-11-11' },
      { keys: '{Shift>}{PageUp}{/Shift}', to: '2025-11-11' },
      { keys: '{Shift>}{ArrowRight}{/Shift}', to: '2026-12-11' },
      { keys: '{Shift>}{ArrowLeft}{/Shift}', to: '2026-10-11' },
      { keys: '{Shift>}{ArrowDown}{/Shift}', to: '2027-11-11' },
      { keys: '{Shift>}{ArrowUp}{/Shift}', to: '2025-11-11' },
    ])('moves the focus from 2026-11-11 to $to for $keys', async ({ keys, to }) => {
      await pressKeys({ from: '2026-11-11', keys });

      expectFocus(to);
    });

    it.each([
      { name: 'the next month', from: '2026-11-30', keys: '{ArrowRight}', to: '2026-12-01' },
      { name: 'the month before', from: '2026-11-01', keys: '{ArrowLeft}', to: '2026-10-31' },
      {
        name: 'a week into the next month',
        from: '2026-11-27',
        keys: '{ArrowDown}',
        to: '2026-12-04',
      },
    ])('moves the page when a key leaves it: $name', async ({ from, keys, to }) => {
      await pressKeys({ from, keys });

      expectFocus(to);
    });

    it.each([
      { name: 'Enter', keys: '{ArrowRight}{Enter}' },
      { name: 'Space', keys: '{ArrowRight} ' },
    ])('presses the focused day with $name', async ({ keys }) => {
      const onValueChange = vi.fn();
      await pressKeys({ from: '2026-11-11', keys, props: { onValueChange } });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0]![0].toString()).toBe('2026-11-12');
      expect(onValueChange.mock.calls[0]![1].reason).toBe('day-press');
    });

    it('does not handle a key with Control, Alt or Meta', async () => {
      const { user } = await renderCalendar();
      button('2026-11-11')!.focus();

      await user.keyboard(
        '{Alt>}{ArrowRight}{/Alt}{Control>}{PageDown}{/Control}{Meta>}{End}{/Meta}',
      );

      expect(document.activeElement).toBe(button('2026-11-11'));
    });

    it('stops the scroll of the page for the keys that it handles', async () => {
      await renderCalendar();
      button('2026-11-11')!.focus();

      expect(await fireEvent.keyDown(button('2026-11-11')!, { key: 'ArrowRight' })).toBe(false);
      expect(await fireEvent.keyDown(button('2026-11-11')!, { key: 'a' })).toBe(true);
    });
  });

  describe('in a right-to-left page', () => {
    it.each([
      { keys: '{ArrowLeft}', to: '2026-11-12' },
      { keys: '{ArrowRight}', to: '2026-11-10' },
      { keys: '{ArrowDown}', to: '2026-11-18' },
      { keys: '{Home}', to: '2026-11-08' },
      { keys: '{PageDown}', to: '2026-12-11' },
      { keys: '{Shift>}{ArrowLeft}{/Shift}', to: '2026-12-11' },
      { keys: '{Shift>}{ArrowRight}{/Shift}', to: '2026-10-11' },
    ])('moves the focus from 2026-11-11 to $to for $keys', async ({ keys, to }) => {
      await pressKeys({ from: '2026-11-11', keys, direction: 'rtl' });

      expectFocus(to);
    });
  });

  describe('at the end of a month', () => {
    it.each([
      {
        name: 'January 31 to February 28',
        today: '2026-01-31',
        keys: '{PageDown}',
        to: '2026-02-28',
      },
      { name: 'March 31 to February 28', today: '2026-03-31', keys: '{PageUp}', to: '2026-02-28' },
      {
        name: 'a leap day to the next year',
        today: '2028-02-29',
        keys: '{Shift>}{PageDown}{/Shift}',
        to: '2029-02-28',
      },
    ])('goes from $name', async ({ today: from, keys, to }) => {
      await pressKeys({ from, keys, props: { today: day(from) } });

      expectFocus(to);
    });
  });

  describe('in a calendar with 13 months', () => {
    it('goes through each month of a Hebrew leap year and back to the same day', async () => {
      // The year 5784 is a leap year. Tishri 15, its fifteenth day, is 2023-09-30.
      const start = day('2023-09-30').withCalendar('hebrew');
      expect(start.monthsInYear).toBe(13);
      const onMonthChange = vi.fn();
      await pressKeys({
        from: '2023-09-30',
        keys: '{PageDown}'.repeat(13),
        props: { today: start, calendar: 'hebrew', onMonthChange },
      });

      const codes = onMonthChange.mock.calls.map(([month]) => month.monthCode);
      expect(codes).toHaveLength(13);
      expect(new Set(codes).size).toBe(13);
      expect(codes).toContain('M05L');
      expect(document.activeElement).toBe(
        button(start.add({ years: 1 }).withCalendar('iso8601').toString()),
      );
    });
  });

  describe('over days that cannot take focus', () => {
    // The weekend of `en-US` is Saturday and Sunday.
    const weekend = { disabledDates: { dayOfWeek: [6, 7] } };

    it.each([
      {
        name: 'the weekend, to Monday',
        from: '2026-11-13',
        keys: '{ArrowRight}',
        to: '2026-11-16',
      },
      {
        name: 'the weekend, back to Friday',
        from: '2026-11-16',
        keys: '{ArrowLeft}',
        to: '2026-11-13',
      },
      { name: 'the first day of the week', from: '2026-11-11', keys: '{Home}', to: '2026-11-09' },
      { name: 'the last day of the week', from: '2026-11-11', keys: '{End}', to: '2026-11-13' },
    ])('skips a disabled day: $name', async ({ from, keys, to }) => {
      await pressKeys({ from, keys, props: weekend });

      expectFocus(to);
    });

    it('skips a hidden day, and stops on an unavailable day', async () => {
      await pressKeys({
        from: '2026-11-10',
        keys: '{ArrowRight}',
        props: { hiddenDates: day('2026-11-11'), unavailableDates: day('2026-11-12') },
      });

      expectFocus('2026-11-12');
    });

    it('stays when no day can take focus', async () => {
      await pressKeys({
        from: '2026-11-11',
        keys: '{ArrowRight}',
        props: { disabledDates: { after: day('2026-11-11') } },
      });

      expectFocus('2026-11-11');
    });
  });

  describe('at the limits', () => {
    const limits = () => ({ minDate: day('2026-11-10'), maxDate: day('2026-11-20') });

    it.each([
      { name: 'a day before minDate', from: '2026-11-10', keys: '{ArrowLeft}', to: '2026-11-10' },
      { name: 'a day after maxDate', from: '2026-11-20', keys: '{ArrowRight}', to: '2026-11-20' },
      { name: 'a month back', from: '2026-11-18', keys: '{PageUp}', to: '2026-11-10' },
      { name: 'a month on', from: '2026-11-12', keys: '{PageDown}', to: '2026-11-20' },
    ])('stops at the limit: $name', async ({ from, keys, to }) => {
      await pressKeys({ from, keys, props: limits() });

      expectFocus(to);
    });
  });

  describe('the events of a move', () => {
    it('gives the change of the month and the change of the focused day the reason keyboard', async () => {
      const handlers = {
        onMonthChange: vi.fn(),
        'onUpdate:month': vi.fn(),
        onFocusedDateChange: vi.fn(),
        'onUpdate:focusedDate': vi.fn(),
      };
      await pressKeys({ from: '2026-11-11', keys: '{PageDown}', props: handlers });

      expect(handlers.onMonthChange).toHaveBeenCalledTimes(1);
      const [month, monthDetails] = handlers.onMonthChange.mock.calls[0]!;
      expect(month.toString()).toBe('2026-12');
      expect(monthDetails.reason).toBe('keyboard');
      expect(monthDetails.event).toBeInstanceOf(KeyboardEvent);
      expect(handlers['onUpdate:month'].mock.calls[0]![0].toString()).toBe('2026-12');
      const focusChange = handlers.onFocusedDateChange.mock.calls.at(-1)!;
      expect(focusChange[0].toString()).toBe('2026-12-11');
      expect(focusChange[1].reason).toBe('keyboard');
      expect(handlers['onUpdate:focusedDate'].mock.calls.at(-1)![0].toString()).toBe('2026-12-11');
    });

    it('does not move when a listener cancels the change of the month', async () => {
      const onMonthChange = vi.fn((_month: unknown, details: { cancel: () => void }) => {
        details.cancel();
      });
      await pressKeys({ from: '2026-11-11', keys: '{PageDown}', props: { onMonthChange } });

      expect(onMonthChange).toHaveBeenCalledTimes(1);
      expectFocus('2026-11-11');
    });

    it('does not move when a listener cancels the change of the focused day', async () => {
      const onFocusedDateChange = vi.fn(
        (date: Temporal.PlainDate, details: { cancel: () => void }) => {
          if (date.day === 12) {
            details.cancel();
          }
        },
      );
      await pressKeys({ from: '2026-11-11', keys: '{ArrowRight}', props: { onFocusedDateChange } });

      expectFocus('2026-11-11');
    });
  });

  describe('Shift with an arrow key', () => {
    function listener() {
      return { onValueChange: vi.fn() };
    }
    const selected = (handler: ReturnType<typeof vi.fn>) =>
      handler.mock.calls.at(-1)![0].map(String);

    it('adds the day that it moves to when more than one day can be selected', async () => {
      const handlers = listener();
      await pressKeys({
        from: '2026-11-11',
        keys: '{Shift>}{ArrowRight}{ArrowDown}{/Shift}',
        props: { multiple: true, ...handlers },
      });

      expect(selected(handlers.onValueChange)).toEqual(['2026-11-12', '2026-11-19']);
      expectFocus('2026-11-19');
      expect(handlers.onValueChange.mock.calls[0]![1].reason).toBe('keyboard');
    });

    it('adds no day past maxDays, and adds no day that is selected', async () => {
      const handlers = listener();
      await pressKeys({
        from: '2026-11-11',
        keys: '{Shift>}{ArrowRight}{ArrowLeft}{ArrowRight}{/Shift}',
        props: { multiple: true, maxDays: 1, ...handlers },
      });

      expect(handlers.onValueChange).toHaveBeenCalledTimes(1);
      expectFocus('2026-11-12');
    });

    it.each([
      { name: 'a read-only calendar', props: { readOnly: true } },
      { name: 'an unavailable day', props: { unavailableDates: day('2026-11-12') } },
    ])('adds no day to $name', async ({ props }) => {
      const handlers = listener();
      await pressKeys({
        from: '2026-11-11',
        keys: '{Shift>}{ArrowRight}{/Shift}',
        props: { multiple: true, ...props, ...handlers },
      });

      expect(handlers.onValueChange).not.toHaveBeenCalled();
      expectFocus('2026-11-12');
    });
  });
});
