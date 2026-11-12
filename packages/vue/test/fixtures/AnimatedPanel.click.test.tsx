import { beforeEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { createRenderer } from '#test-utils';
import { countTransitions } from './animatedPanelHarness';

// A real pointer event makes Chromium compute style before the next frame callback. A later test
// in the same file then passes without the layout read of `useTransitionStatus`. This file has the
// rows that click, so no other row follows a real pointer event.
describe('<AnimatedPanel /> opened by a click', () => {
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
      const counts = await countTransitions(render, { keepMounted }, (button) =>
        userEvent.click(button),
      );

      expect(counts).toEqual({ enter: 6, exit: 6 });
    },
    30_000,
  );
});
