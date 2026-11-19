import { recordStyleProperty } from '../../../test/recordStyleProperty';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, h, KeepAlive, nextTick, onMounted, shallowRef } from 'vue';
import type { PropType, VNodeChild } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createHeldBranch,
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
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import { allowTopLevelViewportWarning } from '../../../test/navigation-menuTestUtils';
import NavigationMenuTriggerHydration from './NavigationMenuTriggerHydration.test.vue';
import NavigationMenuTriggerScoped from './NavigationMenuTriggerScoped.test.vue';

const HYDRATION_FIXTURE = 'src/navigation-menu/trigger/NavigationMenuTriggerHydration.test.vue';

// The popup parts give the positioner element and the popup element to the root, and a trigger
// needs both while its item is active. This part gives the same elements.
const PopupElements = defineComponent(() => {
  const { positionerElement, popupElement } = useNavigationMenuRootContext();

  return () => (
    <div
      data-testid="positioner"
      ref={(element) => {
        positionerElement.value = element as HTMLElement | null;
      }}
    >
      <div
        id="popup"
        data-testid="popup"
        ref={(element) => {
          popupElement.value = element as HTMLElement | null;
        }}
      />
    </div>
  );
});

// A menu with two items and a viewport in the root. `KeepAlive` caches only a stateful component.
const Menu = defineComponent({
  props: {
    rootProps: { type: Object as PropType<Record<string, unknown>>, default: () => ({}) },
    direction: { type: String as PropType<'ltr' | 'rtl'>, default: 'ltr' },
    popup: { type: Boolean, default: false },
  },
  setup(props) {
    return () => (
      <DirectionProvider direction={props.direction}>
        <NavigationMenu.Root {...props.rootProps}>
          <NavigationMenu.List data-testid="list" style={{ display: 'flex' }}>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="content-one">
                <NavigationMenu.Link href="#one-first">First link of one</NavigationMenu.Link>
                <NavigationMenu.Link href="#one-second">Second link of one</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item value="two">
              <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
              <NavigationMenu.Content data-testid="content-two">
                <NavigationMenu.Link href="#two">Link of two</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport data-testid="viewport" />
          {props.popup ? <PopupElements /> : null}
        </NavigationMenu.Root>
        <button type="button" data-testid="outside">
          Outside
        </button>
      </DirectionProvider>
    );
  },
});

const rapidHoverAnimationStyles = `
  .test-navigation-menu-popup {
    transition:
      width 350ms cubic-bezier(0.22, 1, 0.36, 1),
      height 350ms cubic-bezier(0.22, 1, 0.36, 1);
    width: var(--popup-width);
    height: var(--popup-height);
  }
`;

