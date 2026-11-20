import { describe, expect, it } from 'vitest';
import { DateRangePicker } from '@vase-ui/vue/date-range-picker';
import { Popover } from '@vase-ui/vue/popover';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import { formatRangeText } from '../../internals/date-time/calendar/formatText';

const day = (text: string) => Temporal.PlainDate.from(text);
const range = (start: string, end: string) => [day(start), day(end)] as const;

// The text of the default name follows the options of the part.
const FULL_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'full' };
const changeDates = (
  start: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  end: Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
) => `Change dates, ${formatRangeText(start, end, options, locale)}`;

describe('<DateRangePicker.Trigger />', () => {
  const { render } = createRenderer();

  it('opens the picker on a click with a handle attribute', async () => {
    const handle = Popover.createHandle();
    const { user } = await render(
      <DateRangePicker.Root>
        <DateRangePicker.Trigger {...{ handle }} />
        <DateRangePicker.Portal>
          <DateRangePicker.Positioner>
            <DateRangePicker.Popup aria-label="Choose" />
          </DateRangePicker.Positioner>
        </DateRangePicker.Portal>
      </DateRangePicker.Root>,
    );

    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('dialog', { name: 'Choose' })).toBeInTheDocument();
  });

  it('has the attributes of a dialog trigger', async () => {
    await render(
      <DateRangePicker.Root>
        <DateRangePicker.Trigger />
      </DateRangePicker.Root>,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  describe('name', () => {
    it.each([
      { name: 'no day', value: [null, null] as const },
      { name: 'a first day only', value: [day('2026-11-18'), null] as const },
      { name: 'a last day only', value: [null, day('2026-11-20')] as const },
    ])('says what the trigger does while the range has $name', async ({ value }) => {
      await render(
        <DateRangePicker.Root defaultValue={value} locale="en-US">
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('button', { name: 'Choose dates' })).not.toBe(null);
    });

    const start = Temporal.PlainDateTime.from('2026-11-18T09:30');
    const end = Temporal.PlainDateTime.from('2026-11-20T17:45');
    const zonedStart = Temporal.ZonedDateTime.from('2026-11-18T09:30[UTC]');
    const zonedEnd = Temporal.ZonedDateTime.from('2026-11-20T17:45[UTC]');

    it.each([
      { name: 'dates', start: day('2026-11-18'), end: day('2026-11-20'), options: FULL_DATE },
      {
        name: 'dates and times',
        start,
        end,
        options: { dateStyle: 'full', timeStyle: 'short' } as const,
      },
      {
        name: 'dates and times in a zone',
        start: zonedStart,
        end: zonedEnd,
        options: { dateStyle: 'full', timeStyle: 'long' } as const,
      },
    ])('has the range in its name for $name', async ({ start, end, options }) => {
      await render(
        <DateRangePicker.Root defaultValue={[start, end]} locale="en-US">
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('button', { name: changeDates(start, end, options) })).not.toBe(null);
    });

    // The user can type a last day that is before the first day. The field is then invalid, and the
    // name still says what the range is.
    it('has a range with the last day before the first day in its name, with no error', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-20', '2026-11-18')} locale="en-US">
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      expect(
        screen.getByRole('button', {
          name: changeDates(day('2026-11-20'), day('2026-11-18'), FULL_DATE),
        }),
      ).not.toBe(null);
    });

    it('follows the range, and the locale', async () => {
      const { setProps } = await render(
        <DateRangePicker.Root modelValue={range('2026-11-18', '2026-11-20')} locale="de-DE">
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      expect(
        screen.getByRole('button', {
          name: changeDates(day('2026-11-18'), day('2026-11-20'), FULL_DATE, 'de-DE'),
        }),
      ).not.toBe(null);

      await setProps({ modelValue: range('2026-12-24', '2026-12-26') });

      expect(
        screen.getByRole('button', {
          name: changeDates(day('2026-12-24'), day('2026-12-26'), FULL_DATE, 'de-DE'),
        }),
      ).not.toBe(null);
    });

    it('gives the name back to the default when the range goes', async () => {
      const { setProps } = await render(
        <DateRangePicker.Root modelValue={range('2026-11-18', '2026-11-20')} locale="en-US">
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      await setProps({ modelValue: null });

      expect(screen.getByRole('button', { name: 'Choose dates' })).not.toBe(null);
    });

    it('takes the name of the consumer, and `null` removes it', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')} locale="en-US">
          <DateRangePicker.Trigger aria-label="Trip dates" data-testid="own" />
          <DateRangePicker.Trigger aria-label={null} data-testid="none">
            Calendar
          </DateRangePicker.Trigger>
        </DateRangePicker.Root>,
      );

      expect(screen.getByTestId('own')).toHaveAttribute('aria-label', 'Trip dates');
      expect(screen.getByTestId('none')).not.toHaveAttribute('aria-label');
    });

    // A blank name gives nothing to a screen reader, so the part keeps its own name.
    it('keeps its own name for a blank name of the consumer', async () => {
      await render(
        <DateRangePicker.Root defaultValue={range('2026-11-18', '2026-11-20')} locale="en-US">
          <DateRangePicker.Trigger aria-label="  " />
        </DateRangePicker.Root>,
      );

      expect(
        screen.getByRole('button', {
          name: changeDates(day('2026-11-18'), day('2026-11-20'), FULL_DATE),
        }),
      ).not.toBe(null);
    });
  });

  describe('prop: disabled', () => {
    it.each([
      { name: 'the picker is disabled', root: { disabled: true }, trigger: {} },
      { name: 'the picker is read-only', root: { readOnly: true }, trigger: {} },
      { name: 'the trigger is disabled', root: {}, trigger: { disabled: true } },
    ])('is disabled when $name', async ({ root, trigger }) => {
      await render(
        <DateRangePicker.Root {...root}>
          <DateRangePicker.Trigger {...trigger} />
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('is enabled by default', async () => {
      await render(
        <DateRangePicker.Root>
          <DateRangePicker.Trigger />
        </DateRangePicker.Root>,
      );

      expect(screen.getByRole('button')).not.toHaveAttribute('disabled');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws outside the root of a date range picker', async () => {
    await expect(render(<DateRangePicker.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Date Range Picker must be inside <DateRangePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DateRangePicker.Root>.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
