import { describe, expect, it } from 'vitest';
import { DatePicker } from '@vase-ui/vue/date-picker';
import { Popover } from '@vase-ui/vue/popover';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';

const day = Temporal.PlainDate.from('2026-11-14');

// The text of the default name follows the options of the part.
const FULL_DATE: Intl.DateTimeFormatOptions = { dateStyle: 'full' };
const changeDate = (
  value:
    Temporal.PlainDate | Temporal.PlainDateTime | Temporal.ZonedDateTime | Temporal.PlainYearMonth,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
) => `Change date, ${formatText(value, options, locale)}`;

describe('<DatePicker.Trigger />', () => {
  const { render } = createRenderer();

  it('opens the picker on a click with a handle attribute', async () => {
    const handle = Popover.createHandle();
    const { user } = await render(
      <DatePicker.Root>
        <DatePicker.Trigger {...{ handle }} />
        <DatePicker.Portal>
          <DatePicker.Positioner>
            <DatePicker.Popup aria-label="Choose" />
          </DatePicker.Positioner>
        </DatePicker.Portal>
      </DatePicker.Root>,
    );

    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('dialog', { name: 'Choose' })).toBeInTheDocument();
  });

  it('has the attributes of a dialog trigger', async () => {
    await render(
      <DatePicker.Root>
        <DatePicker.Trigger />
      </DatePicker.Root>,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  describe('name', () => {
    it('says what the trigger does while the picker has no value', async () => {
      await render(
        <DatePicker.Root locale="en-US">
          <DatePicker.Trigger />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button', { name: 'Choose date' })).not.toBe(null);
    });

    const dateTime = Temporal.PlainDateTime.from('2026-11-14T15:04');
    const zoned = Temporal.ZonedDateTime.from('2026-11-14T15:04[UTC]');
    const month = Temporal.PlainYearMonth.from('2026-11');

    it.each([
      { name: 'a date', value: day, options: FULL_DATE },
      {
        name: 'a date and time',
        value: dateTime,
        options: { dateStyle: 'full', timeStyle: 'short' } as const,
      },
      {
        name: 'a date and time in a zone',
        value: zoned,
        options: { dateStyle: 'full', timeStyle: 'long' } as const,
      },
      {
        name: 'a year and month',
        value: month,
        options: { month: 'long', year: 'numeric' } as const,
      },
    ])('has the value in its name for $name', async ({ value, options }) => {
      await render(
        <DatePicker.Root defaultValue={value} locale="en-US">
          <DatePicker.Trigger />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button', { name: changeDate(value, options) })).not.toBe(null);
    });

    it('follows the value, and the locale', async () => {
      const { setProps } = await render(
        <DatePicker.Root modelValue={day} locale="de-DE">
          <DatePicker.Trigger />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button', { name: changeDate(day, FULL_DATE, 'de-DE') })).not.toBe(
        null,
      );

      const next = Temporal.PlainDate.from('2026-12-24');
      await setProps({ modelValue: next });

      expect(screen.getByRole('button', { name: changeDate(next, FULL_DATE, 'de-DE') })).not.toBe(
        null,
      );
    });

    it('gives the name back to the default when the value goes', async () => {
      const { setProps } = await render(
        <DatePicker.Root modelValue={day} locale="en-US">
          <DatePicker.Trigger />
        </DatePicker.Root>,
      );

      await setProps({ modelValue: null });

      expect(screen.getByRole('button', { name: 'Choose date' })).not.toBe(null);
    });

    it('takes the name of the consumer, and `null` removes it', async () => {
      await render(
        <DatePicker.Root defaultValue={day} locale="en-US">
          <DatePicker.Trigger aria-label="Departure date" data-testid="own" />
          <DatePicker.Trigger aria-label={null} data-testid="none">
            Calendar
          </DatePicker.Trigger>
        </DatePicker.Root>,
      );

      expect(screen.getByTestId('own')).toHaveAttribute('aria-label', 'Departure date');
      expect(screen.getByTestId('none')).not.toHaveAttribute('aria-label');
    });

    // A blank name gives nothing to a screen reader, so the part keeps its own.
    it('keeps its own name for a blank name of the consumer', async () => {
      await render(
        <DatePicker.Root defaultValue={day} locale="en-US">
          <DatePicker.Trigger aria-label="  " />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button', { name: changeDate(day, FULL_DATE) })).not.toBe(null);
    });
  });

  describe('prop: disabled', () => {
    it.each([
      { name: 'the picker is disabled', root: { disabled: true }, trigger: {} },
      { name: 'the picker is read-only', root: { readOnly: true }, trigger: {} },
      { name: 'the trigger is disabled', root: {}, trigger: { disabled: true } },
    ])('is disabled when $name', async ({ root, trigger }) => {
      await render(
        <DatePicker.Root {...root}>
          <DatePicker.Trigger {...trigger} />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button')).toHaveAttribute('disabled');
    });

    it('is enabled by default', async () => {
      await render(
        <DatePicker.Root>
          <DatePicker.Trigger />
        </DatePicker.Root>,
      );

      expect(screen.getByRole('button')).not.toHaveAttribute('disabled');
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws outside the root of a date picker', async () => {
    await expect(render(<DatePicker.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Date Picker must be inside <DatePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <DatePicker.Root>.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
