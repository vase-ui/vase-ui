import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { KeepAlive, computed, defineComponent, onMounted, shallowRef, watch } from 'vue';
import type { ComponentPublicInstance, PropType } from 'vue';
import { Menubar } from '@vase-ui/vue/menubar';
import {
  createRenderer,
  enterWithMouse,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  popupConformanceTests,
  popupListConformanceTests,
  pressWithScreenReader,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitSingleFrame,
  within,
} from '#test-utils';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import * as AlertDialog from '../../alert-dialog/index.parts';
import { reset as resetWarnings } from '../../common/warn';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { createAttribute } from '../../utils/popups/createAttribute';
import { useTriggerRegistration } from '../../utils/popups/popupStoreUtils';
import { provideFloatingNode, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import * as Menu from '../index.parts';
import type { MenuStore } from '../store/MenuStore';
import type { MenuRootChangeEventDetails, MenuRootHighlightEventDetails } from './MenuRoot.vue';
import { useMenuRootContext } from './MenuRootContext';
import type { MenuRootContext } from './MenuRootContext';
import MenuRootHydration from './MenuRootHydration.test.vue';
import { useMenuRoot } from './useMenuRoot';
import type { UseMenuRootOptions } from './useMenuRoot';

/** Reads the context and the tree that a part below a root gets. */
function createProbe() {
  const contexts: MenuRootContext[] = [];
  const trees: (FloatingTreeType | null)[] = [];
  const Probe = defineComponent({
    setup() {
      contexts.push(useMenuRootContext());
      trees.push(useFloatingTree().value);
      return () => null;
    },
  });

  return {
    Probe,
    trees,
    get context() {
      return contexts[0];
    },
    get store() {
      return contexts[0].store;
    },
  };
}

/** A root part that calls `useMenuRoot` with the given options, as `Menu.SubmenuRoot` does. */
function createRootPart(options: Partial<UseMenuRootOptions> = {}) {
  return defineComponent({
    setup(_, { slots }) {
      useMenuRoot(
        {},
        { onOpenChange() {}, onOpenChangeComplete() {}, onItemHighlighted() {}, ...options },
      );
      return () => slots.default?.();
    },
  });
}

const TestTrigger = defineComponent({
  props: { id: { type: String, required: true } },
  setup(props) {
    const { store } = useMenuRootContext();
    const { registerTrigger } = useTriggerRegistration(() => props.id, store);
    const isActive = computed(() => store.select('isTriggerActive', props.id));
    const setElement = (element: Element | ComponentPublicInstance | null) => {
      registerTrigger(element as Element | null);
    };

    return () => (
      <button id={props.id} {...store.select('triggerProps', isActive.value)} ref={setElement} />
    );
  },
});

const TestPopup = defineComponent({
  props: { onKeydown: Function as PropType<(event: KeyboardEvent) => void> },
  setup(props) {
    const { store } = useMenuRootContext();
    const setElement = (element: Element | ComponentPublicInstance | null) => {
      store.context.popupRef.value = element as HTMLElement | null;
      store.set('popupElement', element as HTMLElement | null);
    };

    return () =>
      store.select('mounted') ? (
        <div
          data-testid="popup"
          onKeydown={props.onKeydown}
          {...store.select('popupProps')}
          ref={setElement}
        />
      ) : null;
  },
});

const imperativeActionDetails = () => createChangeEventDetails(REASONS.imperativeAction);

function useFakeTimers() {
  vi.useFakeTimers();
  onTestFinished(() => {
    vi.useRealTimers();
  });
}

type PartProps = Record<string, unknown>;

const testMenuProps = {
  rootProps: { type: Object as PropType<PartProps>, default: undefined },
  portalProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is a function that returns the content of the popup.
  popupProps: { type: Object as PropType<PartProps>, default: undefined },
  triggerProps: { type: Object as PropType<PartProps>, default: undefined },
  submenuProps: { type: Object as PropType<PartProps>, default: undefined },
  submenuTriggerProps: { type: Object as PropType<PartProps>, default: undefined },
};

const TestMenuContents = defineComponent({
  props: testMenuProps,
  setup(props, { slots }) {
    return () => {
      const { children: popupChildren, ...restPopupProps } = props.popupProps ?? {};
      return (
        <Menu.Root {...props.rootProps}>
          {slots.default?.()}
          <Menu.Portal {...props.portalProps}>
            <Menu.Positioner data-testid="menu-positioner">
              <Menu.Popup data-testid="menu" {...restPopupProps}>
                {typeof popupChildren === 'function' ? (
                  popupChildren()
                ) : (
                  <>
                    <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                    <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                    <Menu.Item data-testid="item-3" disabled>
                      Item 3
                    </Menu.Item>
                    <Menu.SubmenuRoot {...props.submenuProps}>
                      <Menu.SubmenuTrigger
                        data-testid="submenu-trigger"
                        {...props.submenuTriggerProps}
                      >
                        Item 4
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item data-testid="item-4_1">Item 4.1</Menu.Item>
                            <Menu.Item data-testid="item-4_2">Item 4.2</Menu.Item>
                            <Menu.SubmenuRoot {...props.submenuProps}>
                              <Menu.SubmenuTrigger
                                data-testid="nested-submenu-trigger"
                                {...props.submenuTriggerProps}
                              >
                                Item 4.3
                              </Menu.SubmenuTrigger>
                              <Menu.Portal>
                                <Menu.Positioner>
                                  <Menu.Popup data-testid="nested-submenu">
                                    <Menu.Item data-testid="item-4_3_1">Item 4.3.1</Menu.Item>
                                    <Menu.Item data-testid="item-4_3_2">Item 4.3.2</Menu.Item>
                                  </Menu.Popup>
                                </Menu.Positioner>
                              </Menu.Portal>
                            </Menu.SubmenuRoot>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    <Menu.Item data-testid="item-5">Item 5</Menu.Item>
                  </>
                )}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
    };
  },
});

const ContainedTriggerMenu = defineComponent({
  props: testMenuProps,
  setup(props) {
    return () => (
      <TestMenuContents
        rootProps={props.rootProps}
        portalProps={props.portalProps}
        popupProps={props.popupProps}
        submenuProps={props.submenuProps}
        submenuTriggerProps={props.submenuTriggerProps}
      >
        <Menu.Trigger {...props.triggerProps}>Toggle</Menu.Trigger>
      </TestMenuContents>
    );
  },
});

const DetachedTriggerMenu = defineComponent({
  props: testMenuProps,
  setup(props) {
    const menuHandle = new Menu.Handle();

    return () => (
      <>
        <TestMenuContents
          rootProps={{ ...props.rootProps, handle: menuHandle }}
          portalProps={props.portalProps}
          popupProps={props.popupProps}
          submenuProps={props.submenuProps}
          submenuTriggerProps={props.submenuTriggerProps}
        />
        <Menu.Trigger handle={menuHandle} {...props.triggerProps}>
          Toggle
        </Menu.Trigger>
      </>
    );
  },
});

describe('<Menu.Root />', () => {
  const { render } = createRenderer();

  describe('closing before the popup attaches', () => {
    it('unmounts the popup when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent({
        setup() {
          const open = shallowRef(true);
          onMounted(() => {
            open.value = false;
          });
          return () => (
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      await render(<App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('menu', { hidden: true })).toBe(null);
    });

    it('unmounts the popup when a layout effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent({
        setup() {
          const open = shallowRef(false);
          watch(
            open,
            (isOpen) => {
              if (isOpen) {
                open.value = false;
              }
            },
            { flush: 'post' },
          );
          return () => (
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Apple</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      const { user } = await render(<App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('menu', { hidden: true })).toBe(null);
    });
  });

  it('returns focus on Escape after a controlled root ignores a Shift+Tab close', async () => {
    const TestMenu = defineComponent({
      setup() {
        const open = shallowRef(false);
        return () => (
          <Menu.Root
            modal={false}
            open={open.value}
            onOpenChange={(nextOpen: boolean, details: Menu.Root.ChangeEventDetails) => {
              if (details.reason !== REASONS.focusOut) {
                open.value = nextOpen;
              }
            }}
          >
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    const { user } = await render(<TestMenu />);
    const trigger = screen.getByRole('button', { name: 'Toggle' });
    await user.click(trigger);
    await waitFor(() => {
      expect(screen.getByRole('menu')).toHaveFocus();
    });

    await user.tab({ shift: true });
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');

    await user.keyboard('{ArrowDown}');
    await waitFor(() => {
      expect(screen.getByRole('menuitem')).toHaveFocus();
    });

    await user.keyboard('{Escape}');
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });
    expect(trigger).toHaveFocus();
  });

  it('keeps focus in the menu when a Shift+Tab close is canceled', async () => {
    const { user } = await render(
      <Menu.Root
        defaultOpen
        onOpenChange={(open: boolean, details: Menu.Root.ChangeEventDetails) => {
          if (!open) {
            details.cancel();
          }
        }}
      >
        <Menu.Trigger>Toggle</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const menu = screen.getByRole('menu');
    await waitFor(() => {
      expect(menu).toHaveFocus();
    });

    await user.tab({ shift: true });

    expect(menu).toHaveFocus();
    expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('aria-expanded', 'true');
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Menu.Root {...props.root}>
        <Menu.Trigger {...props.trigger}>Open menu</Menu.Trigger>
        <Menu.Portal {...props.portal}>
          <Menu.Positioner>
            <Menu.Popup {...props.popup}>
              <Menu.Item>Item</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'menu',
  });

  describe.skipIf(isJSDOM)('hover opening', () => {
    it('stays open while the pointer crosses the gap from the trigger to the popup', async () => {
      await render(
        <Menu.Root modal={false}>
          <Menu.Trigger data-testid="trigger" openOnHover delay={0}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner sideOffset={24}>
              <Menu.Popup data-testid="popup">
                <Menu.Item data-testid="item">One</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByTestId('trigger');
      await enterWithMouse(trigger);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      await waitSingleFrame();
      await waitSingleFrame();

      const triggerRect = trigger.getBoundingClientRect();
      const item = screen.getByTestId('item');
      const itemRect = item.getBoundingClientRect();
      expect(itemRect.top - triggerRect.bottom).toBeGreaterThanOrEqual(20);
      const x = Math.min(triggerRect.right, itemRect.right) - 5;

      await fireEvent.mouseLeave(trigger, {
        clientX: x,
        clientY: triggerRect.bottom + 1,
        relatedTarget: document.body,
      });
      for (let y = triggerRect.bottom + 4; y < itemRect.top; y += 4) {
        await fireEvent.mouseMove(document.body, { clientX: x, clientY: y });
      }
      await enterWithMouse(item, { clientX: x, clientY: itemRect.top + 2 });
      await waitSingleFrame();
      await waitSingleFrame();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByTestId('popup')).toBeVisible();
    });
  });

  describe('opening', () => {
    const TestMenu = defineComponent({
      setup(_, { slots }) {
        return () => (
          <Menu.Root>
            <Menu.Trigger data-testid="trigger">Open</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  {slots.default?.() ?? (
                    <>
                      <Menu.Item>One</Menu.Item>
                      <Menu.Item>Two</Menu.Item>
                    </>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    it('highlights the first item when the items render a microtask after a keyboard opening', async () => {
      const RenderNextMicrotask = defineComponent({
        setup(_, { slots }) {
          const ready = shallowRef(false);
          onMounted(() => {
            queueMicrotask(() => {
              ready.value = true;
            });
          });
          return () => (ready.value ? slots.default?.() : null);
        },
      });

      const { user } = await render(
        <TestMenu>
          <RenderNextMicrotask>
            <Menu.Item>One</Menu.Item>
            <Menu.Item>Two</Menu.Item>
          </RenderNextMicrotask>
        </TestMenu>,
      );

      screen.getByTestId('trigger').focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });
    });

    it.skipIf(isJSDOM).each([
      { name: 'a zero-size press', init: { width: 0, height: 0 } },
      { name: "Chrome's 1x1 pressureless press", init: { width: 1, height: 1, pressure: 0 } },
    ])('moves focus to the first item after a screen reader $name', async ({ init }) => {
      await render(<TestMenu />);
      const trigger = screen.getByTestId('trigger');

      // Screen readers synthesize the press; the click itself can still report `detail: 1`.
      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', buttons: 0, ...init });
      await fireEvent.mouseDown(trigger, { detail: 1 });
      await fireEvent.pointerUp(trigger, { pointerType: 'mouse', ...init });
      await fireEvent.mouseUp(trigger, { detail: 1 });
      await fireEvent.click(trigger, { detail: 1 });

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });
    });

    it.skipIf(isJSDOM)(
      'returns focus to the trigger from an alert dialog opened by an item after a screen reader press',
      async () => {
        const App = defineComponent({
          setup() {
            const dialogOpen = shallowRef(false);
            const setDialogOpen = (open: boolean) => {
              dialogOpen.value = open;
            };
            return () => (
              <>
                <button type="button">Before</button>
                <Menu.Root>
                  <Menu.Trigger>Playlist</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item onClick={() => setDialogOpen(true)}>Delete</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                <AlertDialog.Root open={dialogOpen.value} onOpenChange={setDialogOpen}>
                  <AlertDialog.Portal>
                    <AlertDialog.Popup>
                      <AlertDialog.Close>Cancel</AlertDialog.Close>
                    </AlertDialog.Popup>
                  </AlertDialog.Portal>
                </AlertDialog.Root>
              </>
            );
          },
        });

        await render(<App />);
        const trigger = screen.getByRole('button', { name: 'Playlist' });

        // The virtual cursor moves to the trigger without moving DOM focus off the previous control.
        screen.getByRole('button', { name: 'Before' }).focus();
        await flushMicrotasks();
        await pressWithScreenReader(trigger);

        const item = await screen.findByRole('menuitem', { name: 'Delete' });
        await waitFor(() => {
          expect(item).toHaveFocus();
        });
        await pressWithScreenReader(item);

        const cancel = await screen.findByRole('button', { name: 'Cancel' });
        await waitFor(() => {
          expect(cancel).toHaveFocus();
        });
        await pressWithScreenReader(cancel);

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
      },
    );

    it.skipIf(isJSDOM)(
      'keeps focus in the popup when a screen reader press moves it to another trigger',
      async () => {
        const handle = Menu.createHandle();
        await render(
          <>
            <Menu.Root handle={handle}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>One</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Menu.Trigger handle={handle}>Trigger A</Menu.Trigger>
            <Menu.Trigger handle={handle}>Trigger B</Menu.Trigger>
          </>,
        );

        await pressWithScreenReader(screen.getByRole('button', { name: 'Trigger A' }));
        const item = await screen.findByRole('menuitem', { name: 'One' });
        await waitFor(() => {
          expect(item).toHaveFocus();
        });

        const triggerB = screen.getByRole('button', { name: 'Trigger B' });
        await pressWithScreenReader(triggerB);
        expect(triggerB).toHaveAttribute('aria-expanded', 'true');

        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
        });
      },
    );
  });

  popupListConformanceTests({
    createComponent: ({ root, items, disabledItems, scrollerStyle, itemStyle, onItemClick }) => (
      <Menu.Root {...root}>
        <Menu.Trigger data-testid="trigger">Open menu</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.List data-testid="scroller" style={scrollerStyle}>
                {items.map((item) => (
                  <Menu.Item
                    key={item}
                    disabled={disabledItems.includes(item)}
                    style={itemStyle}
                    onClick={onItemClick}
                  >
                    <span>{item}</span>
                  </Menu.Item>
                ))}
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    render,
    itemRole: 'menuitem',
    listEnd: 'wrap',
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerMenu },
    { name: 'detached triggers', Component: DetachedTriggerMenu },
  ])('when using $name', ({ Component: TestMenu }) => {
    it('sets aria-orientation on a horizontal popup', async () => {
      await render(<TestMenu rootProps={{ defaultOpen: true, orientation: 'horizontal' }} />);

      expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('does not render aria-orientation on a vertical popup', async () => {
      await render(<TestMenu rootProps={{ defaultOpen: true }} />);

      // `menu` is implicitly vertical.
      expect(screen.getByRole('menu')).not.toHaveAttribute('aria-orientation');
    });

    describe('keyboard navigation', () => {
      it('changes the highlighted item using the arrow keys', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      it.skipIf(isJSDOM)('navigates across grouped items with arrow keys and text', async () => {
        const { user } = await render(
          <TestMenu
            popupProps={{
              children: () => (
                <>
                  <Menu.Group>
                    <Menu.Item>Apple</Menu.Item>
                    <Menu.Item>Banana</Menu.Item>
                  </Menu.Group>
                  <Menu.Group>
                    <Menu.Item>Cherry</Menu.Item>
                  </Menu.Group>
                </>
              ),
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();
        await user.keyboard('[Enter]');

        const apple = screen.getByRole('menuitem', { name: 'Apple' });
        const banana = screen.getByRole('menuitem', { name: 'Banana' });
        const cherry = screen.getByRole('menuitem', { name: 'Cherry' });

        await waitFor(() => {
          expect(apple).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(banana).toHaveFocus();
        });
        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });

        apple.focus();
        await flushMicrotasks();
        await user.keyboard('c');
        await waitFor(() => {
          expect(cherry).toHaveFocus();
        });
      });

      it('closes with a `detail === 0` click event on keyboard item activation', async () => {
        const openChangeSpy = vi.fn();

        const { user } = await render(<TestMenu rootProps={{ onOpenChange: openChangeSpy }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await user.keyboard('[Enter]');

        await waitFor(() => {
          expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        });

        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        // Keyboard activation clicks carry `detail === 0`, which MenuRoot classifies
        // as a keyboard (instant) activation.
        expect((openChangeSpy.mock.lastCall?.[1].event as MouseEvent).detail).toBe(0);
      });

      it('changes the highlighted item using the Home and End keys', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');
        const item1 = screen.getByTestId('item-1');
        const item5 = screen.getByTestId('item-5');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await user.keyboard('{End}');
        await waitFor(() => {
          expect(item5).toHaveFocus();
        });

        await user.keyboard('{Home}');
        await waitFor(() => {
          expect(item1).toHaveFocus();
        });
      });

      it('includes disabled items during keyboard navigation', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');

        const item1 = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const disabledItem3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item1).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });

        await user.keyboard('{ArrowDown}');

        await waitFor(() => {
          expect(disabledItem3).toHaveFocus();
        });

        expect(disabledItem3).toHaveAttribute('aria-disabled', 'true');
      });

      it.skipIf(isJSDOM)('skips items hidden with CSS during keyboard navigation', async () => {
        const { user } = await render(
          <TestMenu
            popupProps={{
              children: () => (
                <>
                  <Menu.Item data-testid="item-1" style={{ display: 'none' }}>
                    Item 1
                  </Menu.Item>
                  <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                </>
              ),
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');

        const hiddenItem = screen.getByTestId('item-1');
        const item2 = screen.getByTestId('item-2');
        const item3 = screen.getByTestId('item-3');

        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
        expect(hiddenItem).toHaveAttribute('tabindex', '-1');

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(item3).toHaveFocus();
        });

        await user.keyboard('{ArrowUp}');
        await waitFor(() => {
          expect(item2).toHaveFocus();
        });
      });

      describe('text navigation', () => {
        it.skipIf(isJSDOM)('changes the highlighted item', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="bb">Bb</Menu.Item>,
            <Menu.Item key="ca">Ca</Menu.Item>,
            <Menu.Item key="cb">Cb</Menu.Item>,
            <Menu.Item key="cd">Cd</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          items[0].focus();
          await flushMicrotasks();

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Ca')).toHaveFocus();
          });

          expect(screen.getByText('Ca')).toHaveAttribute('tabindex', '0');

          await user.keyboard('d');
          await waitFor(() => {
            expect(screen.getByText('Cd')).toHaveFocus();
          });

          expect(screen.getByText('Cd')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)('skips items hidden with CSS in text navigation', async () => {
          const itemElements = [
            <Menu.Item key="hidden" data-testid="item-hidden" style={{ display: 'none' }}>
              Apple
            </Menu.Item>,
            <Menu.Item key="apricot" data-testid="item-apricot">
              Apricot
            </Menu.Item>,
            <Menu.Item key="banana" data-testid="item-banana">
              Banana
            </Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
          );

          const hiddenItem = screen.getByTestId('item-hidden');
          const apricotItem = screen.getByTestId('item-apricot');
          const bananaItem = screen.getByTestId('item-banana');

          bananaItem.focus();
          await flushMicrotasks();

          await user.keyboard('a');
          await waitFor(() => {
            expect(apricotItem).toHaveFocus();
          });

          expect(hiddenItem).toHaveAttribute('tabindex', '-1');
        });

        it.skipIf(isJSDOM)('skips natively disabled items in text navigation', async () => {
          const itemElements = [
            <Menu.Item key="apple">Apple</Menu.Item>,
            <Menu.Item
              key="banana"
              data-testid="item-banana"
              nativeButton
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <button {...props} type="button" disabled>
                    Banana
                  </button>
                ),
              }}
            />,
            <Menu.Item key="blueberry" data-testid="item-blueberry">
              Blueberry
            </Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
          );

          const appleItem = screen.getByText('Apple');
          const bananaItem = screen.getByTestId('item-banana');
          const blueberryItem = screen.getByTestId('item-blueberry');

          appleItem.focus();
          await flushMicrotasks();

          await user.keyboard('b');
          await waitFor(() => {
            expect(blueberryItem).toHaveFocus();
          });

          expect(bananaItem).toHaveAttribute('tabindex', '-1');
          expect(bananaItem).not.toHaveAttribute('data-highlighted');
        });

        it.skipIf(isJSDOM)('skips the non-stringifiable items', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="empty" />,
            <Menu.Item key="nested">
              <div>Nested Content</div>
            </Menu.Item>,
            <Menu.Item key="undefined">{undefined}</Menu.Item>,
            <Menu.Item key="null">{null}</Menu.Item>,
            <Menu.Item key="bc">Bc</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          items[0].focus();
          await flushMicrotasks();

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('c');
          await waitFor(() => {
            expect(screen.getByText('Bc')).toHaveFocus();
          });
          expect(screen.getByText('Bc')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)('navigate to options with diacritic characters', async () => {
          const itemElements = [
            <Menu.Item key="aa">Aa</Menu.Item>,
            <Menu.Item key="ba">Ba</Menu.Item>,
            <Menu.Item key="bb">Bb</Menu.Item>,
            <Menu.Item key="bą">Bą</Menu.Item>,
          ];

          const { user } = await render(
            <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
          );

          const items = screen.getAllByRole('menuitem');

          items[0].focus();
          await flushMicrotasks();

          await user.keyboard('b');
          await waitFor(() => {
            expect(screen.getByText('Ba')).toHaveFocus();
          });
          expect(screen.getByText('Ba')).toHaveAttribute('tabindex', '0');

          await user.keyboard('ą');
          await waitFor(() => {
            expect(screen.getByText('Bą')).toHaveFocus();
          });
          expect(screen.getByText('Bą')).toHaveAttribute('tabindex', '0');
        });

        it.skipIf(isJSDOM)(
          'navigate to next options that begin with diacritic characters',
          async () => {
            const itemElements = [
              <Menu.Item key="aa">Aa</Menu.Item>,
              <Menu.Item key="ąa">ąa</Menu.Item>,
              <Menu.Item key="ąb">ąb</Menu.Item>,
              <Menu.Item key="ąc">ąc</Menu.Item>,
            ];

            const { user } = await render(
              <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
            );

            const items = screen.getAllByRole('menuitem');

            items[0].focus();
            await flushMicrotasks();

            await user.keyboard('ą');
            await waitFor(() => {
              expect(screen.getByText('ąa')).toHaveFocus();
            });
            expect(screen.getByText('ąa')).toHaveAttribute('tabindex', '0');
          },
        );

        it.skipIf(isJSDOM)(
          'does not trigger the onClick event when Space is pressed during text navigation',
          async () => {
            const handleClick = vi.fn();

            const itemElements = [
              <Menu.Item key="one" onClick={() => handleClick()}>
                Item One
              </Menu.Item>,
              <Menu.Item key="two" onClick={() => handleClick()}>
                Item Two
              </Menu.Item>,
              <Menu.Item key="three" onClick={() => handleClick()}>
                Item Three
              </Menu.Item>,
            ];

            const { user } = await render(
              <TestMenu rootProps={{ open: true }} popupProps={{ children: () => itemElements }} />,
            );

            const items = screen.getAllByRole('menuitem');

            items[0].focus();
            await flushMicrotasks();

            await user.keyboard('Item T');

            expect(handleClick.mock.calls.length > 0).toBe(false);

            await waitFor(() => {
              expect(items[1]).toHaveFocus();
            });
          },
        );

        it.skipIf(isJSDOM)(
          'does not open a submenu when pressing Space during a typeahead session',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: () => (
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">
                        Add to Playlist
                      </Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu">
                            <Menu.Item>Add now</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  ),
                }}
              />,
            );

            const submenuTrigger = screen.getByTestId('submenu-trigger');

            submenuTrigger.focus();
            await flushMicrotasks();

            await user.keyboard('Add to p');

            await waitFor(() => {
              expect(submenuTrigger).toHaveFocus();
            });

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).toBe(null);

            await user.keyboard('[Space]');
            expect(screen.queryByTestId('submenu')).toBe(null);
          },
        );

        it('opens a focused submenu trigger with Space when not typing', async () => {
          const { user } = await render(<TestMenu rootProps={{ open: true }} />);

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          submenuTrigger.focus();
          await flushMicrotasks();

          await user.keyboard('[Space]');
          expect(screen.queryByTestId('submenu')).not.toBe(null);
        });

        it.skipIf(isJSDOM)(
          'matches "Item 2" after "Item " currently matches "Item 1"',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: () => (
                    <>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                      <Menu.Item>Item 3</Menu.Item>
                    </>
                  ),
                }}
              />,
            );

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const item2 = screen.getByTestId('item-2');

            item1.focus();
            await flushMicrotasks();

            await user.keyboard('Item 2');
            expect(item2).toHaveFocus();
          },
        );

        it.skipIf(isJSDOM)(
          'matches a submenu trigger label after a space + numeric suffix',
          async () => {
            const { user } = await render(
              <TestMenu
                rootProps={{ open: true }}
                popupProps={{
                  children: () => (
                    <>
                      <Menu.Item>Item 1</Menu.Item>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger data-testid="submenu-trigger">
                          Item 2
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup data-testid="submenu">
                              <Menu.Item>Nested 2.1</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                      <Menu.Item>Item 3</Menu.Item>
                    </>
                  ),
                }}
              />,
            );

            const item1 = screen.getByRole('menuitem', { name: 'Item 1' });
            const submenuTrigger = screen.getByTestId('submenu-trigger');

            item1.focus();
            await flushMicrotasks();

            await user.keyboard('Item 2');
            expect(submenuTrigger).toHaveFocus();
            expect(screen.queryByTestId('submenu')).toBe(null);
          },
        );
      });
    });

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestMenu rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('interaction type tracking (openMethod)', () => {
        it('should not apply scroll lock when opened via touch', async () => {
          await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
          await fireEvent.mouseDown(trigger);

          const menu = await screen.findByRole('menu');

          const doc = menu.ownerDocument;
          // The lock waits for a timer of 0 ms.
          await wait(0);

          expect(isScrollLocked(doc)).toBe(false);
        });

        it('should apply scroll lock when opened via mouse', async () => {
          const { user } = await render(<TestMenu rootProps={{ modal: true }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const doc = trigger.ownerDocument;

          await user.click(trigger);
          await screen.findByRole('menu');
          // The lock waits for a timer of 0 ms.
          await wait(0);

          expect(isScrollLocked(doc)).toBe(true);
        });
      });

      describe('touch scroll lock', () => {
        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'should apply scroll lock when a touch-opened popup $name covers the viewport width',
          async ({ keepMounted }) => {
            await render(
              <Menu.Root modal>
                <Menu.Trigger>Open</Menu.Trigger>
                <Menu.Portal keepMounted={keepMounted}>
                  <Menu.Positioner data-testid="positioner" style={{ width: 'calc(100vw - 10px)' }}>
                    <Menu.Popup>
                      <Menu.Item>1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);

            const menu = await screen.findByRole('menu');
            const doc = menu.ownerDocument;

            await waitFor(() => {
              expect(isScrollLocked(doc)).toBe(true);
            });
          },
        );

        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'should not apply scroll lock when a touch-opened popup $name is narrower than the viewport',
          async ({ keepMounted }) => {
            await render(
              <Menu.Root modal>
                <Menu.Trigger>Open</Menu.Trigger>
                <Menu.Portal keepMounted={keepMounted}>
                  <Menu.Positioner data-testid="positioner" style={{ width: '240px' }}>
                    <Menu.Popup>
                      <Menu.Item>1</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);

            const menu = await screen.findByRole('menu');
            const doc = menu.ownerDocument;

            await waitSingleFrame();
            await flushMicrotasks();

            expect(isScrollLocked(doc)).toBe(false);
          },
        );
      });
    });

    describe.skipIf(isJSDOM)('mouse interaction', () => {
      it('triggers a menu item and closes the menu on click, drag, release', async () => {
        const openChangeSpy = vi.fn();
        const clickSpy = vi.fn();

        const items = () => [
          <Menu.Item key="1" data-testid="item-1">
            1
          </Menu.Item>,
          <Menu.Item key="2" data-testid="item-2" onClick={clickSpy}>
            2
          </Menu.Item>,
          <Menu.Item key="3" data-testid="item-3">
            3
          </Menu.Item>,
        ];

        await render(
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{ children: items }}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseDown(trigger);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).not.toBe(null);
        });

        await wait(200);

        const item2 = screen.getByTestId('item-2');
        await fireEvent.mouseUp(item2);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(clickSpy.mock.calls.length).toBe(1);

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        // The synthesized drag-release click must carry `detail: 1` so MenuRoot does
        // not classify it as a keyboard (`detail === 0`) activation.
        expect((openChangeSpy.mock.lastCall?.[1].event as MouseEvent).detail).toBe(1);
      });

      it('closes the menu on click, drag outside, release', async () => {
        const openChangeSpy = vi.fn();

        const items = () => [
          <Menu.Item key="1" data-testid="item-1">
            1
          </Menu.Item>,
          <Menu.Item key="2" data-testid="item-2">
            2
          </Menu.Item>,
          <Menu.Item key="3" data-testid="item-3">
            3
          </Menu.Item>,
        ];

        await render(
          <div>
            <TestMenu
              rootProps={{ onOpenChange: openChangeSpy }}
              popupProps={{ children: items }}
            />
            <div data-testid="outside">Outside</div>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        // The browser locator must resolve after pointer-down.
        const backdrop = page.getByRole('presentation').first();

        await userEvent.dragAndDrop(trigger, backdrop);

        await waitFor(() => {
          expect(screen.queryByTestId('menu')).toBe(null);
        });

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.cancelOpen);
      });
    });
  });

  it('starts a tree when no menu is above it', async () => {
    const probe = createProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
      </Menu.Root>,
    );

    const tree = probe.store.state.floatingTreeRoot;
    expect(probe.trees).toHaveLength(1);
    expect(probe.trees[0]).toBe(tree);
    expect(tree.nodesRef.value.map((node) => node.id)).toEqual([probe.store.state.floatingNodeId]);
    expect(probe.store.state.floatingParentNodeId).toBe(null);
  });

  it('a root in the slot of a root is not a submenu', async () => {
    const probe = createProbe();

    await render(
      <Menu.Root>
        <probe.Probe />
        <Menu.Root>
          <probe.Probe />
        </Menu.Root>
      </Menu.Root>,
    );

    expect(probe.trees).toHaveLength(2);
    expect(probe.trees[0]).not.toBe(null);
    expect(probe.trees[1]).not.toBe(null);
    expect(probe.trees[1]).not.toBe(probe.trees[0]);
    expect(probe.store.state.parent.type).toBe(undefined);
  });

  it('reads the state of its parent menu when it is a submenu', async () => {
    const parent = createProbe();
    const submenu = createProbe();
    const Submenu = createRootPart({ isSubmenu: true });
    const ParentNode = defineComponent({
      setup(_, { slots }) {
        provideFloatingNode('parent-node');
        return () => slots.default?.();
      },
    });

    await render(
      <Menu.Root>
        <parent.Probe />
        <ParentNode>
          <Submenu>
            <submenu.Probe />
          </Submenu>
        </ParentNode>
      </Menu.Root>,
    );

    expect(submenu.store.state.parent.type).toBe('menu');
    expect(submenu.store.select('rootId')).toBe(parent.store.select('rootId'));
    expect(submenu.store.select('floatingTreeRoot')).toBe(parent.store.state.floatingTreeRoot);
    expect(parent.store.state.floatingTreeRoot.nodesRef.value).toHaveLength(2);
    expect(submenu.store.state.floatingParentNodeId).toBe('parent-node');
    expect(submenu.store.select('modal')).toBe(false);
    expect(submenu.store.context.allowMouseUpTriggerRef).toBe(
      parent.store.context.allowMouseUpTriggerRef,
    );
    expect(submenu.trees[0]).toBe(parent.trees[0]);
  });

  it('gives the orientation, the loop and the escape of the options to its parts', async () => {
    const orientation = shallowRef<'horizontal' | undefined>(undefined);
    const loopFocus = shallowRef<boolean | undefined>(undefined);
    const probe = createProbe();
    await render(() => (
      <Menu.Root orientation={orientation.value} loopFocus={loopFocus.value}>
        <probe.Probe />
      </Menu.Root>
    ));
    const { context } = probe;

    expect(context.orientation.value).toBe('vertical');
    expect(context.loopFocus.value).toBe(true);
    expect(context.allowEscape.value).toBe(true);

    orientation.value = 'horizontal';
    loopFocus.value = false;
    await flushMicrotasks();

    expect(context.orientation.value).toBe('horizontal');
    expect(context.loopFocus.value).toBe(false);

    const allowEscape = shallowRef(false);
    const optionsProbe = createProbe();
    const RootPart = createRootPart({ allowEscape });
    await render(
      <RootPart>
        <optionsProbe.Probe />
      </RootPart>,
    );

    expect(optionsProbe.context.allowEscape.value).toBe(false);

    allowEscape.value = true;

    expect(optionsProbe.context.allowEscape.value).toBe(true);
  });

  it('gives the virtual focus of its options to its context and to a submenu', async () => {
    const virtualFocusRef = shallowRef<HTMLElement | null>(null);
    const plain = createProbe();
    const virtual = createProbe();
    const submenu = createProbe();
    const VirtualFocusRoot = createRootPart({ virtualFocus: true, virtualFocusRef });
    const Submenu = createRootPart({ isSubmenu: true });
    await render(
      <div>
        <Menu.Root>
          <plain.Probe />
        </Menu.Root>
        <VirtualFocusRoot>
          <virtual.Probe />
          <Submenu>
            <submenu.Probe />
          </Submenu>
        </VirtualFocusRoot>
      </div>,
    );

    expect(plain.context.virtualFocus).toBe(false);
    expect(plain.context.parentVirtualFocus).toBe(false);
    expect(plain.store.context.virtualFocusRef).toBe(undefined);
    expect(virtual.context.virtualFocus).toBe(true);
    expect(virtual.context.parentVirtualFocus).toBe(false);
    expect(virtual.store.context.virtualFocusRef).toBe(virtualFocusRef);
    expect(submenu.context.virtualFocus).toBe(false);
    expect(submenu.context.parentVirtualFocus).toBe(true);
  });

  describe('open state', () => {
    it('emits openChange and then update:open', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <probe.Probe />
        </Menu.Root>,
      );

      probe.store.setOpen(true, imperativeActionDetails());

      expect(events).toEqual([
        ['openChange', true, 'imperative-action'],
        ['update:open', true],
      ]);
    });

    it('does not emit update:open after cancel()', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          defaultOpen
          onOpenChange={(open, details) => {
            events.push(['openChange', open]);
            details.cancel();
          }}
          onUpdate:open={(open) => events.push(['update:open', open])}
        >
          <probe.Probe />
        </Menu.Root>,
      );

      probe.store.setOpen(false, imperativeActionDetails());

      expect(events).toEqual([['openChange', false]]);
      expect(probe.store.state.open).toBe(true);
    });

    it('follows v-model:open', async () => {
      const open = shallowRef(false);
      const probe = createProbe();
      const { getByRole } = await render(() => (
        <Menu.Root
          open={open.value}
          triggerId="trigger"
          onUpdate:open={(nextOpen) => {
            open.value = nextOpen;
          }}
        >
          <probe.Probe />
          <TestTrigger id="trigger" />
        </Menu.Root>
      ));
      const trigger = getByRole('button');

      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      open.value = true;
      await flushMicrotasks();

      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      probe.store.setOpen(false, imperativeActionDetails());
      await flushMicrotasks();

      expect(open.value).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });

    it('closes with Escape and marks the close as instant', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByRole } = await render(
        <Menu.Root
          defaultOpen
          defaultTriggerId="trigger"
          onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
          onUpdate:open={(open) => events.push(['update:open', open])}
          onOpenChangeComplete={(open) => events.push(['openChangeComplete', open])}
        >
          <probe.Probe />
          <TestTrigger id="trigger" />
          <TestPopup />
        </Menu.Root>,
      );
      const trigger = getByRole('button');

      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      await waitFor(() => {
        expect(events).toContainEqual(['openChangeComplete', false]);
      });

      expect(events).toEqual([
        ['openChange', false, 'escape-key'],
        ['update:open', false],
        ['openChangeComplete', false],
      ]);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(probe.store.select('instantType')).toBe('dismiss');
    });

    it('does not close for Escape while it is disabled', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root defaultOpen disabled onOpenChange={(open) => events.push(open)}>
          <probe.Probe />
        </Menu.Root>,
      );

      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(events).toEqual([]);
      expect(probe.store.state.open).toBe(true);
    });

    it('closes for a press outside, and stays open for a press in the popup', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <Menu.Root
            defaultOpen
            onOpenChange={(open, details) =>
              events.push([open, details.reason, details.event.type])
            }
          >
            <probe.Probe />
            <TestPopup />
          </Menu.Root>
        </div>,
      );

      await fireEvent.pointerDown(getByTestId('popup'), { pointerType: 'mouse' });

      expect(events).toEqual([]);

      await fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      expect(events).toEqual([[false, 'outside-press', 'pointerdown']]);
    });

    it('exposes close and unmount', async () => {
      const events: unknown[] = [];
      let root!: ComponentPublicInstance;
      await render(() => (
        <Menu.Root
          ref={(instance) => {
            root = instance as ComponentPublicInstance;
          }}
          defaultOpen
          onOpenChange={(open, details) => events.push([open, details.reason])}
        />
      ));

      expect(Object.keys(root).sort()).toEqual(['close', 'unmount']);

      (root as unknown as { close(): void }).close();

      expect(events).toEqual([[false, 'imperative-action']]);
    });
  });

  describe('open change requests', () => {
    it('drops a request that comes before the root is mounted', async () => {
      const events: unknown[] = [];
      let store!: MenuStore<unknown>;
      const RequestWhenMounted = defineComponent({
        setup() {
          store = useMenuRootContext().store;
          onMounted(() => {
            store.setOpen(true, imperativeActionDetails());
          });
          return () => null;
        },
      });

      await render(
        <Menu.Root onOpenChange={(open) => events.push(open)}>
          <RequestWhenMounted />
        </Menu.Root>,
      );

      expect(events).toEqual([]);
      expect(store.state.open).toBe(false);
    });

    it('reports two equal open requests of one tick', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle} onOpenChange={(open) => events.push(open)}>
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );

      handle.open('trigger');
      handle.open('trigger');

      expect(events).toEqual([true, true]);
    });

    it('drops a request that is equal to the rendered state', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle} onOpenChange={(open) => events.push(open)}>
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );
      handle.open('trigger');
      await flushMicrotasks();

      handle.open('trigger');

      expect(events).toEqual([true]);
      expect(handle.isOpen).toBe(true);
    });

    it('drops a request that comes after the unmount', async () => {
      const probe = createProbe();
      const { unmount } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
        </Menu.Root>,
      );
      const { store } = probe;

      unmount();
      store.setOpen(false, imperativeActionDetails());

      expect(store.state.open).toBe(true);
    });
  });

  describe('handle', () => {
    it('opens and closes from the handle and reports isOpen', async () => {
      const events: unknown[] = [];
      const handle = Menu.createHandle<number>();
      await render(
        <Menu.Root
          handle={handle}
          onOpenChange={(open, details) => events.push([open, details.reason, details.trigger?.id])}
        >
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );

      expect(handle.isOpen).toBe(false);

      handle.open('trigger');
      expect(handle.isOpen).toBe(true);
      await flushMicrotasks();

      handle.close();
      handle.close();
      expect(handle.isOpen).toBe(false);

      expect(events).toEqual([
        [true, 'imperative-action', 'trigger'],
        [false, 'imperative-action', 'trigger'],
      ]);
    });

    it('throws when open() names no registered trigger', async () => {
      const handle = Menu.createHandle();
      await render(<Menu.Root handle={handle} />);

      expect(() => handle.open('missing')).toThrow(/Vase UI: MenuHandle\.open\(\)/);
    });
  });

  it('gives the id that the popup registers to the store', async () => {
    const probe = createProbe();
    await render(
      <Menu.Root>
        <probe.Probe />
      </Menu.Root>,
    );
    const { context, store } = probe;
    const generated = context.generatedPopupId;

    expect(store.select('popupId')).toBe(generated);
    expect(store.select('defaultPopupId')).toBe(generated);

    context.setRenderedPopupId('custom');
    await flushMicrotasks();

    expect(store.select('popupId')).toBe('custom');
    expect(store.select('defaultPopupId')).toBe('custom');

    context.setRenderedPopupId('');
    await flushMicrotasks();

    expect(store.select('popupId')).toBe(undefined);
    expect(store.select('defaultPopupId')).toBe(undefined);

    context.setRenderedPopupId(undefined);
    await flushMicrotasks();

    expect(store.select('popupId')).toBe(generated);
    expect(store.select('defaultPopupId')).toBe(generated);
  });

  describe('itemHighlighted', () => {
    function createItems(...ids: string[]) {
      return ids.map((id) => {
        const element = document.createElement('div');
        element.id = id;
        document.body.append(element);
        onTestFinished(() => {
          element.remove();
        });
        return element;
      });
    }

    it('reports the item after the DOM update, with the reason, the event and the label', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root
          onItemHighlighted={(item, details) =>
            events.push([item?.id, details.reason, details.label, details.event.type])
          }
        >
          <probe.Probe />
        </Menu.Root>,
      );
      const { store } = probe;
      store.context.itemDomElements.value = createItems('first', 'second');
      store.context.itemLabels.value = ['First', 'Second'];

      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));

      expect(events).toEqual([]);

      await flushMicrotasks();

      expect(events).toEqual([['second', 'keyboard', 'Second', 'keydown']]);

      store.setActiveIndex(null, 'none');
      await flushMicrotasks();

      expect(events[1]).toEqual([undefined, 'none', undefined, 'vase-ui']);
    });

    it('reports nothing when the registry settles with the same item', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item) => events.push(item?.id)}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      store.context.itemDomElements.value = createItems('first', 'second');
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      context.syncHighlightedItem();

      expect(events).toEqual(['second']);

      store.setActiveIndex(0, 'keyboard', new KeyboardEvent('keydown'));
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      expect(events).toEqual(['second']);
    });

    it('reports another element at the same index with the reason none', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item, details) => events.push([item?.id, details.reason])}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      const [first, second, third] = createItems('first', 'second', 'third');
      store.context.itemDomElements.value = [first, second];
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      store.setActiveIndex(0, 'keyboard', new KeyboardEvent('keydown'));
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      store.context.itemDomElements.value = [first, third];
      context.syncHighlightedItem();

      expect(events).toEqual([
        ['second', 'keyboard'],
        ['third', 'none'],
      ]);
    });

    it('reports nothing for an item that left the document', async () => {
      const events: unknown[] = [];
      const probe = createProbe();
      await render(
        <Menu.Root onItemHighlighted={(item) => events.push(item?.id)}>
          <probe.Probe />
        </Menu.Root>,
      );
      const { context, store } = probe;
      const [first, second, removed] = createItems('first', 'second', 'removed');
      store.context.itemDomElements.value = [first, second];
      store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      await flushMicrotasks();

      removed.remove();
      store.context.itemDomElements.value = [first, removed];
      context.syncHighlightedItem();

      expect(events).toEqual(['second']);
    });

    it('publishes the highlighted item to the store only under virtual focus', async () => {
      const plain = createProbe();
      const virtual = createProbe();
      const VirtualFocusRoot = createRootPart({ virtualFocus: true });
      await render(
        <div>
          <Menu.Root>
            <plain.Probe />
          </Menu.Root>
          <VirtualFocusRoot>
            <virtual.Probe />
          </VirtualFocusRoot>
        </div>,
      );
      const items = createItems('first', 'second');
      for (const { store } of [plain, virtual]) {
        store.context.itemDomElements.value = items;
        store.setActiveIndex(1, 'keyboard', new KeyboardEvent('keydown'));
      }
      await flushMicrotasks();

      expect(virtual.store.state.highlightedItem).toBe(items[1]);
      expect(plain.store.state.highlightedItem).toBe(undefined);
    });
  });

  describe('dismissal', () => {
    // The components of each menu are not in the components of the menu above it, so only the
    // popup tree tells a menu that a press is in a menu below it.
    it('keeps a menu open for a press in a menu that a trigger in its popup opened', async () => {
      const middleHandle = Menu.createHandle();
      const innerHandle = Menu.createHandle();
      const { findByTestId, getByRole, queryByTestId } = await render(
        <div>
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Trigger handle={middleHandle} id="middle-trigger">
                    Middle
                  </Menu.Trigger>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root handle={middleHandle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="middle-menu">
                  <Menu.Trigger handle={innerHandle} id="inner-trigger">
                    Inner
                  </Menu.Trigger>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root handle={innerHandle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="inner-menu">
                  <Menu.Item>Beta</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>,
      );

      middleHandle.open('middle-trigger');
      await findByTestId('middle-menu');
      innerHandle.open('inner-trigger');
      await findByTestId('inner-menu');

      await fireEvent.pointerDown(getByRole('menuitem', { name: 'Beta' }));
      await flushMicrotasks();

      expect(queryByTestId('inner-menu')).not.toBe(null);
      expect(queryByTestId('middle-menu')).not.toBe(null);
    });
  });

  describe('keys', () => {
    function renderMenu(rootProps: Record<string, unknown> = {}, labels = ['One', 'Two', 'Three']) {
      return render(
        <Menu.Root open {...rootProps}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {labels.map((label) => (
                  <Menu.Item key={label}>{label}</Menu.Item>
                ))}
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    }

    const getItem = (name: string) => screen.getByRole('menuitem', { name });
    const getHighlighted = () =>
      screen
        .getAllByRole('menuitem')
        .filter((item) => item.hasAttribute('data-highlighted'))
        .map((item) => item.textContent);

    async function focusItem(name: string) {
      const item = getItem(name);
      item.focus();
      await flushMicrotasks();
      return item;
    }

    it.each([
      { name: 'vertical', orientation: 'vertical', next: 'ArrowDown', previous: 'ArrowUp' },
      { name: 'horizontal', orientation: 'horizontal', next: 'ArrowRight', previous: 'ArrowLeft' },
    ] as const)(
      'moves the highlight with the arrow keys of a $name menu',
      async ({ orientation, next, previous }) => {
        const { user } = await renderMenu({ orientation });
        await focusItem('One');

        await user.keyboard(`[${next}]`);
        await waitFor(() => {
          expect(getItem('Two')).toHaveFocus();
        });

        await user.keyboard(`[${previous}]`);
        await waitFor(() => {
          expect(getItem('One')).toHaveFocus();
        });
      },
    );

    it('moves the highlight from the trigger of an open menu with a typeahead and the arrow keys', async () => {
      const { user } = await render(
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Menu.Item>Two</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('t');
      await waitFor(() => {
        expect(getItem('Two')).toHaveFocus();
      });

      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getItem('One')).toHaveFocus();
      });
    });

    it.each([
      { name: 'loopFocus', loopFocus: true, target: 'One' },
      { name: 'no loopFocus', loopFocus: false, target: 'Three' },
    ])('moves from the last item to $target with $name', async ({ loopFocus, target }) => {
      const { user } = await renderMenu({ loopFocus });
      await focusItem('Three');

      await user.keyboard('[ArrowDown]');
      await flushMicrotasks();

      expect(getHighlighted()).toEqual([target]);
      await waitFor(() => {
        expect(getItem(target)).toHaveFocus();
      });
    });

    it('reports the focus, the key or the pointer that moved the highlight', async () => {
      const events: unknown[] = [];
      const { user } = await renderMenu({
        onItemHighlighted: (
          item: HTMLElement | undefined,
          details: MenuRootHighlightEventDetails,
        ) => events.push([item?.textContent, details.reason, details.event.type]),
      });
      await focusItem('One');
      await user.keyboard('[ArrowDown]');
      await flushMicrotasks();
      // In WebKit, the list ignores a move with no movement: the browser sends it when the list
      // scrolls under the pointer.
      await fireEvent.mouseMove(getItem('Three'), { movementX: 1, movementY: 1 });
      await flushMicrotasks();

      expect(events).toEqual([
        ['One', 'none', 'focusin'],
        ['Two', 'keyboard', 'keydown'],
        ['Three', 'pointer', 'mousemove'],
      ]);
    });

    it.each([
      { name: 'by default', highlightItemOnHover: undefined, highlighted: ['Two'] },
      { name: 'with highlightItemOnHover false', highlightItemOnHover: false, highlighted: [] },
    ])('highlights an item that the pointer moves over $name', async (testCase) => {
      await renderMenu({ highlightItemOnHover: testCase.highlightItemOnHover });

      await fireEvent.mouseMove(getItem('Two'), { movementX: 1, movementY: 1 });
      await flushMicrotasks();

      expect(getHighlighted()).toEqual(testCase.highlighted);
    });

    it('ignores the arrow keys and the typeahead while it is disabled', async () => {
      const { user } = await renderMenu({ disabled: true });
      const one = await focusItem('One');

      await user.keyboard('[ArrowDown]t');
      await flushMicrotasks();

      expect(one).toHaveFocus();
      expect(getHighlighted()).toEqual([]);
    });

    it('starts a new typeahead 500 ms after the last key', async () => {
      useFakeTimers();
      await renderMenu({}, ['Alpha', 'Bravo', 'Charlie']);
      const alpha = await focusItem('Alpha');

      await fireEvent.keyDown(alpha, { key: 'b' });
      expect(getHighlighted()).toEqual(['Bravo']);

      vi.advanceTimersByTime(500);
      await fireEvent.keyDown(getItem('Bravo'), { key: 'c' });

      expect(getHighlighted()).toEqual(['Charlie']);
    });

    it.each([
      {
        name: 'horizontal',
        orientation: 'horizontal',
        openKey: 'ArrowDown',
        otherKey: 'ArrowRight',
      },
      { name: 'vertical', orientation: 'vertical', openKey: 'ArrowRight', otherKey: 'ArrowDown' },
    ] as const)(
      'opens a menu of a $name menubar with $openKey only',
      async ({ orientation, openKey, otherKey }) => {
        const { user } = await render(
          <Menubar orientation={orientation}>
            <Menu.Root>
              <Menu.Trigger>File</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>New</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menubar>,
        );
        screen.getByRole('menuitem', { name: 'File' }).focus();
        await flushMicrotasks();

        await user.keyboard(`[${otherKey}]`);
        await flushMicrotasks();

        expect(screen.queryByRole('menu')).toBe(null);

        await user.keyboard(`[${openKey}]`);

        await waitFor(() => {
          expect(getItem('New')).toHaveFocus();
        });
      },
    );

    it('VUE-46: moves the highlight of a horizontal parent menu with a key that closes the submenu', async () => {
      const { user } = await render(
        <Menu.Root open orientation="horizontal">
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Alpha</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu">
                        <Menu.Item>Monthly</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      await focusItem('More');

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(getItem('Monthly')).toHaveFocus();
      });

      await user.keyboard('[ArrowLeft]');

      await waitFor(() => {
        expect(getItem('Alpha')).toHaveFocus();
      });
      expect(screen.queryByTestId('submenu')).toBe(null);
    });

    it('closes a context menu with Tab', async () => {
      const events: unknown[] = [];
      const { user } = await render(
        <ContextMenuProvider context={createContextMenuContext()}>
          <Menu.Root
            defaultOpen
            onOpenChange={(open: boolean, details: MenuRootChangeEventDetails) =>
              events.push([open, details.reason])
            }
          >
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>One</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </ContextMenuProvider>,
      );
      await focusItem('One');

      await user.keyboard('[Tab]');

      expect(events).toEqual([[false, REASONS.focusOut]]);
    });

    it('gives the keys of the reference to the element that holds the focus under virtual focus', async () => {
      const plain = createProbe();
      const virtual = createProbe();
      const VirtualFocusRoot = createRootPart({ virtualFocus: true });
      await render(
        <div>
          <Menu.Root>
            <plain.Probe />
          </Menu.Root>
          <VirtualFocusRoot>
            <virtual.Probe />
          </VirtualFocusRoot>
        </div>,
      );

      expect(plain.store.state.inputProps).toEqual({});
      expect(virtual.store.state.inputProps).toHaveProperty('onKeydown');
      expect(plain.store.select('triggerProps', true)).toHaveProperty('onFocusin');
      expect(virtual.store.select('triggerProps', true)).not.toHaveProperty('onFocusin');
      expect(virtual.store.select('triggerProps', true)).toHaveProperty('onKeydown');
    });
  });

  describe('popup', () => {
    it('sets allowMouseEnter for a mouse move over the popup, and clears it after the unmount', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(getByTestId('popup')).toHaveAttribute('tabindex', '-1');
      expect(store.state.allowMouseEnter).toBe(false);

      await fireEvent.mouseMove(getByTestId('popup'));

      expect(store.state.allowMouseEnter).toBe(true);

      store.setOpen(false, imperativeActionDetails());
      await waitFor(() => {
        expect(store.state.mounted).toBe(false);
      });

      expect(store.state.allowMouseEnter).toBe(false);
    });

    it('sets allowMouseEnter for a mouse move over the active trigger', async () => {
      const probe = createProbe();
      const { getByRole } = await render(
        <Menu.Root defaultOpen defaultTriggerId="trigger">
          <probe.Probe />
          <TestTrigger id="trigger" />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(store.state.allowMouseEnter).toBe(false);

      await fireEvent.mouseMove(getByRole('button'));

      expect(store.state.allowMouseEnter).toBe(true);
    });

    it.each([
      { name: 'a root with no parent', isSubmenu: false, hoverEnabled: true },
      { name: 'a submenu root', isSubmenu: true, hoverEnabled: false },
    ])(
      'sets hoverEnabled to $hoverEnabled for a mouse move over the popup of $name',
      async ({ isSubmenu, hoverEnabled }) => {
        const probe = createProbe();
        const Part = createRootPart({ isSubmenu });
        const { getByTestId } = await render(
          <Menu.Root>
            <Part>
              <probe.Probe />
              <TestPopup />
            </Part>
          </Menu.Root>,
        );
        const { store } = probe;
        store.setOpen(true, imperativeActionDetails());
        await flushMicrotasks();

        expect(store.state.hoverEnabled).toBe(true);

        await fireEvent.mouseMove(getByTestId('popup'));

        expect(store.state.hoverEnabled).toBe(hoverEnabled);
      },
    );

    it('turns the hover off for a click in the popup, and on again after the close', async () => {
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup />
        </Menu.Root>,
      );
      const { store } = probe;

      expect(store.state.hoverEnabled).toBe(true);

      await fireEvent.click(getByTestId('popup'));

      expect(store.state.hoverEnabled).toBe(false);

      store.setOpen(false, imperativeActionDetails());
      await flushMicrotasks();

      expect(store.state.hoverEnabled).toBe(true);
    });

    it('gives a key of the popup to the keyboard relay, unless a handler stopped it', async () => {
      const relay = vi.fn();
      let stopKey = false;
      const probe = createProbe();
      const { getByTestId } = await render(
        <Menu.Root defaultOpen>
          <probe.Probe />
          <TestPopup
            onKeydown={(event: KeyboardEvent) => {
              if (stopKey) {
                event.stopPropagation();
              }
            }}
          />
        </Menu.Root>,
      );
      probe.store.set('keyboardEventRelay', relay);

      // The list navigation and the typeahead of a vertical menu do not stop the horizontal arrow
      // keys. The menubar gets these keys.
      await fireEvent.keyDown(getByTestId('popup'), { key: 'ArrowRight' });

      expect(relay).toHaveBeenCalledTimes(1);
      expect(relay.mock.calls[0][0].key).toBe('ArrowRight');

      stopKey = true;
      await fireEvent.keyDown(getByTestId('popup'), { key: 'ArrowLeft' });

      expect(relay).toHaveBeenCalledTimes(1);
    });
  });

  describe('modal', () => {
    it('follows the modal prop', async () => {
      const modal = shallowRef<boolean | undefined>(undefined);
      const probe = createProbe();
      await render(() => (
        <Menu.Root modal={modal.value}>
          <probe.Probe />
        </Menu.Root>
      ));

      expect(probe.store.select('modal')).toBe(true);

      modal.value = false;
      await flushMicrotasks();

      expect(probe.store.select('modal')).toBe(false);
    });

    it('follows the disabled prop and the highlightItemOnHover prop', async () => {
      const disabled = shallowRef(false);
      const highlightItemOnHover = shallowRef(true);
      const probe = createProbe();
      await render(() => (
        <Menu.Root disabled={disabled.value} highlightItemOnHover={highlightItemOnHover.value}>
          <probe.Probe />
        </Menu.Root>
      ));

      expect(probe.store.select('disabled')).toBe(false);
      expect(probe.store.select('highlightItemOnHover')).toBe(true);

      disabled.value = true;
      highlightItemOnHover.value = false;
      await flushMicrotasks();

      expect(probe.store.select('disabled')).toBe(true);
      expect(probe.store.select('highlightItemOnHover')).toBe(false);
    });

    it('clears the open method when the menu closes, so an open with no press takes the scroll lock', async () => {
      const handle = Menu.createHandle();
      await render(
        <Menu.Root handle={handle}>
          <Menu.Trigger id="trigger">Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner style={{ width: '240px' }}>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Open' });

      // A touch open of a popup that is narrower than the viewport takes no lock.
      await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
      await fireEvent.mouseDown(trigger);
      await screen.findByRole('menu');
      await wait(0);
      expect(isScrollLocked(document)).toBe(false);

      handle.close();
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      handle.open('trigger');
      await screen.findByRole('menu');
      await waitFor(() => {
        expect(isScrollLocked(document)).toBe(true);
      });
    });

    it('warns that a menu in a menubar ignores modal={false}', async () => {
      resetWarnings();
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      onTestFinished(() => {
        warn.mockRestore();
      });
      const context = createMenubarContext();

      await render(
        <MenubarProvider context={context}>
          <Menu.Root />
          <Menu.Root modal />
        </MenubarProvider>,
      );

      expect(warn).not.toHaveBeenCalled();

      await render(
        <MenubarProvider context={context}>
          <Menu.Root modal={false} />
        </MenubarProvider>,
      );

      expect(warn).toHaveBeenCalledTimes(1);
      expect(warn).toHaveBeenCalledWith(
        expect.stringMatching(/^Vase UI: The `modal` prop of <Menu\.Root> is `false`/),
      );
    });
  });

  describe('in a menubar', () => {
    it('reads the id, the disabled state and the mouse-up ref of the menubar', async () => {
      const disabled = shallowRef(false);
      const allowMouseUpTriggerRef = shallowRef(false);
      const context = createMenubarContext({
        disabled: computed(() => disabled.value),
        allowMouseUpTriggerRef,
      });
      const probe = createProbe();
      await render(
        <MenubarProvider context={context}>
          <Menu.Root>
            <probe.Probe />
          </Menu.Root>
        </MenubarProvider>,
      );
      const { store } = probe;
      const storeDisabled = computed(() => store.select('disabled'));

      expect(store.state.parent.type).toBe('menubar');
      expect(store.select('rootId')).toBe('menubar');
      expect(store.select('modal')).toBe(false);
      expect(store.context.allowMouseUpTriggerRef).toBe(allowMouseUpTriggerRef);
      expect(storeDisabled.value).toBe(false);

      disabled.value = true;

      expect(storeDisabled.value).toBe(true);
    });
  });

  describe('in a context menu', () => {
    it('gives setOpen and the positioner to the context menu and takes them back at the unmount', async () => {
      const context = createContextMenuContext();
      const probe = createProbe();
      const { unmount } = await render(
        <ContextMenuProvider context={context}>
          <Menu.Root>
            <probe.Probe />
          </Menu.Root>
        </ContextMenuProvider>,
      );
      const { store } = probe;
      const positioner = document.createElement('div');

      expect(store.state.parent.type).toBe('context-menu');
      expect(store.select('rootId')).toBe('context-menu');
      expect(store.select('modal')).toBe(true);
      expect(context.actionsRef.value?.setOpen).toBe(store.setOpen);

      store.set('positionerElement', positioner);
      await flushMicrotasks();

      expect(context.positionerRef.value).toBe(positioner);

      unmount();

      expect(context.actionsRef.value).toBe(null);
      expect(context.positionerRef.value).toBe(null);
    });

    it('does not close for a press outside in the first 500 ms, unless a contextmenu event opened it', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root onOpenChange={(open) => events.push(open)}>
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
      );
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('contextmenu')),
      );
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true, false, true, false]);
    });

    it('gives each open of a context menu its own grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const probe = createProbe();
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root onOpenChange={(open) => events.push(open)}>
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });
      const openWithMousedown = () =>
        store.setOpen(
          true,
          createChangeEventDetails(REASONS.triggerPress, new MouseEvent('mousedown')),
        );

      openWithMousedown();
      await flushMicrotasks();
      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);

      openWithMousedown();
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true, false, true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false, true, false]);
    });

    it('gives a context menu that mounts open the grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const { getByTestId } = await render(
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root defaultOpen onOpenChange={(open) => events.push(open)}>
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>,
      );
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      await pressOutside();

      expect(events).toEqual([]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([false]);
    });

    it('forgets the contextmenu event of the last open, so that the next open has the grace time', async () => {
      useFakeTimers();
      const events: unknown[] = [];
      const open = shallowRef(false);
      const probe = createProbe();
      const { getByTestId } = await render(() => (
        <div>
          <button data-testid="outside" />
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen) => events.push(nextOpen)}
              onUpdate:open={(nextOpen) => {
                open.value = nextOpen;
              }}
            >
              <probe.Probe />
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        </div>
      ));
      const { store } = probe;
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      store.setOpen(
        true,
        createChangeEventDetails(REASONS.triggerPress, new MouseEvent('contextmenu')),
      );
      await flushMicrotasks();

      expect(store.context.lastOpenChangeEvent?.type).toBe('contextmenu');

      open.value = false;
      await flushMicrotasks();

      expect(store.context.lastOpenChangeEvent).toBe(undefined);

      open.value = true;
      await flushMicrotasks();
      await pressOutside();

      expect(events).toEqual([true]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([true, false]);
    });
  });

  it('VUE-5: keeps its open state under KeepAlive and hears no Escape while deactivated', async () => {
    const events: unknown[] = [];
    const visible = shallowRef(true);
    const probe = createProbe();
    const Branch = defineComponent({
      setup: () => () => (
        <Menu.Root
          defaultOpen
          onOpenChange={(open, details) => events.push([open, details.reason])}
        >
          <probe.Probe />
          <TestPopup />
        </Menu.Root>
      ),
    });
    const Other = defineComponent({ setup: () => () => <span /> });
    await render(() => (
      <KeepAlive>{visible.value ? <Branch key="branch" /> : <Other key="other" />}</KeepAlive>
    ));

    visible.value = false;
    await flushMicrotasks();
    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(events).toEqual([]);
    expect(probe.store.state.open).toBe(true);

    visible.value = true;
    await flushMicrotasks();
    await fireEvent.keyDown(document.body, { key: 'Escape' });

    expect(events).toEqual([[false, 'escape-key']]);
  });

  describe('server render', () => {
    it('renders the trigger of an open root as open, and a detached trigger with no open state', async () => {
      const serverHtml = await renderOnServer('src/menu/root/MenuRootHydration.test.vue', {});
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      const triggers = Array.from(template.content.querySelectorAll('button'));
      expect(triggers.map((trigger) => trigger.id)).toEqual(['in-root', 'detached']);
      expect(triggers[0].getAttribute('aria-expanded')).toBe('true');
      expect(triggers[0].hasAttribute('data-popup-open')).toBe(true);
      expect(triggers[1].getAttribute('aria-haspopup')).toBe('menu');
      expect(triggers[1].hasAttribute('aria-expanded')).toBe(false);
      expect(triggers[1].hasAttribute('data-popup-open')).toBe(false);
      expect(template.content.querySelector('[role="menu"]')).toBe(null);
    });

    it('hydrates an open root, a trigger of a handle and their portals, with no message', async () => {
      const serverHtml = await renderOnServer('src/menu/root/MenuRootHydration.test.vue', {});

      await hydrate(MenuRootHydration, { serverHtml });
    });

    it('puts the focus guards beside the trigger of an open root only after the hydration', async () => {
      const serverHtml = await renderOnServer('src/menu/root/MenuRootHydration.test.vue', {});
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(template.content.querySelectorAll(`[${createAttribute('focus-guard')}]`)).toHaveLength(
        0,
      );

      const { container } = await hydrate(MenuRootHydration, { serverHtml });
      await flushMicrotasks();

      const trigger = within(container).getByRole('button', { name: 'Open' });
      expect(
        [trigger.previousElementSibling, trigger.nextElementSibling].map(
          (sibling) => sibling?.hasAttribute(createAttribute('focus-guard')) ?? false,
        ),
      ).toEqual([true, true]);
    });
  });
});
