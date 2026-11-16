import { describe, expect, it } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, describeConformance, screen, takeReportedMessages } from '#test-utils';
import { formatNumber } from '../../common/formatNumber';

const time = (text: string) => Temporal.PlainTime.from(text);

const texts = () => screen.getAllByRole('option').map((option) => option.textContent);
const selectedTexts = () =>
  screen.queryAllByRole('option', { selected: true }).map((option) => option.textContent);

const unitName = (unit: string, locale = 'en-US') =>
  new Intl.DisplayNames(locale, { type: 'dateTimeField' }).of(unit);

const range = (count: number, step = 1, first = 0) =>
  Array.from({ length: Math.ceil(count / step) }, (_, place) => first + place * step);
const twoDigits = (value: number, locale = 'en-US') =>
  formatNumber(value, locale, { minimumIntegerDigits: 2 });
// The day period of 9:00 and of 21:00.
const dayPeriods = (locale: string) =>
  [9, 21].map(
    (hour) =>
      new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
        .formatToParts(Date.UTC(1970, 0, 1, hour))
        .find((part) => part.type === 'dayPeriod')?.value,
  );

describe('<TimePicker.Column />', () => {
  const { render } = createRenderer();

  describeConformance(<TimePicker.Column unit="hour" />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => render(<TimePicker.Root>{node}</TimePicker.Root>),
  }));

  function renderColumn(
    columnProps: Record<string, unknown>,
    rootProps: Record<string, unknown> = {},
  ) {
    return render(
      <TimePicker.Root locale="en-US" {...rootProps}>
        <TimePicker.Column unit="hour" {...columnProps} />
      </TimePicker.Root>,
    );
  }

  describe('name and state', () => {
    it.each(['hour', 'minute', 'second', 'dayPeriod'] as const)(
      'is a listbox that has the name of the unit %s',
      async (unit) => {
        await renderColumn({ unit }, { hourCycle: 12 });

        expect(screen.getByRole('listbox', { name: unitName(unit) })).toHaveAttribute(
          'data-unit',
          unit,
        );
      },
    );

    it('has the name in the locale of the picker', async () => {
      await renderColumn({ unit: 'hour' }, { locale: 'de-DE' });

      expect(screen.getByRole('listbox', { name: unitName('hour', 'de-DE') })).not.toBe(null);
    });

    it('takes the name that the consumer gives', async () => {
      await renderColumn({ unit: 'hour', 'aria-label': 'Hours' });

      expect(screen.getByRole('listbox', { name: 'Hours' })).not.toBe(null);
    });

    it('has the states of the picker as attributes', async () => {
      await renderColumn({}, { disabled: true, readOnly: true });

      const column = screen.getByRole('listbox');
      expect(column).toHaveAttribute('aria-disabled', 'true');
      expect(column).toHaveAttribute('aria-readonly', 'true');
      expect(column).toHaveAttribute('data-disabled');
      expect(column).toHaveAttribute('data-readonly');
    });
  });

  describe('the values', () => {
    it.each([
      {
        name: 'the hours of a 12-hour cycle, from 12',
        unit: 'hour',
        hourCycle: 12,
        step: undefined,
        expected: ['12', ...range(11, 1, 1).map(String)],
      },
      {
        name: 'the hours of a 24-hour cycle, with two digits',
        unit: 'hour',
        hourCycle: 24,
        step: undefined,
        expected: range(24).map((value) => twoDigits(value)),
      },
      {
        name: 'the hours of a 12-hour cycle with a step',
        unit: 'hour',
        hourCycle: 12,
        step: 3,
        expected: ['12', '3', '6', '9'],
      },
      {
        name: 'the hours of a 24-hour cycle with a step',
        unit: 'hour',
        hourCycle: 24,
        step: 6,
        expected: ['00', '06', '12', '18'],
      },
      {
        name: 'the minutes',
        unit: 'minute',
        hourCycle: 12,
        step: undefined,
        expected: range(60).map((value) => twoDigits(value)),
      },
      {
        name: 'the minutes with a step',
        unit: 'minute',
        hourCycle: 12,
        step: 15,
        expected: ['00', '15', '30', '45'],
      },
      {
        name: 'the minutes with a step that does not divide an hour',
        unit: 'minute',
        hourCycle: 12,
        step: 25,
        expected: ['00', '25', '50'],
      },
      {
        name: 'the seconds with a step',
        unit: 'second',
        hourCycle: 24,
        step: 20,
        expected: ['00', '20', '40'],
      },
      {
        name: 'the day periods',
        unit: 'dayPeriod',
        hourCycle: 12,
        step: undefined,
        expected: dayPeriods('en-US'),
      },
    ] as const)('has $name', async ({ unit, hourCycle, step, expected }) => {
      await renderColumn({ unit, step }, { hourCycle });

      expect(texts()).toEqual(expected);
    });

    it('has the digits of the locale', async () => {
      await renderColumn({ unit: 'minute', step: 30 }, { locale: 'ar-EG' });

      expect(texts()).toEqual([0, 30].map((value) => twoDigits(value, 'ar-EG')));
    });

    it('has the day periods of the locale', async () => {
      await renderColumn({ unit: 'dayPeriod' }, { locale: 'ja-JP', hourCycle: 12 });

      expect(texts()).toEqual(dayPeriods('ja-JP'));
    });

    it('renders no day period in a 24-hour cycle', async () => {
      await renderColumn({ unit: 'dayPeriod' }, { hourCycle: 24 });

      expect(screen.queryByRole('listbox')).toBe(null);
    });

    it.each([0, -1, 2.5, Number.NaN])(
      'warns for the step %s and uses a step of 1',
      async (step) => {
        await renderColumn({ unit: 'minute', step });

        expect(screen.getAllByRole('option')).toHaveLength(60);
        expect(takeReportedMessages()).toEqual([
          'console.warn: Vase UI: TimePicker.Column `step` must be a whole number above 0. The column uses a step of 1 instead. Set `step` to a whole number above 0.',
        ]);
      },
    );

    it('gives each value and its index to the slot item', async () => {
      await render(
        <TimePicker.Root locale="en-US" hourCycle={12}>
          <TimePicker.Column
            unit="dayPeriod"
            v-slots={{
              item: ({ value, index }: { value: number | 'am' | 'pm'; index: number }) => (
                <TimePicker.ColumnItem value={value} data-index={index} />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(
        screen.getAllByRole('option').map((option) => option.getAttribute('data-index')),
      ).toEqual(['0', '1']);
    });

    it('does not render the values in the slot render', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.Column
            unit="hour"
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <section {...props} data-testid="custom" />
              ),
            }}
          />
        </TimePicker.Root>,
      );

      expect(screen.getByTestId('custom')).not.toBe(null);
      expect(screen.queryAllByRole('option')).toHaveLength(0);
    });
  });

  describe('the value of the picker', () => {
    it.each([
      { unit: 'hour', expected: '3' },
      { unit: 'minute', expected: '30' },
      { unit: 'second', expected: '45' },
      { unit: 'dayPeriod', expected: dayPeriods('en-US')[1] },
    ] as const)('selects the $unit of the time', async ({ unit, expected }) => {
      await renderColumn({ unit }, { hourCycle: 12, defaultValue: time('15:30:45') });

      expect(selectedTexts()).toEqual([expected]);
    });

    it('selects the hour of a 24-hour cycle', async () => {
      await renderColumn({}, { hourCycle: 24, defaultValue: time('15:30') });

      expect(selectedTexts()).toEqual(['15']);
    });

    it('selects 12 for midnight and for noon', async () => {
      const { setProps } = await render(
        <TimePicker.Root locale="en-US" hourCycle={12} value={time('00:15')}>
          <TimePicker.Column unit="hour" />
        </TimePicker.Root>,
      );
      expect(selectedTexts()).toEqual(['12']);
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');

      await setProps({ value: time('12:15') });

      expect(selectedTexts()).toEqual(['12']);
      expect(screen.getAllByRole('option')[0]).toHaveAttribute('aria-selected', 'true');
    });

    it('selects no item while the picker has no value', async () => {
      await renderColumn({ unit: 'minute' });

      expect(selectedTexts()).toEqual([]);
    });

    it('selects no item for a minute that the step does not have', async () => {
      await renderColumn({ unit: 'minute', step: 5 }, { defaultValue: time('10:07') });

      expect(selectedTexts()).toEqual([]);
    });
  });

  describe('keys', () => {
    it('has the tab stop on the selected item', async () => {
      const { user } = await renderColumn(
        { unit: 'minute', step: 15 },
        { defaultValue: time('10:30') },
      );

      await user.tab();

      expect(screen.getByRole('option', { name: '30' })).toHaveFocus();
    });

    it('has the tab stop on the first item while the picker has no value', async () => {
      const { user } = await renderColumn({ unit: 'minute', step: 15 });

      await user.tab();

      expect(screen.getAllByRole('option')[0]).toHaveFocus();
    });

    it('has one tab stop in each column, so the Tab key moves from one column to the next', async () => {
      const { user } = await render(
        <TimePicker.Root locale="en-US" hourCycle={12} defaultValue={time('15:30')}>
          <TimePicker.Column unit="hour" />
          <TimePicker.Column unit="minute" step={15} />
        </TimePicker.Root>,
      );

      await user.tab();
      expect(screen.getByRole('option', { name: '3' })).toHaveFocus();

      await user.tab();
      expect(screen.getByRole('option', { name: '30' })).toHaveFocus();
    });

    it('moves the focus with the arrow keys inside the column, and goes round at the ends', async () => {
      const { user } = await renderColumn({ unit: 'minute', step: 20 });
      const [first, second, last] = screen.getAllByRole('option');
      await user.tab();

      await user.keyboard('{ArrowDown}');
      expect(second).toHaveFocus();

      await user.keyboard('{ArrowUp}{ArrowUp}');
      expect(last).toHaveFocus();

      await user.keyboard('{Home}');
      expect(first).toHaveFocus();

      await user.keyboard('{End}');
      expect(last).toHaveFocus();
    });
  });
});
