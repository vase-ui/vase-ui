import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, waitFor } from '#test-utils';
import { nextEvent } from '../../../test/fixtures/animatedPanelHarness';

// A real pointer event makes Chromium compute style before the next frame callback. A later case
// in the same file then passes without the layout read of the panel. This file has the cases that
// click, so no other case follows a real pointer event.
describe('<Collapsible.Panel /> opened by a click', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
  });

  it.each([
    { name: 'unmounted', keepMounted: false },
    { name: 'keep-mounted', keepMounted: true },
  ])(
    'runs one transition for each enter and each exit: $name',
    async ({ keepMounted }) => {
      const { container } = await render(() => (
        <>
          <style>{`
            .click-transition-panel {
              overflow: hidden;
              height: var(--collapsible-panel-height);
              transition: height 100ms linear;
            }

            .click-transition-panel[data-starting-style],
            .click-transition-panel[data-ending-style] {
              height: 0;
            }
          `}</style>

          <Collapsible.Root>
            <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="click-transition-panel"
              data-testid="panel"
              keepMounted={keepMounted}
            >
              This is panel content
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = container.querySelector<HTMLButtonElement>('[data-testid="trigger"]')!;
      const getPanel = () => container.querySelector<HTMLElement>('[data-testid="panel"]');

      const counts = { enter: 0, exit: 0 };
      let phase: keyof typeof counts | undefined;
      container.addEventListener('transitionrun', (event) => {
        if (phase && (event.target as Element).matches('[data-testid="panel"]')) {
          counts[phase] += 1;
        }
      });

      for (let cycle = 0; cycle < 6; cycle += 1) {
        phase = 'enter';
        // The click command can resolve after the transition has ended. The wait for the end event
        // starts in the task of the start event, so the end event cannot come before the wait.
        const entered = nextEvent(container, 'transitionrun').then(() =>
          nextEvent(container, 'transitionend'),
        );
        await Promise.all([userEvent.click(trigger), entered]);
        await waitFor(() => {
          expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
        });

        phase = 'exit';
        await userEvent.click(trigger);
        await waitFor(
          () => {
            const panel = getPanel();
            expect(panel === null || panel.hidden).toBe(true);
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
