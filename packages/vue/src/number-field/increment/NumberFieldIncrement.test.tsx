import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { NumberField } from '@vase-ui/vue/number-field';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

// Mirrors the touch settle delay in `usePressAndHold`.
const TOUCH_TIMEOUT = 50;

async function tick(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await flushMicrotasks();
}

describe('<NumberField.Increment />', () => {
  const { render } = createRenderer();

  describeConformance(<NumberField.Increment />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(<NumberField.Root>{node}</NumberField.Root>);
    },
  }));

  describe('press and hold', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function TestNumberField() {
      return (
        <NumberField.Root defaultValue={0}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>
      );
    }

    it('stops the hold on release when an ancestor stops pointerup propagation', async () => {
      await render(
        <div onPointerup={(event: PointerEvent) => event.stopPropagation()}>
          <NumberField.Root defaultValue={0}>
            <NumberField.Increment />
            <NumberField.Input />
          </NumberField.Root>
        </div>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      await fireEvent.pointerDown(button, { pointerType: 'mouse' });

      expect(input).toHaveValue('1');

      await fireEvent.pointerUp(button, { pointerType: 'mouse' });
      await fireEvent.mouseUp(button);

      await tick(START_AUTO_CHANGE_DELAY);
      await tick(CHANGE_VALUE_TICK_DELAY);
      await tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('1');
    });

    it('starts the hold once a touch press settles and ignores the compatibility click', async () => {
      await render(<TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      await fireEvent.touchStart(increment);
      await fireEvent.pointerDown(increment, { pointerType: 'touch' });

      expect(input).toHaveValue('0');

      await tick(TOUCH_TIMEOUT);

      expect(input).toHaveValue('1');

      await tick(START_AUTO_CHANGE_DELAY);
      await tick(CHANGE_VALUE_TICK_DELAY);
      await tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('3');

      await fireEvent.pointerUp(increment, { pointerType: 'touch' });
      await fireEvent.touchEnd(increment);
      await fireEvent.click(increment, { detail: 1 });

      await tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('3');
    });

    it('does not start the hold when the touch moves like a scroll', async () => {
      await render(<TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      await fireEvent.touchStart(increment);
      await fireEvent.pointerDown(increment, { pointerType: 'touch', clientX: 0, clientY: 0 });
      await fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 0, clientY: 20 });

      await tick(TOUCH_TIMEOUT);
      await tick(START_AUTO_CHANGE_DELAY);
      await tick(CHANGE_VALUE_TICK_DELAY);

      expect(input).toHaveValue('0');
    });

    it('treats a touch press with several small moves as a tap', async () => {
      await render(<TestNumberField />);

      const input = screen.getByRole('textbox');
      const increment = screen.getByRole('button', { name: 'Increase' });

      await fireEvent.touchStart(increment);
      await fireEvent.pointerDown(increment, { pointerType: 'touch', clientX: 0, clientY: 0 });
      await fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 1, clientY: 0 });
      await fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 2, clientY: 0 });
      await fireEvent.pointerMove(increment, { pointerType: 'touch', clientX: 3, clientY: 0 });

      await tick(TOUCH_TIMEOUT);
      await tick(START_AUTO_CHANGE_DELAY);

      expect(input).toHaveValue('0');

      await fireEvent.pointerUp(increment, { pointerType: 'touch' });
      await fireEvent.touchEnd(increment);
      await fireEvent.click(increment, { detail: 1 });

      expect(input).toHaveValue('1');
    });
  });

  describe('with a real pointer', () => {
    // The pointer of the browser stays where a case leaves it, for each later test.
    function releasePointerAfterTest() {
      onTestFinished(async () => {
        await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
      });
    }

    it('steps one time and commits one time for a click, and keeps the focus in the input', async () => {
      const onValueChange = vi.fn();
      const onValueCommitted = vi.fn();
      await render(
        <NumberField.Root
          defaultValue={0}
          onValueChange={onValueChange}
          onValueCommitted={onValueCommitted}
        >
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      await userEvent.click(screen.getByRole('button'));

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.lastCall?.[1].reason).toBe(REASONS.incrementPress);
      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(1);
      expect(screen.getByRole('textbox')).toHaveValue('1');
      expect(screen.getByRole('textbox')).toHaveFocus();
    });

    it('steps again while the pointer is held, and stops at the release', async () => {
      const onValueCommitted = vi.fn();
      await render(
        <NumberField.Root defaultValue={0} onValueCommitted={onValueCommitted}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );
      const input = screen.getByRole<HTMLInputElement>('textbox');
      releasePointerAfterTest();

      await userEvent.pointer({ target: screen.getByRole('button'), keys: '[MouseLeft>]' });
      await waitFor(() => expect(Number(input.value)).toBeGreaterThanOrEqual(3), { timeout: 3000 });
      expect(onValueCommitted).not.toHaveBeenCalled();

      await userEvent.pointer({ keys: '[/MouseLeft]' });
      const valueAtRelease = input.value;

      expect(onValueCommitted).toHaveBeenCalledTimes(1);
      expect(onValueCommitted.mock.lastCall?.[0]).toBe(Number(valueAtRelease));

      // The wait is longer than two ticks of the hold.
      await new Promise((resolve) => setTimeout(resolve, CHANGE_VALUE_TICK_DELAY * 3));
      expect(input).toHaveValue(valueAtRelease);
    });
  });

  it('places the caret at the end of the input when a mouse press focuses it', async () => {
    await render(
      <NumberField.Root defaultValue={100}>
        <NumberField.Increment />
        <NumberField.Input />
      </NumberField.Root>,
    );

    const button = screen.getByRole('button');
    const input = screen.getByRole<HTMLInputElement>('textbox');

    await fireEvent.pointerDown(button, { pointerType: 'mouse', button: 0 });

    expect(document.activeElement).toBe(input);
    expect(input.selectionStart).toBe(input.value.length);
    expect(input.selectionEnd).toBe(input.value.length);
  });

  describe('prop: snapOnStep', () => {
    it('should increment by exact step without rounding when snapOnStep is false', async () => {
      await render(
        <NumberField.Root defaultValue={2.7} step={2} snapOnStep={false}>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue((4.7).toLocaleString());
    });

    it('should snap on increment when snapOnStep is true', async () => {
      await render(
        <NumberField.Root defaultValue={1.3} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      await fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: '1.9' } });
      await fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('2');

      await fireEvent.input(screen.getByRole('textbox'), { target: { value: '-0.2' } });
      await fireEvent.click(button);

      expect(screen.getByRole('textbox')).toHaveValue('0');
    });

    it('should increment with respect to the min value', async () => {
      await render(
        <NumberField.Root defaultValue={1} min={1} step={2} snapOnStep>
          <NumberField.Increment />
          <NumberField.Input />
        </NumberField.Root>,
      );

      const button = screen.getByRole('button');
      const input = screen.getByRole('textbox');

      await fireEvent.click(button);
      expect(input).toHaveValue('3');

      await fireEvent.click(button);
      expect(input).toHaveValue('5');

      await fireEvent.input(input, { target: { value: '1.112' } });
      await fireEvent.click(button);
      expect(input).toHaveValue('3');

      await fireEvent.input(input, { target: { value: '0.999' } });
      await fireEvent.click(button);
      expect(input).toHaveValue('1');
    });
  });
});
