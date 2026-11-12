import { beforeEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, waitFor } from '#test-utils';
import { nextEvent } from '../../../test/fixtures/animatedPanelHarness';

const PANEL_CONTENT = 'This is panel content';

const TRANSITION = 'collapsible-transition-panel';
const ANIMATION = 'collapsible-animation-panel';

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
`;

interface PanelRow {
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
}

interface FrameProbeResult {
  /** The panel was `hidden` or not connected in the callback of the frame. */
  isGone: boolean;
  /** The callback of the frame has the time of the frame in which the animation ended. */
  isSameFrame: boolean;
}

/**
 * Tells if a frame paints between the end of the exit animation and the removal of the panel.
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

function openInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = true;
  });
}

function closeInTimerTask(open: { value: boolean }) {
  setTimeout(() => {
    open.value = false;
  });
}

// A test that counts transitions reads no style and no layout. A read starts the transition that the
// part must start, and the count is then right with a broken part.
describe('<Collapsible.Panel /> transitions', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  async function renderPanel(open: { value: boolean }, className: string, row: PanelRow) {
    const { container } = await render(() => (
      <>
        <style>{STYLE}</style>
        <Collapsible.Root open={open.value}>
          <Collapsible.Panel
            class={className}
            data-testid="panel"
            keepMounted={row.keepMounted}
            hiddenUntilFound={row.hiddenUntilFound}
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
        const { container, getPanel, isGone } = await renderPanel(open, TRANSITION, row);

        const counts = { enter: 0, exit: 0 };
        let phase: keyof typeof counts | undefined;
        container.addEventListener('transitionrun', (event) => {
          if (phase && (event.target as Element).matches('[data-testid="panel"]')) {
            counts[phase] += 1;
          }
        });

        for (let cycle = 0; cycle < 6; cycle += 1) {
          phase = 'enter';
          const started = nextEvent(container, 'transitionrun');
          openInTimerTask(open);
          await started;
          await nextEvent(container, 'transitionend');
          await waitFor(() => {
            expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
          });

          phase = 'exit';
          closeInTimerTask(open);
          await waitFor(
            () => {
              expect(isGone()).toBe(true);
            },
            { timeout: 3000 },
          );
          phase = undefined;
        }

        expect(counts).toEqual({ enter: 6, exit: 6 });
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
      const { container, getPanel, isGone } = await renderPanel(open, className, row);

      // The end event of an exit can come after the removal of the panel. A wait for the start of
      // the next enter cannot take it for the end of that enter.
      const startEvent = className === TRANSITION ? 'transitionrun' : 'animationstart';
      const endEvent = className === TRANSITION ? 'transitionend' : 'animationend';
      const results: FrameProbeResult[] = [];
      for (let cycle = 0; cycle < 3; cycle += 1) {
        const started = nextEvent(container, startEvent);
        openInTimerTask(open);
        await started;
        await nextEvent(container, endEvent);
        await waitFor(() => {
          expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
        });

        const panel = getPanel()!;
        const exitStarted = nextEvent(panel, startEvent);
        closeInTimerTask(open);
        await exitStarted;
        results.push(
          await probeFrameAfterExit(panel, () =>
            row.keepMounted ? panel.hidden === true : !panel.isConnected,
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
