import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { KeepAlive, defineComponent, shallowRef } from 'vue';
import { NumberField } from '@vase-ui/vue/number-field';
import { createRenderer, fireEvent, flushMicrotasks, isJSDOM, screen } from '#test-utils';
import { REASONS } from '../../internals/reasons';
import { CHANGE_VALUE_TICK_DELAY, START_AUTO_CHANGE_DELAY } from '../utils/constants';

type NumberFieldProps = InstanceType<typeof NumberField.Root>['$props'];

interface StepperCase {
  name: string;
  Stepper: typeof NumberField.Increment;
  label: string;
  /**
   * Displayed values after 1, 2, 4 and 5 steps from `defaultValue={0}`.
   */
  steps: { 1: string; 2: string; 4: string; 5: string };
  /**
   * Displayed value after one step from the dirty text `100`.
   */
  fromDirty100: string;
  /**
   * Values after one and two steps from `1.23456`.
   */
  fromFractional: [number, number];
  /**
   * Root props one step short of the boundary the stepper moves toward, and that boundary.
   */
  boundary: { props: NumberFieldProps; value: number };
  /**
   * `onValueChange` values when the dirty text `100` is synced and stepped but every change is
   * canceled.
   */
  canceledDirtyStepValues: number[];
  /**
   * Value after one step from the dirty text `7` with `step={2}` and `snapOnStep`.
   */
  snappedDirtyStep: number;
}

const cases: StepperCase[] = [
  {
    name: 'NumberField.Increment',
    Stepper: NumberField.Increment,
    label: 'Increase',
    steps: { 1: '1', 2: '2', 4: '4', 5: '5' },
    fromDirty100: '101',
    fromFractional: [2.23456, 3.23456],
    boundary: { props: { defaultValue: 9, max: 10 }, value: 10 },
    canceledDirtyStepValues: [100, 100, 1],
    snappedDirtyStep: 8,
  },
  {
    name: 'NumberField.Decrement',
    Stepper: NumberField.Decrement,
    label: 'Decrease',
    steps: { 1: '-1', 2: '-2', 4: '-4', 5: '-5' },
    fromDirty100: '99',
    fromFractional: [0.23456, -0.76544],
    boundary: { props: { defaultValue: -9, min: -10 }, value: -10 },
    canceledDirtyStepValues: [100, 100, -1],
    snappedDirtyStep: 6,
  },
];

async function tick(milliseconds: number) {
  vi.advanceTimersByTime(milliseconds);
  await flushMicrotasks();
}

