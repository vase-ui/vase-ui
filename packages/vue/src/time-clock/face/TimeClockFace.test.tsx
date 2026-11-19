import { describe, expect, it, vi } from 'vitest';
import { h, nextTick, shallowRef } from 'vue';
import type { Component, CSSProperties } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { TimeClock } from '@vase-ui/vue/time-clock';
import type { TimeClockFaceNumber } from '@vase-ui/vue/time-clock';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
} from '#test-utils';
import { pointOnFace } from '../../../test/time-clockTestUtils';

const time = (text: string) => Temporal.PlainTime.from(text);
const faceStyle = { width: '200px', height: '200px' };

function unitText(unit: 'hour' | 'minute' | 'second', value: number) {
  return new Intl.NumberFormat('en-US', { style: 'unit', unit, unitDisplay: 'long' }).format(value);
}

function unitName(unit: 'hour' | 'minute' | 'second') {
  return new Intl.DisplayNames('en-US', { type: 'dateTimeField' }).of(unit);
}

const mouse = { button: 0, buttons: 1, pointerId: 1, pointerType: 'mouse' };

describe('<TimeClock.Face />', () => {
  const { render } = createRenderer();

  describeConformance(<TimeClock.Face />, () => ({
    render: (node) => render(<TimeClock.Root>{node}</TimeClock.Root>),
    refInstanceof: window.HTMLDivElement,
    childrenSelector: 'input[type="range"]',
  }));

  describe('range input', () => {
    it.each([
      {
        name: 'the hours of a 12-hour face',
        props: { hourCycle: 12 },
        unit: 'hour',
        min: 1,
        max: 12,
        step: 1,
        value: 3,
      },
      {
        name: 'the hours of a 24-hour face',
        props: { hourCycle: 24 },
        unit: 'hour',
        min: 0,
        max: 23,
        step: 1,
        value: 15,
      },
      {
        name: 'the minutes with a step',
        props: { defaultView: 'minute', minuteStep: 5 },
        unit: 'minute',
        min: 0,
        max: 59,
        step: 5,
        value: 30,
      },
      {
        name: 'the seconds',
        props: { defaultView: 'second' },
        unit: 'second',
        min: 0,
        max: 59,
        step: 1,
        value: 45,
      },
    ] as const)('is a slider for $name', async ({ props, unit, min, max, step, value }) => {
      await render(
        <TimeClock.Root locale="en-US" defaultValue={time('15:30:45')} {...props}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      const slider = screen.getByRole('slider', { name: unitName(unit) });
      expect(slider).toHaveAttribute('type', 'range');
      expect(slider).toHaveAttribute('min', String(min));
      expect(slider).toHaveAttribute('max', String(max));
      expect(slider).toHaveAttribute('step', String(step));
      expect(slider).toHaveValue(String(value));
      expect(slider).toHaveAttribute('aria-valuenow', String(value));
      expect(slider).toHaveAttribute('aria-valuetext', unitText(unit, value));
      expect(slider).toHaveAttribute('autocomplete', 'off');
      expect(slider).not.toHaveAttribute('aria-readonly');
    });

    it('shows the reference time while the clock has no value', async () => {
      await render(
        <TimeClock.Root locale="en-US" hourCycle={24} referenceDate={time('08:00')}>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).toHaveValue('8');
    });

    it('is disabled when the clock is disabled', async () => {
      await render(
        <TimeClock.Root disabled>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).toBeDisabled();
    });

    it('is read only when the clock is read only', async () => {
      await render(
        <TimeClock.Root readOnly>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute('aria-readonly', 'true');
    });

    it('gives the input the box of the face, so that the focus ring of a screen reader fits the face', async () => {
      await render(
        <TimeClock.Root>
          <TimeClock.Face data-testid="face" style={{ ...faceStyle, position: 'relative' }} />
        </TimeClock.Root>,
      );

      const face = screen.getByTestId('face').getBoundingClientRect();
      const input = screen.getByRole('slider').getBoundingClientRect();
      expect([input.left, input.top, input.width, input.height]).toEqual([
        face.left,
        face.top,
        face.width,
        face.height,
      ]);
    });

    it('takes the name of a consumer in place of the name of the view', async () => {
      await render(
        <TimeClock.Root locale="en-US">
          <TimeClock.Face aria-label="Meeting hour" data-testid="face" />
        </TimeClock.Root>,
      );

      const slider = screen.getByRole('slider', { name: 'Meeting hour' });
      expect(slider).toHaveAttribute('aria-label', 'Meeting hour');
      expect(screen.getByTestId('face')).not.toHaveAttribute('aria-label');
    });

    it('takes the label reference of a consumer in place of the name of the view', async () => {
      await render(
        <TimeClock.Root locale="en-US">
          <span id="clock-name">Start time</span>
          <TimeClock.Face aria-labelledby="clock-name" data-testid="face" />
        </TimeClock.Root>,
      );

      const slider = screen.getByRole('slider', { name: 'Start time' });
      expect(slider).toHaveAttribute('aria-labelledby', 'clock-name');
      expect(slider).not.toHaveAttribute('aria-label');
      expect(screen.getByTestId('face')).not.toHaveAttribute('aria-labelledby');
    });

    it('gives the description reference of a consumer to the input', async () => {
      await render(
        <TimeClock.Root>
          <span id="clock-help">Pick the hour</span>
          <TimeClock.Face aria-describedby="clock-help" data-testid="face" />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAccessibleDescription('Pick the hour');
      expect(screen.getByTestId('face')).not.toHaveAttribute('aria-describedby');
    });

    it('takes the value text of a consumer in place of the number with its unit', async () => {
      const getAriaValueText = vi.fn((value: number, view: string) => `${value} in ${view}`);
      await render(
        <TimeClock.Root locale="en-US" defaultValue={time('15:30')} defaultView="minute">
          <TimeClock.Face getAriaValueText={getAriaValueText} />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).toHaveAttribute('aria-valuetext', '30 in minute');
      expect(getAriaValueText).toHaveBeenLastCalledWith(30, 'minute');
    });

    it('does not give the input a name, so that a form does not send it', async () => {
      await render(
        <TimeClock.Root>
          <TimeClock.Face />
        </TimeClock.Root>,
      );

      expect(screen.getByRole('slider')).not.toHaveAttribute('name');
    });
  });

  describe('numbers', () => {
    it.each([
      { name: 'a 12-hour face', hourCycle: 12, count: 12 },
      { name: 'a 24-hour face', hourCycle: 24, count: 24 },
    ] as const)(
      'renders the numbers of $name through the number slot',
      async ({ hourCycle, count }) => {
        await render(
          <TimeClock.Root locale="en-US" hourCycle={hourCycle}>
            <TimeClock.Face
              v-slots={{
                number: ({ number, index }: { number: TimeClockFaceNumber; index: number }) => (
                  <TimeClock.Number number={number} data-testid="number" data-index={index} />
                ),
              }}
            />
          </TimeClock.Root>,
        );

        const numbers = screen.getAllByTestId('number');
        expect(numbers).toHaveLength(count);
        expect(numbers.map((number) => number.getAttribute('data-index'))).toEqual(
          Array.from({ length: count }, (_, index) => String(index)),
        );
      },
    );

    it('renders no numbers without a number slot', async () => {
      await render(
        <TimeClock.Root>
          <TimeClock.Face data-testid="face" />
        </TimeClock.Root>,
      );

      expect(screen.getByTestId('face').children).toHaveLength(1);
    });

    it('mounts the input and the numbers that the consumer gives inside the element of the render slot', async () => {
      await render(
        <TimeClock.Root locale="en-US" hourCycle={12}>
          <TimeClock.Face
            v-slots={{
              render: ({ props, children }: { props: HTMLProps; children: Component }) => (
                <article {...props} data-testid="custom">
                  {h(children, null, {
                    number: ({ number }: { number: TimeClockFaceNumber }) => (
                      <TimeClock.Number number={number} data-testid="number" />
                    ),
                  })}
                </article>
              ),
            }}
          />
        </TimeClock.Root>,
      );

      const custom = screen.getByTestId('custom');
      expect(custom.tagName).toBe('ARTICLE');
      expect(custom.querySelectorAll('[data-testid="number"]')).toHaveLength(12);
      expect(custom.querySelector('input[type="range"]')).toBe(screen.getByRole('slider'));
    });
  });

  describe('press and drag', () => {
    function renderClock(extra: Record<string, unknown> = {}) {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const onViewChange = vi.fn();
      const result = render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={time('10:30')}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          onViewChange={onViewChange}
          {...extra}
        >
          <TimeClock.Face data-testid="face" style={faceStyle} />
        </TimeClock.Root>,
      );
      return { onValueChange, onValueCommitted, onViewChange, result };
    }

    function lastValue(spy: ReturnType<typeof vi.fn>) {
      return String(spy.mock.calls.at(-1)?.[0]);
    }

    it.each([{ pointerType: 'mouse' }, { pointerType: 'touch' }, { pointerType: 'pen' }])(
      'selects the hour of a press with a $pointerType',
      async ({ pointerType }) => {
        const { onValueChange, onValueCommitted, result } = renderClock();
        await result;
        const face = screen.getByTestId('face');

        await fireEvent.pointerDown(face, { ...mouse, pointerType, ...pointOnFace(face, 90) });

        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(lastValue(onValueChange)).toBe('03:30:00');
        expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'drag' });
        expect(onValueCommitted).not.toHaveBeenCalled();

        await fireEvent.pointerUp(face, { ...mouse, pointerType, ...pointOnFace(face, 90) });

        expect(onValueCommitted).toHaveBeenCalledTimes(1);
        expect(lastValue(onValueCommitted)).toBe('03:30:00');
        expect(onValueCommitted.mock.calls[0]?.[1]).toMatchObject({ reason: 'drag' });
      },
    );

    it('follows a drag and gives one change for each number', async () => {
      const { onValueChange, onValueCommitted, result } = renderClock();
      await result;
      const face = screen.getByTestId('face');
      const root = face.parentElement;

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 0) });
      expect(root).toHaveAttribute('data-dragging');
      expect(face).toHaveAttribute('data-dragging');
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 5) });
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 92) });
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 88) });
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 180) });

      expect(onValueChange.mock.calls.map(([value]) => String(value))).toEqual([
        '00:30:00',
        '03:30:00',
        '06:30:00',
      ]);
      expect(onValueCommitted).not.toHaveBeenCalled();

      await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, 180) });

      expect(root).not.toHaveAttribute('data-dragging');
      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(lastValue(onValueCommitted)).toBe('06:30:00');
    });

    it('gives the first value of a clock that has no value, with the kind of its reference', async () => {
      const { onValueChange, result } = renderClock({
        defaultValue: null,
        referenceDate: Temporal.PlainDateTime.from('2026-11-14T00:00'),
      });
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, 90) });

      expect(lastValue(onValueChange)).toBe('2026-11-14T03:00:00');
      expect(face.parentElement).not.toHaveAttribute('data-empty');
    });

    it('puts the focus on the range input at a press', async () => {
      const { result } = renderClock();
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });

      expect(screen.getByRole('slider')).toHaveFocus();
    });

    it('stops the browser from selecting text at a press', async () => {
      const { result } = renderClock();
      await result;
      const face = screen.getByTestId('face');

      const notPrevented = await fireEvent.pointerDown(face, {
        ...mouse,
        ...pointOnFace(face, 90),
      });

      expect(notPrevented).toBe(false);
      expect(face.style.touchAction).toBe('none');
    });

    it('holds the pointer for the press, and lets it go at the release', async () => {
      const { result } = renderClock();
      await result;
      const face = screen.getByTestId('face');
      const setPointerCapture = vi.spyOn(face, 'setPointerCapture').mockImplementation(() => {});
      const releasePointerCapture = vi
        .spyOn(face, 'releasePointerCapture')
        .mockImplementation(() => {});
      vi.spyOn(face, 'hasPointerCapture').mockReturnValue(true);

      await fireEvent.pointerDown(face, { ...mouse, pointerId: 7, ...pointOnFace(face, 90) });
      expect(setPointerCapture).toHaveBeenCalledWith(7);

      await fireEvent.pointerUp(face, { ...mouse, pointerId: 7, ...pointOnFace(face, 90) });
      expect(releasePointerCapture).toHaveBeenCalledWith(7);
    });

    it('ignores another pointer while a press holds the capture', async () => {
      const { onValueChange, onValueCommitted, result } = renderClock();
      await result;
      const face = screen.getByTestId('face');
      vi.spyOn(face, 'setPointerCapture').mockImplementation(() => {});
      vi.spyOn(face, 'releasePointerCapture').mockImplementation(() => {});
      const hasPointerCapture = vi.spyOn(face, 'hasPointerCapture').mockReturnValue(true);
      const other = { ...mouse, pointerId: 2, pointerType: 'touch' };

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      await fireEvent.pointerDown(face, { ...other, ...pointOnFace(face, 180) });
      await fireEvent.pointerMove(face, { ...other, ...pointOnFace(face, 270) });
      await fireEvent.pointerUp(face, { ...other, ...pointOnFace(face, 270) });

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueCommitted).not.toHaveBeenCalled();

      // When the browser lost the capture, the release of the first pointer went missing.
      hasPointerCapture.mockReturnValue(false);
      await fireEvent.pointerDown(face, { ...other, ...pointOnFace(face, 180) });

      expect(lastValue(onValueChange)).toBe('06:30:00');
    });

    it('ends a press that the system cancels, with no commit', async () => {
      const { onValueCommitted, onViewChange, result } = renderClock();
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      await fireEvent.pointerCancel(face, { ...mouse, ...pointOnFace(face, 90) });

      expect(face).not.toHaveAttribute('data-dragging');
      expect(onValueCommitted).not.toHaveBeenCalled();
      expect(onViewChange).not.toHaveBeenCalled();
    });

    it('ends the press when the face goes away and the root stays', async () => {
      const showFace = shallowRef(true);
      await render(() => (
        <TimeClock.Root locale="en-US" data-testid="root">
          {showFace.value ? <TimeClock.Face data-testid="face" style={faceStyle} /> : null}
        </TimeClock.Root>
      ));
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      expect(screen.getByTestId('root')).toHaveAttribute('data-dragging');

      showFace.value = false;
      await nextTick();

      expect(screen.getByTestId('root')).not.toHaveAttribute('data-dragging');
    });

    it.each([
      { name: 'a button other than the first', extra: {}, init: { button: 2 } },
      { name: 'a disabled clock', extra: { disabled: true }, init: {} },
      { name: 'a read only clock', extra: { readOnly: true }, init: {} },
    ])('ignores a press of $name', async ({ extra, init }) => {
      const { onValueChange, onValueCommitted, result } = renderClock(extra);
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...init, ...pointOnFace(face, 90) });
      await fireEvent.pointerUp(face, { ...mouse, ...init, ...pointOnFace(face, 90) });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
      expect(face).not.toHaveAttribute('data-dragging');
    });

    it('selects an hour of the inner ring of a 24-hour face', async () => {
      const { onValueChange, result } = renderClock({ hourCycle: 24 });
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90, 0.5) });
      expect(lastValue(onValueChange)).toBe('15:30:00');
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 90, 0.9) });
      expect(lastValue(onValueChange)).toBe('03:30:00');
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 0, 0.5) });
      expect(lastValue(onValueChange)).toBe('00:30:00');
    });

    it('selects the ring of a press from the places of the numbers', async () => {
      const onValueChange = vi.fn();
      // The style puts the outer ring at 0.75 of the radius of the face, and the inner ring at 0.48.
      const numberStyle: CSSProperties = {
        position: 'absolute',
        left: '90px',
        top: '90px',
        width: '20px',
        height: '20px',
        transform:
          'rotate(var(--time-clock-number-angle)) translateY(calc(var(--time-clock-number-radius) * -75px)) rotate(calc(var(--time-clock-number-angle) * -1))',
      };
      await render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={24}
          defaultValue={time('10:30')}
          onValueChange={onValueChange}
        >
          <TimeClock.Face
            data-testid="face"
            style={{ ...faceStyle, position: 'relative' }}
            v-slots={{
              number: ({ number }: { number: TimeClockFaceNumber }) => (
                <TimeClock.Number number={number} style={numberStyle} />
              ),
            }}
          />
        </TimeClock.Root>,
      );
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90, 0.75) });
      expect(lastValue(onValueChange)).toBe('03:30:00');
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 90, 0.48) });
      expect(lastValue(onValueChange)).toBe('15:30:00');
    });

    it('selects the minute that is nearest to a press, in the step of the view', async () => {
      const { onValueChange, result } = renderClock({ defaultView: 'minute', minuteStep: 5 });
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 37, 0.2) });

      expect(lastValue(onValueChange)).toBe('10:05:00');
    });

    it('goes on to the next view when the press ends', async () => {
      const { onViewChange, result } = renderClock();
      await result;
      const face = screen.getByTestId('face');

      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, 90) });

      expect(onViewChange).toHaveBeenCalledTimes(1);
      expect(onViewChange.mock.calls[0]?.[0]).toBe('minute');
      expect(onViewChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'drag' });
      expect(face.parentElement).toHaveAttribute('data-view', 'minute');
      expect(screen.getByRole('slider')).toHaveAttribute('max', '59');
    });

    it('does not select a disabled number, and puts a time into the range', async () => {
      const { onValueChange, result } = renderClock({
        minTime: time('09:30'),
        defaultValue: time('10:15'),
      });
      await result;
      const face = screen.getByTestId('face');

      // 3 o'clock is before the least time.
      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      expect(onValueChange).not.toHaveBeenCalled();

      // 9 o'clock holds a time of the range, but 09:15 is before it.
      await fireEvent.pointerMove(face, { ...mouse, ...pointOnFace(face, 270) });
      expect(lastValue(onValueChange)).toBe('09:30:00');
    });

    it('commits nothing at the release of a press on a disabled number', async () => {
      const { onValueChange, onValueCommitted, onViewChange, result } = renderClock({
        minTime: time('09:30'),
      });
      await result;
      const face = screen.getByTestId('face');

      // 3 o'clock is before the least time.
      await fireEvent.pointerDown(face, { ...mouse, ...pointOnFace(face, 90) });
      await fireEvent.pointerUp(face, { ...mouse, ...pointOnFace(face, 90) });

      expect(onValueChange).not.toHaveBeenCalled();
      expect(onValueCommitted).not.toHaveBeenCalled();
      expect(onViewChange).not.toHaveBeenCalled();
    });
  });

  describe('keyboard', () => {
    async function renderFocused(
      extra: Record<string, unknown> = {},
      faceProps: Record<string, unknown> = {},
    ) {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      const { user } = await render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={time('11:00')}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
          {...extra}
        >
          <TimeClock.Face {...faceProps} />
        </TimeClock.Root>,
      );
      await user.tab();
      return { user, onValueChange, onValueCommitted, slider: screen.getByRole('slider') };
    }

    it.each([
      { name: 'ArrowRight adds one hour and wraps', keys: '{ArrowRight}', value: '12' },
      { name: 'ArrowUp adds one hour', keys: '{ArrowUp}{ArrowUp}', value: '1' },
      { name: 'ArrowLeft takes one hour', keys: '{ArrowLeft}', value: '10' },
      { name: 'ArrowDown takes one hour', keys: '{ArrowDown}{ArrowDown}', value: '9' },
      { name: 'PageUp adds two hours', keys: '{PageUp}', value: '1' },
      { name: 'PageDown takes two hours', keys: '{PageDown}', value: '9' },
      { name: 'Home goes to the least hour', keys: '{Home}', value: '1' },
      { name: 'End goes to the greatest hour', keys: '{End}', value: '12' },
    ])('$name', async ({ keys, value }) => {
      const { user, slider, onValueChange } = await renderFocused();

      await user.keyboard(keys);

      expect(slider).toHaveValue(value);
      expect(slider).toHaveAttribute('aria-valuetext', unitText('hour', Number(value)));
      expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'keyboard' });
    });

    it.each([
      { name: 'ArrowRight at the last minute', from: '10:55', keys: '{ArrowRight}', value: '0' },
      { name: 'ArrowLeft at the first minute', from: '10:00', keys: '{ArrowLeft}', value: '55' },
      { name: 'ArrowRight between two steps', from: '10:07', keys: '{ArrowRight}', value: '10' },
      { name: 'PageUp', from: '10:30', keys: '{PageUp}', value: '45' },
    ])('goes by the step of the minutes with $name', async ({ from, keys, value }) => {
      const { user, slider } = await renderFocused({
        defaultView: 'minute',
        defaultValue: time(from),
        minuteStep: 5,
      });

      await user.keyboard(keys);

      expect(slider).toHaveValue(value);
    });

    it('goes to the least and the greatest hour of a 24-hour face', async () => {
      const { user, slider } = await renderFocused({ hourCycle: 24 });

      await user.keyboard('{Home}');
      expect(slider).toHaveValue('0');
      await user.keyboard('{End}');
      expect(slider).toHaveValue('23');
    });

    it('keeps the direction of the arrow keys in a right-to-left page', async () => {
      const { user } = await render(
        <DirectionProvider direction="rtl">
          <div dir="rtl">
            <TimeClock.Root locale="en-US" hourCycle={12} defaultValue={time('11:00')}>
              <TimeClock.Face />
            </TimeClock.Root>
          </div>
        </DirectionProvider>,
      );
      const slider = screen.getByRole('slider');
      await user.tab();

      await user.keyboard('{ArrowRight}');
      expect(slider).toHaveValue('12');
      await user.keyboard('{ArrowLeft}{ArrowLeft}');
      expect(slider).toHaveValue('10');
    });

    it('skips the numbers that are disabled', async () => {
      const { user, slider } = await renderFocused({
        disabledTimes: (t: Temporal.PlainTime) => t.hour < 2,
      });

      await user.keyboard('{ArrowRight}');

      // 12 and 1 are the hours 0 and 1 before noon.
      expect(slider).toHaveValue('2');
    });

    it('commits at Enter and at Space, and shows the next view', async () => {
      const { user, slider, onValueCommitted } = await renderFocused();

      await user.keyboard('{Enter}');
      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(String(onValueCommitted.mock.calls[0]?.[0])).toBe('11:00:00');
      expect(onValueCommitted.mock.calls[0]?.[1]).toMatchObject({ reason: 'keyboard' });
      expect(slider.closest('[role="group"]')).toHaveAttribute('data-view', 'minute');

      await user.keyboard(' ');
      expect(onValueCommitted).toHaveBeenCalledTimes(2);
    });

    it('commits the time that the face shows when the clock has no value', async () => {
      const { user, onValueChange, onValueCommitted } = await renderFocused({
        defaultValue: null,
        referenceDate: time('04:00'),
      });

      await user.keyboard('{Enter}');

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe('04:00:00');
      expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'keyboard' });
      expect(String(onValueCommitted.mock.calls[0]?.[0])).toBe('04:00:00');
    });

    it.each([{ modifier: 'altKey' }, { modifier: 'ctrlKey' }, { modifier: 'metaKey' }])(
      'leaves a key with $modifier to the browser',
      async ({ modifier }) => {
        const { slider, onValueChange } = await renderFocused();

        // `user.keyboard` moves the caret for an arrow key that no listener prevents, and a range
        // input has no caret.
        const notPrevented = await fireEvent.keyDown(slider, {
          key: 'ArrowRight',
          [modifier]: true,
        });

        expect(notPrevented).toBe(true);
        expect(onValueChange).not.toHaveBeenCalled();
      },
    );

    it('ignores a key that a listener of the consumer stops', async () => {
      const { user, slider } = await renderFocused(
        {},
        {
          onKeydown: (event: { preventVaseUIHandler: () => void }) => {
            event.preventVaseUIHandler();
          },
        },
      );

      await user.keyboard('{ArrowRight}');

      expect(slider).toHaveValue('11');
    });

    it('leaves the keys of another control in the face alone', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root locale="en-US" defaultValue={time('11:00')} onValueChange={onValueChange}>
          <TimeClock.Face>
            <button data-testid="other">Other</button>
          </TimeClock.Face>
        </TimeClock.Root>,
      );

      screen.getByTestId('other').focus();
      await user.keyboard('{ArrowRight}');

      expect(onValueChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'a disabled clock', extra: { disabled: true } },
      { name: 'a read only clock', extra: { readOnly: true } },
    ])('does not change the time of $name', async ({ extra }) => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TimeClock.Root
          locale="en-US"
          defaultValue={time('11:00')}
          onValueChange={onValueChange}
          {...extra}
        >
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      screen.getByRole('slider').focus();

      await user.keyboard('{ArrowRight}{Home}{Enter}');

      expect(onValueChange).not.toHaveBeenCalled();
      expect(screen.getByRole('slider')).toHaveValue('11');
    });
  });

  describe('input event', () => {
    async function renderClock(extra: Record<string, unknown> = {}) {
      const onValueChange = vi.fn();
      await render(
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          defaultValue={time('11:00')}
          onValueChange={onValueChange}
          {...extra}
        >
          <TimeClock.Face />
        </TimeClock.Root>,
      );
      return { onValueChange, slider: screen.getByRole<HTMLInputElement>('slider') };
    }

    it('selects the value that assistive technology sets on the range input', async () => {
      const { onValueChange, slider } = await renderClock();

      slider.value = '4';
      await fireEvent.input(slider);

      expect(String(onValueChange.mock.calls[0]?.[0])).toBe('04:00:00');
      expect(onValueChange.mock.calls[0]?.[1]).toMatchObject({ reason: 'input-change' });
      expect(slider).toHaveValue('4');
    });

    it('renders the replacement face when the parent changes the view during an input event', async () => {
      const minute = shallowRef(false);
      await render(() => (
        <TimeClock.Root
          locale="en-US"
          hourCycle={12}
          modelValue={time('11:30')}
          view={minute.value ? 'minute' : 'hour'}
          onValueChange={() => (minute.value = true)}
        >
          <TimeClock.Face key={minute.value ? 'minute' : 'hour'} />
        </TimeClock.Root>
      ));
      const hour = screen.getByRole<HTMLInputElement>('slider');
      hour.value = '4';
      await fireEvent.input(hour);

      const replacement = screen.getByRole<HTMLInputElement>('slider');
      expect(replacement).not.toBe(hour);
      expect(replacement).toHaveValue('30');
      expect(replacement).toHaveAttribute('aria-valuenow', '30');
      expect(hour).toHaveValue('4');
    });

    it.each([
      {
        name: 'a change that a listener cancels',
        extra: {
          onValueChange: (_value: unknown, details: { cancel: () => void }) => {
            details.cancel();
          },
        },
      },
      { name: 'a read only clock', extra: { readOnly: true } },
      { name: 'a controlled clock that keeps its time', extra: { modelValue: time('11:00') } },
    ])('puts the old value back on the range input after $name', async ({ extra }) => {
      const { slider } = await renderClock(extra);

      slider.value = '4';
      await fireEvent.input(slider);
      await flushMicrotasks();

      expect(slider).toHaveValue('11');
    });
  });
});
