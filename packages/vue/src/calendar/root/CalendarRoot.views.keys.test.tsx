import { describe, expect, it, vi } from 'vitest';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { createRenderer, fireEvent, screen } from '#test-utils';
import CalendarViewsAnatomy from './CalendarViewsAnatomy.test.vue';

const day = (text: string) => Temporal.PlainDate.from(text);

// 2026-11-14 is a Saturday. The grid of months has three columns, and the page of years that holds
// 2026 has the years 2016 to 2027, in four rows of three.
const today = () => day('2026-11-14');

const monthLabel = (iso: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' }).format(
    Date.parse(iso),
  );

const years = (from: string, to: string) =>
  new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', year: 'numeric' }).formatRange(
    Date.parse(from),
    Date.parse(to),
  );

const monthCell = (iso: string) => screen.getByRole('gridcell', { name: monthLabel(iso) });
const yearCell = (year: number) => screen.getByRole('gridcell', { name: String(year) });
const title = () => screen.getByTestId('month-trigger');

describe('<Calendar.Root /> keys of the grids of months and years', () => {
  const { render } = createRenderer();

  async function renderViews(props: Record<string, unknown>, direction?: 'rtl') {
    const calendar = <CalendarViewsAnatomy {...{ today: today(), locale: 'en-US', ...props }} />;
    return render(
      direction ? (
        <DirectionProvider direction={direction}>{calendar}</DirectionProvider>
      ) : (
        calendar
      ),
    );
  }

  describe('in the grid of months', () => {
    async function pressKeys({
      from,
      keys,
      props = {},
      direction,
    }: {
      from: string;
      keys: string;
      props?: Record<string, unknown>;
      direction?: 'rtl';
    }) {
      const { user } = await renderViews({ defaultView: 'month', ...props }, direction);
      monthCell(from).focus();
      await user.keyboard(keys);
    }

    // The row of November 2026 is October, November and December.
    it.each([
      { keys: '{ArrowRight}', to: '2026-12-01' },
      { keys: '{ArrowLeft}', to: '2026-10-01' },
      { keys: '{ArrowDown}', to: '2027-02-01' },
      { keys: '{ArrowUp}', to: '2026-08-01' },
      { keys: '{Home}', to: '2026-10-01' },
      { keys: '{End}', to: '2026-12-01' },
      { keys: '{PageDown}', to: '2027-11-01' },
      { keys: '{PageUp}', to: '2025-11-01' },
    ])('moves the focus from November 2026 to $to for $keys', async ({ keys, to }) => {
      await pressKeys({ from: '2026-11-01', keys });

      expect(monthCell(to)).toHaveFocus();
      expect(title()).toHaveTextContent(String(Number(to.slice(0, 4))));
    });

    it.each([
      { keys: '{ArrowLeft}', to: '2026-12-01' },
      { keys: '{ArrowRight}', to: '2026-10-01' },
      { keys: '{ArrowDown}', to: '2027-02-01' },
      { keys: '{Home}', to: '2026-10-01' },
    ])('swaps left and right in a right-to-left page: $keys', async ({ keys, to }) => {
      await pressKeys({ from: '2026-11-01', keys, direction: 'rtl' });

      expect(monthCell(to)).toHaveFocus();
    });

    it.each([
      { name: 'the next year', from: '2026-12-01', keys: '{ArrowRight}', to: '2027-01-01' },
      { name: 'the year before', from: '2026-01-01', keys: '{ArrowLeft}', to: '2025-12-01' },
      {
        name: 'a row into the year before',
        from: '2026-02-01',
        keys: '{ArrowUp}',
        to: '2025-11-01',
      },
    ])('shows the year that a key reaches: $name', async ({ from, keys, to }) => {
      const onMonthChange = vi.fn();
      await pressKeys({ from, keys, props: { onMonthChange } });

      expect(monthCell(to)).toHaveFocus();
      expect(title()).toHaveTextContent(to.slice(0, 4));
      const [month, details] = onMonthChange.mock.calls[0]!;
      expect(month.toString()).toBe(to.slice(0, 7));
      expect(details.reason).toBe('keyboard');
    });

    it('moves inside the year with no change of the page, and reports the focused date', async () => {
      const onMonthChange = vi.fn();
      const onFocusedDateChange = vi.fn();
      await pressKeys({
        from: '2026-11-01',
        keys: '{ArrowLeft}',
        props: { onMonthChange, onFocusedDateChange },
      });

      expect(onMonthChange).not.toHaveBeenCalled();
      const [date, details] = onFocusedDateChange.mock.lastCall!;
      expect(date.toString()).toBe('2026-10-14');
      expect(details.reason).toBe('keyboard');
    });

    it('goes on to the next month that can take focus, also in the next year', async () => {
      await pressKeys({
        from: '2026-11-01',
        keys: '{ArrowRight}',
        props: {
          disabledMonths: (month: Temporal.PlainYearMonth) =>
            month.month === 12 || month.month === 1,
        },
      });

      expect(monthCell('2027-02-01')).toHaveFocus();
    });

    it.each([
      { keys: '{ArrowRight}{ArrowRight}{ArrowRight}', to: '2026-12-01' },
      { keys: '{PageDown}', to: '2026-12-01' },
      { keys: '{ArrowDown}', to: '2026-12-01' },
    ])('stops at maxDate: $keys', async ({ keys, to }) => {
      await pressKeys({ from: '2026-11-01', keys, props: { maxDate: day('2026-12-20') } });

      expect(monthCell(to)).toHaveFocus();
    });

    it('reaches the month of maxDate in the next year, also with two months', async () => {
      await pressKeys({
        from: '2026-12-01',
        keys: '{ArrowRight}',
        props: { numberOfMonths: 2, maxDate: day('2027-01-15') },
      });

      expect(monthCell('2027-01-01')).toHaveFocus();
      expect(title()).toHaveTextContent('2027');
    });

    it('stops at minDate', async () => {
      await pressKeys({
        from: '2026-03-01',
        keys: '{ArrowLeft}{ArrowLeft}{ArrowLeft}',
        props: { minDate: day('2026-02-10') },
      });

      expect(monthCell('2026-02-01')).toHaveFocus();
    });

    it('uses the columns of the grid for up, down, home and end', async () => {
      const { user } = await renderViews({ defaultView: 'month', columns: 4 });
      monthCell('2026-06-01').focus();

      await user.keyboard('{ArrowDown}');
      expect(monthCell('2026-10-01')).toHaveFocus();

      await user.keyboard('{End}');
      expect(monthCell('2026-12-01')).toHaveFocus();

      await user.keyboard('{Home}');
      expect(monthCell('2026-09-01')).toHaveFocus();
    });

    it('presses the focused month with Enter and with Space', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderViews({
        defaultView: 'month',
        defaultValue: Temporal.PlainYearMonth.from('2026-11'),
        onValueChange,
      });
      monthCell('2026-11-01').focus();

      await user.keyboard('{ArrowLeft}{Enter}{ArrowLeft} ');

      expect(onValueChange.mock.calls.map(([value]) => value.toString())).toEqual([
        '2026-10',
        '2026-09',
      ]);
      expect(onValueChange.mock.calls[0]![1].reason).toBe('month-press');
    });

    it('stops the scroll of the page for the keys that it handles, and no other key', async () => {
      await renderViews({ defaultView: 'month' });
      monthCell('2026-11-01').focus();

      expect(await fireEvent.keyDown(monthCell('2026-11-01'), { key: 'ArrowRight' })).toBe(false);
      expect(await fireEvent.keyDown(monthCell('2026-11-01'), { key: 'a' })).toBe(true);
    });

    it('does not handle a key with Control, Alt, Meta or Shift', async () => {
      const { user } = await renderViews({ defaultView: 'month' });
      monthCell('2026-11-01').focus();

      await user.keyboard(
        '{Alt>}{ArrowRight}{/Alt}{Control>}{PageDown}{/Control}{Meta>}{End}{/Meta}{Shift>}{ArrowLeft}{/Shift}',
      );

      expect(monthCell('2026-11-01')).toHaveFocus();
    });

    it('keeps the focus on the cell when a listener cancels the month change', async () => {
      const { user } = await renderViews({
        defaultView: 'month',
        onMonthChange: (_month: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });
      monthCell('2026-12-01').focus();

      await user.keyboard('{ArrowRight}');

      expect(monthCell('2026-12-01')).toHaveFocus();
      expect(title()).toHaveTextContent('2026');
    });
  });

  describe('in the grid of years', () => {
    async function pressKeys({
      from,
      keys,
      props = {},
      direction,
    }: {
      from: number;
      keys: string;
      props?: Record<string, unknown>;
      direction?: 'rtl';
    }) {
      const { user } = await renderViews({ defaultView: 'year', ...props }, direction);
      yearCell(from).focus();
      await user.keyboard(keys);
    }

    it.each([
      { keys: '{ArrowRight}', to: 2027 },
      { keys: '{ArrowLeft}', to: 2025 },
      { keys: '{ArrowDown}', to: 2029 },
      { keys: '{ArrowUp}', to: 2023 },
      { keys: '{Home}', to: 2025 },
      { keys: '{End}', to: 2027 },
      { keys: '{PageDown}', to: 2038 },
      { keys: '{PageUp}', to: 2014 },
    ])('moves the focus from 2026 to $to for $keys', async ({ keys, to }) => {
      await pressKeys({ from: 2026, keys });

      expect(yearCell(to)).toHaveFocus();
    });

    it('swaps left and right in a right-to-left page', async () => {
      await pressKeys({ from: 2026, keys: '{ArrowLeft}', direction: 'rtl' });

      expect(yearCell(2027)).toHaveFocus();
    });

    it.each([
      { name: 'the next page', from: 2027, keys: '{ArrowRight}', to: 2028, page: ['2028', '2039'] },
      {
        name: 'the page before',
        from: 2016,
        keys: '{ArrowLeft}',
        to: 2015,
        page: ['2004', '2015'],
      },
      { name: 'a page of years', from: 2026, keys: '{PageDown}', to: 2038, page: ['2028', '2039'] },
    ])('shows the page of the year that a key reaches: $name', async ({ from, keys, to, page }) => {
      const onMonthChange = vi.fn();
      await pressKeys({ from, keys, props: { onMonthChange } });

      expect(yearCell(to)).toHaveFocus();
      expect(title()).toHaveTextContent(years(`${page[0]}-01-01`, `${page[1]}-01-01`));
      expect(onMonthChange.mock.calls[0]![1].reason).toBe('keyboard');
    });

    it('keeps the page for a key inside the page, and the month of the focused date', async () => {
      const onMonthChange = vi.fn();
      const onFocusedDateChange = vi.fn();
      await pressKeys({
        from: 2026,
        keys: '{ArrowLeft}',
        props: { onMonthChange, onFocusedDateChange },
      });

      expect(onMonthChange).not.toHaveBeenCalled();
      expect(onFocusedDateChange.mock.lastCall![0].toString()).toBe('2025-11-14');
    });

    it('goes on to the next year that can take focus, and stops at the limits', async () => {
      await pressKeys({
        from: 2026,
        keys: '{ArrowRight}',
        props: { disabledYears: (year: Temporal.PlainYearMonth) => year.year === 2027 },
      });
      expect(yearCell(2028)).toHaveFocus();
    });

    it('stops at maxDate and at minDate', async () => {
      const { user } = await renderViews({
        defaultView: 'year',
        minDate: day('2018-06-01'),
        maxDate: day('2025-06-01'),
      });
      yearCell(2024).focus();

      await user.keyboard('{ArrowDown}');
      expect(yearCell(2025)).toHaveFocus();

      await user.keyboard('{ArrowUp}{ArrowUp}{ArrowUp}{ArrowUp}');
      expect(yearCell(2018)).toHaveFocus();
    });

    it('shows the months of the focused year for Enter, which keeps the month of the page', async () => {
      const onMonthChange = vi.fn();
      const { user } = await renderViews({ defaultView: 'year', onMonthChange });
      yearCell(2026).focus();

      await user.keyboard('{ArrowRight}{Enter}');

      expect(title()).toHaveTextContent('2027');
      expect(screen.getByRole('group')).toHaveAttribute('data-view', 'month');
      expect(onMonthChange.mock.lastCall![0].toString()).toBe('2027-11');
    });
  });
});