const TestNavigationMenuRapidHoverSizing = defineComponent(() => {
  const isProductExpanded = shallowRef(false);

  return () => (
    <NavigationMenu.Root>
      <style>{rapidHoverAnimationStyles}</style>
      <NavigationMenu.List style={{ display: 'flex' }}>
        <NavigationMenu.Item value="product">
          <NavigationMenu.Trigger>Product</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <div>
              <button
                type="button"
                onClick={() => {
                  isProductExpanded.value = true;
                }}
              >
                Expand Product
              </button>
              {isProductExpanded.value ? (
                <div style={{ width: '760px', height: '460px' }}>Expanded product panel</div>
              ) : (
                <div style={{ width: '700px', height: '420px' }}>Product panel</div>
              )}
            </div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>

        <NavigationMenu.Item value="solutions">
          <NavigationMenu.Trigger>Solutions</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <div style={{ width: '500px', height: '320px' }}>Solutions panel</div>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup data-testid="popup-root" class="test-navigation-menu-popup">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
});

const TestActiveItemDropsTrigger = defineComponent({
  props: {
    registerNavigate: {
      type: Function as PropType<(navigate: () => void) => void>,
      required: true,
    },
  },
  setup(props) {
    const value = shallowRef<string | null>(null);
    const aIsActive = shallowRef(false);

    onMounted(() => {
      props.registerNavigate(() => {
        // Batched: close the menu and drop A's trigger (A becomes the active item rendered inline).
        value.value = null;
        aIsActive.value = true;
      });
    });

    return () => (
      <NavigationMenu.Root
        modelValue={value.value}
        onValueChange={(nextValue) => {
          value.value = nextValue;
        }}
      >
        <NavigationMenu.List data-testid="list">
          {aIsActive.value ? (
            <NavigationMenu.Item value="a">
              <a href="#a">A active</a>
            </NavigationMenu.Item>
          ) : (
            <NavigationMenu.Item value="a">
              <NavigationMenu.Trigger>A</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#a">A link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          )}
          <NavigationMenu.Item value="b">
            <NavigationMenu.Trigger>B</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#b">B link</NavigationMenu.Link>
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
  },
});

type ViewportRenderSlotProps = Parameters<
  NonNullable<InstanceType<typeof NavigationMenu.Viewport>['$slots']['render']>
>[0];

describe('<NavigationMenu.Trigger />', () => {
  beforeEach(allowTopLevelViewportWarning);

  const { render } = createRenderer();

  describeConformance(<NavigationMenu.Trigger />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    render(node) {
      return render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>{node}</NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>,
      );
    },
  }));

  it('applies the data-disabled style hook only when disabled', async () => {
    const App = defineComponent(() => {
      const disabled = shallowRef(true);

      return () => (
        <div>
          <NavigationMenu.Root>
            <NavigationMenu.List>
              <NavigationMenu.Item>
                <NavigationMenu.Trigger disabled={disabled.value} data-testid="trigger">
                  Overview
                </NavigationMenu.Trigger>
              </NavigationMenu.Item>
            </NavigationMenu.List>
          </NavigationMenu.Root>
          <button
            type="button"
            onClick={() => {
              disabled.value = false;
            }}
          >
            enable
          </button>
        </div>
      );
    });

    await render(<App />);
    const trigger = screen.getByTestId('trigger');
    expect(trigger).toHaveAttribute('data-disabled', '');

    await fireEvent.click(screen.getByText('enable'));
    expect(trigger).not.toHaveAttribute('data-disabled');
  });

  it('renders the attributes of a closed trigger, and no focus guard', async () => {
    await render(<Menu />);

    for (const id of ['trigger-one', 'trigger-two']) {
      const trigger = screen.getByTestId(id);
      expect(trigger).toHaveAttribute('type', 'button');
      expect(trigger).toHaveAttribute('tabindex', '0');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).toHaveAttribute('data-vase-ui-navigation-menu-trigger', '');
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(trigger.parentElement!.children).toHaveLength(1);
    }
  });

  describe('press', () => {
    it('opens its item, and shows the content of the item in the viewport', async () => {
      const handleValueChange = vi.fn();
      await render(<Menu rootProps={{ onValueChange: handleValueChange }} />);
      const trigger = screen.getByTestId('trigger-one');
      expect(screen.queryByTestId('content-one')).toBe(null);

      await fireEvent.click(trigger);

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('one');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('trigger-press');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(trigger).toHaveAttribute('data-pressed');
      expect(screen.getByTestId('viewport')).toContainElement(screen.getByTestId('content-one'));
      expect(screen.getByTestId('content-one')).toHaveAttribute('data-open');
    });

    it('names the popup in aria-controls while its item is active', async () => {
      await render(<Menu popup />);
      const one = screen.getByTestId('trigger-one');
      const two = screen.getByTestId('trigger-two');
      expect(one).not.toHaveAttribute('aria-controls');

      await fireEvent.click(one);

      expect(one).toHaveAttribute('aria-controls', screen.getByTestId('popup').id);
      expect(two).not.toHaveAttribute('aria-controls');
    });

    it('renders a focus guard, the owner of the viewport and a focus guard after the active trigger', async () => {
      await render(<Menu />);
      const trigger = screen.getByTestId('trigger-one');

      await fireEvent.click(trigger);

      const [, before, owner, after, ...rest] = Array.from(trigger.parentElement!.children);
      expect(before).toHaveAttribute('data-vase-ui-focus-guard');
      expect(owner).toHaveAttribute('aria-owns', screen.getByTestId('viewport').id);
      expect(after).toHaveAttribute('data-vase-ui-focus-guard');
      expect(rest).toEqual([]);
      expect(screen.getByTestId('trigger-two').parentElement!.children).toHaveLength(1);
    });

    it('closes the menu with a press of the active trigger', async () => {
      await render(<Menu popup />);
      const one = screen.getByTestId('trigger-one');

      await fireEvent.click(one);
      expect(one).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(one);
      expect(one).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('keyboard', () => {
    it.each([
      { name: 'ArrowDown in a horizontal menu', orientation: 'horizontal', key: 'ArrowDown' },
      { name: 'ArrowRight in a vertical menu', orientation: 'vertical', key: 'ArrowRight' },
      {
        name: 'ArrowLeft in a vertical RTL menu',
        orientation: 'vertical',
        direction: 'rtl',
        key: 'ArrowLeft',
      },
    ] as const)('opens its item with $name, and keeps the focus on the trigger', async (row) => {
      const { orientation, key } = row;
      const direction = 'direction' in row ? row.direction : 'ltr';
      const handleValueChange = vi.fn();
      await render(
        <Menu
          direction={direction}
          rootProps={{ orientation, onValueChange: handleValueChange }}
        />,
      );
      const trigger = screen.getByTestId('trigger-one');

      trigger.focus();
      await fireEvent.keyDown(trigger, { key });

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe('one');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('list-navigation');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveFocus();
    });

    it.each([
      { name: 'ArrowRight in a horizontal menu', orientation: 'horizontal', key: 'ArrowRight' },
      { name: 'ArrowLeft in a vertical menu', orientation: 'vertical', key: 'ArrowLeft' },
      { name: 'ArrowDown in a vertical menu', orientation: 'vertical', key: 'ArrowDown' },
    ] as const)('does not open its item with $name', async ({ orientation, key }) => {
      await render(<Menu rootProps={{ orientation }} />);
      const trigger = screen.getByTestId('trigger-one');

      trigger.focus();
      await fireEvent.keyDown(trigger, { key });

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  it('leaves the arrow keys of a nested trigger to the content above', async () => {
    const { user } = await render(
      <NavigationMenu.Root defaultValue="outer">
        <NavigationMenu.List>
          <NavigationMenu.Item value="outer">
            <NavigationMenu.Trigger>Outer</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#before">Before</NavigationMenu.Link>
              <NavigationMenu.Root>
                <NavigationMenu.List>
                  <NavigationMenu.Item value="inner">
                    <NavigationMenu.Trigger>Inner</NavigationMenu.Trigger>
                  </NavigationMenu.Item>
                </NavigationMenu.List>
              </NavigationMenu.Root>
              <NavigationMenu.Link href="#after">After</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Viewport />
      </NavigationMenu.Root>,
    );
    const inner = screen.getByRole('button', { name: 'Inner' });

    screen.getByRole('link', { name: 'Before' }).focus();
    await user.keyboard('[ArrowDown]');
    expect(inner).toHaveFocus();

    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('link', { name: 'After' })).toHaveFocus();
    expect(inner).toHaveAttribute('aria-expanded', 'false');
  });

  describe('prop: disabled', () => {
    it.each([
      { name: 'a press', act: (trigger: HTMLElement) => fireEvent.click(trigger) },
      {
        name: 'ArrowDown',
        act: (trigger: HTMLElement) => fireEvent.keyDown(trigger, { key: 'ArrowDown' }),
      },
    ])('does not open its item with $name', async ({ act }) => {
      const handleValueChange = vi.fn();
      await render(() => (
        <NavigationMenu.Root onValueChange={handleValueChange}>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger disabled data-testid="trigger">
                One
              </NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
        </NavigationMenu.Root>
      ));
      const trigger = screen.getByTestId('trigger');

      await act(trigger);

      expect(handleValueChange).not.toHaveBeenCalled();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('hover', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function hover(trigger: HTMLElement, ms: number) {
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    }

    it('opens its item when the pointer rests on the trigger for the delay of the root', async () => {
      const handleValueChange = vi.fn();
      await render(<Menu rootProps={{ delay: 100, onValueChange: handleValueChange }} />);
      const trigger = screen.getByTestId('trigger-one');

      await hover(trigger, 99);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(handleValueChange.mock.calls[0][1].reason).toBe('trigger-hover');
    });

    it('does not open its item for a pointer move that follows no enter', async () => {
      await render(<Menu />);
      const trigger = screen.getByTestId('trigger-one');

      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(100);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('does not open its item, and does not block the list, while the trigger is disabled', async () => {
      await render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List data-testid="list">
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger disabled data-testid="trigger">
                One
              </NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport />
        </NavigationMenu.Root>
      ));
      const trigger = screen.getByTestId('trigger');

      await hover(trigger, 100);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('list').style.pointerEvents).toBe('');
    });

    it('keeps the open event of its store when a key opens the closed menu', async () => {
      // A hover that `valueChange` cancels leaves its event in the store of the trigger. A press of
      // the open trigger then keeps the menu open, as it does after a hover open.
      await render(
        <Menu
          popup
          rootProps={{
            onValueChange(_value: unknown, details: NavigationMenu.Root.ChangeEventDetails) {
              if (details.reason === REASONS.triggerHover) {
                details.cancel();
              }
            },
          }}
        />,
      );
      const trigger = screen.getByTestId('trigger-one');
      await hover(trigger, 50);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await fireEvent.keyDown(trigger, { key: 'ArrowDown' });
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('blocks the pointer events of the list while the pointer is on the trigger, and releases them when the pointer leaves', async () => {
      await render(<Menu popup />);
      const list = screen.getByTestId('list');
      const trigger = screen.getByTestId('trigger-one');

      await fireEvent.mouseEnter(trigger);
      expect(list.style.pointerEvents).toBe('none');

      await fireEvent.mouseLeave(trigger);
      expect(list.style.pointerEvents).toBe('');
    });

    it('releases the pointer events of the list when the menu opens', async () => {
      await render(<Menu popup />);
      const list = screen.getByTestId('list');
      const trigger = screen.getByTestId('trigger-one');
      await fireEvent.mouseEnter(trigger);
      expect(list.style.pointerEvents).toBe('none');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(list.style.pointerEvents).toBe('');
    });

    it('releases the pointer events of the list when its item closes', async () => {
      await render(<Menu popup />);
      const list = screen.getByTestId('list');
      const trigger = screen.getByTestId('trigger-one');
      await fireEvent.click(trigger);
      await fireEvent.mouseEnter(trigger);
      expect(list.style.pointerEvents).toBe('none');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(list.style.pointerEvents).toBe('');
    });

    it('releases the pointer events of the list when the trigger unmounts', async () => {
      const showTrigger = shallowRef(true);
      await render(() => (
        <NavigationMenu.Root>
          <NavigationMenu.List data-testid="list">
            <NavigationMenu.Item value="one">
              {showTrigger.value ? (
                <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              ) : null}
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport />
        </NavigationMenu.Root>
      ));
      const list = screen.getByTestId('list');
      await fireEvent.mouseEnter(screen.getByTestId('trigger'));
      expect(list.style.pointerEvents).toBe('none');

      showTrigger.value = false;
      await flushMicrotasks();

      expect(list.style.pointerEvents).toBe('');
    });
  });

  describe('activation direction', () => {
    it('gives no direction to the content of a menu that opens', async () => {
      await render(<Menu />);

      await fireEvent.click(screen.getByTestId('trigger-two'));

      expect(screen.getByTestId('content-two')).not.toHaveAttribute('data-activation-direction');
    });

    it('gives no direction to the content that a key opens in a closed menu, after another trigger had the menu', async () => {
      await render(<Menu popup />);
      const one = screen.getByTestId('trigger-one');
      const two = screen.getByTestId('trigger-two');
      // The focus is not on a trigger, so the root does not give it back when the menu closes. The
      // root then still names the first trigger as the trigger that had the menu.
      await fireEvent.click(one);
      screen.getByTestId('outside').focus();
      await fireEvent.click(one);
      expect(one).toHaveAttribute('aria-expanded', 'false');

      two.focus();
      await fireEvent.keyDown(two, { key: 'ArrowDown' });

      expect(two).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('content-two')).not.toHaveAttribute('data-activation-direction');
    });
  });

  describe('focus', () => {
    it('moves the focus into the viewport for a Shift+Tab from the next trigger, after the viewport lost the focus', async () => {
      const { user } = await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      const two = screen.getByTestId('trigger-two');
      const viewport = screen.getByTestId('viewport');
      await waitForLaterMillisecond(() => fireEvent.click(one));
      const secondLink = screen.getByRole('link', { name: 'Second link of one' });
      secondLink.focus();
      two.focus();
      await flushMicrotasks();
      expect(viewport).toHaveAttribute('inert');

      await user.tab({ shift: true });

      await waitFor(() => {
        expect(secondLink).toHaveFocus();
      });
      expect(viewport).not.toHaveAttribute('inert');
    });

    it('moves the focus through the content with the Tab key, and on to the next trigger', async () => {
      const { user } = await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      await waitForLaterMillisecond(() => fireEvent.click(one));
      const first = screen.getByRole('link', { name: 'First link of one' });
      const second = screen.getByRole('link', { name: 'Second link of one' });
      one.focus();

      await user.tab();
      expect(first).toHaveFocus();
      await user.tab();
      expect(second).toHaveFocus();
      await user.tab();
      expect(screen.getByTestId('trigger-two')).toHaveFocus();
      expect(one).toHaveAttribute('aria-expanded', 'true');

      await user.tab({ shift: true });
      await waitFor(() => {
        expect(second).toHaveFocus();
      });
      await user.tab({ shift: true });
      expect(first).toHaveFocus();
      await user.tab({ shift: true });
      expect(one).toHaveFocus();
    });

    it('keeps working focus guards when the active item changes from the second trigger to the first', async () => {
      const { user } = await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      await fireEvent.click(screen.getByTestId('trigger-two'));
      await waitForLaterMillisecond(() => fireEvent.click(one));
      screen.getByRole('link', { name: 'Second link of one' }).focus();

      await user.tab();

      expect(screen.getByTestId('trigger-two')).toHaveFocus();
    });

    it('makes the viewport interactive again when the active trigger gets the focus', async () => {
      await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      const viewport = screen.getByTestId('viewport');
      await waitForLaterMillisecond(() => fireEvent.click(one));
      screen.getByRole('link', { name: 'First link of one' }).focus();
      screen.getByTestId('trigger-two').focus();
      await flushMicrotasks();
      expect(viewport).toHaveAttribute('inert');

      one.focus();
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('inert');
    });

    it('closes its item with the reason focus-out when the focus moves out of the menu', async () => {
      const handleValueChange = vi.fn();
      const { user } = await render(
        <Menu popup rootProps={{ onValueChange: handleValueChange }} />,
      );
      const one = screen.getByTestId('trigger-one');
      await fireEvent.click(one);
      one.focus();
      handleValueChange.mockClear();

      await user.click(screen.getByTestId('outside'));

      expect(handleValueChange).toHaveBeenCalledTimes(1);
      expect(handleValueChange.mock.calls[0][0]).toBe(null);
      expect(handleValueChange.mock.calls[0][1].reason).toBe('focus-out');
      expect(screen.getByTestId('outside')).toHaveFocus();
    });
  });

  describe('guards and owner element', () => {
    it.each([
      { name: 'its item closes', nextValue: null, mounted: true },
      { name: 'the trigger unmounts', nextValue: 'one', mounted: false },
    ])('clears the guard refs of the root when $name', async ({ nextValue, mounted }) => {
      let rootContext!: ReturnType<typeof useNavigationMenuRootContext>;
      const RootContextReader = defineComponent(() => {
        rootContext = useNavigationMenuRootContext();
        return () => null;
      });
      const value = shallowRef<string | null>('one');
      const hasTrigger = shallowRef(true);
      await render(() => (
        <NavigationMenu.Root modelValue={value.value}>
          <RootContextReader />
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              {hasTrigger.value ? <NavigationMenu.Trigger>One</NavigationMenu.Trigger> : null}
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Viewport />
        </NavigationMenu.Root>
      ));
      await flushMicrotasks();
      expect(rootContext.beforeOutsideRef.value).toHaveAttribute('data-vase-ui-focus-guard');
      expect(rootContext.afterOutsideRef.value).toHaveAttribute('data-vase-ui-focus-guard');

      value.value = nextValue;
      hasTrigger.value = mounted;
      await flushMicrotasks();

      expect(rootContext.beforeOutsideRef.value).toBe(null);
      expect(rootContext.afterOutsideRef.value).toBe(null);
    });

    it('removes aria-owns from the owner element when the viewport unmounts', async () => {
      const hasViewport = shallowRef(true);
      await render(() => (
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          {hasViewport.value ? <NavigationMenu.Viewport data-testid="viewport" /> : null}
        </NavigationMenu.Root>
      ));
      await flushMicrotasks();
      const owner = screen.getByTestId('trigger').parentElement!.children[2];
      expect(owner).toHaveAttribute('aria-owns', screen.getByTestId('viewport').id);

      hasViewport.value = false;
      await flushMicrotasks();

      expect(owner).not.toHaveAttribute('aria-owns');
    });
  });

  // `KeepAlive` takes a held viewport out of the document, with its inside guards. A root with no
  // viewport has no inside guards.
  type ViewportOutOfDocument = 'held' | 'mounted while held' | 'inline, held' | 'no viewport';

  function renderPositionedViewport() {
    return (
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    );
  }

  function renderItems() {
    return (
      <NavigationMenu.List>
        <NavigationMenu.Item value="one">
          <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <a href="#one">Link of one</a>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
        <NavigationMenu.Item value="two">
          <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <a href="#two">Link of two</a>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
    );
  }

  function inOuterMenu(menu: () => VNodeChild) {
    return (
      <NavigationMenu.Root defaultValue="outer">
        <NavigationMenu.List>
          <NavigationMenu.Item value="outer">
            <NavigationMenu.Trigger>Outer</NavigationMenu.Trigger>
            <NavigationMenu.Content>{menu()}</NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        {renderPositionedViewport()}
      </NavigationMenu.Root>
    );
  }

  async function renderViewportOutOfDocument(popup: ViewportOutOfDocument, defaultValue = 'one') {
    const reasons: string[] = [];
    const handleValueChange = (
      _value: unknown,
      details: NavigationMenu.Root.ChangeEventDetails,
    ) => {
      reasons.push(details.reason);
    };
    const isInline = popup === 'inline, held';
    const { HeldBranch, hide, mountWhileHeld } = createHeldBranch(
      isInline ? () => <NavigationMenu.Viewport /> : renderPositionedViewport,
      { mounted: popup !== 'mounted while held', renderBranch: (part) => part },
    );
    const renderMenu = () => (
      <NavigationMenu.Root defaultValue={defaultValue} onValueChange={handleValueChange}>
        {renderItems()}
        {popup === 'no viewport' ? null : <HeldBranch />}
      </NavigationMenu.Root>
    );
    const result = await render(() => (
      <div>
        {isInline ? inOuterMenu(renderMenu) : renderMenu()}
        <button data-testid="after">After</button>
      </div>
    ));
    await flushMicrotasks();
    if (popup === 'mounted while held') {
      await mountWhileHeld();
    } else if (popup !== 'no viewport') {
      await hide();
    }
    return { ...result, reasons };
  }

  describe('VUE-120: the guards skip a viewport that KeepAlive holds', () => {
    it.each([
      { name: 'positioner, held', popup: 'held' as const },
      { name: 'positioner, mounted while held', popup: 'mounted while held' as const },
      { name: 'inline viewport, held', popup: 'inline, held' as const },
    ])('goes from the active trigger to the next trigger for Tab ($name)', async ({ popup }) => {
      const { user, reasons } = await renderViewportOutOfDocument(popup);
      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await flushMicrotasks();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-two')).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(reasons).toEqual([]);
    });

    it.each([
      { name: 'positioner, held', popup: 'held' as const },
      { name: 'positioner, mounted while held', popup: 'mounted while held' as const },
      { name: 'inline viewport, held', popup: 'inline, held' as const },
    ])(
      'goes from the next trigger to the active trigger for Shift+Tab ($name)',
      async ({ popup }) => {
        const { user, reasons } = await renderViewportOutOfDocument(popup);
        const trigger = screen.getByTestId('trigger');
        screen.getByTestId('trigger-two').focus();
        await flushMicrotasks();

        await user.tab({ shift: true });
        await flushMicrotasks();

        expect(trigger).toHaveFocus();
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(reasons).toEqual([]);
      },
    );

    it('closes the item for Tab from the active trigger to an element after the root', async () => {
      const { user, reasons } = await renderViewportOutOfDocument('held', 'two');
      const trigger = screen.getByTestId('trigger-two');
      trigger.focus();
      await flushMicrotasks();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(reasons).toEqual([REASONS.focusOut]);
    });
  });

  describe('VUE-132: the guards skip a viewport that is not mounted', () => {
    it('goes from the active trigger to the next trigger for Tab', async () => {
      const { user, reasons } = await renderViewportOutOfDocument('no viewport');
      const trigger = screen.getByTestId('trigger');
      trigger.focus();
      await flushMicrotasks();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-two')).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(reasons).toEqual([]);
    });

    it('goes from the next trigger to the active trigger for Shift+Tab', async () => {
      const { user, reasons } = await renderViewportOutOfDocument('no viewport');
      const trigger = screen.getByTestId('trigger');
      screen.getByTestId('trigger-two').focus();
      await flushMicrotasks();

      await user.tab({ shift: true });
      await flushMicrotasks();

      expect(trigger).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(reasons).toEqual([]);
    });

    it('closes the item for Tab from the active trigger to an element after the root', async () => {
      const { user, reasons } = await renderViewportOutOfDocument('no viewport', 'two');
      const trigger = screen.getByTestId('trigger-two');
      trigger.focus();
      await flushMicrotasks();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(reasons).toEqual([REASONS.focusOut]);
    });
  });

  describe('VUE-60: the trigger has one root node', () => {
    it.each([
      { name: 'a closed item', defaultValue: null },
      { name: 'an active item', defaultValue: 'one' },
    ])(
      'gives the scope id, v-show and a custom directive of the consumer to $name',
      async ({ defaultValue }) => {
        const shown = shallowRef(true);
        await render(() => (
          <NavigationMenuTriggerScoped defaultValue={defaultValue} shown={shown.value} />
        ));
        await flushMicrotasks();
        const trigger = screen.getByTestId('trigger');

        expect(getComputedStyle(trigger).outlineStyle).toBe('dashed');
        expect(trigger).toHaveAttribute('data-mark', 'marked');
        expect(trigger.parentElement!.querySelectorAll('[data-vase-ui-focus-guard]')).toHaveLength(
          defaultValue === null ? 0 : 2,
        );

        shown.value = false;
        await nextTick();

        expect(trigger).not.toBeVisible();
      },
    );
  });

  describe('hydration', () => {
    it.each([
      { name: 'a closed menu', props: {}, active: false },
      { name: 'a closed menu with kept content', props: { keepMounted: true }, active: false },
      { name: 'an open menu', props: { defaultValue: 'one' }, active: true },
      {
        name: 'an open menu with kept content',
        props: { defaultValue: 'one', keepMounted: true },
        active: true,
      },
    ])('hydrates $name', async ({ props, active }) => {
      const serverHtml = await renderOnServer(HYDRATION_FIXTURE, props);

      const { container } = await hydrate(NavigationMenuTriggerHydration, { serverHtml, props });

      const viewport = within(container).getByTestId('viewport');
      expect(within(container).getByTestId('trigger-one')).toHaveAttribute(
        'aria-expanded',
        String(active),
      );
      // The viewport holds a kept content also while its item is not active.
      expect(viewport.contains(within(container).queryByTestId('content-one'))).toBe(
        active || 'keepMounted' in props,
      );
    });
  });

  describe('KeepAlive', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    async function renderKeptMenu() {
      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Menu popup /> : null}</KeepAlive>
      ));
      await render(<App />);

      async function deactivateAndActivate() {
        visible.value = false;
        await flushMicrotasks();
        visible.value = true;
        await flushMicrotasks();
      }

      return { deactivateAndActivate };
    }

    it('closes the active item on a click while KeepAlive holds the positioner', async () => {
      await renderViewportOutOfDocument('held');
      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps the content in the element of an inline viewport while KeepAlive holds the viewport', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(
        () => <NavigationMenu.Viewport data-testid="inline-viewport" />,
        { renderBranch: (part) => part, mounted: true },
      );
      await render(() =>
        inOuterMenu(() => (
          <NavigationMenu.Root defaultValue="one">
            {renderItems()}
            <HeldBranch />
          </NavigationMenu.Root>
        )),
      );
      const viewport = screen.getByTestId('inline-viewport');
      const content = screen.getByText('Link of one').parentElement!;
      const target = content.parentElement!;
      expect(target.parentElement).toBe(viewport);

      await hide();

      expect(viewport.isConnected).toBe(false);
      expect(content.parentElement).toBe(target);
      await show();

      expect(viewport.isConnected).toBe(true);
      expect(target.contains(screen.getByText('Link of one'))).toBe(true);
    });

    it('closes a menu that hover opened', async () => {
      const { deactivateAndActivate } = await renderKeptMenu();
      const trigger = screen.getByTestId('trigger-one');
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      vi.advanceTimersByTime(50);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await deactivateAndActivate();

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('keeps a menu that a press opened', async () => {
      const { deactivateAndActivate } = await renderKeptMenu();
      const trigger = screen.getByTestId('trigger-one');
      await fireEvent.click(trigger);

      await deactivateAndActivate();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('releases the pointer events that a pointer on the trigger blocked', async () => {
      const { deactivateAndActivate } = await renderKeptMenu();
      await fireEvent.mouseEnter(screen.getByTestId('trigger-one'));
      expect(screen.getByTestId('list').style.pointerEvents).toBe('none');

      await deactivateAndActivate();

      expect(screen.getByTestId('list').style.pointerEvents).toBe('');
    });

    it('opens the item again at the activation when the pointer is over the trigger', async () => {
      const visible = shallowRef(true);
      const App = defineComponent(() => () => (
        <KeepAlive>{visible.value ? <Menu popup /> : null}</KeepAlive>
      ));
      await render(<App />);
      const trigger = screen.getByTestId('trigger-one');
      visible.value = false;
      await flushMicrotasks();

      // A pointer that is over a trigger that comes back sends no enter event.
      const originalMatches = Element.prototype.matches;
      const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function matches(
        this: Element,
        selector: string,
      ) {
        if (selector === ':hover' && (this as HTMLElement).dataset.testid === 'trigger-one') {
          return true;
        }
        return originalMatches.call(this, selector);
      });
      onTestFinished(() => {
        matchesSpy.mockRestore();
      });

      visible.value = true;
      await flushMicrotasks();
      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('opens the item at the first activation of a trigger that mounted in a held branch when the pointer is over it', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => <Menu popup />);
      await render(<HeldBranch />);
      await mountWhileHeld();

      // A pointer that is over a trigger at its first show sends no enter event.
      const originalMatches = Element.prototype.matches;
      const matchesSpy = vi.spyOn(Element.prototype, 'matches').mockImplementation(function matches(
        this: Element,
        selector: string,
      ) {
        if (selector === ':hover' && (this as HTMLElement).dataset.testid === 'trigger-one') {
          return true;
        }
        return originalMatches.call(this, selector);
      });
      onTestFinished(() => {
        matchesSpy.mockRestore();
      });

      await show();
      vi.advanceTimersByTime(50);
      await flushMicrotasks();

      expect(screen.getByTestId('trigger-one')).toHaveAttribute('aria-expanded', 'true');
    });
  });

  function renderMenu(popupParts: () => unknown) {
    return render(() => (
      <NavigationMenu.Root defaultValue="one">
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
            <NavigationMenu.Content data-testid="content">Content</NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        {popupParts()}
      </NavigationMenu.Root>
    ));
  }

  describe('VUE-73: aria-controls names only an element in the document', () => {
    function popupParts(
      popupSlots: Record<string, unknown> = { default: () => <NavigationMenu.Viewport /> },
    ) {
      return (
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup data-testid="popup" v-slots={popupSlots} />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      );
    }

    it('has no aria-controls while the popup has an empty id', async () => {
      // An empty `id` of the part counts as no `id` (VUE-93). Only the `#render` slot can give the
      // element an empty `id`.
      await renderMenu(() =>
        popupParts({
          render: ({ props }: { props: HTMLProps }) => (
            <nav {...props} id="">
              <NavigationMenu.Viewport />
            </nav>
          ),
        }),
      );
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(screen.getByTestId('popup').id).toBe('');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('has no aria-controls while KeepAlive holds the popup', async () => {
      const Popup = defineComponent({ setup: () => () => popupParts() });
      const Other = defineComponent({ setup: () => () => <span /> });
      const visible = shallowRef(true);
      await renderMenu(() => (
        <KeepAlive>{visible.value ? <Popup key="popup" /> : <Other key="other" />}</KeepAlive>
      ));
      await flushMicrotasks();
      const trigger = screen.getByTestId('trigger');
      const popup = screen.getByTestId('popup');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);

      visible.value = false;
      await flushMicrotasks();

      expect(popup.isConnected).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');

      visible.value = true;
      await flushMicrotasks();

      expect(popup.isConnected).toBe(true);
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });

    it('has no aria-controls while the popup mounts in a branch that KeepAlive holds', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => (
          <NavigationMenu.Popup data-testid="popup">
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        ),
        { renderBranch: (part) => part },
      );
      await renderMenu(() => (
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <HeldBranch />
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      ));

      await mountWhileHeld();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');

      await show();

      const popup = screen.getByTestId('popup');
      expect(popup.id).not.toBe('');
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });
  });

  describe('VUE-73: aria-owns names only a viewport in the document', () => {
    // The owner element comes after the trigger and the guard before it.
    function getOwner() {
      return screen.getByTestId('trigger').parentElement!.children[2];
    }

    it('has no aria-owns while KeepAlive holds the viewport, and keeps the content in the viewport', async () => {
      // `KeepAlive` caches only a stateful component.
      const Popup = defineComponent({
        setup: () => () => (
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup>
                <NavigationMenu.Viewport data-testid="viewport" />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        ),
      });
      const Other = defineComponent({ setup: () => () => <span /> });
      const visible = shallowRef(true);
      await renderMenu(() => (
        <KeepAlive>{visible.value ? <Popup key="popup" /> : <Other key="other" />}</KeepAlive>
      ));
      await flushMicrotasks();
      const owner = getOwner();
      const viewport = screen.getByTestId('viewport');
      const content = screen.getByTestId('content');
      expect(viewport.id).not.toBe('');
      expect(owner).toHaveAttribute('aria-owns', viewport.id);

      visible.value = false;
      await flushMicrotasks();

      expect(viewport.isConnected).toBe(false);
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(owner).not.toHaveAttribute('aria-owns');
      expect(viewport.contains(content)).toBe(true);

      visible.value = true;
      await flushMicrotasks();

      expect(owner).toHaveAttribute('aria-owns', viewport.id);
      expect(screen.getByTestId('content')).toBe(content);
      expect(viewport.contains(content)).toBe(true);
    });

    it('has no aria-owns while the viewport mounts in a branch that KeepAlive holds', async () => {
      const { HeldBranch, mountWhileHeld, show } = createHeldBranch(
        () => <NavigationMenu.Viewport data-testid="viewport" />,
        { renderBranch: (part) => part },
      );
      await renderMenu(() => (
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <HeldBranch />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      ));

      await mountWhileHeld();

      const owner = getOwner();
      expect(screen.getByTestId('trigger')).toHaveAttribute('aria-expanded', 'true');
      expect(owner).not.toHaveAttribute('aria-owns');
      expect(owner).not.toHaveAttribute('data-vase-ui-focus-guard');

      await show();

      const viewport = screen.getByTestId('viewport');
      expect(viewport.id).not.toBe('');
      expect(owner).toHaveAttribute('aria-owns', viewport.id);
    });
  });

  describe('VUE-86: the active trigger follows the ids of the popup and the viewport', () => {
    // An empty `id` of a part counts as no `id` (VUE-93). Only the `#render` slot can give the
    // element an empty `id`, so the slots write the ids.
    function menuWithIds(ids: { popup?: string; viewport?: string }) {
      const idOf = (id: string | undefined) => (id === undefined ? {} : { id });
      return (
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>Content</NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner>
              <NavigationMenu.Popup
                data-testid="popup"
                v-slots={{
                  render: ({ props }: { props: HTMLProps }) => (
                    <nav {...props} {...idOf(ids.popup)}>
                      <NavigationMenu.Viewport
                        data-testid="viewport"
                        v-slots={{
                          render: ({ props: viewportProps, children }: ViewportRenderSlotProps) => (
                            <div {...viewportProps} {...idOf(ids.viewport)}>
                              {h(children)}
                            </div>
                          ),
                        }}
                      />
                    </nav>
                  ),
                }}
              />
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      );
    }

    it('follows the id of the popup in aria-controls', async () => {
      const id = shallowRef('first');
      await render(() => menuWithIds({ popup: id.value }));
      await flushMicrotasks();

      const trigger = screen.getByTestId('trigger');
      expect(trigger).toHaveAttribute('aria-controls', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('popup').id).toBe('second');
      expect(trigger).toHaveAttribute('aria-controls', 'second');

      id.value = '';
      await flushMicrotasks();

      expect(screen.getByTestId('popup').id).toBe('');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('follows the id of the viewport in aria-owns', async () => {
      const id = shallowRef('first');
      await render(() => menuWithIds({ viewport: id.value }));
      await flushMicrotasks();

      const owner = screen.getByTestId('trigger').parentElement!.querySelector('[aria-owns]');
      expect(owner).toHaveAttribute('aria-owns', 'first');

      id.value = 'second';
      await flushMicrotasks();

      expect(screen.getByTestId('viewport').id).toBe('second');
      expect(owner).toHaveAttribute('aria-owns', 'second');

      id.value = '';
      await flushMicrotasks();

      expect(screen.getByTestId('viewport').id).toBe('');
      expect(owner).not.toHaveAttribute('aria-owns');
    });
  });

  describe('popup size', () => {
    // Base UI asserts pixel sizes of the default font of Chromium. These cases compare the size
    // variables of the positioner with the measured size of the content, so that they run in each
    // engine.
    function readPositionerSize(positioner: HTMLElement, name: 'width' | 'height') {
      return parseFloat(getComputedStyle(positioner).getPropertyValue(`--positioner-${name}`));
    }

    it('gives the positioner the height of the content of the item that a key opens, and keeps the focus on the trigger', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Quick Start</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Styling Base UI components</NavigationMenu.Link>
              </NavigationMenu.Content>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Second Link</NavigationMenu.Link>
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner data-testid="positioner">
              <NavigationMenu.Popup data-testid="popup">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>,
      );

      const overviewButton = screen.getByRole('button', { name: 'Overview' });
      overviewButton.focus();
      await flushMicrotasks();

      await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowDown}');
        await flushMicrotasks();
      });

      const positioner = screen.getByTestId('positioner');
      const popupHeight = () => screen.getByTestId('popup').getBoundingClientRect().height;
      await waitFor(() => {
        expect(
          Math.abs(readPositionerSize(positioner, 'height') - popupHeight()),
        ).toBeLessThanOrEqual(1);
      });
      const oneLine = popupHeight();
      expect(oneLine).toBeGreaterThan(0);

      const overviewLink = screen.getByRole('link', { name: 'Quick Start' });
      await waitFor(() => {
        expect(overviewButton).toHaveFocus();
      });

      await user.tab();
      await waitFor(() => {
        expect(overviewLink).toHaveFocus();
      });

      await user.tab({ shift: true });
      await waitFor(() => {
        expect(overviewButton).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}');
      const handbookButton = screen.getByRole('button', { name: 'Handbook' });
      await waitFor(() => {
        expect(handbookButton).toHaveFocus();
      });

      await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowDown}');
        await flushMicrotasks();
      });

      await waitFor(() => {
        expect(
          Math.abs(readPositionerSize(positioner, 'height') - 2 * oneLine),
        ).toBeLessThanOrEqual(1);
      });
      expect(Math.abs(popupHeight() - 2 * oneLine)).toBeLessThanOrEqual(1);

      const handbookLink = screen.getByRole('link', { name: 'Styling Base UI components' });
      await waitFor(() => {
        expect(handbookButton).toHaveFocus();
      });

      await user.tab();
      await waitFor(() => {
        expect(handbookLink).toHaveFocus();
      });

      await user.tab({ shift: true });
      await waitFor(() => {
        expect(handbookButton).toHaveFocus();
      });

      await user.keyboard('{ArrowLeft}');
      await waitFor(() => {
        expect(overviewButton).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');
      await flushMicrotasks();
      await waitFor(() => {
        expect(Math.abs(readPositionerSize(positioner, 'height') - oneLine)).toBeLessThanOrEqual(1);
      });
      await waitFor(() => {
        expect(overviewButton).toHaveFocus();
      });
    });

    it('gives the positioner the width of the content after the pointer moves through a trigger with no content', async () => {
      const { user } = await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>noContent</NavigationMenu.Trigger>
            </NavigationMenu.Item>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>withContent</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Styling Base UI components</NavigationMenu.Link>
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

      const noContentButton = screen.getByRole('button', { name: 'noContent' });
      const withContentButton = screen.getByRole('button', { name: 'withContent' });

      await user.pointer([
        { target: withContentButton },
        { target: noContentButton, releasePrevious: true },
        { target: withContentButton, releasePrevious: true },
      ]);

      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'Styling Base UI components' })).toBeVisible();
      });

      const positioner = screen.getByTestId('positioner');
      const link = screen.getByRole('link', { name: 'Styling Base UI components' });

      await waitFor(() => {
        expect(
          Math.abs(readPositionerSize(positioner, 'width') - link.getBoundingClientRect().width),
        ).toBeLessThanOrEqual(1);
      });
    });

    it('gives the positioner the size of the new content when a press changes the active item', async () => {
      await render(
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <div style={{ width: '100px', height: '40px' }} />
              </NavigationMenu.Content>
            </NavigationMenu.Item>
            <NavigationMenu.Item value="two">
              <NavigationMenu.Trigger data-testid="trigger-two">Two</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <div style={{ width: '200px', height: '80px' }} />
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

      await fireEvent.click(screen.getByTestId('trigger-one'));
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('100px');
      });

      await fireEvent.click(screen.getByTestId('trigger-two'));

      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('200px');
      });
      expect(positioner.style.getPropertyValue('--positioner-height')).toBe('80px');
    });

    it('keeps intrinsic popup size while a consumer supplies the start marker', async () => {
      const expanded = shallowRef(false);
      await render(() => (
        <NavigationMenu.Root defaultValue="one">
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger>One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <div style={{ width: '90px', height: '20px' }} />
                {expanded.value && <div style={{ width: '180px', height: '20px' }} />}
              </NavigationMenu.Content>
            </NavigationMenu.Item>
          </NavigationMenu.List>
          <NavigationMenu.Portal>
            <NavigationMenu.Positioner data-testid="positioner">
              <NavigationMenu.Popup data-testid="popup" data-starting-style="">
                <NavigationMenu.Viewport />
              </NavigationMenu.Popup>
            </NavigationMenu.Positioner>
          </NavigationMenu.Portal>
        </NavigationMenu.Root>
      ));
      const popup = screen.getByTestId('popup');
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => expect(popup.style.getPropertyValue('--popup-width')).toBe('auto'));
      expect(positioner.style.getPropertyValue('--positioner-width')).toBe('90px');
      expect(popup).toHaveAttribute('data-starting-style');
      const widths = recordStyleProperty(popup, '--popup-width');

      expanded.value = true;
      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('180px');
        expect(popup.style.getPropertyValue('--popup-width')).toBe('auto');
      });
      expect(widths.filter((width) => width.endsWith('px'))).toEqual([]);
    });

    it('keeps the size variables when the window resizes while KeepAlive holds the menu', async () => {
      const visible = shallowRef(true);
      // `KeepAlive` caches only a stateful component.
      const KeptMenu = defineComponent(() => () => (
        <NavigationMenu.Root>
          <NavigationMenu.List>
            <NavigationMenu.Item value="one">
              <NavigationMenu.Trigger data-testid="trigger-one">One</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <div style={{ width: '100px', height: '40px' }} />
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
        </NavigationMenu.Root>
      ));
      await render(() => <KeepAlive>{visible.value ? <KeptMenu /> : null}</KeepAlive>);
      await fireEvent.click(screen.getByTestId('trigger-one'));
      await flushMicrotasks();
      const positioner = screen.getByTestId('positioner');
      await waitFor(() => {
        expect(positioner.style.getPropertyValue('--positioner-width')).toBe('100px');
      });

      visible.value = false;
      await flushMicrotasks();
      // A size pass of a popup that is out of the document removes the variables and measures 0.
      window.dispatchEvent(new Event('resize'));
      await new Promise(requestAnimationFrame);
      await new Promise(requestAnimationFrame);

      expect(positioner.style.getPropertyValue('--positioner-width')).toBe('100px');
    });
  });

  it('opens a vertical menu with the mirrored arrow key in RTL mode', async () => {
    const { user } = await render(
      <DirectionProvider direction="rtl">
        <NavigationMenu.Root orientation="vertical">
          <NavigationMenu.List>
            <NavigationMenu.Item>
              <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
              <NavigationMenu.Content>
                <NavigationMenu.Link href="#">Quick Start</NavigationMenu.Link>
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
      </DirectionProvider>,
    );

    const trigger = screen.getByRole('button', { name: 'Overview' });
    trigger.focus();

    await user.keyboard('{ArrowLeft}');

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    });
  });

  it.each([
    ['ArrowDown', '{ArrowDown}'],
    ['Enter', '{Enter}'],
    ['Space', ' '],
  ])('keeps focus on the trigger when opened with %s', async (_keyName, key) => {
    const { user } = await render(
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#quick-start">Quick Start</NavigationMenu.Link>
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

    const trigger = screen.getByRole('button', { name: 'Overview' });
    trigger.focus();

    await user.keyboard(key);

    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Quick Start' })).toBeVisible();
    });
    await new Promise(requestAnimationFrame);
    await flushMicrotasks();

    expect(trigger).toHaveFocus();
  });

  it('repositions the positioner when switching triggers via hover', async () => {
    const { user: rendererUser } = await render(
      <NavigationMenu.Root>
        <NavigationMenu.List style={{ display: 'flex' }}>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Overview</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Overview Link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item>
            <NavigationMenu.Trigger>Handbook</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#">Handbook Link</NavigationMenu.Link>
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

    // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
    const user = rendererUser.setup({ pointerEventsCheck: 0 });

    const overviewButton = screen.getByRole('button', { name: 'Overview' });
    const handbookButton = screen.getByRole('button', { name: 'Handbook' });

    await user.pointer([{ target: overviewButton }]);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Overview Link' })).toBeVisible();
    });

    const positioner = screen.getByTestId('positioner');
    const firstLeft = positioner.getBoundingClientRect().left;

    await user.pointer([{ target: handbookButton, releasePrevious: true }]);
    await waitFor(() => {
      expect(screen.getByRole('link', { name: 'Handbook Link' })).toBeVisible();
    });

    await waitFor(() => {
      const secondLeft = positioner.getBoundingClientRect().left;
      expect(Math.abs(secondLeft - firstLeft)).toBeGreaterThan(20);
    });
  });

  it('does not let a previously hovered trigger reapply popup sizes after a later switch', async () => {
    const { user: rendererUser } = await render(<TestNavigationMenuRapidHoverSizing />);

    // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
    const user = rendererUser.setup({ pointerEventsCheck: 0 });

    await user.hover(screen.getByRole('button', { name: 'Product' }));

    const popupRoot = await screen.findByTestId('popup-root');
    const widths = recordStyleProperty(popupRoot, '--popup-width');

    await waitFor(() => {
      expect(widths).toContain('700px');
    });
    const beforeSwitch = widths.length;

    await user.hover(screen.getByRole('button', { name: 'Solutions' }));

    await waitFor(() => {
      expect(screen.getByText('Solutions panel')).toBeVisible();
    });

    await waitFor(() => {
      expect(widths.slice(beforeSwitch)).toContain('500px');
    });

    await waitFor(() => {
      expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
    });

    // Once the switch has settled, Product's stale size must not have been applied after Solutions'.
    const popupWidthCallsAfterSwitch = widths.slice(beforeSwitch);
    const solutionsWidthIndex = popupWidthCallsAfterSwitch.indexOf('500px');
    expect(popupWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain('700px');
  });

  it('does not let interrupted mutation resizing reapply popup sizes after a later switch', async () => {
    const { user: rendererUser } = await render(<TestNavigationMenuRapidHoverSizing />);

    // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
    const user = rendererUser.setup({ pointerEventsCheck: 0 });

    const popupRoot = await waitForLaterMillisecond(async () => {
      await user.hover(screen.getByRole('button', { name: 'Product' }));
      return screen.findByTestId('popup-root');
    });
    const positioner = popupRoot.parentElement as HTMLElement;
    const widths = recordStyleProperty(positioner, '--positioner-width');
    const popupWidths = recordStyleProperty(popupRoot, '--popup-width');
    await waitFor(() => {
      expect(popupWidths).toContain('700px');
    });

    let popupWidth = 700;
    let popupHeight = 420;

    Object.defineProperty(popupRoot, 'offsetWidth', {
      configurable: true,
      get: () => popupWidth,
    });
    Object.defineProperty(popupRoot, 'offsetHeight', {
      configurable: true,
      get: () => popupHeight,
    });

    popupWidth = 760;
    popupHeight = 460;
    await user.click(screen.getByRole('button', { name: 'Expand Product' }));

    await waitFor(() => {
      expect(widths).toContain('760px');
    });

    popupWidth = 500;
    popupHeight = 320;
    const beforeSwitch = widths.length;

    await user.hover(screen.getByRole('button', { name: 'Solutions' }));

    await waitFor(() => {
      expect(screen.getByText('Solutions panel')).toBeVisible();
    });

    await waitFor(() => {
      expect(widths.slice(beforeSwitch)).toContain('500px');
    });

    await waitFor(() => {
      expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
    });

    // Once the switch has settled, the interrupted 760px resize must not have been applied after
    // Solutions' size.
    const positionerWidthCallsAfterSwitch = widths.slice(beforeSwitch);
    const solutionsWidthIndex = positionerWidthCallsAfterSwitch.indexOf('500px');
    expect(positionerWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain('760px');
  });

  it.skipIf(isJSDOM)(
    'releases the pointer-events lock on the list when the open trigger unmounts',
    async () => {
      let navigate = () => {};

      const { user: rendererUser } = await render(
        <TestActiveItemDropsTrigger
          registerNavigate={(fn) => {
            navigate = fn;
          }}
        />,
      );

      // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
      const user = rendererUser.setup({ pointerEventsCheck: 0 });

      const list = screen.getByTestId('list');
      const triggerA = screen.getByRole('button', { name: 'A' });

      // Opening A's flyout by hovering the trigger locks the list with `pointer-events: none` (safe polygon),
      // while the pointer stays on the trigger rather than the popup.
      await user.pointer([{ target: triggerA }]);
      await waitFor(() => {
        expect(screen.getByRole('link', { name: 'A link' })).toBeVisible();
      });
      await waitFor(() => {
        expect(list.style.pointerEvents).toBe('none');
      });

      // Drop A's trigger and close the menu in one update, while the pointer is still on the trigger, so none
      // of the trigger-scoped release paths run before the trigger unmounts.
      navigate();
      await flushMicrotasks();

      await waitFor(() => {
        expect(list.style.pointerEvents).toBe('');
      });
    },
  );

  it('releases the pointer-events lock when the pointer sweeps across a trigger without the menu opening', async () => {
    const { user: rendererUser } = await render(
      <NavigationMenu.Root>
        <NavigationMenu.List data-testid="list">
          <NavigationMenu.Item value="a">
            <NavigationMenu.Trigger>A</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#a">A link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
          <NavigationMenu.Item value="b">
            <NavigationMenu.Trigger>B</NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#b">B link</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal keepMounted>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
    const user = rendererUser.setup({ pointerEventsCheck: 0 });

    const list = screen.getByTestId('list');
    const triggerA = screen.getByRole('button', { name: 'A' });

    // Sweep across the trigger and leave before the rest delay elapses, so the menu
    // never opens. `mouseenter` applies the safe-polygon pointer-events lock on the
    // list eagerly (the Portal is `keepMounted`, so the floating element exists while
    // closed); without an open -> close cycle nothing releases it.
    await user.pointer([{ target: triggerA }, { target: document.body }]);

    await waitFor(() => {
      expect(list.style.pointerEvents).toBe('');
    });
    expect(screen.queryByRole('link', { name: 'A link' })).toBe(null);
  });
});
