import { expect } from 'vitest';
import { shallowRef } from 'vue';
import type { ShallowRef } from 'vue';
import { waitFor } from '#test-utils';
import type { createRenderer } from '#test-utils';
import AnimatedPanel from './AnimatedPanel.vue';

export const TRANSITION = 'animated-panel-transition';
export const ANIMATION = 'animated-panel-animation';

/**
 * Waits for the next event of a type on a target. It fails when none comes, so a missing animation
 * gives a message and not a timeout of the test.
 */
export function nextEvent(target: EventTarget, type: string): Promise<Event> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      target.removeEventListener(type, handleEvent);
      reject(new Error(`No ${type} event came in 3 seconds.`));
    }, 3000);
    function handleEvent(event: Event) {
      clearTimeout(timer);
      resolve(event);
    }
    target.addEventListener(type, handleEvent, { once: true });
  });
}

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

export function openInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = true;
  });
}

export function closeInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = false;
  });
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
      />
    </>
  ));
  const button = container.querySelector<HTMLButtonElement>('[data-testid="toggle"]')!;

  const counts = { enter: 0, exit: 0 };
  let phase: keyof typeof counts | undefined;
  container.addEventListener('transitionrun', (event) => {
    if (phase && (event.target as Element).matches('[data-testid="panel"]')) {
      counts[phase] += 1;
    }
  });

  for (let cycle = 0; cycle < 6; cycle += 1) {
    phase = 'enter';
    const entered = log.next(true);
    await flip(button, open);
    await entered;

    phase = 'exit';
    const exited = log.next(false);
    await flip(button, open);
    await exited;
    await waitFor(() => {
      const panel = container.querySelector<HTMLElement>('[data-testid="panel"]');
      expect(panel === null || panel.hidden).toBe(true);
    });
    phase = undefined;
  }

  return counts;
}
