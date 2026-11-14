import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { OPEN_DELAY } from '../utils/constants';

vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: true },
    },
  };
});

function TestNavigationMenu() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List data-testid="top-level-list">
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestInlineNestedNavigationMenu() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Root defaultValue="nested-item-1">
              <NavigationMenu.List data-testid="inline-nested-list">
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger data-testid="nested-trigger-1">
                    Nested Item 1
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-1">
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport data-testid="inline-nested-viewport" />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function mockBoundingClientRect(
  element: Element,
  rect: { x: number; y: number; width: number; height: number },
) {
  const domRect = {
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    top: rect.y,
    left: rect.x,
    right: rect.x + rect.width,
    bottom: rect.y + rect.height,
    toJSON: () => ({}),
  } satisfies DOMRect;

  vi.spyOn(element, 'getBoundingClientRect').mockReturnValue(domRect);
}

describe('<NavigationMenu.Root /> (Safari)', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('blocks top-level pointer events for hover-open menus', async () => {
    await render(<TestNavigationMenu />);
    const trigger = screen.getByTestId('trigger-1');

    await fireEvent.mouseEnter(trigger);
    await fireEvent.mouseMove(trigger);
    vi.advanceTimersByTime(OPEN_DELAY);
    await flushMicrotasks();

    const topLevelList = screen.getByTestId('top-level-list');

    expect(screen.queryByTestId('popup-1')).not.toBe(null);
    expect(topLevelList.style.pointerEvents).toBe('none');
    expect(document.body.style.pointerEvents).toBe('');
  });

  it('keeps nested safePolygon pointer events scoped on WebKit', async () => {
    await render(<TestInlineNestedNavigationMenu />);
    const trigger1 = screen.getByTestId('trigger-1');

    await fireEvent.mouseEnter(trigger1);
    await fireEvent.mouseMove(trigger1);
    vi.advanceTimersByTime(OPEN_DELAY);
    await flushMicrotasks();

    const nestedList = screen.getByTestId('inline-nested-list');
    const nestedTrigger1 = screen.getByTestId('nested-trigger-1');
    const nestedViewport = screen.getByTestId('inline-nested-viewport');

    mockBoundingClientRect(nestedTrigger1, { x: 0, y: 40, width: 100, height: 40 });
    mockBoundingClientRect(nestedViewport, { x: 200, y: 0, width: 300, height: 300 });
    await fireEvent.mouseEnter(nestedTrigger1);

    expect(nestedList.style.pointerEvents).toBe('none');
    expect(document.body.style.pointerEvents).toBe('');
  });
});