describe('useNumberFieldStepperButton', () => {
  const { render } = createRenderer();

  describe.each(cases)(
    '<$name />',
    ({
      Stepper,
      label,
      steps,
      fromDirty100,
      fromFractional,
      boundary,
      canceledDirtyStepValues,
      snappedDirtyStep,
    }) => {
      function TestNumberField(props: NumberFieldProps) {
        return (
          <NumberField.Root defaultValue={0} {...props}>
            <Stepper />
            <NumberField.Input />
          </NumberField.Root>
        );
      }

      async function focus(element: HTMLElement) {
        element.focus();
        await flushMicrotasks();
      }

      describe('ARIA attributes', () => {
        it(`has the ${label} label`, async () => {
          await render(
            <NumberField.Root>
              <Stepper />
            </NumberField.Root>,
          );
          expect(screen.getByRole('button')).toHaveAccessibleName(label);
        });

        it('exposes aria-controls on the stepper', async () => {
          await render(<TestNumberField readOnly />);
          const input = screen.getByRole('textbox');
          expect(screen.getByRole('button')).toHaveAttribute('aria-controls', input.id);
        });
      });

      describe('click', () => {
        it('seeds an empty field with 0', async () => {
          await render(<TestNumberField defaultValue={undefined} />);
          await fireEvent.click(screen.getByRole('button'));
          expect(screen.getByRole('textbox')).toHaveValue('0');
        });

        it('steps once from defaultValue=0', async () => {
          await render(<TestNumberField />);
          await fireEvent.click(screen.getByRole('button'));
          expect(screen.getByRole('textbox')).toHaveValue(steps[1]);
        });

        it('seeds an empty fully-negative range in range on the first step', async () => {
          await render(<TestNumberField defaultValue={undefined} min={-10} max={-5} />);
          await fireEvent.click(screen.getByRole('button'));
          // The first step on an empty field seeds the in-range value nearest 0 (the max here),
          // whatever the direction.
          expect(screen.getByRole('textbox')).toHaveValue('-5');
        });

        it('seeds an empty field in range without directional snapping', async () => {
          await render(
            <TestNumberField defaultValue={undefined} min={-10} max={-5} step={2} snapOnStep />,
          );
          await fireEvent.click(screen.getByRole('button'));
          // The seed isn't a step from a previous value, so it must not be directionally snapped
          // (which would land on -6 or -4 clamped to -5 depending on direction).
          expect(screen.getByRole('textbox')).toHaveValue('-5');
        });

        it('only calls onValueChange once per step', async () => {
          const handleValueChange = vi.fn();
          const { user } = await render(
            <TestNumberField defaultValue={undefined} onValueChange={handleValueChange} />,
          );

          const button = screen.getByRole('button');

          await user.click(button);
          expect(handleValueChange.mock.calls.length).toBe(1);

          await user.click(button);
          expect(handleValueChange.mock.calls.length).toBe(2);
        });

        it('steps from the value set by an external controlled update', async () => {
          const Controlled = defineComponent(() => {
            const value = shallowRef<number | null>(null);
            return () => (
              <NumberField.Root
                value={value.value}
                onValueChange={(next: number | null) => {
                  value.value = next;
                }}
              >
                <NumberField.Input />
                <Stepper />
                <button
                  onClick={() => {
                    value.value = 1.23456;
                  }}
                >
                  external
                </button>
              </NumberField.Root>
            );
          });

          const { user } = await render(<Controlled />);
          const input = screen.getByRole('textbox');

          await user.click(screen.getByText('external'));
          expect(input).toHaveValue((1.23456).toLocaleString());

          await user.click(screen.getByLabelText(label));
          expect(input).toHaveValue(fromFractional[0].toLocaleString());
        });

        it('steps uncontrolled defaultValue from numeric state, not rounded display text', async () => {
          const onValueChange = vi.fn();

          const { user } = await render(
            <TestNumberField defaultValue={1.23456} onValueChange={onValueChange} />,
          );

          const input = screen.getByRole('textbox');
          expect(input).toHaveValue((1.23456).toLocaleString());

          await user.click(screen.getByLabelText(label));

          expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([fromFractional[0]]);
          expect(input).toHaveValue(fromFractional[0].toLocaleString());
        });

        it('steps from numeric state after typed precision is formatted on blur', async () => {
          const onValueChange = vi.fn();

          const { user } = await render(
            <TestNumberField defaultValue={undefined} onValueChange={onValueChange} />,
          );

          const input = screen.getByRole('textbox');
          const button = screen.getByLabelText(label);

          await user.click(input);
          await user.keyboard('1.23456');
          await fireEvent.focusOut(input);

          expect(input).toHaveValue((1.23456).toLocaleString());

          await user.click(button);
          expect(input).toHaveValue(fromFractional[0].toLocaleString());

          await user.click(button);
          expect(onValueChange.mock.lastCall?.[0]).toBe(fromFractional[1]);
          expect(input).toHaveValue(fromFractional[1].toLocaleString());
        });

        it('does not commit a stale value when a synced step is canceled after an external change', async () => {
          const onValueCommitted = vi.fn();
          let cancelNextChange = false;

          const Controlled = defineComponent(() => {
            const value = shallowRef<number | null>(0);
            return () => (
              <NumberField.Root
                value={value.value}
                onValueChange={(
                  next: number | null,
                  details: NumberField.Root.ChangeEventDetails,
                ) => {
                  if (cancelNextChange) {
                    details.cancel();
                    return;
                  }
                  value.value = next;
                }}
                onValueCommitted={onValueCommitted}
              >
                <NumberField.Input />
                <Stepper />
                <button
                  onClick={() => {
                    value.value = 10;
                  }}
                >
                  external
                </button>
              </NumberField.Root>
            );
          });

          await render(<Controlled />);
          const button = screen.getByLabelText(label);

          // A prior committed step populates the internal `lastChangedValueRef`.
          await fireEvent.click(button);
          expect(onValueCommitted.mock.calls.length).toBe(1);
          expect(onValueCommitted.mock.lastCall?.[0]).toBe(Number(steps[1]));

          // The controlled value changes externally to 10.
          await fireEvent.click(screen.getByText('external'));

          // Canceling the next step must not commit the stale earlier value: the synced path
          // refreshes the commit ref to the current value before stepping.
          cancelNextChange = true;
          await fireEvent.click(button);

          expect(onValueCommitted.mock.calls.length).toBe(1);
        });
      });

      describe('dirty input', () => {
        it('steps when input is dirty but not blurred (click)', async () => {
          await render(<TestNumberField />);

          const input = screen.getByRole('textbox');
          await focus(input);

          await fireEvent.input(input, { target: { value: '100' } });
          await fireEvent.click(screen.getByRole('button'));

          expect(input).toHaveValue(fromDirty100);
        });

        it('steps when input is dirty but not blurred (pointerdown)', async () => {
          await render(<TestNumberField />);

          const input = screen.getByRole('textbox');
          await focus(input);

          await fireEvent.input(input, { target: { value: '100' } });
          await fireEvent.pointerDown(screen.getByRole('button'));

          expect(input).toHaveValue(fromDirty100);
        });

        it('ignores non-primary pointer buttons', async () => {
          const onValueChange = vi.fn();

          // Controlled and pinned to 0, so the typed text stays out of sync with the stored value
          // and any dirty-text sync from the press would be reported.
          await render(
            <TestNumberField defaultValue={undefined} value={0} onValueChange={onValueChange} />,
          );

          const input = screen.getByRole('textbox');
          await focus(input);

          await fireEvent.input(input, { target: { value: '100' } });
          onValueChange.mockClear();

          await fireEvent.pointerDown(screen.getByRole('button'), { button: 1 });

          // A middle/right press must not even sync the dirty text, let alone start a hold.
          expect(onValueChange).not.toHaveBeenCalled();
          expect(input).toHaveValue('100');
        });

        it('does not step or commit when the dirty-input sync is canceled', async () => {
          const onValueChange = vi.fn(
            (_value: number | null, details: NumberField.Root.ChangeEventDetails) =>
              details.cancel(),
          );
          const onValueCommitted = vi.fn();

          await render(
            <TestNumberField onValueChange={onValueChange} onValueCommitted={onValueCommitted} />,
          );

          const input = screen.getByRole('textbox');
          await focus(input);

          await fireEvent.input(input, { target: { value: '100' } });
          // A keyboard/AT activation reaches `onClick` without a preceding `pointerdown`.
          await fireEvent.click(screen.getByRole('button'));

          // Both the dirty-text sync and the step that follows it were vetoed: the step still runs
          // (from the unchanged stored 0, not the typed 100), the typed text is left alone, and
          // nothing is committed.
          expect(onValueChange.mock.calls.map((call) => call[0])).toEqual(canceledDirtyStepValues);
          expect(input).toHaveValue('100');
          expect(onValueCommitted).not.toHaveBeenCalled();
        });

        it('does not emit a snapped intermediate when committing dirty text before a step', async () => {
          const onValueChange = vi.fn();
          await render(<TestNumberField step={2} snapOnStep onValueChange={onValueChange} />);

          const input = screen.getByRole('textbox');
          await focus(input);

          await fireEvent.input(input, { target: { value: '7' } });
          onValueChange.mockClear();
          await fireEvent.click(screen.getByRole('button'));

          // Typing already reported 7, so the press reports only the step. A directional snap of the
          // dirty "7" before stepping would emit an extra intermediate value (6).
          expect(onValueChange.mock.calls.map((call) => call[0])).toEqual([snappedDirtyStep]);
          expect(input).toHaveValue(String(snappedDirtyStep));
        });
      });

      describe('touch', () => {
        it('adds its touchstart listener as a passive listener', async () => {
          const addEventListener = vi.spyOn(EventTarget.prototype, 'addEventListener');
          onTestFinished(() => addEventListener.mockRestore());

          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const touchstartOptions = addEventListener.mock.calls
            .filter(
              ([type], index) =>
                type === 'touchstart' && addEventListener.mock.contexts[index] === button,
            )
            .map(([, , options]) => options);

          expect(touchstartOptions).toEqual([{ passive: true }]);
        });

        it('treats pen pointer as touch-like', async () => {
          await render(<TestNumberField />);

          await fireEvent.pointerDown(screen.getByRole('button'), {
            pointerType: 'pen',
            button: 0,
          });

          // A mouse press focuses the input; touch-like presses leave focus alone.
          expect(document.activeElement).toBe(document.body);
        });

        it.each([
          { order: 'click before touchend', clickFirst: true },
          { order: 'touchend before click', clickFirst: false },
        ])('always steps on quick touch ($order, before TOUCH_TIMEOUT)', async ({ clickFirst }) => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          async function tap() {
            await fireEvent.pointerDown(button, { pointerType: 'touch' });
            if (clickFirst) {
              await fireEvent.click(button, { detail: 1 });
              await fireEvent.touchEnd(button);
            } else {
              await fireEvent.touchEnd(button);
              await fireEvent.click(button, { detail: 1 });
            }
          }

          await fireEvent.touchStart(button);
          await fireEvent.mouseEnter(button);
          await tap();

          expect(input).toHaveValue(steps[1]);

          await fireEvent.touchStart(button);
          // No mouseenter occurs after the first focus
          await tap();

          expect(input).toHaveValue(steps[2]);
        });

        it.skipIf(isJSDOM)('fires onValueCommitted once on first soft tap (touch)', async () => {
          const onValueCommitted = vi.fn();
          await render(<TestNumberField onValueCommitted={onValueCommitted} />);

          const button = screen.getByLabelText(label);

          // Simulate the typical sequence with a 300ms tap delay producing mouse compatibility
          // events.
          await fireEvent.touchStart(button);
          await fireEvent.pointerDown(button, { pointerType: 'touch' });
          // No movement; quick tap
          await fireEvent.touchEnd(button);
          // Compatibility mouse events and click
          await fireEvent.mouseEnter(button);
          await fireEvent.click(button, { detail: 1 });

          expect(onValueCommitted.mock.calls.length).toBe(1);
          expect(onValueCommitted.mock.calls[0][0]).toBe(Number(steps[1]));
        });
      });

      describe('press and hold', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });

        afterEach(() => {
          vi.useRealTimers();
        });

        async function holdForThreeTicks() {
          await tick(START_AUTO_CHANGE_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
        }

        it('steps continuously when holding pointerdown', async () => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          await fireEvent.pointerDown(button);
          expect(input).toHaveValue(steps[1]);

          await holdForThreeTicks();
          expect(input).toHaveValue(steps[4]);

          await fireEvent.pointerUp(button);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(steps[4]);
        });

        it('does not step twice with pointerdown and click', async () => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');

          await fireEvent.pointerDown(button);
          await fireEvent.pointerUp(button);
          await fireEvent.click(button, { detail: 1 });

          expect(screen.getByRole('textbox')).toHaveValue(steps[1]);
        });

        it('stops calling onValueChange once the boundary is reached', async () => {
          const handleValueChange = vi.fn();
          await render(<TestNumberField {...boundary.props} onValueChange={handleValueChange} />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          await fireEvent.pointerDown(button);

          expect(input).toHaveValue(String(boundary.value));
          expect(handleValueChange.mock.calls.length).toBe(1);

          await tick(START_AUTO_CHANGE_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(String(boundary.value));
          expect(handleValueChange.mock.calls.length).toBe(1);

          await fireEvent.pointerUp(button);
        });

        it('commits on release after a hold reaches the boundary', async () => {
          const onValueCommitted = vi.fn();
          await render(<TestNumberField {...boundary.props} onValueCommitted={onValueCommitted} />);

          const button = screen.getByRole('button');

          await fireEvent.pointerDown(button);
          await tick(START_AUTO_CHANGE_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(screen.getByRole('textbox')).toHaveValue(String(boundary.value));
          expect(onValueCommitted).not.toHaveBeenCalled();

          await fireEvent.pointerUp(button);

          expect(onValueCommitted.mock.calls.length).toBe(1);
          expect(onValueCommitted.mock.lastCall?.[0]).toBe(boundary.value);
        });

        it('does not commit a stale value when the first hold tick is canceled after dirty input', async () => {
          const onValueCommitted = vi.fn();
          let cancelNextChange = false;

          const Controlled = defineComponent(() => {
            const value = shallowRef<number | null>(0);
            return () => (
              <NumberField.Root
                value={value.value}
                onValueChange={(
                  nextValue: number | null,
                  details: NumberField.Root.ChangeEventDetails,
                ) => {
                  if (cancelNextChange) {
                    details.cancel();
                    cancelNextChange = false;
                    return;
                  }
                  value.value = nextValue;
                }}
                onValueCommitted={onValueCommitted}
              >
                <NumberField.Input />
                <Stepper />
                <button
                  onClick={() => {
                    value.value = 10;
                  }}
                >
                  external
                </button>
              </NumberField.Root>
            );
          });

          await render(<Controlled />);
          const button = screen.getByLabelText(label);
          const input = screen.getByRole('textbox');

          await fireEvent.click(button);
          expect(onValueCommitted.mock.lastCall?.[0]).toBe(Number(steps[1]));

          await fireEvent.click(screen.getByText('external'));
          expect(input).toHaveValue('10');

          await fireEvent.focusIn(input);
          await fireEvent.input(input, { target: { value: '-' } });
          expect(input).toHaveValue('-');

          cancelNextChange = true;
          await fireEvent.pointerDown(button);
          await fireEvent.pointerUp(button);

          expect(onValueCommitted.mock.calls.length).toBe(2);
          expect(onValueCommitted.mock.lastCall?.[0]).toBe(10);
        });

        it('stops stepping after mouseleave', async () => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          await fireEvent.pointerDown(button);
          expect(input).toHaveValue(steps[1]);

          await holdForThreeTicks();
          expect(input).toHaveValue(steps[4]);

          await fireEvent.mouseLeave(button);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(steps[4]);
        });

        it('starts stepping again after mouseleave then mouseenter', async () => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          await fireEvent.pointerDown(button);
          expect(input).toHaveValue(steps[1]);

          await holdForThreeTicks();
          expect(input).toHaveValue(steps[4]);

          await fireEvent.mouseLeave(button);
          await tick(CHANGE_VALUE_TICK_DELAY);
          expect(input).toHaveValue(steps[4]);

          await fireEvent.mouseEnter(button);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(steps[5]);
        });

        it('does not start stepping again after mouseleave then mouseenter after pointerup', async () => {
          await render(<TestNumberField />);

          const button = screen.getByRole('button');
          const input = screen.getByRole('textbox');

          await fireEvent.pointerDown(button);
          expect(input).toHaveValue(steps[1]);

          await holdForThreeTicks();
          expect(input).toHaveValue(steps[4]);

          await fireEvent.pointerUp(button);
          await tick(CHANGE_VALUE_TICK_DELAY);
          expect(input).toHaveValue(steps[4]);

          await fireEvent.mouseLeave(button);
          await tick(CHANGE_VALUE_TICK_DELAY);
          expect(input).toHaveValue(steps[4]);

          await fireEvent.mouseEnter(button);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(steps[4]);
        });

        it('cancels an active mouse press-and-hold interaction when disabled', async () => {
          const { setProps } = await render(<TestNumberField disabled={false} />);

          const input = screen.getByRole('textbox');
          const button = screen.getByRole('button', { name: label });

          await fireEvent.pointerDown(button, { button: 0, pointerType: 'mouse' });
          expect(input).toHaveValue(steps[1]);

          await setProps({ disabled: true });

          await tick(START_AUTO_CHANGE_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(input).toHaveValue(steps[1]);

          await setProps({ disabled: false });
          await fireEvent.mouseLeave(button);
          await fireEvent.mouseEnter(button);

          expect(input).toHaveValue(steps[1]);
        });

        it('cancels the compatibility click from a touch press when disabled', async () => {
          const { setProps } = await render(<TestNumberField disabled={false} />);

          const input = screen.getByRole('textbox');
          const button = screen.getByRole('button', { name: label });

          await fireEvent.touchStart(button);
          await fireEvent.pointerDown(button, { pointerType: 'touch' });

          await setProps({ disabled: true });
          await setProps({ disabled: false });

          await fireEvent.pointerUp(button, { pointerType: 'touch' });
          await fireEvent.touchEnd(button);
          await fireEvent.mouseEnter(button);
          await fireEvent.click(button, { detail: 1 });

          expect(input).toHaveValue('0');
        });

        it('removes the global release listener when unmounted during a hold', async () => {
          const addEventListener = vi.spyOn(window, 'addEventListener');
          const removeEventListener = vi.spyOn(window, 'removeEventListener');

          function App(props: { mounted: boolean }) {
            return props.mounted ? <TestNumberField /> : null;
          }

          try {
            const { setProps } = await render(<App mounted />);
            await fireEvent.pointerDown(screen.getByRole('button'));

            const pointerUpListener = addEventListener.mock.calls.find(
              ([type]) => type === 'pointerup',
            );
            expect(pointerUpListener).toBeDefined();

            await setProps({ mounted: false });

            expect(removeEventListener).toHaveBeenCalledWith('pointerup', pointerUpListener?.[1], {
              once: true,
            });
          } finally {
            addEventListener.mockRestore();
            removeEventListener.mockRestore();
          }
        });

        it('ends a hold when KeepAlive deactivates the field, and the release commits nothing', async () => {
          const onValueChange = vi.fn();
          const onValueCommitted = vi.fn();
          const shown = shallowRef(true);
          const App = defineComponent(() => () => (
            <KeepAlive>
              {shown.value ? (
                <NumberField.Root
                  key="field"
                  defaultValue={0}
                  onValueChange={onValueChange}
                  onValueCommitted={onValueCommitted}
                >
                  <Stepper />
                  <NumberField.Input />
                </NumberField.Root>
              ) : null}
            </KeepAlive>
          ));
          await render(<App />);

          await fireEvent.pointerDown(screen.getByRole('button'));
          expect(onValueChange).toHaveBeenCalledTimes(1);

          shown.value = false;
          await flushMicrotasks();
          await tick(START_AUTO_CHANGE_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);
          await tick(CHANGE_VALUE_TICK_DELAY);

          expect(onValueChange).toHaveBeenCalledTimes(1);

          await fireEvent.pointerUp(window, { pointerType: 'mouse' });

          // The input loses focus when `KeepAlive` takes it out of the document, and that commits the
          // step with the reason `input-blur`. The release of the pointer commits nothing more.
          const reasons = onValueCommitted.mock.calls.map(([, details]) => details.reason);
          expect(reasons).not.toContain(REASONS.incrementPress);
          expect(reasons).not.toContain(REASONS.decrementPress);
        });
      });

      describe('disabled and read-only states', () => {
        it('does not step when readOnly', async () => {
          await render(<TestNumberField defaultValue={undefined} readOnly />);

          await fireEvent.click(screen.getByRole('button'));
          expect(screen.getByRole('textbox')).toHaveValue('');
        });

        it('does not step when root is disabled', async () => {
          const handleValueChange = vi.fn();
          await render(
            <TestNumberField defaultValue={undefined} disabled onValueChange={handleValueChange} />,
          );

          await fireEvent.click(screen.getByRole('button'));
          expect(screen.getByRole('textbox')).toHaveValue('');
          expect(handleValueChange.mock.calls.length).toBe(0);
        });

        it('is disabled when the value reaches the boundary that the stepper moves toward', async () => {
          await render(<TestNumberField {...boundary.props} />);

          const button = screen.getByRole('button');
          expect(button).not.toHaveAttribute('disabled');
          expect(button).not.toHaveAttribute('data-disabled');

          await fireEvent.click(button);

          expect(screen.getByRole('textbox')).toHaveValue(String(boundary.value));
          expect(button).toHaveAttribute('disabled');
          expect(button).toHaveAttribute('data-disabled');
        });

        it('does not step when the button is disabled', async () => {
          const handleValueChange = vi.fn();
          await render(
            <NumberField.Root defaultValue={0} onValueChange={handleValueChange}>
              <Stepper disabled />
              <NumberField.Input />
            </NumberField.Root>,
          );
          const input = screen.getByRole('textbox');
          const button = screen.getByRole('button');
          expect(button).toHaveAttribute('disabled');
          expect(input).toHaveValue('0');

          await fireEvent.pointerDown(button);
          expect(handleValueChange.mock.calls.length).toBe(0);
          expect(input).toHaveValue('0');
        });

        it.each([
          { scenario: 'root is disabled', rootDisabled: true, buttonDisabled: false },
          { scenario: 'button is disabled', rootDisabled: false, buttonDisabled: true },
        ])(
          'passes disabled state to className when $scenario',
          async ({ rootDisabled, buttonDisabled }) => {
            const classNameSpy = vi.fn();
            await render(
              <NumberField.Root disabled={rootDisabled}>
                <Stepper disabled={buttonDisabled} stateClass={classNameSpy} />
                <NumberField.Input />
              </NumberField.Root>,
            );

            expect(classNameSpy.mock.lastCall?.[0]).toHaveProperty('disabled', true);
          },
        );
      });
    },
  );
});
