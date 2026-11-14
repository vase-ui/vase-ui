import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, KeepAlive, shallowRef } from 'vue';
import type { CSSProperties, PropType } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
  within,
} from '#test-utils';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import * as NavigationMenu from '../index.parts';
import { useNavigationMenuRootContext } from '../root/NavigationMenuRootContext';
import NavigationMenuTriggerHydration from './NavigationMenuTriggerHydration.test.vue';

const HYDRATION_FIXTURE = 'src/navigation-menu/trigger/NavigationMenuTriggerHydration.test.vue';

// The real pointer of the browser can rest where a trigger renders, and it then sends events of its
// own. A case that dispatches hover events renders its menu in a wrapper with this style. A
// dispatched event still reaches the trigger. The style is not on the trigger or on the list,
// because the hover intent writes and removes `pointer-events` on both.
const NO_REAL_POINTER: CSSProperties = { pointerEvents: 'none' };

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
    listStyle: {
      type: Object as PropType<CSSProperties>,
      default: () => ({ display: 'flex' }),
    },
  },
  setup(props) {
    return () => (
      <DirectionProvider direction={props.direction}>
        <div style={NO_REAL_POINTER}>
          <NavigationMenu.Root {...props.rootProps}>
            <NavigationMenu.List data-testid="list" style={props.listStyle}>
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
        </div>
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

function getPopupWidthCalls(calls: Array<[property: string, value: string, priority?: string]>) {
  return calls.filter((call) => call[0] === '--popup-width').map((call) => call[1]);
}

function getPositionerWidthCalls(
  calls: Array<[property: string, value: string, priority?: string]>,
) {
  return calls.filter((call) => call[0] === '--positioner-width').map((call) => call[1]);
}

describe('<NavigationMenu.Trigger />', () => {
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

    it('keeps the menu open when a press changes the active item', async () => {
      const handleValueChange = vi.fn();
      await render(<Menu popup rootProps={{ onValueChange: handleValueChange }} />);
      const one = screen.getByTestId('trigger-one');
      const two = screen.getByTestId('trigger-two');

      await fireEvent.click(one);
      await fireEvent.click(two);
      await flushMicrotasks();

      expect(one).toHaveAttribute('aria-expanded', 'false');
      expect(two).toHaveAttribute('aria-expanded', 'true');
      expect(handleValueChange.mock.calls.map(([value]) => value)).toEqual(['one', 'two']);
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

    it('changes the active item at once when the pointer enters another trigger', async () => {
      await render(<Menu popup />);
      const one = screen.getByTestId('trigger-one');
      const two = screen.getByTestId('trigger-two');
      await hover(one, 50);
      expect(one).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.mouseEnter(two);

      expect(one).toHaveAttribute('aria-expanded', 'false');
      expect(two).toHaveAttribute('aria-expanded', 'true');
    });

    it('does not open its item, and does not block the list, while the trigger is disabled', async () => {
      await render(() => (
        <div style={NO_REAL_POINTER}>
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
        </div>
      ));
      const trigger = screen.getByTestId('trigger');

      await hover(trigger, 100);

      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(screen.getByTestId('list').style.pointerEvents).toBe('');
    });

    it('closes its item when the pointer leaves the trigger for the close delay of the root', async () => {
      await render(<Menu popup rootProps={{ closeDelay: 100 }} />);
      const trigger = screen.getByTestId('trigger-one');
      await hover(trigger, 50);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.mouseLeave(trigger);
      vi.advanceTimersByTime(99);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      vi.advanceTimersByTime(1);
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it.each([
      { name: 'before the patient threshold', after: PATIENT_CLICK_THRESHOLD - 1, open: true },
      { name: 'at the patient threshold', after: PATIENT_CLICK_THRESHOLD, open: false },
    ])('handles a press $name of a hover open', async ({ after, open }) => {
      await render(<Menu popup />);
      const trigger = screen.getByTestId('trigger-one');
      await hover(trigger, 50);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      vi.advanceTimersByTime(after);
      await fireEvent.click(trigger);

      expect(trigger).toHaveAttribute('aria-expanded', String(open));
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
        <div style={NO_REAL_POINTER}>
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
        </div>
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
    it.each([
      {
        name: 'a horizontal row of triggers',
        orientation: 'horizontal',
        listStyle: { display: 'flex' } satisfies CSSProperties,
        toSecond: 'right',
        toFirst: 'left',
      },
      {
        name: 'a vertical column of triggers',
        orientation: 'vertical',
        listStyle: { display: 'flex', flexDirection: 'column' } satisfies CSSProperties,
        toSecond: 'down',
        toFirst: 'up',
      },
    ])(
      'gives the content that enters the side that it came from for $name',
      async ({ orientation, listStyle, toSecond, toFirst }) => {
        await render(<Menu rootProps={{ orientation }} listStyle={listStyle} />);
        const one = screen.getByTestId('trigger-one');
        const two = screen.getByTestId('trigger-two');

        await fireEvent.click(one);
        await fireEvent.click(two);
        expect(screen.getByTestId('content-two')).toHaveAttribute(
          'data-activation-direction',
          toSecond,
        );

        await fireEvent.click(one);
        expect(screen.getByTestId('content-one')).toHaveAttribute(
          'data-activation-direction',
          toFirst,
        );
      },
    );

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
      await fireEvent.click(one);
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
      await fireEvent.click(one);
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
      await fireEvent.click(one);
      screen.getByRole('link', { name: 'Second link of one' }).focus();

      await user.tab();

      expect(screen.getByTestId('trigger-two')).toHaveFocus();
    });

    it('makes the viewport interactive again when the active trigger gets the focus', async () => {
      await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      const viewport = screen.getByTestId('viewport');
      await fireEvent.click(one);
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

    it('does not make the viewport inert when the focus leaves it for the active trigger', async () => {
      await render(<Menu />);
      const one = screen.getByTestId('trigger-one');
      const viewport = screen.getByTestId('viewport');

      await fireEvent.click(one);
      const link = screen.getByRole('link', { name: 'First link of one' });
      link.focus();
      one.focus();
      await flushMicrotasks();

      expect(viewport).not.toHaveAttribute('inert');
    });
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
  });

  describe('popup size', () => {
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

  it('handles focus and positioner height', async () => {
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
            <NavigationMenu.Popup>
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>,
    );

    const overviewButton = screen.getByRole('button', { name: 'Overview' });
    overviewButton.focus();
    await flushMicrotasks();

    await user.keyboard('{ArrowDown}');
    await flushMicrotasks();

    const positioner = screen.getByTestId('positioner');
    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 18,
        ),
      ).toBeLessThanOrEqual(1);
    });

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

    await user.keyboard('{ArrowDown}');
    await flushMicrotasks();

    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 36,
        ),
      ).toBeLessThanOrEqual(1);
    });

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
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-height'), 10) - 18,
        ),
      ).toBeLessThanOrEqual(1);
    });
    await waitFor(() => {
      expect(overviewButton).toHaveFocus();
    });
  });

  it('handles positioner width correctly', async () => {
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
      const handbookLink = screen.getByRole('link', { name: 'Styling Base UI components' });

      expect(handbookLink).toBeVisible();
    });

    const positioner = await screen.findByTestId('positioner');

    await waitFor(() => {
      expect(
        Math.abs(
          parseInt(getComputedStyle(positioner).getPropertyValue('--positioner-width'), 10) - 183,
        ),
      ).toBeLessThanOrEqual(1);
    });
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
    const setPropertySpy = vi.spyOn(popupRoot.style, 'setProperty');
    const getWidthCallsSince = (startIndex = 0) =>
      getPopupWidthCalls(
        setPropertySpy.mock.calls.slice(startIndex) as Array<
          [property: string, value: string, priority?: string]
        >,
      );

    await waitFor(() => {
      expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('700px');
    });

    const callsBeforeSolutionsHover = setPropertySpy.mock.calls.length;

    await user.hover(screen.getByRole('button', { name: 'Solutions' }));

    await waitFor(() => {
      expect(screen.getByText('Solutions panel')).toBeVisible();
    });

    await waitFor(() => {
      expect(getWidthCallsSince(callsBeforeSolutionsHover)).toContain('500px');
    });

    await waitFor(() => {
      expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('auto');
    });

    // Once the switch has settled, Product's stale size must not have been applied after Solutions'.
    const popupWidthCallsAfterSwitch = getWidthCallsSince(callsBeforeSolutionsHover);
    const solutionsWidthIndex = popupWidthCallsAfterSwitch.indexOf('500px');
    expect(popupWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain('700px');

    setPropertySpy.mockRestore();
  });

  it('does not let interrupted mutation resizing reapply popup sizes after a later switch', async () => {
    const { user: rendererUser } = await render(<TestNavigationMenuRapidHoverSizing />);

    // The safe-polygon lock sets `pointer-events: none` on the list while hovering.
    const user = rendererUser.setup({ pointerEventsCheck: 0 });

    await user.hover(screen.getByRole('button', { name: 'Product' }));

    const popupRoot = await screen.findByTestId('popup-root');
    const positioner = popupRoot.parentElement as HTMLElement;
    const setPositionerPropertySpy = vi.spyOn(positioner.style, 'setProperty');
    const getPositionerWidthCallsSince = (startIndex = 0) =>
      getPositionerWidthCalls(
        setPositionerPropertySpy.mock.calls.slice(startIndex) as Array<
          [property: string, value: string, priority?: string]
        >,
      );

    await waitFor(() => {
      expect(popupRoot.style.getPropertyValue('--popup-width')).toBe('700px');
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

    popupRoot.style.setProperty('--popup-width', '700px');
    popupRoot.style.setProperty('--popup-height', '420px');

    popupWidth = 760;
    popupHeight = 460;
    await user.click(screen.getByRole('button', { name: 'Expand Product' }));

    await waitFor(() => {
      expect(
        setPositionerPropertySpy.mock.calls.some(
          (call) => call[0] === '--positioner-width' && call[1] === '760px',
        ),
      ).toBe(true);
    });

    popupWidth = 500;
    popupHeight = 320;
    const callsBeforeSolutionsHover = setPositionerPropertySpy.mock.calls.length;

    await user.hover(screen.getByRole('button', { name: 'Solutions' }));

    await waitFor(() => {
      expect(screen.getByText('Solutions panel')).toBeVisible();
    });

    await waitFor(() => {
      expect(getPositionerWidthCallsSince(callsBeforeSolutionsHover)).toContain('500px');
    });

    await waitFor(() => {
      expect(positioner.style.getPropertyValue('--positioner-width')).toBe('500px');
    });

    // Once the switch has settled, the interrupted 760px resize must not have been applied after
    // Solutions' size.
    const positionerWidthCallsAfterSwitch = getPositionerWidthCallsSince(callsBeforeSolutionsHover);
    const solutionsWidthIndex = positionerWidthCallsAfterSwitch.indexOf('500px');
    expect(positionerWidthCallsAfterSwitch.slice(solutionsWidthIndex + 1)).not.toContain('760px');

    setPositionerPropertySpy.mockRestore();
  });

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
