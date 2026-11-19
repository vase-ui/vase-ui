import { describe, expect, it, vi } from 'vitest';
import { h, KeepAlive, shallowRef } from 'vue';
import type { Component } from 'vue';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import TimePickerAnatomy from '../../time-picker/root/TimePickerAnatomy.test.vue';
import TimeClockFaceReplace from './TimeClockFaceReplace.test.vue';

const time = (text: string) => Temporal.PlainTime.from(text);

// The day period of 9:00 or 21:00 in the 12-hour format of a locale.
function dayPeriodText(locale: string, hour: 9 | 21) {
  return new Intl.DateTimeFormat(locale, { hour: 'numeric', hour12: true, timeZone: 'UTC' })
    .formatToParts(Date.UTC(1970, 0, 1, hour))
    .find((part) => part.type === 'dayPeriod')?.value;
}

describe('<TimeClock.DayPeriod />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.DayPeriod value="am" />, () => ({
    render: (node) => render(<TimeClock.Root hourCycle={12}>{node}</TimeClock.Root>),
    refInstanceof: window.HTMLButtonElement,
    button: true,
    testRenderPropWith: 'button',
  }));

  it.each([
    { name: 'English', locale: 'en-US' },
    { name: 'Japanese', locale: 'ja-JP' },
    { name: 'Arabic', locale: 'ar-EG' },
  ])('shows the day periods of $name', async ({ locale }) => {
    await render(
      <TimeClock.Root locale={locale} hourCycle={12}>
        <TimeClock.DayPeriod value="am" data-testid="am" />
        <TimeClock.DayPeriod value="pm" data-testid="pm" />
      </TimeClock.Root>,
    );

    expect(screen.getByTestId('am').textContent).toBe(dayPeriodText(locale, 9));
    expect(screen.getByTestId('pm').textContent).toBe(dayPeriodText(locale, 21));
  });

  it('is pressed for the day period of the time', async () => {
    const { setProps } = await render(
      <TimeClock.Root hourCycle={12} modelValue={time('10:30')}>
        <TimeClock.DayPeriod value="am" data-testid="am" />
        <TimeClock.DayPeriod value="pm" data-testid="pm" />
      </TimeClock.Root>,
    );

    expect(screen.getByTestId('am')).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('am')).toHaveAttribute('data-selected');
    expect(screen.getByTestId('pm')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('pm')).not.toHaveAttribute('data-selected');

    await setProps({ modelValue: time('12:00') });

    expect(screen.getByTestId('am')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('pm')).toHaveAttribute('aria-pressed', 'true');
  });

  it('is not pressed while the clock has no value', async () => {
    await render(
      <TimeClock.Root hourCycle={12}>
        <TimeClock.DayPeriod value="am" data-testid="am" />
        <TimeClock.DayPeriod value="pm" data-testid="pm" />
      </TimeClock.Root>,
    );

    expect(screen.getByTestId('am')).toHaveAttribute('aria-pressed', 'false');
    expect(screen.getByTestId('pm')).toHaveAttribute('aria-pressed', 'false');
  });

  describe('press', () => {
    function renderClock(extra: Record<string, unknown> = {}) {
      const onValueChange = vi.fn();
      const result = render(
        <TimeClock.Root
          hourCycle={12}
          defaultValue={time('10:30')}
          onValueChange={onValueChange}
          {...extra}
        >
          <TimeClock.DayPeriod value="am" data-testid="am" />
          <TimeClock.DayPeriod value="pm" data-testid="pm" />
        </TimeClock.Root>,
      );
      return { onValueChange, result };
    }

    it('moves the time to the other half of the day and keeps the rest', async () => {
      const { onValueChange, result } = renderClock({ defaultValue: time('10:30:15') });
      const { user } = await result;

      await user.click(screen.getByTestId('pm'));

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe('22:30:15');
      expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'item-press' });
      expect(screen.getByTestId('pm')).toHaveAttribute('aria-pressed', 'true');

      await user.click(screen.getByTestId('am'));
      expect(String(onValueChange.mock.calls[1]?.[0])).toBe('10:30:15');
    });

    it.each([
      { name: 'the noon hour', at: '12:10', press: 'am', result: '00:10:00' },
      { name: 'the midnight hour', at: '00:10', press: 'pm', result: '12:10:00' },
    ])('moves $name', async ({ at, press, result }) => {
      const { onValueChange, result: rendered } = renderClock({ defaultValue: time(at) });
      const { user } = await rendered;

      await user.click(screen.getByTestId(press));

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe(result);
    });

    it('goes to the limits from a time that is out of them', async () => {
      const { onValueChange, result } = renderClock({
        defaultValue: time('10:00'),
        minTime: time('13:00'),
        maxTime: time('17:00'),
      });
      const { user } = await result;

      await user.click(screen.getByTestId('pm'));

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe('17:00:00');
    });

    it('gives no change for the day period that the time is in', async () => {
      const { onValueChange, result } = renderClock();
      const { user } = await result;

      await user.click(screen.getByTestId('am'));

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('gives the first value of a clock that has no value', async () => {
      const { onValueChange, result } = renderClock({
        defaultValue: null,
        referenceDate: Temporal.PlainDateTime.from('2026-11-14T00:00'),
      });
      const { user } = await result;

      await user.click(screen.getByTestId('am'));

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe('2026-11-14T00:00:00');
    });

    it('stops at a change that a listener cancels', async () => {
      const { result } = renderClock({
        onValueChange: (_value: unknown, details: { cancel: () => void }) => {
          details.cancel();
        },
      });
      const { user } = await result;

      await user.click(screen.getByTestId('pm'));

      expect(screen.getByTestId('am')).toHaveAttribute('aria-pressed', 'true');
    });

    it.each([
      { name: 'a read only clock', extra: { readOnly: true } },
      { name: 'a day period before the least time', extra: { minTime: time('13:00') } },
    ])('is ignored for $name', async ({ extra }) => {
      const { onValueChange, result } = renderClock({ defaultValue: time('14:00'), ...extra });
      const { user } = await result;

      await user.click(screen.getByTestId('am'));

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('disabled', () => {
    it.each([
      { name: 'a disabled clock', extra: { disabled: true }, am: true, pm: true },
      {
        name: 'a day period before the least time',
        extra: { minTime: time('13:00') },
        am: true,
        pm: false,
      },
      {
        name: 'a day period after the greatest time',
        extra: { maxTime: time('11:00') },
        am: false,
        pm: true,
      },
      {
        name: 'a day period that disabledTimes names',
        extra: { disabledTimes: (t: Temporal.PlainTime) => t.hour >= 12 },
        am: false,
        pm: true,
      },
      {
        name: 'one disabled hour of a day period',
        extra: { disabledTimes: (t: Temporal.PlainTime) => t.hour === 22 },
        am: false,
        pm: false,
      },
      {
        name: 'a time that is out of the limits',
        extra: { minTime: time('13:00'), maxTime: time('17:00') },
        am: true,
        pm: false,
      },
    ])('is disabled for $name', async ({ extra, am, pm }) => {
      await render(
        <TimeClock.Root hourCycle={12} defaultValue={time('10:30')} {...extra}>
          <TimeClock.DayPeriod value="am" data-testid="am" />
          <TimeClock.DayPeriod value="pm" data-testid="pm" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('am').hasAttribute('data-disabled')).toBe(am);
      expect(screen.getByTestId('am').hasAttribute('disabled')).toBe(am);
      expect(screen.getByTestId('pm').hasAttribute('data-disabled')).toBe(pm);
    });
  });

  describe('hour cycle', () => {
    it.each([
      { name: 'the prop of a 24-hour clock', props: { hourCycle: 24 } },
      { name: 'a locale that has a 24-hour clock', props: { locale: 'de-DE' } },
    ] as const)('renders nothing for $name', async ({ props }) => {
      await render(
        <TimeClock.Root {...props}>
          <TimeClock.DayPeriod value="am" data-testid="am" />
          <TimeClock.DayPeriod
            value="pm"
            v-slots={{
              render: ({ props: slotProps }: { props: object }) => (
                <i {...slotProps} data-testid="pm" />
              ),
            }}
          />
        </TimeClock.Root>,
      );

      expect(screen.queryByTestId('am')).toBeNull();
      expect(screen.queryByTestId('pm')).toBeNull();
    });

    it('renders for a locale that has a 12-hour clock', async () => {
      await render(
        <TimeClock.Root locale="en-US">
          <TimeClock.DayPeriod value="am" data-testid="am" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('am')).toBeInTheDocument();
    });

    describe('focus', () => {
      function renderClock() {
        return render(
          <TimeClock.Root hourCycle={12}>
            <TimeClock.ViewTrigger view="hour" data-testid="hour" />
            <TimeClock.DayPeriod value="pm" data-testid="pm" />
            <TimeClock.Face />
          </TimeClock.Root>,
        );
      }

      it('gives its focus to the face when the hour cycle becomes 24', async () => {
        const { setProps } = await renderClock();
        const pm = screen.getByTestId('pm');
        pm.focus();
        expect(pm).toHaveFocus();

        await setProps({ hourCycle: 24 });

        expect(screen.queryByTestId('pm')).toBeNull();
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      it('keeps the focus of another element when the hour cycle becomes 24', async () => {
        const { setProps } = await renderClock();
        const hour = screen.getByTestId('hour');
        hour.focus();
        expect(hour).toHaveFocus();

        await setProps({ hourCycle: 24 });

        expect(screen.queryByTestId('pm')).toBeNull();
        expect(hour).toHaveFocus();
      });

      // The popup takes a focus that moves to `<body>`, so the face must take the focus before the
      // removal.
      it('gives its focus to the face in the popup of a time picker', async () => {
        const { setProps } = await render(
          <TimePickerAnatomy
            {...{ locale: 'en-US', hourCycle: 12, defaultOpen: true, clock: true }}
          />,
        );
        await screen.findByTestId('face');
        // The popup gives the first focus one frame after it opens.
        await waitFor(() => {
          expect(screen.getByRole('slider')).toHaveFocus();
        });
        const pm = screen.getByTestId('pm');
        pm.focus();
        expect(pm).toHaveFocus();

        await setProps({ hourCycle: 24 });

        expect(screen.queryByTestId('pm')).toBeNull();
        expect(screen.getByRole('slider')).toHaveFocus();
      });

      it('focuses the visible face when another face mounts inside a held branch', async () => {
        const cycle = shallowRef<12 | 24>(12);
        const { HeldBranch, mountWhileHeld, show, hide } = createHeldBranch(() => (
          <TimeClock.Face ariaLabel="second" />
        ));
        await render(() => (
          <TimeClock.Root hourCycle={cycle.value}>
            <TimeClock.Face ariaLabel="first" />
            <HeldBranch />
            <TimeClock.DayPeriod value="pm" />
          </TimeClock.Root>
        ));

        await mountWhileHeld();
        screen.getByRole('button').focus();
        cycle.value = 24;
        await flushMicrotasks();
        expect(screen.getByRole('slider', { name: 'first' })).toHaveFocus();

        cycle.value = 12;
        await show();
        screen.getByRole('button').focus();
        cycle.value = 24;
        await flushMicrotasks();
        expect(screen.getByRole('slider', { name: 'second' })).toHaveFocus();

        cycle.value = 12;
        await hide();
        screen.getByRole('button').focus();
        cycle.value = 24;
        await flushMicrotasks();
        expect(screen.getByRole('slider', { name: 'first' })).toHaveFocus();
      });

      it('focuses the remaining input when a render slot holds its children', async () => {
        const visible = shallowRef(true);
        const cycle = shallowRef<12 | 24>(12);
        await render(() => (
          <TimeClock.Root hourCycle={cycle.value}>
            <TimeClock.Face ariaLabel="first" />
            <TimeClock.Face
              ariaLabel="second"
              v-slots={{
                render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                  <div {...props}>
                    <KeepAlive>{visible.value ? h(children) : null}</KeepAlive>
                  </div>
                ),
              }}
            />
            <TimeClock.DayPeriod value="pm" />
          </TimeClock.Root>
        ));

        visible.value = false;
        await flushMicrotasks();
        screen.getByRole('button').focus();
        cycle.value = 24;
        await flushMicrotasks();
        expect(screen.getByRole('slider', { name: 'first' })).toHaveFocus();
      });

      it('gives its focus to a face that mounts before the old face unmounts', async () => {
        const swapped = shallowRef(false);
        const hourCycle = shallowRef<12 | 24>(12);
        await render(() => (
          <TimeClock.Root hourCycle={hourCycle.value}>
            <TimeClock.DayPeriod value="pm" data-testid="pm" />
            <TimeClockFaceReplace swapped={swapped.value} />
          </TimeClock.Root>
        ));
        swapped.value = true;
        await flushMicrotasks();
        const pm = screen.getByTestId('pm');
        pm.focus();
        expect(pm).toHaveFocus();

        hourCycle.value = 24;
        await flushMicrotasks();

        expect(screen.queryByTestId('pm')).toBeNull();
        expect(screen.getByRole('slider')).toHaveFocus();
      });
    });
  });

  it('is never a submit button of a form', async () => {
    const onSubmit = vi.fn((event: Event) => {
      event.preventDefault();
    });
    const { user } = await render(
      <form onSubmit={onSubmit}>
        <TimeClock.Root hourCycle={12}>
          <TimeClock.DayPeriod value="am" data-testid="am" type="submit" />
        </TimeClock.Root>
      </form>,
    );

    await user.click(screen.getByTestId('am'));

    expect(onSubmit).not.toHaveBeenCalled();
    expect(screen.getByTestId('am')).toHaveAttribute('type', 'button');
  });
});
