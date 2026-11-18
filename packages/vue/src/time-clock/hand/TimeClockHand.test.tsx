import { describe, expect, it } from 'vitest';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { createRenderer, describeConformance, screen } from '#test-utils';

const time = (text: string) => Temporal.PlainTime.from(text);

describe('<TimeClock.Hand />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.Hand />, () => ({
    render: (node) => render(<TimeClock.Root defaultValue={time('10:30')}>{node}</TimeClock.Root>),
    refInstanceof: window.HTMLDivElement,
  }));

  function variables(hand: HTMLElement) {
    return Object.fromEntries(
      Array.from(hand.style, (name) => [name, hand.style.getPropertyValue(name)]),
    );
  }

  it.each([
    { name: 'an hour', props: {}, angle: '300deg', length: '1', between: false },
    {
      name: 'an hour at the top',
      props: { defaultValue: time('00:40') },
      angle: '0deg',
      length: '1',
      between: false,
    },
    {
      name: 'a minute on a number',
      props: { defaultView: 'minute', defaultValue: time('10:35') },
      angle: '210deg',
      length: '1',
      between: false,
    },
    {
      name: 'a minute between numbers',
      props: { defaultView: 'minute', defaultValue: time('10:37') },
      angle: '222deg',
      length: '1',
      between: true,
    },
    {
      name: 'a second between numbers',
      props: { defaultView: 'second', defaultValue: time('10:30:01') },
      angle: '6deg',
      length: '1',
      between: true,
    },
  ] as const)('points at $name', async ({ props, angle, length, between }) => {
    await render(
      <TimeClock.Root hourCycle={12} defaultValue={time('10:30')} {...props}>
        <TimeClock.Hand data-testid="hand" />
      </TimeClock.Root>,
    );

    const hand = screen.getByTestId('hand');
    expect(variables(hand)).toEqual({
      '--time-clock-hand-angle': angle,
      '--time-clock-hand-length': length,
    });
    expect(hand).toHaveAttribute('aria-hidden', 'true');
    expect(hand.hasAttribute('data-between-numbers')).toBe(between);
    expect(hand).not.toHaveAttribute('data-inner');
  });

  it.each([
    { name: 'the inner ring', at: '15:00', angle: '90deg', length: '0.64', inner: true },
    { name: 'midnight on the inner ring', at: '00:00', angle: '0deg', length: '0.64', inner: true },
    { name: 'noon on the outer ring', at: '12:00', angle: '0deg', length: '1', inner: false },
    { name: 'the outer ring', at: '03:00', angle: '90deg', length: '1', inner: false },
  ])('points at $name of a 24-hour face', async ({ at, angle, length, inner }) => {
    await render(
      <TimeClock.Root hourCycle={24} defaultValue={time(at)}>
        <TimeClock.Hand data-testid="hand" />
      </TimeClock.Root>,
    );

    const hand = screen.getByTestId('hand');
    expect(variables(hand)).toEqual({
      '--time-clock-hand-angle': angle,
      '--time-clock-hand-length': length,
    });
    expect(hand.hasAttribute('data-inner')).toBe(inner);
  });

  it('writes only the variables, and no position', async () => {
    await render(
      <TimeClock.Root defaultValue={time('10:30')}>
        <TimeClock.Hand data-testid="hand" />
      </TimeClock.Root>,
    );

    const names = Array.from(screen.getByTestId('hand').style);
    expect(names).toHaveLength(2);
    expect(names.every((name) => name.startsWith('--time-clock-hand-'))).toBe(true);
  });

  it('follows a change of the time and of the view', async () => {
    const { setProps } = await render(
      <TimeClock.Root hourCycle={12} modelValue={time('10:30')} view="hour">
        <TimeClock.Hand data-testid="hand" />
      </TimeClock.Root>,
    );
    const hand = screen.getByTestId('hand');

    await setProps({ modelValue: time('03:30') });
    expect(hand.style.getPropertyValue('--time-clock-hand-angle')).toBe('90deg');

    await setProps({ view: 'minute' });
    expect(hand.style.getPropertyValue('--time-clock-hand-angle')).toBe('180deg');
  });

  it('renders nothing while the clock has no value', async () => {
    const { setProps } = await render(
      <TimeClock.Root modelValue={null}>
        <TimeClock.Hand data-testid="hand" />
      </TimeClock.Root>,
    );

    expect(screen.queryByTestId('hand')).toBeNull();

    await setProps({ modelValue: time('10:30') });
    expect(screen.getByTestId('hand')).toBeInTheDocument();

    await setProps({ modelValue: null });
    expect(screen.queryByTestId('hand')).toBeNull();
  });

  it('renders nothing with the render slot while the clock has no value', async () => {
    await render(
      <TimeClock.Root>
        <TimeClock.Hand
          v-slots={{
            render: ({ props }: { props: object }) => <i {...props} data-testid="hand" />,
          }}
        />
      </TimeClock.Root>,
    );

    expect(screen.queryByTestId('hand')).toBeNull();
  });
});
