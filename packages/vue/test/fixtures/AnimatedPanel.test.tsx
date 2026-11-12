import { beforeEach, describe, expect, it, onTestFinished } from 'vitest';
import { shallowRef } from 'vue';
import { createRenderer, flushMicrotasks, hydrate, renderOnServer, waitFor } from '#test-utils';
import AnimatedPanel from './AnimatedPanel.vue';
import {
  ANIMATION,
  TRANSITION,
  closeInTimerTask,
  countTransitions,
  createCompletionLog,
  nextEvent,
  openInTimerTask,
} from './animatedPanelHarness';
import type { TransitionRow } from './animatedPanelHarness';

interface FrameProbeResult {
  /** The panel was `hidden` or not connected in the callback of the frame. */
  isGone: boolean;
  /** The callback of the frame has the time of the frame in which the animation ended. */
  isSameFrame: boolean;
}

/**
 * Finds out if a frame paints between the end of the exit animation and the removal of the panel.
 * The reaction to the end reads the time of the timeline and requests one frame. If the removal
 * is done in that frame callback, no frame ran between the end and the removal. The time of the
 * callback shows that it belongs to the frame of the end.
 */
function probeFrameAfterExit(panel: HTMLElement, isGone: () => boolean) {
  return new Promise<FrameProbeResult>((resolve, reject) => {
    const animations = panel.getAnimations();
    if (animations.length === 0) {
      reject(new Error('The panel has no animation to wait for.'));
      return;
    }
    Promise.all(animations.map((animation) => animation.finished)).then(() => {
      const endTime = Number(document.timeline.currentTime);
      requestAnimationFrame((frameTime) => {
        resolve({ isGone: isGone(), isSameFrame: Math.abs(frameTime - endTime) < 0.5 });
      });
    }, reject);
  });
}

