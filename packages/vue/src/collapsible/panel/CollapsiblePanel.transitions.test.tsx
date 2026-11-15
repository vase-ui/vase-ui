import { beforeEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';
import {
  closeInTimerTask,
  createRenderer,
  createTransitionRunCounter,
  nextAnimationsRead,
  nextEvent,
  openInTimerTask,
  probeFrameAfterExit,
  probeFrameAfterExitBeforeRead,
  waitFor,
} from '#test-utils';
import type { EarlyExitProbeResult, FrameProbeResult } from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

const TRANSITION = 'collapsible-transition-panel';
const ANIMATION = 'collapsible-animation-panel';
const LONG_EXIT = 'collapsible-long-exit-panel';
const TWO_EXITS = 'collapsible-two-exits-panel';
const OTHER_EXITS = 'collapsible-other-exits-panel';
const CHILD = 'collapsible-panel-child';

const STYLE = `
  .${TRANSITION} {
    overflow: hidden;
    height: var(--collapsible-panel-height);
    transition: height 100ms linear;
  }

  .${TRANSITION}[data-starting-style],
  .${TRANSITION}[data-ending-style] {
    height: 0;
  }

  @keyframes collapsible-slide-down {
    from {
      height: 0;
    }

    to {
      height: var(--collapsible-panel-height);
    }
  }

  @keyframes collapsible-slide-up {
    from {
      height: var(--collapsible-panel-height);
    }

    to {
      height: 0;
    }
  }

  .${ANIMATION} {
    overflow: hidden;
  }

  .${ANIMATION}[data-open] {
    animation: collapsible-slide-down 100ms linear;
  }

  .${ANIMATION}[data-closed] {
    animation: collapsible-slide-up 100ms linear;
  }

  /* The exit of a panel that a test moves to its end must not end by itself. A late frame can end
     a short exit before the part reads its animations. Each rule is for one kind, because a panel
     with a transition and an animation gets a warning. */
  .${TRANSITION}.${LONG_EXIT}[data-ending-style] {
    transition-duration: 100s;
  }

  .${ANIMATION}.${LONG_EXIT}[data-closed] {
    animation-duration: 100s;
  }

  @keyframes collapsible-fade-out {
    from {
      opacity: 1;
    }

    to {
      opacity: 0;
    }
  }

  .${TWO_EXITS}[data-closed] {
    animation:
      collapsible-slide-up 100s linear,
      collapsible-fade-out 100s linear;
  }

  .${OTHER_EXITS}[data-closed] > .${CHILD},
  .${OTHER_EXITS}[data-closed]::before {
    animation: collapsible-fade-out 100s linear;
  }

  .${OTHER_EXITS}::before {
    content: '';
    display: block;
  }
`;

interface PanelRow {
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
}

// A test that counts transitions reads no style and no layout. A read starts the transition that the
// part must start, and the count is then right with a broken part.
describe('<Collapsible.Panel /> transitions', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  async function renderPanel(
    open: { value: boolean },
    className: string,
    row: PanelRow,
    onTransitionrun?: (event: Event) => void,
  ) {
    const { container } = await render(() => (
      <>
        <style>{STYLE}</style>
        <Collapsible.Root open={open.value}>
          <Collapsible.Panel
            class={className}
            data-testid="panel"
            keepMounted={row.keepMounted}
            hiddenUntilFound={row.hiddenUntilFound}
            onTransitionrun={onTransitionrun}
          >
            <div class={CHILD}>{PANEL_CONTENT}</div>
          </Collapsible.Panel>
        </Collapsible.Root>
      </>
    ));

    const getPanel = () => container.querySelector<HTMLElement>('[data-testid="panel"]');
    const isGone = () => {
      const panel = getPanel();
      return panel === null || panel.hasAttribute('hidden');
    };

    return { container, getPanel, isGone };
  }

  describe('the count of the transitions', () => {
    it.each<PanelRow & { name: string }>([
      { name: 'unmounted' },
      { name: 'keep-mounted', keepMounted: true },
      { name: 'hiddenUntilFound', hiddenUntilFound: true },
    ])(
      'runs one transition for each enter and each exit when a timer task opens the panel: $name',
      async (row) => {
        const open = shallowRef(false);
        const counter = createTransitionRunCounter(() => open.value);
        const { container, getPanel, isGone } = await renderPanel(
          open,
          TRANSITION,
          row,
          counter.onTransitionrun,
        );

        for (let cycle = 0; cycle < 6; cycle += 1) {
          const entered = nextEvent(container, 'transitionend', { after: 'transitionrun' });
          openInTimerTask(open);
          await entered;
          await waitFor(() => {
            expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
          });

          // A busy machine can stall the page for some seconds, so the wait for the end of the
          // animations of the exit has no time limit.
          const read = nextAnimationsRead(getPanel()!);
          closeInTimerTask(open);
          await Promise.all((await read).map((animation) => animation.finished));
          await waitFor(() => {
            expect(isGone()).toBe(true);
          });
        }

        // The browser can send the `transitionrun` of the last exit after the panel is hidden.
        await waitFor(() => {
          expect(counter.counts.exit).toBe(6);
        });
        expect(counter.counts).toEqual({ enter: 6, exit: 6 });
      },
      30_000,
    );
  });

  describe('the frame after the exit animation', () => {
    interface FrameRow extends PanelRow {
      name: string;
      className: string;
    }

    async function probeCycles({ className, ...row }: FrameRow) {
      const open = shallowRef(false);
      const { container, getPanel, isGone } = await renderPanel(
        open,
        `${className} ${LONG_EXIT}`,
        row,
      );

      // The end event of an exit can come after the removal of the panel. The wait for the end of an
      // enter ignores each end event that comes before the start of that enter.
      const startEvent = className === TRANSITION ? 'transitionrun' : 'animationstart';
      const endEvent = className === TRANSITION ? 'transitionend' : 'animationend';
      const results: FrameProbeResult[] = [];
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const entered = nextEvent(container, endEvent, { after: startEvent });
        openInTimerTask(open);
        await entered;
        await waitFor(() => {
          expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
        });

        const panel = getPanel()!;
        results.push(
          await probeFrameAfterExit(
            panel,
            () => (row.keepMounted ? panel.hidden === true : !panel.isConnected),
            () => closeInTimerTask(open),
          ),
        );

        await waitFor(() => {
          expect(isGone()).toBe(true);
        });
      }
      return results;
    }

    it.each<FrameRow>([
      { name: 'unmounted, transition', className: TRANSITION },
      { name: 'keep-mounted, transition', className: TRANSITION, keepMounted: true },
      { name: 'unmounted, animation', className: ANIMATION },
      { name: 'keep-mounted, animation', className: ANIMATION, keepMounted: true },
    ])(
      'removes the panel in the frame in which the exit animation ends: $name',
      async (row) => {
        const results = await probeCycles(row);

        expect(results.map(({ isSameFrame }) => isSameFrame)).toEqual([true, true, true]);
        expect(results.map(({ isGone }) => isGone)).toEqual([true, true, true]);
      },
      20_000,
    );
  });

  describe('VUE-71: a keyframe exit that ends before the part reads it', () => {
    it.each<PanelRow & { name: string }>([
      { name: 'unmounted' },
      { name: 'keep-mounted', keepMounted: true },
      { name: 'hiddenUntilFound', hiddenUntilFound: true },
    ])(
      'removes the panel in the frame in which the exit ends: $name',
      async (row) => {
        const open = shallowRef(false);
        const { container, getPanel, isGone } = await renderPanel(
          open,
          `${ANIMATION} ${LONG_EXIT}`,
          row,
        );

        const results: EarlyExitProbeResult[] = [];
        for (let cycle = 0; cycle < 3; cycle += 1) {
          const entered = nextEvent(container, 'animationend', { after: 'animationstart' });
          openInTimerTask(open);
          await entered;
          await waitFor(() => {
            expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
          });

          const panel = getPanel()!;
          results.push(
            await probeFrameAfterExitBeforeRead(
              panel,
              () =>
                row.keepMounted || row.hiddenUntilFound
                  ? panel.hidden !== false
                  : !panel.isConnected,
              () => closeInTimerTask(open),
            ),
          );

          await waitFor(() => {
            expect(isGone()).toBe(true);
          });
        }

        expect(results.map(({ isReadBeforeEnd }) => isReadBeforeEnd)).toEqual([
          false,
          false,
          false,
        ]);
        expect(results.map(({ isSameFrame }) => isSameFrame)).toEqual([true, true, true]);
        expect(results.map(({ isGone }) => isGone)).toEqual([true, true, true]);
      },
      20_000,
    );

    async function renderOpenPanel(open: { value: boolean }, className: string) {
      const { container, getPanel, isGone } = await renderPanel(
        open,
        `${className} ${LONG_EXIT}`,
        {},
      );
      const isTransition = className.split(' ').includes(TRANSITION);
      const startEvent = isTransition ? 'transitionrun' : 'animationstart';
      const endEvent = isTransition ? 'transitionend' : 'animationend';
      const entered = nextEvent(container, endEvent, { after: startEvent });
      openInTimerTask(open);
      await entered;
      await waitFor(() => {
        expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
      });
      return { container, panel: getPanel()!, isGone };
    }

    // The listener of the case is on the container, so it runs after the listener of the part and
    // after the update that the listener of the part makes.
    it('keeps the panel until the last of its exit animations ends', async () => {
      const open = shallowRef(false);
      const { container, panel, isGone } = await renderOpenPanel(open, `${ANIMATION} ${TWO_EXITS}`);

      const [first, second] = await nextAnimationsRead(panel, {
        action: () => closeInTimerTask(open),
      });
      const firstEnd = nextEvent(container, 'animationend').then(() => panel.isConnected);
      first!.finish();
      expect(await firstEnd).toBe(true);

      second!.finish();
      await waitFor(() => {
        expect(isGone()).toBe(true);
      });
    });

    it.each<{ name: string; pseudoElement: string | null }>([
      { name: 'a child', pseudoElement: null },
      { name: '::before', pseudoElement: '::before' },
    ])('keeps the panel when an animation of $name ends', async ({ pseudoElement }) => {
      const open = shallowRef(false);
      const { container, panel, isGone } = await renderOpenPanel(
        open,
        `${TRANSITION} ${OTHER_EXITS}`,
      );

      const closed = new Promise<void>((resolve) => {
        new MutationObserver((_, observer) => {
          observer.disconnect();
          resolve();
        }).observe(panel, { attributes: true, attributeFilter: ['data-closed'] });
      });
      const read = nextAnimationsRead(panel, { action: () => closeInTimerTask(open) });
      await closed;
      // The part waits only for the animations of the panel itself. The case ends the other
      // animation before the exit of the panel starts. It reads the animations of the document,
      // because a read on the panel ends the wait of `nextAnimationsRead`.
      const child = panel.querySelector(`.${CHILD}`);
      const other = document.getAnimations().find((animation) => {
        const effect = animation.effect as KeyframeEffect;
        return pseudoElement === null
          ? effect.target === child
          : effect.target === panel && effect.pseudoElement === pseudoElement;
      })!;
      const otherEnd = nextEvent(container, 'animationend').then(() => panel.isConnected);
      other.finish();
      expect(await otherEnd).toBe(true);

      (await read).forEach((animation) => animation.finish());
      await waitFor(() => {
        expect(isGone()).toBe(true);
      });
    });
  });
});
