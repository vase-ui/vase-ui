import { expect } from 'vitest';
import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { createTransitionRunCounter, waitFor } from '#test-utils';
import type { createRenderer } from '#test-utils';
import AnimatedPanel from './AnimatedPanel.vue';

export const TRANSITION = 'animated-panel-transition';
export const ANIMATION = 'animated-panel-animation';
export const LONG_EXIT = 'animated-panel-long-exit';

/**
 * Records the `openChangeComplete` events of a panel, and lets a test wait for the next one.
 */
export function createCompletionLog() {
  const calls: boolean[] = [];
  let waiting: { open: boolean; resolve: () => void } | undefined;

  return {
    calls,
    onOpenChangeComplete(open: boolean) {
      calls.push(open);
      if (waiting?.open === open) {
        waiting.resolve();
        waiting = undefined;
      }
    },
    next(open: boolean) {
      return new Promise<void>((resolve) => {
        waiting = { open, resolve };
      });
    },
  };
}

export interface TransitionRow {
  keepMounted: boolean;
  enableIdleState?: boolean;
  as?: string;
}

/**
 * Opens and closes a panel that has a CSS transition, and counts the `transitionrun` events of the
 * panel for each phase. `flip` changes `open` in a timer task or with a click on the button.
 * The helper reads no style and no layout. A read starts the transition that the part must start,
 * and the count is then right with a broken part.
 */
export async function countTransitions(
  render: ReturnType<typeof createRenderer>['render'],
  { keepMounted, enableIdleState, as }: TransitionRow,
  flip: (button: HTMLButtonElement, open: ShallowRef<boolean>) => void | Promise<void>,
) {
  const open = shallowRef(false);
  const log = createCompletionLog();
  const counter = createTransitionRunCounter(() => open.value);
  const { container } = await render(() => (
    <>
      <button
        type="button"
        data-testid="toggle"
        onClick={() => {
          open.value = !open.value;
        }}
      />
      <AnimatedPanel
        open={open.value}
        keepMounted={keepMounted}
        enableIdleState={enableIdleState}
        as={as}
        class={TRANSITION}
        data-testid="panel"
        onOpenChangeComplete={log.onOpenChangeComplete}
        onTransitionrun={counter.onTransitionrun}
      />
    </>
  ));
  const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle"]')!;

  for (let cycle = 0; cycle < 6; cycle += 1) {
    const entered = log.next(true);
    await flip(button, open);
    await entered;

    const exited = log.next(false);
    await flip(button, open);
    await exited;
    await waitFor(() => {
      const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
      expect(panel === null || panel.hidden).toBe(true);
    });
  }

  // The browser can send the `transitionrun` of the last exit after the completion.
  await waitFor(() => {
    expect(counter.counts.exit).toBe(6);
  });

  return counter.counts;
}