describe('<AnimatedPanel />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  describe('the frame after the exit animation', () => {
    interface FrameRow {
      name: string;
      keepMounted: boolean;
      className: string;
      batch?: boolean;
    }

    async function probeCycles({
      keepMounted,
      className,
      batch = false,
      completeInLaterTask = false,
    }: FrameRow & { completeInLaterTask?: boolean }) {
      const open = shallowRef(true);
      const log = createCompletionLog();
      const { container } = await render(() => (
        <AnimatedPanel
          open={open.value}
          keepMounted={keepMounted}
          batch={batch}
          completeInLaterTask={completeInLaterTask}
          class={className}
          data-testid="panel"
          onOpenChangeComplete={log.onOpenChangeComplete}
        />
      ));
      await waitFor(() => {
        expect(log.calls).toContain(true);
      });

      const exitEvent = className === TRANSITION ? 'transitionrun' : 'animationstart';
      const results: FrameProbeResult[] = [];
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const panel = container.querySelector<HTMLElement>('[data-testid="panel"]')!;
        const exitStarted = nextEvent(panel, exitEvent);
        const exited = log.next(false);
        closeInTimerTask(open);
        await exitStarted;
        results.push(
          await probeFrameAfterExit(panel, () =>
            keepMounted ? panel.hidden === true : !panel.isConnected,
          ),
        );

        await exited;
        const entered = log.next(true);
        openInTimerTask(open);
        await entered;
      }
      return results;
    }

    it.each<FrameRow>([
      { name: 'unmounted, transition', keepMounted: false, className: TRANSITION },
      { name: 'keep-mounted, transition', keepMounted: true, className: TRANSITION },
      { name: 'unmounted, animation', keepMounted: false, className: ANIMATION },
      { name: 'keep-mounted, animation', keepMounted: true, className: ANIMATION },
      {
        name: 'unmounted, animation, batch',
        keepMounted: false,
        className: ANIMATION,
        batch: true,
      },
    ])(
      'removes the panel in the frame in which the exit animation ends: $name',
      async (row) => {
        const results = await probeCycles(row);

        expect(results.map(({ isSameFrame }) => isSameFrame)).toEqual([true, true, true]);
        expect(results.map(({ isGone }) => isGone)).toEqual([true, true, true]);
      },
      20_000,
    );

    // A probe that cannot see a late removal proves nothing.
    it.each<FrameRow>([
      { name: 'unmounted', keepMounted: false, className: ANIMATION },
      { name: 'keep-mounted', keepMounted: true, className: ANIMATION },
    ])(
      'finds the panel in the frame when the completion runs in a later task: $name',
      async (row) => {
        const results = await probeCycles({ ...row, completeInLaterTask: true });

        expect(results.map(({ isSameFrame }) => isSameFrame)).toEqual([true, true, true]);
        expect(results.map(({ isGone }) => isGone)).toEqual([false, false, false]);
      },
      20_000,
    );
  });

  describe('completions of two panels', () => {
    it('run in sequence, so a completion sees the change of the completion before it', async () => {
      const firstOpen = shallowRef(true);
      const secondOpen = shallowRef(true);
      const first = createCompletionLog();
      const second = createCompletionLog();
      const { container } = await render(() => (
        <>
          <AnimatedPanel
            open={firstOpen.value}
            keepMounted
            class={ANIMATION}
            data-testid="first"
            onOpenChangeComplete={(open: boolean) => {
              first.onOpenChangeComplete(open);
              if (!open) {
                secondOpen.value = true;
              }
            }}
          />
          <AnimatedPanel
            open={secondOpen.value}
            keepMounted
            class={ANIMATION}
            data-testid="second"
            onOpenChangeComplete={second.onOpenChangeComplete}
          />
        </>
      ));
      const firstPanel = container.querySelector<HTMLElement>('[data-testid="first"]')!;
      const secondPanel = container.querySelector<HTMLElement>('[data-testid="second"]')!;
      await waitFor(() => {
        expect(first.calls).toContain(true);
      });
      await waitFor(() => {
        expect(second.calls).toContain(true);
      });
      expect(second.calls).not.toContain(false);

      const exitsStarted = Promise.all([
        nextEvent(firstPanel, 'animationstart'),
        nextEvent(secondPanel, 'animationstart'),
      ]);
      setTimeout(() => {
        firstOpen.value = false;
        secondOpen.value = false;
      });
      await exitsStarted;

      // The explicit calls fix the order. Two animations that end in one frame have no order.
      const [firstAnimation] = firstPanel.getAnimations();
      const [secondAnimation] = secondPanel.getAnimations();
      firstAnimation.finish();
      secondAnimation.finish();
      await flushMicrotasks();

      expect(first.calls).toContain(false);
      expect(second.calls).not.toContain(false);
      expect(secondPanel.hidden).toBe(false);
    });
  });

  describe('transitions', () => {
    // The rows that open the panel with a real click are in `AnimatedPanel.click.test.tsx`.
    it.each<TransitionRow & { name: string }>([
      { name: 'unmounted', keepMounted: false },
      { name: 'keep-mounted', keepMounted: true },
      { name: 'keep-mounted with the idle state', keepMounted: true, enableIdleState: true },
      { name: 'unmounted svg', keepMounted: false, as: 'svg' },
    ])(
      'runs one transition for each enter and each exit when a timer task opens the panel: $name',
      async (row) => {
        const counts = await countTransitions(render, row, (_button, open) => {
          setTimeout(() => {
            open.value = !open.value;
          });
        });

        expect(counts).toEqual({ enter: 6, exit: 6 });
      },
      30_000,
    );

    it('runs one enter transition each time a panel mounts open with animateInitialOpen', async () => {
      let enters = 0;
      const handleTransitionRun = (event: Event) => {
        if ((event.target as Element).matches('[data-testid="panel"]')) {
          enters += 1;
        }
      };
      document.addEventListener('transitionrun', handleTransitionRun, true);
      onTestFinished(() =>
        document.removeEventListener('transitionrun', handleTransitionRun, true),
      );

      for (let cycle = 0; cycle < 6; cycle += 1) {
        const log = createCompletionLog();
        const entered = log.next(true);
        const { unmount } = await render(() => (
          <AnimatedPanel
            open
            animateInitialOpen
            class={TRANSITION}
            data-testid="panel"
            onOpenChangeComplete={log.onOpenChangeComplete}
          />
        ));
        await entered;
        unmount();
      }

      expect(enters).toBe(6);
    }, 20_000);
  });

  describe('the completion of an open', () => {
    it('comes after the enter transition and not before it', async () => {
      const open = shallowRef(false);
      const log = createCompletionLog();
      const { container } = await render(() => (
        <AnimatedPanel
          open={open.value}
          class={TRANSITION}
          data-testid="panel"
          onOpenChangeComplete={log.onOpenChangeComplete}
        />
      ));

      const started = nextEvent(container, 'transitionrun');
      openInTimerTask(open);
      await started;
      expect(log.calls).not.toContain(true);

      await nextEvent(container, 'transitionend');
      await flushMicrotasks();
      expect(log.calls).toEqual([true]);
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'an open panel', props: { open: true } },
      {
        name: 'an open panel with animateInitialOpen',
        props: { open: true, animateInitialOpen: true },
      },
    ])('hydrates $name with no difference from a client render', async ({ props }) => {
      const serverHtml = await renderOnServer('test/fixtures/AnimatedPanel.vue', props);

      await hydrate(AnimatedPanel, { serverHtml, props });
    });
  });
});
