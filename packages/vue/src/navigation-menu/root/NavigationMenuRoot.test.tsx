import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
import type { HTMLProps } from '@vase-ui/vue/types';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import * as NavigationMenu from '../index.parts';
import { OPEN_DELAY } from '../utils/constants';
import NavigationMenuRootHydration from './NavigationMenuRootHydration.test.vue';
import { useNavigationMenuRootContext } from './NavigationMenuRootContext';

const HYDRATION_FIXTURE = 'src/navigation-menu/root/NavigationMenuRootHydration.test.vue';

type RootInstance = NavigationMenu.Root.Actions & { element: HTMLElement | null };

type FalsyNavigationMenuValue = 0 | '' | false;

const falsyNavigationMenuValueCases = [
  ['0', 0],
  ['empty string', ''],
  ['false', false],
] as const satisfies ReadonlyArray<[string, FalsyNavigationMenuValue]>;

type TestNavigationMenuProps = NavigationMenu.Root.Props & {
  keepMountedPortal?: boolean;
  rootRef?: (instance: RootInstance | null) => void;
  onValueChange?: (value: any, eventDetails: NavigationMenu.Root.ChangeEventDetails) => void;
  onOpenChangeComplete?: (open: boolean) => void;
};

function TestNavigationMenu(props: TestNavigationMenuProps) {
  const { keepMountedPortal = false, rootRef, ...rootProps } = props;

  return (
    <NavigationMenu.Root
      ref={(instance) => rootRef?.(instance as unknown as RootInstance | null)}
      {...rootProps}
    >
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
            <NavigationMenu.Link href="#link-4">Link 4</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal keepMounted={keepMountedPortal}>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup data-testid="popup-root">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

function TestNavigationMenuWithTopLevelLink(props: NavigationMenu.Root.Props = {}) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-2">Link 2</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item>
          <NavigationMenu.Link href="#top-level-link" data-testid="top-level-link">
            Top level link
          </NavigationMenu.Link>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="top-level-positioner">
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

type TestNavigationMenuWithDisabledTriggerProps = NavigationMenu.Root.Props & {
  onValueChange?: (value: any, eventDetails: NavigationMenu.Root.ChangeEventDetails) => void;
};

function TestNavigationMenuWithDisabledTrigger(
  props: TestNavigationMenuWithDisabledTriggerProps = {},
) {
  return (
    <NavigationMenu.Root {...props}>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1" disabled>
            Item 1
          </NavigationMenu.Trigger>
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

function TestNavigationMenuOrientationAttributes() {
  return (
    <NavigationMenu.Root data-testid="top-level-root" defaultValue="item-1" orientation="vertical">
      <NavigationMenu.List data-testid="top-level-list">
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger>Item 1</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Root
              data-testid="nested-root"
              defaultValue="nested-item-1"
              orientation="vertical"
            >
              <NavigationMenu.List data-testid="nested-list">
                <NavigationMenu.Item value="nested-item-1">
                  <NavigationMenu.Trigger>Nested Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#nested-link-1">Nested Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport />
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

function TestInlineNestedNavigationMenu() {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="item-1">
          <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>

          <NavigationMenu.Content data-testid="popup-1">
            <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
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
                <NavigationMenu.Item value="nested-item-2">
                  <NavigationMenu.Trigger data-testid="nested-trigger-2">
                    Nested Item 2
                  </NavigationMenu.Trigger>
                  <NavigationMenu.Content data-testid="nested-popup-2">
                    <NavigationMenu.Link href="#nested-link-2">Nested Link 2</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>

              <NavigationMenu.Viewport data-testid="inline-nested-viewport" />
            </NavigationMenu.Root>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="item-2">
          <NavigationMenu.Trigger data-testid="trigger-2">Item 2</NavigationMenu.Trigger>
          <NavigationMenu.Content data-testid="popup-2">
            <NavigationMenu.Link href="#link-3">Link 3</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>

      <NavigationMenu.Portal>
        <NavigationMenu.Positioner data-testid="positioner">
          <NavigationMenu.Popup data-testid="popup-root">
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
  };

  Object.defineProperty(element, 'getBoundingClientRect', {
    configurable: true,
    value: () => domRect,
  });
}

function mockAnimations(element: HTMLElement) {
  type MockAnimation = {
    finished: Promise<void>;
    resolveFinished: (() => void) | null;
  };

  function createAnimation(): MockAnimation {
    let resolveFinished: (() => void) | null = null;

    return {
      finished: new Promise<void>((resolve) => {
        resolveFinished = resolve;
      }),
      resolveFinished,
    };
  }

  let currentAnimation = createAnimation();
  let activeAnimations: MockAnimation[] = [];

  Object.defineProperty(element, 'getAnimations', {
    configurable: true,
    value: () =>
      activeAnimations.map((animation) => ({
        finished: animation.finished,
      })),
  });

  return {
    start() {
      currentAnimation = createAnimation();
      activeAnimations.push(currentAnimation);
      return currentAnimation;
    },
    finish(animation: MockAnimation = currentAnimation) {
      const finished = animation.finished;
      animation.resolveFinished?.();
      animation.resolveFinished = null;
      activeAnimations = activeAnimations.filter((item) => item !== animation);
      return finished;
    },
  };
}

// The root waits for the animations of its popup element before it unmounts the popup. This
// component gives the root an element to wait for.
const PopupElement = defineComponent(() => {
  const { popupElement } = useNavigationMenuRootContext();

  return () => (
    <div
      data-testid="popup"
      ref={(element) => {
        popupElement.value = element as HTMLElement | null;
      }}
    />
  );
});

describe('<NavigationMenu.Root />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describeConformance(<NavigationMenu.Root />, () => ({
    refInstanceof: window.HTMLElement,
    render(node) {
      return render(node);
    },
  }));

  it('does not apply aria-orientation to the top-level list or root element', async () => {
    await render(<TestNavigationMenuOrientationAttributes />);

    expect(screen.getByTestId('top-level-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('top-level-list')).not.toHaveAttribute('aria-orientation');
  });

  it('does not apply aria-orientation to nested lists or root elements', async () => {
    await render(<TestNavigationMenuOrientationAttributes />);

    expect(screen.getByTestId('nested-root')).not.toHaveAttribute('aria-orientation');
    expect(screen.getByTestId('nested-list')).not.toHaveAttribute('aria-orientation');
  });

  describe('interactions', () => {
    it('opens on hover with mouse input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('blocks pointer events on the list while traversing from a top-level trigger to the popup', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const siblingTrigger = screen.getByTestId('trigger-2');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(siblingTrigger).pointerEvents).toBe('none');

      await fireEvent.mouseEnter(screen.getByTestId('top-level-positioner'));
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it('reapplies top-level safePolygon pointer events after returning from the popup and switching triggers', async () => {
      await render(<TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      const positioner = screen.getByTestId('top-level-positioner');

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      await fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      await fireEvent.mouseLeave(positioner, { relatedTarget: trigger1 });
      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');

      await fireEvent.mouseEnter(positioner);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('');

      await fireEvent.mouseLeave(positioner, { relatedTarget: trigger2 });
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('keeps top-level safePolygon pointer events active when switching directly to a different trigger', async () => {
      await render(<TestNavigationMenuWithTopLevelLink />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');
      const topLevelLink = screen.getByTestId('top-level-link');
      const topLevelList = trigger1.closest('ul') as HTMLElement;

      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');
      expect(document.body.style.pointerEvents).toBe('');
      expect(getComputedStyle(trigger1).pointerEvents).toBe('none');
      expect(getComputedStyle(topLevelLink).pointerEvents).toBe('none');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
    });

    it('clears top-level safePolygon pointer events on trigger pointerdown', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');
      const topLevelList = trigger.closest('ul') as HTMLElement;

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(topLevelList.style.pointerEvents).toBe('none');

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });

      expect(topLevelList.style.pointerEvents).toBe('');
    });

    it('scopes safePolygon pointer events to the document for a custom list element', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => (
                <div {...props} data-testid="custom-list">
                  <NavigationMenu.Item value="item">
                    <NavigationMenu.Trigger>Trigger 1</NavigationMenu.Trigger>
                    <NavigationMenu.Content>Content 1</NavigationMenu.Content>
                  </NavigationMenu.Item>
                  <NavigationMenu.Item value="item-2">
                    <NavigationMenu.Trigger>Trigger 2</NavigationMenu.Trigger>
                    <NavigationMenu.Content>Content 2</NavigationMenu.Content>
                  </NavigationMenu.Item>
                </div>
              ),
            }}
          />
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      const trigger = screen.getByText('Trigger 1');
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(document.body.style.pointerEvents).toBe('none');
      expect(screen.getByTestId('custom-list').style.pointerEvents).toBe('');

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
      expect(document.body.style.pointerEvents).toBe('');

      const secondTrigger = screen.getByText('Trigger 2');
      await fireEvent.mouseEnter(secondTrigger);
      await flushMicrotasks();

      expect(secondTrigger).toHaveAttribute('aria-expanded', 'true');
      expect(document.body.style.pointerEvents).toBe('none');

      await fireEvent.pointerDown(secondTrigger, { pointerType: 'mouse' });
      expect(document.body.style.pointerEvents).toBe('');
    });

    it.skipIf(isJSDOM)(
      'blocks pointer events on sibling top-level triggers when opened through real hover',
      async () => {
        const { user } = await render(<TestNavigationMenu />);
        const trigger = screen.getByTestId('trigger-1');
        const siblingTrigger = screen.getByTestId('trigger-2');
        const topLevelList = trigger.closest('ul') as HTMLElement;

        await user.hover(trigger);

        await waitFor(() => {
          expect(topLevelList.style.pointerEvents).toBe('none');
        });

        expect(getComputedStyle(siblingTrigger).pointerEvents).toBe('none');
      },
    );

    it('opens on click with mouse input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not open on hover with touch input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      ['horizontal', 'right', 'left'],
      ['vertical', 'down', 'up'],
    ] as const)(
      'reports %s activation direction when switching in either direction',
      async (orientation, forwardDirection, backwardDirection) => {
        await render(<TestNavigationMenu orientation={orientation} />);
        const trigger1 = screen.getByTestId('trigger-1');
        const trigger2 = screen.getByTestId('trigger-2');

        if (orientation === 'horizontal') {
          mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
          mockBoundingClientRect(trigger2, { x: 120, y: 0, width: 80, height: 32 });
        } else {
          mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
          mockBoundingClientRect(trigger2, { x: 0, y: 80, width: 80, height: 32 });
        }

        await fireEvent.click(trigger1);
        await flushMicrotasks();

        await fireEvent.click(trigger2);
        await flushMicrotasks();

        expect(screen.getByTestId('popup-2')).toHaveAttribute(
          'data-activation-direction',
          forwardDirection,
        );

        await fireEvent.click(trigger1);
        await flushMicrotasks();

        expect(screen.getByTestId('popup-1')).toHaveAttribute(
          'data-activation-direction',
          backwardDirection,
        );
      },
    );

    it('opens on click with touch input', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it.skipIf(isJSDOM)('restores hover open after a touch click closes outside', async () => {
      const { user } = await render(
        <div>
          <TestNavigationMenu />
          <button data-testid="outside" />
        </div>,
      );
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await fireEvent.pointerEnter(trigger1, { pointerType: 'touch' });
      await fireEvent.pointerDown(trigger1, { pointerType: 'touch' });
      await fireEvent.pointerUp(trigger1, { pointerType: 'touch' });
      await fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      await user.click(screen.getByTestId('outside'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).not.toBe(null);
      });
    });

    it.skipIf(isJSDOM)(
      'restores hover open after touching a nested submenu trigger and closing outside',
      async () => {
        const { user } = await render(
          <div>
            <TestInlineNestedNavigationMenu />
            <button data-testid="outside" />
          </div>,
        );
        const trigger = screen.getByTestId('trigger-1');

        await fireEvent.pointerEnter(trigger, { pointerType: 'touch' });
        await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
        await fireEvent.pointerUp(trigger, { pointerType: 'touch' });
        await fireEvent.click(trigger);
        await flushMicrotasks();
        // The click mounted the nested trigger in this millisecond of the fake clock.
        await waitForLaterMillisecond();

        const nestedTrigger2 = screen.getByTestId('nested-trigger-2');
        await fireEvent.pointerEnter(nestedTrigger2, { pointerType: 'touch' });
        await fireEvent.pointerDown(nestedTrigger2, { pointerType: 'touch' });
        await fireEvent.pointerUp(nestedTrigger2, { pointerType: 'touch' });
        await fireEvent.click(nestedTrigger2);
        await flushMicrotasks();

        expect(screen.queryByTestId('nested-popup-2')).not.toBe(null);

        await user.click(screen.getByTestId('outside'));
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-1')).toBe(null);

        await user.hover(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('popup-1')).not.toBe(null);
        });
      },
    );

    it('restores hover open after a quick click then trigger switch', async () => {
      const { user } = await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      await user.click(trigger1);
      await flushMicrotasks();

      await user.hover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).not.toBe(null);
      });

      await user.unhover(trigger2);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-2')).toBe(null);
      });

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });
    });

    it('closes after pointerdown on a link in a hover-open popup when pointer leaves', async () => {
      const { user } = await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');

      await user.hover(trigger1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).not.toBe(null);
      });

      const popup1 = screen.getByTestId('popup-1');
      const link1 = within(popup1).getByText('Link 1');

      await user.hover(link1);
      await fireEvent.pointerDown(link1, { pointerType: 'mouse' });
      await user.unhover(link1);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
    });

    it('does not close menu when clicking a different trigger with mouse', async () => {
      await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not close menu when clicking a different trigger on touch', async () => {
      await render(<TestNavigationMenu />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.pointerDown(trigger2, { pointerType: 'touch' });
      await fireEvent.pointerUp(trigger2, { pointerType: 'touch' });
      await fireEvent.click(trigger2);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-2')).not.toBe(null);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns focus to trigger when closing menu', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      const link = screen.getByRole('link', { name: 'Link 1' });
      link.focus();
      await flushMicrotasks();
      expect(link).toHaveFocus();

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(trigger).toHaveFocus();
    });

    it('respects focus outside when clicking menu', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      await user.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.click(screen.getByTestId('last'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(last).toHaveFocus();
    });

    it('does not restore focus to the trigger when closed via hover', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);

      const popup = await screen.findByTestId('popup-1');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.mouseLeave(trigger);
      await fireEvent.mouseLeave(popup);
      vi.advanceTimersByTime(50);

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveFocus();
    });

    it('does not restore focus to the trigger when focus moves outside', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');
      const last = screen.getByTestId('last');

      trigger.focus();
      await flushMicrotasks();

      await user.click(trigger);
      await user.tab();
      await user.tab();
      await user.tab();
      await user.tab();

      await waitFor(() => {
        expect(screen.queryByTestId('popup-1')).toBe(null);
      });
      expect(last).toHaveFocus();
      expect(trigger).not.toHaveFocus();
    });
  });

  describe('patient click threshold', () => {
    it('stays open if hovered then clicked within the patient threshold', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('closes if hovered then clicked after the patient threshold', async () => {
      await render(<TestNavigationMenu />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD);

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: defaultValue', () => {
    it('should respect defaultValue', async () => {
      await render(<TestNavigationMenu defaultValue="item-1" />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('disables popup and arrow transitions while a kept portal opens', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item-1">
              <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal keepMounted>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup data-testid="popup-root">
                <NavigationMenu.Arrow data-testid="arrow" />
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      await fireEvent.click(screen.getByTestId('trigger-1'));

      expect(screen.getByTestId('popup-root')).toHaveStyle({
        transition: 'none',
      });
      expect(screen.getByTestId('arrow')).toHaveStyle({
        transition: 'none',
      });

      await waitFor(() => {
        expect(screen.getByTestId('popup-root')).not.toHaveStyle({
          transition: 'none',
        });
      });
      expect(screen.getByTestId('arrow')).not.toHaveStyle({
        transition: 'none',
      });
    });
  });

  describe('prop: onValueChange', () => {
    it('should call onValueChange when value changes', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await fireEvent.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      await fireEvent.click(trigger2);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(2);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-2');
    });

    it('does not open when onValueChange cancels the interaction', async () => {
      const onValueChange = vi.fn(
        (_nextValue: unknown, eventDetails: NavigationMenu.Root.ChangeEventDetails) => {
          eventDetails.cancel();
        },
      );
      await render(<TestNavigationMenu onValueChange={onValueChange} />);

      await fireEvent.click(screen.getByTestId('trigger-1'));
      await flushMicrotasks();

      expect(onValueChange.mock.calls.length).toBe(1);
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
    });

    it('does not emit a duplicate onValueChange when switching items via keyboard', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(<TestNavigationMenu onValueChange={onValueChange} />);
      const trigger1 = screen.getByTestId('trigger-1');
      const trigger2 = screen.getByTestId('trigger-2');

      await user.click(trigger1);
      await flushMicrotasks();
      expect(onValueChange.mock.calls.length).toBe(1);
      expect(onValueChange.mock.lastCall?.[0]).toBe('item-1');

      trigger1.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');
      await flushMicrotasks();
      expect(trigger2).toHaveFocus();
      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(0);

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(onValueChange.mock.calls.filter((call) => call[0] === 'item-2')).toHaveLength(1);
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    it.each(falsyNavigationMenuValueCases)(
      'treats a falsy item value (%s) as a valid open value',
      async (_label, itemValue) => {
        const onValueChange = vi.fn();
        await render(
          <NavigationMenu.Root<FalsyNavigationMenuValue> onValueChange={onValueChange}>
            <NavigationMenu.List>
              <NavigationMenu.Item value={itemValue}>
                <NavigationMenu.Trigger data-testid="trigger-0">Zero</NavigationMenu.Trigger>
                <NavigationMenu.Content data-testid="popup-0">
                  <NavigationMenu.Link href="#link-0">Zero link</NavigationMenu.Link>
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
          </NavigationMenu.Root>,
        );

        const trigger = screen.getByTestId('trigger-0');

        await fireEvent.click(trigger);
        await flushMicrotasks();

        expect(onValueChange.mock.calls.length).toBe(1);
        expect(onValueChange.mock.lastCall?.[0]).toBe(itemValue);
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(screen.queryByTestId('popup-0')).not.toBe(null);
      },
    );

    it('should be controlled by value prop', async () => {
      const { setProps } = await render(<TestNavigationMenu value="item-1" />);

      let trigger1 = screen.getByTestId('trigger-1');
      await fireEvent.mouseEnter(trigger1);
      await fireEvent.mouseMove(trigger1);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();
      expect(trigger1).toHaveAttribute('aria-expanded', 'true');

      await setProps({ value: 'item-2' });

      const trigger2 = screen.getByTestId('trigger-2');
      await fireEvent.mouseLeave(trigger1);
      await fireEvent.mouseEnter(trigger2);
      await fireEvent.mouseMove(trigger2);
      await flushMicrotasks();

      trigger1 = screen.getByTestId('trigger-1');
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      expect(trigger2).toHaveAttribute('aria-expanded', 'true');
    });

    async function expectPopupSizePreservedWhenControlledValueClosesExternally(
      keepMountedPortal = false,
    ) {
      const previousAnimationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      const originalOffsetWidth = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetWidth',
      );
      const originalOffsetHeight = Object.getOwnPropertyDescriptor(
        HTMLElement.prototype,
        'offsetHeight',
      );
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      try {
        function isPopupOpen() {
          return screen.queryByTestId('popup-1')?.hasAttribute('data-open') ?? false;
        }

        Object.defineProperty(HTMLElement.prototype, 'offsetWidth', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 675 : 0;
            }

            return originalOffsetWidth?.get?.call(this) ?? 0;
          },
        });
        Object.defineProperty(HTMLElement.prototype, 'offsetHeight', {
          configurable: true,
          get() {
            if (this.getAttribute('data-testid') === 'popup-root') {
              return isPopupOpen() ? 220 : 0;
            }

            return originalOffsetHeight?.get?.call(this) ?? 0;
          },
        });

        function ControlledNavigationMenu(props: { value: string | null }) {
          return <TestNavigationMenu value={props.value} keepMountedPortal={keepMountedPortal} />;
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const positioner = screen.getByTestId('top-level-positioner');
        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);

        animations.start();
        await rerender(<ControlledNavigationMenu value={null} />);
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');
        expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('675px');
        expect(popupRoot.style.getPropertyValue('--popup-height')).toBe('220px');
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('675px');
        expect(positioner.style.getPropertyValue('--positioner-height')).toBe('220px');

        animations.finish();
        await flushMicrotasks();
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
        if (originalOffsetWidth) {
          Object.defineProperty(HTMLElement.prototype, 'offsetWidth', originalOffsetWidth);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetWidth');
        }
        if (originalOffsetHeight) {
          Object.defineProperty(HTMLElement.prototype, 'offsetHeight', originalOffsetHeight);
        } else {
          Reflect.deleteProperty(HTMLElement.prototype, 'offsetHeight');
        }
      }
    }

    it('preserves popup size when controlled value closes externally', async () => {
      await expectPopupSizePreservedWhenControlledValueClosesExternally();
    });

    it('preserves popup size when controlled value closes externally with keepMounted portal', async () => {
      await expectPopupSizePreservedWhenControlledValueClosesExternally(true);
    });

    it('clears activation direction when controlled value closes externally after switching triggers', async () => {
      const previousAnimationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      try {
        function ControlledNavigationMenu(props: { value: string | null }) {
          return <TestNavigationMenu value={props.value} />;
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const trigger1 = screen.getByTestId('trigger-1');
        const trigger2 = screen.getByTestId('trigger-2');

        mockBoundingClientRect(trigger1, { x: 0, y: 0, width: 80, height: 32 });
        mockBoundingClientRect(trigger2, { x: 120, y: 0, width: 80, height: 32 });

        await fireEvent.click(trigger2);
        await rerender(<ControlledNavigationMenu value="item-2" />);

        expect(screen.getByTestId('popup-2')).toHaveAttribute('data-activation-direction', 'right');

        const exitingContent = screen.getByTestId('popup-2');
        const animations = mockAnimations(exitingContent);

        animations.start();
        await rerender(<ControlledNavigationMenu value={null} />);

        expect(exitingContent).toHaveAttribute('data-ending-style');
        expect(exitingContent).not.toHaveAttribute('data-activation-direction');

        animations.finish();
        await flushMicrotasks();
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: delay', () => {
    it('respects custom delay value', async () => {
      const customDelay = 100;
      await render(<TestNavigationMenu delay={customDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(customDelay - 25);
      await flushMicrotasks();

      // Menu shouldn't be open yet since we're before the delay
      expect(screen.queryByTestId('popup-1')).toBe(null);

      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });
  });

  describe('prop: closeDelay', () => {
    it('respects custom closeDelay value', async () => {
      const customCloseDelay = 100;
      await render(<TestNavigationMenu closeDelay={customCloseDelay} />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      await fireEvent.mouseLeave(trigger);
      vi.advanceTimersByTime(customCloseDelay - 25);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).not.toBe(null);

      // Complete the closeDelay
      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('prop: disabled', () => {
    it('does not open on hover when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(OPEN_DELAY);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on click when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open on touch when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      await render(<TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />);
      const trigger = screen.getByTestId('trigger-1');

      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await fireEvent.pointerUp(trigger, { pointerType: 'touch' });
      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });

    it('does not open via keyboard when the trigger is disabled', async () => {
      const onValueChange = vi.fn();
      const { user } = await render(
        <TestNavigationMenuWithDisabledTrigger onValueChange={onValueChange} />,
      );
      const trigger = screen.getByTestId('trigger-1');

      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-1')).toBe(null);
      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('prop: actionsRef', () => {
    it('automatically unmounts with an actions ref and completes closing once', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();

      function ControlledNavigationMenu(props: { value: string | null }) {
        return (
          <TestNavigationMenu
            value={props.value}
            rootRef={(instance) => {
              actionsRef.value = instance;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          />
        );
      }

      const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

      expect(actionsRef.value?.unmount).toBeTypeOf('function');
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await rerender(<ControlledNavigationMenu value={null} />);
      await waitFor(() => {
        expect(screen.queryByTestId('popup-root')).toBe(null);
      });
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

      // Calling the action after the automatic unmount must not repeat the completion.
      actionsRef.value?.unmount();
      await flushMicrotasks();
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('keeps the popup mounted until the unmount action completes closing', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();

      function ControlledNavigationMenu(props: { value: string | null }) {
        return (
          <TestNavigationMenu
            value={props.value}
            rootRef={(instance) => {
              actionsRef.value = instance;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
            onValueChange={(value, details) => {
              if (value == null) {
                details.preventUnmountOnClose();
              }
            }}
          />
        );
      }

      const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      // The controlled close never runs `onValueChange`, so it doesn't opt out on its own.
      actionsRef.value?.close();
      await flushMicrotasks();
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await rerender(<ControlledNavigationMenu value={null} />);
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.value?.unmount();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('closes through the `close` action so `onValueChange` can opt out', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onValueChange = vi.fn();

      await render(
        <TestNavigationMenu
          defaultValue="item-1"
          rootRef={(instance) => {
            actionsRef.value = instance;
          }}
          onValueChange={onValueChange}
        />,
      );
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'true');

      actionsRef.value?.close();
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe(null);
      expect(onValueChange.mock.calls[0][1].reason).toBe('imperative-action');
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the opt-out when the `close` action is called again while closed', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();

      await render(
        <TestNavigationMenu
          defaultValue="item-1"
          rootRef={(instance) => {
            actionsRef.value = instance;
          }}
          onOpenChangeComplete={onOpenChangeComplete}
          onValueChange={(value, details) => {
            if (value == null) {
              details.preventUnmountOnClose();
            }
          }}
        />,
      );

      actionsRef.value?.close();
      await flushMicrotasks();
      actionsRef.value?.close();
      await flushMicrotasks();
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.value?.unmount();
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('keeps the opt-out when focus leaves the trigger during a manual exit', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();

      const { user } = await render(
        <div>
          <TestNavigationMenu
            defaultValue="item-1"
            rootRef={(instance) => {
              actionsRef.value = instance;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
            onValueChange={(value, details) => {
              if (value == null) {
                details.preventUnmountOnClose();
              }
            }}
          />
          <button data-testid="outside">Outside</button>
        </div>,
      );

      const trigger = screen.getByTestId('trigger-1');
      trigger.focus();
      await flushMicrotasks();
      actionsRef.value?.close();
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      // The trigger's blur requests another close while the popup is still exiting.
      await user.click(screen.getByTestId('outside'));
      await flushMicrotasks();

      expect(screen.queryByTestId('popup-root')).not.toBe(null);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      actionsRef.value?.unmount();
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).toBe(null);
      expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
    });

    it('ignores `unmount` while the popup is open', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();
      await render(
        <TestNavigationMenu
          defaultValue="item-1"
          rootRef={(instance) => {
            actionsRef.value = instance;
          }}
          onOpenChangeComplete={onOpenChangeComplete}
        />,
      );
      const popup = screen.getByTestId('popup-root');

      actionsRef.value?.unmount();
      await flushMicrotasks();

      expect(screen.getByTestId('popup-root')).toBe(popup);
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      expect(screen.getByTestId('trigger-1')).toHaveAttribute('aria-expanded', 'true');
    });

    it('still unmounts on a later close after `unmount` was called while open', async () => {
      const actionsRef = shallowRef<RootInstance | null>(null);
      const onOpenChangeComplete = vi.fn();

      function ControlledNavigationMenu(props: { value: string | null }) {
        return (
          <TestNavigationMenu
            value={props.value}
            rootRef={(instance) => {
              actionsRef.value = instance;
            }}
            onOpenChangeComplete={onOpenChangeComplete}
          />
        );
      }

      const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

      // A stale exit-animation callback can call `unmount()` after a quick reopen.
      actionsRef.value?.unmount();
      await flushMicrotasks();
      expect(screen.queryByTestId('popup-root')).not.toBe(null);

      await rerender(<ControlledNavigationMenu value={null} />);
      await waitFor(() => {
        expect(screen.queryByTestId('popup-root')).toBe(null);
      });
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });

    it('unmounts immediately when called while the popup is closing', async () => {
      const previousAnimationsDisabled = globalThis.VASE_UI_ANIMATIONS_DISABLED;
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

      try {
        const actionsRef = shallowRef<RootInstance | null>(null);

        function ControlledNavigationMenu(props: { value: string | null }) {
          return (
            <TestNavigationMenu
              value={props.value}
              rootRef={(instance) => {
                actionsRef.value = instance;
              }}
              onValueChange={(value, details) => {
                if (value == null) {
                  details.preventUnmountOnClose();
                }
              }}
            />
          );
        }

        const { rerender } = await render(<ControlledNavigationMenu value="item-1" />);

        const popupRoot = screen.getByTestId('popup-root');
        const animations = mockAnimations(popupRoot);
        const closingAnimation = animations.start();

        await rerender(<ControlledNavigationMenu value={null} />);
        await flushMicrotasks();

        expect(popupRoot).toHaveAttribute('data-ending-style');

        actionsRef.value?.unmount();
        await flushMicrotasks();
        await flushMicrotasks();

        expect(screen.queryByTestId('popup-root')).toBe(null);

        animations.finish(closingAnimation);
        await flushMicrotasks();
      } finally {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = previousAnimationsDisabled;
      }
    });
  });

  describe('prop: side', () => {
    it.each([
      ['left in LTR', 'ltr', 'left'],
      ['inline-start in LTR', 'ltr', 'inline-start'],
      ['inline-end in RTL', 'rtl', 'inline-end'],
    ] as const)(
      'pins the popup to the right edge when side is %s so it grows leftward',
      async (_label, direction, side) => {
        await render(
          <DirectionProvider direction={direction as TextDirection}>
            <NavigationMenu.Root>
              <NavigationMenu.List>
                <NavigationMenu.Item value="item-1">
                  <NavigationMenu.Trigger data-testid="trigger-1">Item 1</NavigationMenu.Trigger>
                  <NavigationMenu.Content>
                    <NavigationMenu.Link href="#link-1">Link 1</NavigationMenu.Link>
                  </NavigationMenu.Content>
                </NavigationMenu.Item>
              </NavigationMenu.List>
              <NavigationMenu.Portal>
                <NavigationMenu.Positioner side={side}>
                  <NavigationMenu.Popup data-testid="popup-root">
                    <NavigationMenu.Viewport />
                  </NavigationMenu.Popup>
                </NavigationMenu.Positioner>
              </NavigationMenu.Portal>
            </NavigationMenu.Root>
          </DirectionProvider>,
        );

        const trigger = screen.getByTestId('trigger-1');
        await fireEvent.click(trigger);
        await flushMicrotasks();

        const popup = screen.getByTestId('popup-root');
        expect(popup).toHaveAttribute('data-side', side);
        expect(popup).toHaveStyle({ position: 'absolute', top: '0px', right: '0px' });
      },
    );
  });

  describe('tabbing', () => {
    it('moves focus through the menu correctly', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>,
      );
      const trigger1 = screen.getByTestId('trigger-1');

      trigger1.focus();
      await flushMicrotasks();

      await fireEvent.click(trigger1);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger1).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      await fireEvent.click(screen.getByTestId('trigger-2'));
      await flushMicrotasks();

      expect(screen.getByTestId('popup-2')).not.toBe(null);

      await user.tab();
      expect(screen.getByText('Link 3')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 4')).toHaveFocus();

      await user.tab({ shift: true });
      await user.tab({ shift: true });
      await user.tab({ shift: true });

      expect(trigger1).toHaveFocus();
    });

    it('closes the menu when tabbing forward out', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      trigger.focus();
      await flushMicrotasks();
      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab(); // Link 1
      await user.tab(); // Link 2
      await user.tab(); // trigger 2
      await user.tab(); // last

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });

    it('closes after tabbing out of arbitrary tabbable content', async () => {
      const { user } = await render(
        <div>
          <NavigationMenu.Root>
            <NavigationMenu.List>
              <NavigationMenu.Item value="item">
                <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
                <NavigationMenu.Content>
                  <button>Action</button>
                </NavigationMenu.Content>
              </NavigationMenu.Item>
            </NavigationMenu.List>
            <NavigationMenu.Portal>
              <NavigationMenu.Positioner>
                <NavigationMenu.Popup data-testid="popup">
                  <NavigationMenu.Viewport />
                </NavigationMenu.Popup>
              </NavigationMenu.Positioner>
            </NavigationMenu.Portal>
          </NavigationMenu.Root>
          <button>After menu</button>
        </div>,
      );

      const trigger = screen.getByText('Trigger');
      trigger.focus();
      await flushMicrotasks();
      await fireEvent.click(trigger);
      await flushMicrotasks();

      await user.tab();
      expect(screen.getByText('Action')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('After menu')).toHaveFocus();
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('returns focus to the trigger when no viewport focus guard is rendered', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="item">
              <NavigationMenu.Trigger>Trigger</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>Popup</NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      const trigger = screen.getByText('Trigger');
      trigger.focus();
      await flushMicrotasks();
      await fireEvent.click(trigger);
      await flushMicrotasks();

      const guards = trigger.parentElement?.querySelectorAll('[data-vase-ui-focus-guard]');
      const afterTriggerGuard = guards?.[1] as HTMLElement;
      afterTriggerGuard.focus();
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('returns to the last submenu item when shift+tabbing after tabbing out of it', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
          <button data-testid="last" />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      trigger.focus();
      await flushMicrotasks();
      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 2')).toHaveFocus();

      await user.tab();
      expect(screen.getByTestId('trigger-2')).toHaveFocus();

      await user.tab({ shift: true });
      expect(screen.getByText('Link 2')).toHaveFocus();
    });

    it('closes the menu when tabbing back out', async () => {
      const { user } = await render(
        <div>
          <button data-testid="first" />
          <TestNavigationMenu />
        </div>,
      );
      const trigger = screen.getByTestId('trigger-1');

      trigger.focus();
      await flushMicrotasks();
      await fireEvent.click(trigger);
      await flushMicrotasks();

      expect(screen.getByTestId('popup-1')).not.toBe(null);
      expect(trigger).toHaveFocus();

      await user.tab();
      expect(screen.getByText('Link 1')).toHaveFocus();

      await user.tab({ shift: true }); // trigger 1
      await user.tab({ shift: true }); // first

      expect(screen.queryByTestId('popup-1')).toBe(null);
    });
  });

  /**
   * A menu with one item that is open, and a popup element. `log` gets one line for each emit of
   * the value.
   */
  async function renderMenu(
    onValueChange?: (value: string | null, details: NavigationMenu.Root.ChangeEventDetails) => void,
  ) {
    const handle: { root: RootInstance | null } = { root: null };
    const log: string[] = [];
    const handleOpenChangeComplete = vi.fn();

    await render(() => (
      <NavigationMenu.Root
        ref={(instance) => {
          handle.root = instance as unknown as RootInstance | null;
        }}
        defaultValue="item-1"
        onValueChange={(value, details) => {
          log.push(`valueChange ${value} ${details.reason}`);
          onValueChange?.(value, details);
        }}
        onUpdate:value={(value) => {
          log.push(`update:value ${value}`);
        }}
        onOpenChangeComplete={handleOpenChangeComplete}
      >
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Icon data-testid="icon" />
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <PopupElement />
      </NavigationMenu.Root>
    ));

    return { root: handle.root as RootInstance, log, handleOpenChangeComplete };
  }

  describe('tag', () => {
    it('renders a nav element, and a div element when nested', async () => {
      await render(
        <NavigationMenu.Root data-testid="root">
          <NavigationMenu.Root data-testid="nested-root" />
        </NavigationMenu.Root>,
      );

      const root = screen.getByTestId('root');
      const nestedRoot = screen.getByTestId('nested-root');
      expect(root.localName).toBe('nav');
      expect(root).not.toHaveAttribute('data-nested');
      expect(nestedRoot.localName).toBe('div');
      expect(nestedRoot).toHaveAttribute('data-nested');
    });

    it('renders the tag of `as` in place of the default tag, also when nested', async () => {
      await render(
        <NavigationMenu.Root as="section" data-testid="root">
          <NavigationMenu.Root as="aside" data-testid="nested-root" />
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root').localName).toBe('section');
      expect(screen.getByTestId('nested-root').localName).toBe('aside');
    });
  });

  describe('open item', () => {
    function renderIcons() {
      return (
        <NavigationMenu.List>
          <NavigationMenu.Item value="item-1">
            <NavigationMenu.Icon data-testid="icon-1" />
          </NavigationMenu.Item>
          <NavigationMenu.Item value="item-2">
            <NavigationMenu.Icon data-testid="icon-2" />
          </NavigationMenu.Item>
        </NavigationMenu.List>
      );
    }

    it('opens the item of defaultValue', async () => {
      await render(
        <NavigationMenu.Root data-testid="root" defaultValue="item-2">
          {renderIcons()}
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root')).toHaveAttribute('data-open');
      expect(screen.getByTestId('icon-1')).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');
    });

    it('opens the item of the value prop, and follows a change of it', async () => {
      const { setProps } = await render(
        <NavigationMenu.Root value="item-1">{renderIcons()}</NavigationMenu.Root>,
      );
      expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');

      await setProps({ value: 'item-2' });

      expect(screen.getByTestId('icon-1')).not.toHaveAttribute('data-popup-open');
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');

      await setProps({ value: null });

      expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
    });

    it('follows v-model:value, and writes it when the menu closes', async () => {
      const model = shallowRef<string | null>('item-1');
      const handle: { root: RootInstance | null } = { root: null };
      const App = defineComponent(() => () => (
        <NavigationMenu.Root
          ref={(instance) => {
            handle.root = instance as unknown as RootInstance | null;
          }}
          v-model:value={model.value}
        >
          {renderIcons()}
        </NavigationMenu.Root>
      ));
      await render(<App />);
      expect(screen.getByTestId('icon-1')).toHaveAttribute('data-popup-open');

      model.value = 'item-2';
      await flushMicrotasks();
      expect(screen.getByTestId('icon-2')).toHaveAttribute('data-popup-open');

      handle.root!.close();
      await flushMicrotasks();

      expect(model.value).toBe(null);
      expect(screen.getByTestId('icon-2')).not.toHaveAttribute('data-popup-open');
    });

    it.each([
      { name: 'defaultValue 0', controlled: false, itemValue: 0 },
      { name: 'defaultValue an empty string', controlled: false, itemValue: '' },
      { name: 'defaultValue false', controlled: false, itemValue: false },
      { name: 'value 0', controlled: true, itemValue: 0 },
      { name: 'value an empty string', controlled: true, itemValue: '' },
      { name: 'value false', controlled: true, itemValue: false },
    ])('treats $name as an open value', async ({ controlled, itemValue }) => {
      const rootProps = controlled ? { value: itemValue } : { defaultValue: itemValue };

      await render(
        <NavigationMenu.Root data-testid="root" {...rootProps}>
          <NavigationMenu.List>
            <NavigationMenu.Item value={itemValue}>
              <NavigationMenu.Icon data-testid="icon" />
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );

      expect(screen.getByTestId('root')).toHaveAttribute('data-open');
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
    });

    it('stays uncontrolled when the value prop is absent', async () => {
      const { root } = await renderMenu();
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');

      root.close();
      await flushMicrotasks();

      expect(screen.getByTestId('icon')).not.toHaveAttribute('data-popup-open');
    });
  });

  describe('exposed close', () => {
    it('emits valueChange with the reason imperative-action, and then update:value', async () => {
      const { root, log } = await renderMenu();

      root.close();

      expect(log).toEqual(['valueChange null imperative-action', 'update:value null']);
    });

    it('keeps the menu open, and emits no update:value, when valueChange cancels the close', async () => {
      const { root, log, handleOpenChangeComplete } = await renderMenu((_value, details) => {
        details.cancel();
      });

      root.close();
      await flushMicrotasks();

      expect(log).toEqual(['valueChange null imperative-action']);
      expect(screen.getByTestId('icon')).toHaveAttribute('data-popup-open');
      expect(handleOpenChangeComplete).not.toHaveBeenCalled();
    });

    it('emits nothing when the menu is already closed', async () => {
      const { root, log } = await renderMenu();

      root.close();
      root.close();

      expect(log).toEqual(['valueChange null imperative-action', 'update:value null']);
    });

    it('closes a nested root and keeps the root above it open', async () => {
      const handleOuterChange = vi.fn();
      const handle: { nestedRoot: RootInstance | null } = { nestedRoot: null };
      await render(() => (
        <NavigationMenu.Root defaultValue="outer" onValueChange={handleOuterChange}>
          <NavigationMenu.Root
            ref={(instance) => {
              handle.nestedRoot = instance as unknown as RootInstance | null;
            }}
            defaultValue="inner"
          />
        </NavigationMenu.Root>
      ));

      handle.nestedRoot!.close();

      expect(handleOuterChange).not.toHaveBeenCalled();
    });
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed menu', props: {}, open: false },
      { name: 'a menu with defaultValue', props: { defaultValue: 'item-1' }, open: true },
    ])('hydrates $name', async ({ props, open }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(NavigationMenuRootHydration, { serverHtml, props });

      const icon = container.querySelector('[data-testid="icon-1"]');
      expect(icon?.hasAttribute('data-popup-open')).toBe(open);
      expect(container.querySelector('[data-testid="root"]')?.localName).toBe('nav');
    });
  });
});

describe('initial open', () => {
  // A dedicated renderer without `shouldAdvanceTime` so the one-frame instant reset
  // (scheduled via a zero-delay timeout) can be observed deterministically rather
  // than racing the assertion.
  const { render } = createRenderer();

  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('suppresses the positioner transition for the first frame while initially open', async () => {
    await render(<TestNavigationMenu defaultValue="item-1" />);

    // While initially open, the positioner starts with its transition suppressed so a
    // default value does not animate in from the unpositioned portal state.
    const positioner = screen.getByTestId('top-level-positioner');
    expect(positioner).toHaveAttribute('data-instant');

    // The suppression is released on the next tick.
    vi.advanceTimersByTime(0);
    await flushMicrotasks();
    expect(positioner).not.toHaveAttribute('data-instant');
  });
});
