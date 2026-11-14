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
  waitFor,
} from '#test-utils';
import type { FrameProbeResult } from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

const TRANSITION = 'collapsible-transition-panel';
const ANIMATION = 'collapsible-animation-panel';
const LONG_EXIT = 'collapsible-long-exit-panel';

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
            {PANEL_CONTENT}
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

          // A busy machine can stall the page for some seconds, so the wait for the end of the exit
          // has no time limit.
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
});
