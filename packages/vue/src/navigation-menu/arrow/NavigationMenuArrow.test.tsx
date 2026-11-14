import { describe, expect, it, vi } from 'vitest';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

describe('<NavigationMenu.Arrow />', () => {
  const { render } = createRenderer();

  // The portal renders the arrow in the flush after the mount.
  describeConformance(<NavigationMenu.Arrow />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>{node}</NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('is hidden from assistive technology and has the state attributes of the open popup', async () => {
    await render(
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Arrow data-testid="arrow" />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );
    await flushMicrotasks();

    const arrow = screen.getByTestId('arrow');
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
    expect(arrow).toHaveAttribute('data-open');
    expect(arrow).toHaveAttribute('data-side', 'bottom');
    expect(arrow).toHaveAttribute('data-align', 'center');
  });

  it('throws a descriptive error when rendered outside <NavigationMenu.Positioner>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        render(
          <NavigationMenu.Root>
            <NavigationMenu.Arrow />
          </NavigationMenu.Root>,
        ),
      ).rejects.toThrow(
        'Vase UI: <NavigationMenu.Positioner> is missing. The popup and the arrow read their side and their alignment from the positioner. Put the part inside <NavigationMenu.Positioner>.',
      );
    } finally {
      errorSpy.mockRestore();
    }

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
