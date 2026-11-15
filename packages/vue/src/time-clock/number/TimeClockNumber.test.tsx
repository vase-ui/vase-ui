import { describe, expect, it } from 'vitest';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { createRenderer, describeConformance, screen } from '#test-utils';

const time = (text: string) => Temporal.PlainTime.from(text);
const hour = (value: number, inner = false) => ({ value, inner });

describe('<TimeClock.Number />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.Number number={hour(3)} />, () => ({
    render: (node) => render(<TimeClock.Root>{node}</TimeClock.Root>),
    refInstanceof: window.HTMLSpanElement,
  }));

  describe('text', () => {
    it.each([
      { name: 'an hour', number: hour(3), text: '3' },
      { name: 'a zero with two digits', number: hour(0, true), text: '00' },
      { name: 'an hour of the inner ring', number: hour(13, true), text: '13' },
    ])('shows $name', async ({ number, text }) => {
      await render(
        <TimeClock.Root locale="en-US" hourCycle={24}>
          <TimeClock.Number number={number} data-testid="number" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number').textContent).toBe(text);
    });

    it.each([
      { name: 'a minute', view: 'minute', value: 5, text: '05' },
      { name: 'a minute of two digits', view: 'minute', value: 35, text: '35' },
      { name: 'a second', view: 'second', value: 0, text: '00' },
    ] as const)('shows $name with two digits', async ({ view, value, text }) => {
      await render(
        <TimeClock.Root locale="en-US" defaultView={view}>
          <TimeClock.Number number={hour(value)} data-testid="number" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number').textContent).toBe(text);
    });

    it('shows the digits of the locale', async () => {
      await render(
        <TimeClock.Root locale="ar-EG">
          <TimeClock.Number number={hour(10)} data-testid="number" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number').textContent).toBe(
        new Intl.NumberFormat('ar-EG', { useGrouping: false }).format(10),
      );
    });

    it('shows the content of the consumer in place of the text', async () => {
      await render(
        <TimeClock.Root>
          <TimeClock.Number number={hour(3)} data-testid="number">
            three
          </TimeClock.Number>
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number').textContent).toBe('three');
    });
  });

  it('places the number with variables only, and hides it from assistive technology', async () => {
    await render(
      <TimeClock.Root hourCycle={24}>
        <TimeClock.Number number={hour(13, true)} data-testid="inner" />
        <TimeClock.Number number={hour(3)} data-testid="outer" />
      </TimeClock.Root>,
    );

    const inner = screen.getByTestId('inner');
    const outer = screen.getByTestId('outer');
    expect(Array.from(inner.style)).toEqual([
      '--time-clock-number-angle',
      '--time-clock-number-radius',
    ]);
    expect(inner.style.getPropertyValue('--time-clock-number-angle')).toBe('30deg');
    expect(inner.style.getPropertyValue('--time-clock-number-radius')).toBe('0.64');
    expect(outer.style.getPropertyValue('--time-clock-number-angle')).toBe('90deg');
    expect(outer.style.getPropertyValue('--time-clock-number-radius')).toBe('1');
    expect(inner).toHaveAttribute('aria-hidden', 'true');
    expect(inner).toHaveAttribute('data-inner');
    expect(outer).not.toHaveAttribute('data-inner');
  });

  it('places a minute at 6 degrees for each minute', async () => {
    await render(
      <TimeClock.Root defaultView="minute">
        <TimeClock.Number number={hour(35)} data-testid="number" />
      </TimeClock.Root>,
    );

    expect(screen.getByTestId('number').style.getPropertyValue('--time-clock-number-angle')).toBe(
      '210deg',
    );
  });

  describe('state', () => {
    it('is selected when the time of the clock selects the number', async () => {
      await render(
        <TimeClock.Root hourCycle={12} defaultValue={time('15:00')}>
          <TimeClock.Number number={hour(3)} data-testid="three" />
          <TimeClock.Number number={hour(4)} data-testid="four" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('three')).toHaveAttribute('data-selected');
      expect(screen.getByTestId('four')).not.toHaveAttribute('data-selected');
    });

    it('selects the hour of a 24-hour face on its own ring', async () => {
      await render(
        <TimeClock.Root hourCycle={24} defaultValue={time('15:00')}>
          <TimeClock.Number number={hour(3)} data-testid="outer" />
          <TimeClock.Number number={hour(15, true)} data-testid="inner" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('outer')).not.toHaveAttribute('data-selected');
      expect(screen.getByTestId('inner')).toHaveAttribute('data-selected');
    });

    it('selects no number while the clock has no value', async () => {
      await render(
        <TimeClock.Root referenceDate={time('03:00')} hourCycle={12}>
          <TimeClock.Number number={hour(3)} data-testid="number" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number')).not.toHaveAttribute('data-selected');
      expect(screen.getByTestId('number')).toHaveAttribute('data-empty');
    });

    it.each([
      {
        name: 'a number before the least time',
        props: { minTime: time('09:00') },
        number: hour(3),
        disabled: true,
      },
      {
        name: 'a number in the range',
        props: { minTime: time('09:00') },
        number: hour(10),
        disabled: false,
      },
      {
        name: 'a number that disabledTimes names',
        props: { disabledTimes: (t: Temporal.PlainTime) => t.hour === 4 },
        number: hour(4),
        disabled: true,
      },
      {
        name: 'any number of a disabled clock',
        props: { disabled: true },
        number: hour(4),
        disabled: true,
      },
    ])('is disabled for $name: $disabled', async ({ props, number, disabled }) => {
      await render(
        <TimeClock.Root hourCycle={12} defaultValue={time('10:30')} {...props}>
          <TimeClock.Number number={number} data-testid="number" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('number').hasAttribute('data-disabled')).toBe(disabled);
    });

    it('is disabled for a minute that is not in the step', async () => {
      await render(
        <TimeClock.Root defaultView="minute" minuteStep={15}>
          <TimeClock.Number number={hour(45)} data-testid="on" />
          <TimeClock.Number number={hour(50)} data-testid="off" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('on')).not.toHaveAttribute('data-disabled');
      expect(screen.getByTestId('off')).toHaveAttribute('data-disabled');
    });
  });
});
