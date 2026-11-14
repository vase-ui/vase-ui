import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import * as NavigationMenu from '../index.parts';

const useAnchorPositioningSpy = vi.hoisted(() => vi.fn());

vi.mock('../../internals/useAnchorPositioning', async () => {
  const actual = await vi.importActual<typeof import('../../internals/useAnchorPositioning')>(
    '../../internals/useAnchorPositioning',
  );

  return {
    ...actual,
    useAnchorPositioning: ((...args: Parameters<typeof actual.useAnchorPositioning>) => {
      useAnchorPositioningSpy(...args);
      return actual.useAnchorPositioning(...args);
    }) satisfies typeof actual.useAnchorPositioning,
  };
});

describe('<NavigationMenu.Positioner />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    useAnchorPositioningSpy.mockClear();
  });

  // The portal renders the positioner in the flush after the mount.
  describeConformance(<NavigationMenu.Positioner />, () => ({
    refInstanceof: window.HTMLDivElement,
    async render(node) {
      const result = await render(
        <NavigationMenu.Root value="test">
          <NavigationMenu.Portal>{node}</NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('uses the layout viewport', async () => {
    await render(
      <NavigationMenu.Root value="test">
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner />
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );
    await flushMicrotasks();

    expect(useAnchorPositioningSpy.mock.lastCall?.[0].shift).toEqual({
      rootBoundary: 'layoutViewport',
    });
  });

  function renderMenu(rootProps: Record<string, unknown> = {}) {
    return render(
      <NavigationMenu.Root {...rootProps}>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#one">Link of one</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner data-testid="positioner">
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );
  }

  it('positions the popup below the active trigger', async () => {
    await renderMenu();
    const trigger = screen.getByTestId('trigger');

    await fireEvent.click(trigger);
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(positioner).toHaveAttribute('data-align', 'center');
    await waitFor(() => {
      expect(
        Math.round(positioner.getBoundingClientRect().top - trigger.getBoundingClientRect().bottom),
      ).toBe(0);
    });
  });

  it.each([
    { name: 'a root', nested: false, fallbackAxisSide: 'none' },
    { name: 'a nested root', nested: true, fallbackAxisSide: 'end' },
  ])('gives the collision avoidance of $name', async ({ nested, fallbackAxisSide }) => {
    const portal = (
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner />
      </NavigationMenu.Portal>
    );
    await render(
      nested ? (
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Root value="nested">{portal}</NavigationMenu.Root>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport />
        </NavigationMenu.Root>
      ) : (
        <NavigationMenu.Root value="test">{portal}</NavigationMenu.Root>
      ),
    );

    await waitFor(() => {
      expect(useAnchorPositioningSpy).toHaveBeenCalled();
    });
    const collisionAvoidance = useAnchorPositioningSpy.mock.lastCall?.[0].collisionAvoidance;
    expect(collisionAvoidance()).toEqual({ fallbackAxisSide });
  });

  it('has data-instant while the window resizes, and removes it 100 ms later', async () => {
    vi.useFakeTimers();
    try {
      await renderMenu({ defaultValue: 'one' });
      await vi.advanceTimersByTimeAsync(0);
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');
      expect(positioner).not.toHaveAttribute('data-instant');

      window.dispatchEvent(new Event('resize'));
      await flushMicrotasks();
      expect(positioner).toHaveAttribute('data-instant');

      await vi.advanceTimersByTimeAsync(100);
      await flushMicrotasks();
      expect(positioner).not.toHaveAttribute('data-instant');
    } finally {
      vi.useRealTimers();
    }
  });

  it('throws a descriptive error when rendered outside <NavigationMenu.Portal>', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    try {
      await expect(
        render(
          <NavigationMenu.Root value="test">
            <NavigationMenu.Positioner />
          </NavigationMenu.Root>,
        ),
      ).rejects.toThrow(
        'Vase UI: <NavigationMenu.Portal> is missing. The positioner reads from the portal whether the popup stays in the DOM while it is closed. Put <NavigationMenu.Positioner> inside <NavigationMenu.Portal>.',
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
