import { describe, expect, it } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { Popover } from '@vase-ui/vue/popover';
import { createRenderer, screen, takeReportedMessages } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';

const time = Temporal.PlainTime.from('15:04');

// The text of the default name follows the options of the part.
const SHORT: Intl.DateTimeFormatOptions = { hour: 'numeric', minute: '2-digit' };
const changeTime = (
  value: Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
) => `Change time, ${formatText(value, options, locale)}`;

describe('<TimePicker.Trigger />', () => {
  const { render } = createRenderer();

  it('opens the picker on a click with a handle attribute', async () => {
    const handle = Popover.createHandle();
    const { user } = await render(
      <TimePicker.Root>
        <TimePicker.Trigger {...{ handle }} />
        <TimePicker.Portal>
          <TimePicker.Positioner>
            <TimePicker.Popup aria-label="Choose" />
          </TimePicker.Positioner>
        </TimePicker.Portal>
      </TimePicker.Root>,
    );

    await user.click(screen.getByRole('button'));

    expect(await screen.findByRole('dialog', { name: 'Choose' })).toBeInTheDocument();
  });

  it('has the attributes of a dialog trigger', async () => {
    await render(
      <TimePicker.Root>
        <TimePicker.Trigger />
      </TimePicker.Root>,
    );

    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  describe('name', () => {
    it('says what the trigger does while the picker has no value', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.Trigger />
        </TimePicker.Root>,
      );

      expect(screen.getByRole('button', { name: 'Choose time' })).not.toBe(null);
    });

    const dateTime = Temporal.PlainDateTime.from('2026-11-14T15:04');
    const zoned = Temporal.ZonedDateTime.from('2026-11-14T15:04[Asia/Tokyo]');

    it.each([
      { name: 'a time', value: time, props: {}, options: SHORT },
      { name: 'a date and time', value: dateTime, props: {}, options: SHORT },
      {
        name: 'a time in a zone',
        value: zoned,
        props: {},
        options: { ...SHORT, timeZoneName: 'short' },
      },
      {
        name: 'a time with a granularity of seconds',
        value: time,
        props: { granularity: 'second' },
        options: { ...SHORT, second: '2-digit' },
      },
      {
        name: 'a time in a 24-hour cycle',
        value: time,
        props: { hourCycle: 24 },
        options: { ...SHORT, hourCycle: 'h23' },
      },
    ] as const)(
      'has the time, and not the date, in its name for $name',
      async ({ value, props, options }) => {
        await render(
          <TimePicker.Root locale="en-US" defaultValue={value} {...props}>
            <TimePicker.Trigger />
          </TimePicker.Root>,
        );

        expect(screen.getByRole('button')).toHaveAttribute(
          'aria-label',
          changeTime(value, options),
        );
      },
    );

    it('follows the value and the locale of the picker', async () => {
      const { setProps } = await render(
        <TimePicker.Root locale="en-US" modelValue={time}>
          <TimePicker.Trigger />
        </TimePicker.Root>,
      );
      expect(screen.getByRole('button')).toHaveAttribute('aria-label', changeTime(time, SHORT));

      await setProps({ modelValue: Temporal.PlainTime.from('09:30'), locale: 'de-DE' });

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        changeTime(Temporal.PlainTime.from('09:30'), SHORT, 'de-DE'),
      );
    });

    it('says what the trigger does again after the picker is emptied', async () => {
      const { setProps } = await render(
        <TimePicker.Root locale="en-US" modelValue={time}>
          <TimePicker.Trigger />
        </TimePicker.Root>,
      );

      await setProps({ modelValue: null });

      expect(screen.getByRole('button', { name: 'Choose time' })).not.toBe(null);
    });

    it('takes the name that the consumer gives, and removes it for null', async () => {
      await render(
        <TimePicker.Root locale="en-US" defaultValue={time}>
          <TimePicker.Trigger aria-label="Start time" />
          <TimePicker.Trigger aria-label={null} aria-labelledby="named" />
          <span id="named">Named</span>
        </TimePicker.Root>,
      );

      const [first, second] = screen.getAllByRole('button');
      expect(first).toHaveAttribute('aria-label', 'Start time');
      expect(second).not.toHaveAttribute('aria-label');
    });

    it('keeps its own name for a blank name of the consumer', async () => {
      await render(
        <TimePicker.Root locale="en-US">
          <TimePicker.Trigger aria-label="  " />
        </TimePicker.Root>,
      );

      expect(screen.getByRole('button', { name: 'Choose time' })).not.toBe(null);
    });
  });

  describe('prop: disabled', () => {
    it.each([
      { name: 'the trigger', root: {}, trigger: { disabled: true } },
      { name: 'the picker', root: { disabled: true }, trigger: {} },
      { name: 'a read-only picker', root: { readOnly: true }, trigger: {} },
    ])('is disabled by $name', async ({ root, trigger }) => {
      await render(
        <TimePicker.Root {...root}>
          <TimePicker.Trigger {...trigger} />
        </TimePicker.Root>,
      );

      expect(screen.getByRole('button')).toBeDisabled();
    });
  });

  it('throws outside the root of a time picker', async () => {
    await expect(render(<TimePicker.Trigger />)).rejects.toThrow(
      'Vase UI: A part of Time Picker must be inside <TimePicker.Root>. Without a root the part has no value and no popup to share. Put the part inside <TimePicker.Root>.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
