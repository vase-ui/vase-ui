import { describe, expect, it, vi } from 'vitest';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { createRenderer, describeConformance, screen } from '#test-utils';

const time = (text: string) => Temporal.PlainTime.from(text);

function twoDigits(value: number) {
  return new Intl.NumberFormat('en-US', { minimumIntegerDigits: 2, useGrouping: false }).format(
    value,
  );
}

function unitName(unit: 'hour' | 'minute' | 'second') {
  return new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(unit);
}

describe('<TimeClock.ViewTrigger />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.ViewTrigger view="hour" />, () => ({
    render: (node) => render(<TimeClock.Root>{node}</TimeClock.Root>),
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
  }));

  describe('text', () => {
    it.each([
      { name: 'an hour of a 12-hour clock', hourCycle: 12, view: 'hour', value: 3 },
      { name: 'an hour of a 24-hour clock', hourCycle: 24, view: 'hour', value: 15 },
      { name: 'a minute', hourCycle: 12, view: 'minute', value: 7 },
      { name: 'a second', hourCycle: 12, view: 'second', value: 9 },
    ] as const)('shows $name with two digits', async ({ hourCycle, view, value }) => {
      await render(
        <TimeClock.Root locale="en-US" hourCycle={hourCycle} defaultValue={time('15:07:09')}>
          <TimeClock.ViewTrigger view={view} data-testid="trigger" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('trigger').textContent).toBe(twoDigits(value));
    });

    it('shows a placeholder while the clock has no value', async () => {
      await render(
        <TimeClock.Root>
          <TimeClock.ViewTrigger view="minute" data-testid="trigger" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('trigger').textContent).toBe('--');
    });

    it('shows the content of the consumer in place of the text', async () => {
      await render(
        <TimeClock.Root defaultValue={time('15:07')}>
          <TimeClock.ViewTrigger view="minute" data-testid="trigger">
            Minutes
          </TimeClock.ViewTrigger>
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('trigger').textContent).toBe('Minutes');
    });
  });

  describe('name', () => {
    it('names the unit and the number', async () => {
      await render(
        <TimeClock.Root locale="en-US" hourCycle={12} defaultValue={time('15:07')}>
          <TimeClock.ViewTrigger view="hour" />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('button', { name: `${unitName('hour')} 03` })).toBeInTheDocument();
    });

    it('names only the unit while the clock has no value', async () => {
      await render(
        <TimeClock.Root locale="en-US">
          <TimeClock.ViewTrigger view="minute" />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('button', { name: unitName('minute') })).toBeInTheDocument();
    });

    it.each([
      { name: 'content of the consumer', props: {}, content: 'Minutes', label: null },
      {
        name: 'an aria-label of the consumer',
        props: { 'aria-label': 'Set minutes' },
        content: undefined,
        label: 'Set minutes',
      },
    ])('keeps $name as the name', async ({ props, content, label }) => {
      await render(
        <TimeClock.Root defaultValue={time('15:07')}>
          <TimeClock.ViewTrigger view="minute" data-testid="trigger" {...props}>
            {content}
          </TimeClock.ViewTrigger>
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('trigger').getAttribute('aria-label')).toBe(label);
    });
  });

  describe('press', () => {
    it('shows the view of the trigger', async () => {
      const onViewChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root defaultValue={time('15:07')} onViewChange={onViewChange}>
          <TimeClock.ViewTrigger view="hour" data-testid="hour" />
          <TimeClock.ViewTrigger view="minute" data-testid="minute" />
        </TimeClock.Root>,
      );
      const hour = screen.getByTestId('hour');
      const minute = screen.getByTestId('minute');
      expect(hour).toHaveAttribute('aria-pressed', 'true');
      expect(hour).toHaveAttribute('data-active');
      expect(minute).toHaveAttribute('aria-pressed', 'false');
      expect(minute).not.toHaveAttribute('data-active');

      await user.click(minute);

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0]?.[0]).toBe('minute');
      expect(onViewChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'trigger-press' });
      expect(minute).toHaveAttribute('aria-pressed', 'true');
      expect(hour).toHaveAttribute('aria-pressed', 'false');
      expect(minute.parentElement).toHaveAttribute('data-view', 'minute');
    });

    it('stays on the view when the view is controlled', async () => {
      const onViewChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root view="hour" onViewChange={onViewChange}>
          <TimeClock.ViewTrigger view="minute" data-testid="minute" />
        </TimeClock.Root>,
      );

      await user.click(screen.getByTestId('minute'));

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(screen.getByTestId('minute')).toHaveAttribute('aria-pressed', 'false');
    });

    it('stays on the view when a listener cancels the change', async () => {
      const { user } = await render(
        <TimeClock.Root
          onViewChange={(_view: unknown, details: { cancel: () => void }) => {
            details.cancel();
          }}
        >
          <TimeClock.ViewTrigger view="minute" data-testid="minute" />
        </TimeClock.Root>,
      );

      await user.click(screen.getByTestId('minute'));

      expect(screen.getByTestId('minute')).toHaveAttribute('aria-pressed', 'false');
    });

    it('shows a view that is beyond the granularity', async () => {
      const { user } = await render(
        <TimeClock.Root granularity="hour">
          <TimeClock.ViewTrigger view="second" data-testid="second" />
        </TimeClock.Root>,
      );

      await user.click(screen.getByTestId('second'));

      expect(screen.getByTestId('second')).toHaveAttribute('aria-pressed', 'true');
    });

    it('works in a read only clock, because it changes no time', async () => {
      const { user } = await render(
        <TimeClock.Root readOnly>
          <TimeClock.ViewTrigger view="minute" data-testid="minute" />
        </TimeClock.Root>,
      );

      await user.click(screen.getByTestId('minute'));

      expect(screen.getByTestId('minute')).toHaveAttribute('aria-pressed', 'true');
    });

    it('is disabled in a disabled clock', async () => {
      const onViewChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root disabled onViewChange={onViewChange}>
          <TimeClock.ViewTrigger view="minute" data-testid="minute" />
        </TimeClock.Root>,
      );

      await user.click(screen.getByTestId('minute'));

      expect(screen.getByTestId('minute')).toBeDisabled();
      expect(onViewChange).not.toHaveBeenCalled();
    });
  });

  it('is never a submit button of a form', async () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const { user } = await render(
      <form onSubmit={onSubmit}>
        <TimeClock.Root>
          <TimeClock.ViewTrigger view="minute" data-testid="minute" type="submit" />
        </TimeClock.Root>
      </form>,
    );

    await user.click(screen.getByTestId('minute'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('minute')).toHaveAttribute('type', 'button');
  });
});
