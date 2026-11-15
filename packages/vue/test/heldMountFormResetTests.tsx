import { describe, expect, it, onTestFinished, vi } from 'vitest';
import type { VNodeChild } from 'vue';
import type { createRenderer } from './createRenderer';
import { flushMicrotasks } from './flushMicrotasks';
import { createHeldBranch } from './heldBranch';
import { screen } from './queries';

/**
 * A control that mounts while `KeepAlive` holds its branch follows a native reset of its form
 * after the show.
 */
export function heldMountFormResetTests(config: HeldMountFormResetTestsConfig) {
  const { render, renderControl, change, readState, defaultState, changedState } = config;

  describe('BUG-6206: a native reset of a control that mounts while KeepAlive holds its branch', () => {
    it('follows a reset of its form after the show', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(renderControl);
      await render(() => (
        <form data-testid="form">
          <HeldBranch />
        </form>
      ));
      await mountWhileHeld();
      await show();
      expect(readState()).toEqual(defaultState);

      await change();
      expect(readState()).toEqual(changedState);

      // `change` can use `user`, which waits for a real timer. The clock is thus fake only for the
      // timeout of the reset.
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      screen.getByTestId<HTMLFormElement>('form').reset();
      vi.advanceTimersByTime(0);
      vi.useRealTimers();
      await flushMicrotasks();

      expect(readState()).toEqual(defaultState);
    });
  });
}

export interface HeldMountFormResetTestsConfig {
  /**
   * Render function returned from `createRenderer`.
   */
  render: ReturnType<typeof createRenderer>['render'];
  /**
   * Returns the uncontrolled control with a `name` and a default value.
   */
  renderControl: () => VNodeChild;
  /**
   * Changes the value of the control as a user or an autofill does.
   */
  change: () => Promise<unknown>;
  /**
   * Reads the state of the part that the user sees, such as `aria-checked`.
   */
  readState: () => unknown;
  /**
   * The state at the default value.
   */
  defaultState: unknown;
  /**
   * The state after `change`.
   */
  changedState: unknown;
}
