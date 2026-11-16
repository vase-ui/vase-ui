import { describe, expect, it } from 'vitest';
import { TimePicker } from '@vase-ui/vue/time-picker';
import { createRenderer, describeConformance, screen } from '#test-utils';
import { formatText } from '../../internals/date-time/calendar/formatText';

const time = Temporal.PlainTime.from('15:04');

// The text of the default name follows the options of the part.
const changeTime = (
  value: Temporal.PlainTime | Temporal.PlainDateTime | Temporal.ZonedDateTime,
  options: Intl.DateTimeFormatOptions,
  locale = 'en-US',
) => `Change time, ${formatText(value, options, locale)}`;

describe('<TimePicker.Trigger />', () => {
  const { render } = createRenderer();

  describeConformance(<TimePicker.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(<TimePicker.Root>{node}</TimePicker.Root>);
    },
  }));

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
      { name: 'a time', value: time, props: {}, options: { timeStyle: 'short' } },
      { name: 'a date and time', value: dateTime, props: {}, options: { timeStyle: 'short' } },
      { name: 'a time in a zone', value: zoned, props: {}, options: { timeStyle: 'long' } },
      {
        name: 'a time with a granularity of seconds',
        value: time,
        props: { granularity: 'second' },
        options: { timeStyle: 'medium' },
      },
      {
        name: 'a time in a 24-hour cycle',
        value: time,
        props: { hourCycle: 24 },
        options: { timeStyle: 'short', hourCycle: 'h23' },
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
        <TimePicker.Root locale="en-US" value={time}>
          <TimePicker.Trigger />
        </TimePicker.Root>,
      );
      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        changeTime(time, { timeStyle: 'short' }),
      );

      await setProps({ value: Temporal.PlainTime.from('09:30'), locale: 'de-DE' });

      expect(screen.getByRole('button')).toHaveAttribute(
        'aria-label',
        changeTime(Temporal.PlainTime.from('09:30'), { timeStyle: 'short' }, 'de-DE'),
      );
    });

    it('says what the trigger does again after the picker is emptied', async () => {
      const { setProps } = await render(
        <TimePicker.Root locale="en-US" value={time}>
          <TimePicker.Trigger />
        </TimePicker.Root>,
      );

      await setProps({ value: null });

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
});
