import { beforeEach, describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import { Accordion } from '@vase-ui/vue/accordion';
import { createRenderer, nextEvent, waitFor } from '#test-utils';

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
        const { container } = await render(() => (
          <>
            <style>{STYLE}</style>
            <Accordion.Root
              value={value.value}
              keepMounted={row.keepMounted}
              hiddenUntilFound={row.hiddenUntilFound}
            >
              {['a', 'b'].map((itemValue) => (
                <Accordion.Item key={itemValue} value={itemValue}>
                  <Accordion.Panel class={TRANSITION} data-testid={`panel-${itemValue}`}>
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

        const runs: string[] = [];
        container.addEventListener('transitionrun', (event) => {
          runs.push((event.target as Element).getAttribute('data-testid')!);
        });

        let from = 'a';
        let to = 'b';
        for (let cycle = 0; cycle < 6; cycle += 1) {
          const started = nextEvent(container, 'transitionrun');
          changeValueInTimerTask(value, [to]);
          await started;

          const closing = from;
          const opening = to;
          await waitFor(
            () => {
              expect(isGone(closing)).toBe(true);
            },
            { timeout: 3000 },
          );
          await waitFor(() => {
            expect(getPanel(opening)!.style.getPropertyValue('--accordion-panel-height')).toBe(
              'auto',
            );
          });
          [from, to] = [to, from];
        }

        // Each panel enters 3 times and exits 3 times.
        expect(runs.filter((run) => run === 'panel-a')).toHaveLength(6);
        expect(runs.filter((run) => run === 'panel-b')).toHaveLength(6);
      },
      30_000,
    );
  });
});
