import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { createRenderer, createTransitionRunCounter, nextEvent, waitFor } from '#test-utils';

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
      let isOpen = false;
      const counter = createTransitionRunCounter(() => isOpen);
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

          <Collapsible.Root
            onOpenChange={(open: boolean) => {
              isOpen = open;
            }}
          >
            <Collapsible.Trigger data-testid="trigger">Trigger</Collapsible.Trigger>
            <Collapsible.Panel
              class="click-transition-panel"
              data-testid="panel"
              keepMounted={keepMounted}
              onTransitionrun={counter.onTransitionrun}
            >
              This is panel content
            </Collapsible.Panel>
          </Collapsible.Root>
        </>
      ));

      const trigger = container.querySelector<HTMLButtonElement>('[data-testid="trigger"]')!;
      const getPanel = () => container.querySelector<HTMLElement>('[data-testid="panel"]');

      for (let cycle = 0; cycle < 6; cycle += 1) {
        // The click command can resolve after the transition has ended. The wait starts before the
        // click, so it gets the end event of this transition and no earlier one.
        const entered = nextEvent(container, 'transitionend', { after: 'transitionrun' });
        await Promise.all([userEvent.click(trigger), entered]);
        await waitFor(() => {
          expect(getPanel()!.style.getPropertyValue('--collapsible-panel-height')).toBe('auto');
        });

        await userEvent.click(trigger);
        await waitFor(
          () => {
            const panel = getPanel();
            expect(panel === null || panel.hidden).toBe(true);
          },
          { timeout: 3000 },
        );
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
