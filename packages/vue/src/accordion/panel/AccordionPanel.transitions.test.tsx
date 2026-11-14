import { beforeEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import {
  createRenderer,
  createTransitionRunCounter,
  nextAnimationsRead,
  nextEvent,
  waitFor,
  waitSingleFrame,
} from '#test-utils';

const PANEL_CONTENT = 'This is panel content';

const TRANSITION = 'accordion-transition-panel';

const STYLE = `
  .${TRANSITION} {
    overflow: hidden;
    height: var(--accordion-panel-height);
    transition: height 100ms linear;
  }

  .${TRANSITION}[data-starting-style],
  .${TRANSITION}[data-ending-style] {
    height: 0;
  }
`;

interface PanelRow {
  keepMounted?: boolean;
  hiddenUntilFound?: boolean;
}

function changeValueInTimerTask(value: { value: string[] }, next: string[]) {
  setTimeout(() => {
    value.value = next;
  });
}

// A test that counts transitions reads no style and no layout. A read starts the transition that
// the part must start, and the count is then right with a broken part.
describe('<Accordion.Panel /> transitions', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  describe('the count of the transitions', () => {
    it.each<PanelRow & { name: string }>([
      { name: 'unmounted' },
      { name: 'keep-mounted', keepMounted: true },
      { name: 'hiddenUntilFound', hiddenUntilFound: true },
    ])(
      'runs one exit and one enter when the value changes from one item to the other: $name',
      async (row) => {
        const value = shallowRef(['a']);
        const counters = {
          a: createTransitionRunCounter(() => value.value.includes('a')),
          b: createTransitionRunCounter(() => value.value.includes('b')),
        };
        const { container } = await render(() => (
          <>
            <style>{STYLE}</style>
            <Accordion.Root
              value={value.value}
              keepMounted={row.keepMounted}
              hiddenUntilFound={row.hiddenUntilFound}
            >
              {(['a', 'b'] as const).map((itemValue) => (
                <Accordion.Item key={itemValue} value={itemValue}>
                  <Accordion.Panel
                    class={TRANSITION}
                    data-testid={`panel-${itemValue}`}
                    onTransitionrun={counters[itemValue].onTransitionrun}
                  >
                    {PANEL_CONTENT}
                  </Accordion.Panel>
                </Accordion.Item>
              ))}
            </Accordion.Root>
          </>
        ));

        const getPanel = (itemValue: string) =>
          container.querySelector<HTMLElement>(`[data-testid="panel-${itemValue}"]`);
        const isGone = (itemValue: string) => {
          const panel = getPanel(itemValue);
          return panel === null || panel.hasAttribute('hidden');
        };

        // The open panel reads its animations in the frame after the mount. The next read of the
        // panel is then the read of its exit.
        await waitSingleFrame();

        let from = 'a';
        let to = 'b';
        for (let cycle = 0; cycle < 6; cycle += 1) {
          const closing = from;
          const opening = to;
          // The end event of the previous exit can come after the panel is hidden.
          const ended = nextEvent(container, 'transitionend', { after: 'transitionrun' });
          // The browser cancels a finished transition when the panel goes. Its `finished` is then a
          // new promise that never settles, so the case gets each promise at the read.
          const exited = nextAnimationsRead(getPanel(closing)!).then((animations) =>
            Promise.all(animations.map((animation) => animation.finished)),
          );
          changeValueInTimerTask(value, [to]);
          await Promise.all([ended, exited]);
          await waitFor(() => {
            expect(isGone(closing)).toBe(true);
          });
          await waitFor(() => {
            expect(getPanel(opening)!.style.getPropertyValue('--accordion-panel-height')).toBe(
              'auto',
            );
          });
          [from, to] = [to, from];
        }

        // The last exit is the exit of panel b. The browser can send its `transitionrun` after the
        // panel is gone.
        await waitFor(() => {
          expect(counters.b.counts.exit).toBe(3);
        });
        expect(counters.a.counts).toEqual({ enter: 3, exit: 3 });
        expect(counters.b.counts).toEqual({ enter: 3, exit: 3 });
      },
      30_000,
    );
  });
});
