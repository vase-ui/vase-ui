import { triggerBindings, popupBindings } from '../../utils/popups/popupBindings';
import userEvent from '@testing-library/user-event';
import type { CDPSession } from '@vitest/browser-playwright';
import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { page, userEvent as browserUserEvent } from 'vitest/browser';
import { KeepAlive, computed, defineComponent, onMounted, onUpdated, shallowRef, watch } from 'vue';
import type { ComponentPublicInstance, PropType } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import { Menubar } from '@vase-ui/vue/menubar';
import {
  clientCenter,
  createHeldBranch,
  createRenderer,
  enterWithMouse,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  moveMouse,
  nextEvent,
  popupAnatomyTests,
  popupConformanceTests,
  popupListConformanceTests,
  pressWithScreenReader,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
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
import { platform } from '../../common/platform';
import { reset as resetWarnings } from '../../common/warn';
import * as ContextMenu from '../../context-menu/index.parts';
import * as Dialog from '../../dialog/index.parts';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { createAttribute } from '../../utils/popups/createAttribute';
import { useTriggerRegistration } from '../../utils/popups/usePopupTrigger';
import { provideFloatingNode, useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import * as Menu from '../index.parts';
import type { MenuStore } from '../store/MenuStore';
import type { MenuRootChangeEventDetails, MenuRootHighlightEventDetails } from './MenuRoot.vue';
import { useMenuRootContext } from './MenuRootContext';
import type { MenuRootContext } from './MenuRootContext';
import MenuRootHydration from './MenuRootHydration.test.vue';
import MenuRootTriggerRenderCost from './MenuRootTriggerRenderCost.test.vue';
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
      <button id={props.id} {...triggerBindings(store, isActive.value)} ref={setElement} />
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
          {...popupBindings(store)}
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

async function tick(ms: number) {
  vi.advanceTimersByTime(ms);
  await flushMicrotasks();
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

// A `render` function in `triggerProps` becomes the `#render` slot of the trigger.
function renderTrigger(triggerProps: PartProps | undefined) {
  const { render: renderSlot, ...rest } = triggerProps ?? {};
  return typeof renderSlot === 'function' ? (
    <Menu.Trigger {...rest} v-slots={{ render: renderSlot }} />
  ) : (
    <Menu.Trigger {...rest}>Toggle</Menu.Trigger>
  );
}

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
        {renderTrigger(props.triggerProps)}
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
        {renderTrigger({ ...props.triggerProps, handle: menuHandle })}
      </>
    );
  },
});

describe('<Menu.Root />', () => {
  const { render } = createRenderer();

  popupAnatomyTests({
    held: {
      createRoot: ({ open, onOpenChangeComplete, keepMounted, content }) => (
        <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal keepMounted={keepMounted}>{content}</Menu.Portal>
        </Menu.Root>
      ),
      createPopup: () => (
        <Menu.Positioner>
          <Menu.Popup data-testid="popup">Popup</Menu.Popup>
        </Menu.Positioner>
      ),
    },
    createComponent: ({ open, onOpenChangeComplete, content }) => (
      <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner data-testid="shown" class="shown">
            Content
            {content}
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    createPopup: () => <Menu.Popup data-testid="popup">Popup</Menu.Popup>,
    createBackdropComponent: ({ open, onOpenChangeComplete }) => (
      <Menu.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Backdrop data-testid="shown" class="shown" />
        </Menu.Portal>
      </Menu.Root>
    ),
    createPendingPositionerComponent: ({ Pending, onOpenChange }) => (
      <Menu.Root defaultOpen onOpenChange={onOpenChange}>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Pending>
            <Menu.Positioner data-testid="shown">
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Pending>
        </Menu.Portal>
      </Menu.Root>
    ),
    render,
  });

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
    await waitForLaterMillisecond(async () => {
      await user.click(trigger);
      await screen.findByRole('menu');
    });
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
    expect(screen.queryByRole('menu')).toBe(null);
    expect(trigger).toHaveFocus();
  });

  it('VUE-69: moves the focus to the trigger for Shift+Tab when the root cancels the close', async () => {
    const reasons: string[] = [];
    await render(
      <Menu.Root
        defaultOpen
        onOpenChange={(open: boolean, details: Menu.Root.ChangeEventDetails) => {
          reasons.push(details.reason);
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

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    const menu = screen.getByRole('menu');
    await waitFor(() => {
      expect(menu).toHaveFocus();
    });

    await browserUserEvent.keyboard('{Shift>}[Tab]{/Shift}');

    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(menu).toBeInTheDocument();
    expect(reasons).toEqual([REASONS.focusOut]);

    await browserUserEvent.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(screen.getByRole('menuitem')).toHaveFocus();
    });
  });

  it.each([
    { name: 'Tab', shift: false },
    { name: 'Shift+Tab', shift: true },
  ])(
    'VUE-69: keeps the focus in a context menu for $name when the root cancels the close',
    async ({ shift }) => {
      const reasons: string[] = [];
      await render(
        <ContextMenu.Root
          onOpenChange={(open: boolean, details: ContextMenu.Root.ChangeEventDetails) => {
            reasons.push(details.reason);
            if (!open) {
              details.cancel();
            }
          }}
        >
          <ContextMenu.Trigger as="button">Surface</ContextMenu.Trigger>
          <ContextMenu.Portal>
            <ContextMenu.Positioner>
              <ContextMenu.Popup>
                <ContextMenu.Item>One</ContextMenu.Item>
              </ContextMenu.Popup>
            </ContextMenu.Positioner>
          </ContextMenu.Portal>
        </ContextMenu.Root>,
      );

      const surface = screen.getByRole('button', { name: 'Surface' });
      await fireEvent.contextMenu(surface, { clientX: 20, clientY: 20, button: 2 });
      const menu = await screen.findByRole('menu');
      await waitFor(() => {
        expect(menu).toHaveFocus();
      });

      await browserUserEvent.keyboard(shift ? '{Shift>}[Tab]{/Shift}' : '[Tab]');

      expect(menu).toHaveFocus();
      expect(reasons).toEqual([REASONS.triggerPress, REASONS.focusOut]);
    },
  );

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
      await waitForLaterMillisecond(async () => {
        await enterWithMouse(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'true');
        });
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
        const item = await waitForLaterMillisecond(async () => {
          await pressWithScreenReader(trigger);
          return screen.findByRole('menuitem', { name: 'Delete' });
        });
        await waitFor(() => {
          expect(item).toHaveFocus();
        });
        const cancel = await waitForLaterMillisecond(async () => {
          await pressWithScreenReader(item);
          return screen.findByRole('button', { name: 'Cancel' });
        });
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

        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

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
        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

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

        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

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

        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
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

        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

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

        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));

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

        it('changes the highlighted item using text navigation on label prop', async () => {
          const itemElements = [
            <Menu.Item key="1" label="Aa">
              1
            </Menu.Item>,
            <Menu.Item key="2" label="Ba">
              2
            </Menu.Item>,
            <Menu.Item key="3" label="Bb">
              3
            </Menu.Item>,
            <Menu.Item key="4" label="Ca">
              4
            </Menu.Item>,
          ];

          const { user } = await render(<TestMenu popupProps={{ children: () => itemElements }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const items = await waitForLaterMillisecond(async () => {
            await user.click(trigger);
            return screen.findAllByRole('menuitem');
          });
          // A pointer open gives the focus to the popup one frame later. A key before that frame
          // goes to the trigger.
          await waitFor(() => {
            expect(screen.getByTestId('menu')).toHaveFocus();
          });
          await flushMicrotasks();

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[1]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[1]).toHaveAttribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).toHaveAttribute('tabindex', '0');
          });

          await user.keyboard('b');
          await waitFor(() => {
            expect(items[2]).toHaveFocus();
          });

          await waitFor(() => {
            expect(items[2]).toHaveAttribute('tabindex', '0');
          });
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

    describe('nested menus', () => {
      it.skipIf(isJSDOM).each([
        { orientation: 'vertical', direction: 'ltr', openKey: 'ArrowRight', closeKey: 'ArrowLeft' },
        { orientation: 'vertical', direction: 'rtl', openKey: 'ArrowLeft', closeKey: 'ArrowRight' },
        { orientation: 'horizontal', direction: 'ltr', openKey: 'ArrowDown', closeKey: 'ArrowUp' },
        { orientation: 'horizontal', direction: 'rtl', openKey: 'ArrowDown', closeKey: 'ArrowUp' },
      ] as const)(
        'opens a nested menu of a $orientation $direction menu with $openKey key and closes it with $closeKey',
        async ({ orientation, direction, openKey, closeKey }) => {
          const { user } = await render(
            <DirectionProvider direction={direction}>
              <TestMenu rootProps={{ open: true, orientation }} submenuProps={{ orientation }} />
            </DirectionProvider>,
          );

          const submenuTrigger = screen.getByTestId('submenu-trigger');

          submenuTrigger.focus();
          await flushMicrotasks();

          // This check fails in JSDOM
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          await waitForLaterMillisecond(async () => {
            await user.keyboard(`[${openKey}]`);
            await screen.findByTestId('submenu');
          });

          const submenuItem1 = screen.getByTestId('item-4_1');
          await waitFor(() => {
            expect(submenuItem1).toHaveFocus();
          });

          await user.keyboard(`[${closeKey}]`);

          expect(screen.queryByTestId('submenu')).toBe(null);
          expect(submenuTrigger).toHaveFocus();
        },
      );

      it('opens submenu on click when openOnHover is false', async () => {
        const { user } = await render(<TestMenu submenuTriggerProps={{ openOnHover: false }} />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        const menu = await waitForLaterMillisecond(async () => {
          await user.click(mainTrigger);
          return screen.findByTestId('menu');
        });
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        expect(menu).not.toBe(null);
        expect(await screen.findByTestId('item-4_1')).toHaveTextContent('Item 4.1');
      });

      it('renders root menu portal ownership without an accessibility role', async () => {
        const { user } = await render(<TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(mainTrigger);

        const menu = await screen.findByTestId('menu');
        const menuPortal = menu.closest('[data-vase-ui-portal]');
        const menuPortalId = menuPortal?.id ?? '';
        const owner = menu.ownerDocument.querySelector('span[aria-owns]');

        expect(menuPortalId).not.toBe('');
        expect(owner).toHaveAttribute('aria-owns', menuPortalId);
        expect(owner).not.toHaveAttribute('role');
      });

      it('renders submenu portal ownership as an allowed menu child', async () => {
        const { user } = await render(<TestMenu submenuTriggerProps={{ openOnHover: false }} />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        const menu = await waitForLaterMillisecond(async () => {
          await user.click(mainTrigger);
          return screen.findByTestId('menu');
        });
        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        const submenu = await screen.findByTestId('submenu');
        const submenuPortal = submenu.closest('[data-vase-ui-portal]');
        const submenuPortalId = submenuPortal?.id ?? '';
        const owner = menu.querySelector('span[aria-owns]');

        expect(submenuPortalId).not.toBe('');
        expect(owner).toHaveAttribute('role', 'group');
        expect(owner).toHaveAttribute('aria-owns', submenuPortalId);
        expect(submenuTrigger).not.toHaveAttribute('aria-owns');
      });

      it('keeps the root menu open when a submenu opens and the trigger `render` element has a custom id', async () => {
        const onOpenChange = vi.fn();
        const { user } = await render(
          <TestMenu
            rootProps={{ onOpenChange }}
            triggerProps={{
              render: ({ props }: { props: HTMLProps }) => (
                <button {...props} id="custom-trigger">
                  Toggle
                </button>
              ),
            }}
            submenuTriggerProps={{ openOnHover: false }}
          />,
        );

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(mainTrigger);
          await screen.findByTestId('menu');
        });

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await user.click(submenuTrigger);

        await screen.findByTestId('submenu');

        expect(screen.getByTestId('menu')).not.toBe(null);
        expect(onOpenChange).not.toHaveBeenCalledWith(
          false,
          expect.objectContaining({ reason: REASONS.siblingOpen }),
        );
      });

      it('closes submenus when focus is lost by shift-tabbing from a nested menu', async () => {
        const { user } = await render(<TestMenu />);

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(mainTrigger);
          await screen.findByTestId('menu');
        });
        expect(screen.queryByTestId('submenu')).toBe(null);

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await waitForLaterMillisecond(async () => {
          await user.hover(submenuTrigger);
          await waitFor(() => {
            expect(screen.getByTestId('submenu')).not.toBe(null);
          });
        });

        const submenuItem = await screen.findByTestId('item-4_1');
        submenuItem.focus();
        await flushMicrotasks();

        await waitFor(() => {
          expect(submenuItem).toHaveFocus();
        });

        // Shift+Tab should close the submenu and focus should return to the submenu trigger
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        expect(screen.queryByTestId('submenu')).toBe(null);

        expect(submenuTrigger).toHaveFocus();
        expect(screen.getByTestId('menu')).not.toBe(null);
      });

      it('closes every menu and moves the focus to the next control when tabbing from a nested menu', async () => {
        const { user } = await render(
          <div>
            <TestMenu />
            <input data-testid="after" />
          </div>,
        );

        const mainTrigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(mainTrigger);
          await screen.findByTestId('menu');
        });

        const submenuTrigger = await screen.findByTestId('submenu-trigger');
        await waitForLaterMillisecond(async () => {
          await user.hover(submenuTrigger);
          await screen.findByTestId('submenu');
        });

        const submenuItem = await screen.findByTestId('item-4_1');
        submenuItem.focus();
        await flushMicrotasks();
        expect(submenuItem).toHaveFocus();

        await user.keyboard('{Tab}');

        expect(screen.queryByTestId('menu')).toBe(null);
        expect(screen.queryByTestId('submenu')).toBe(null);
        expect(screen.getByTestId('after')).toHaveFocus();
      });

      it('closes the entire tree when clicking outside the deepest submenu', async () => {
        const { user } = await render(
          <div>
            <TestMenu />
            <button data-testid="outside">Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        const menu = await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          return screen.findByTestId('menu');
        });
        // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
        await waitFor(() => {
          expect(menu).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger1 = await screen.findByTestId('submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger1).toHaveFocus();
        });

        await waitForLaterMillisecond(async () => {
          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('submenu');
        });
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');

        const submenuTrigger2 = await screen.findByTestId('nested-submenu-trigger');
        await waitFor(() => {
          expect(submenuTrigger2).toHaveFocus();
        });

        await waitForLaterMillisecond(async () => {
          await user.keyboard('[ArrowRight]');
          await screen.findByTestId('nested-submenu');
        });

        const outside = screen.getByTestId('outside');
        await user.click(outside);

        expect(screen.queryByTestId('menu')).toBe(null);
        expect(screen.queryByTestId('submenu')).toBe(null);
        expect(screen.queryByTestId('nested-submenu')).toBe(null);
      });

      it.skipIf(isJSDOM)(
        'calls onOpenChange with false exactly once per menu when a submenu item is clicked',
        async () => {
          const rootOnOpenChange = vi.fn();
          const submenuOnOpenChange = vi.fn();

          const { user } = await render(
            <TestMenu
              rootProps={{ onOpenChange: rootOnOpenChange }}
              submenuProps={{ onOpenChange: submenuOnOpenChange }}
              submenuTriggerProps={{ delay: 0, closeDelay: 50 }}
            />,
          );

          await waitForLaterMillisecond(async () => {
            await user.click(screen.getByRole('button', { name: 'Toggle' }));
            await screen.findByTestId('menu');
          });

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitForLaterMillisecond(async () => {
            await user.hover(submenuTrigger);
            await waitFor(() => {
              expect(screen.getByTestId('submenu')).not.toBe(null);
            });
          });

          // Schedule a delayed hover close, then click the item before it fires.
          await fireEvent.mouseLeave(submenuTrigger);
          await fireEvent.click(screen.getByTestId('item-4_1'));

          expect(screen.queryByTestId('menu')).toBe(null);

          // Wait out pending hover close timers; they must not refire a close.
          await wait(100);

          const rootCloseCalls = rootOnOpenChange.mock.calls.filter((args) => args[0] === false);
          const submenuCloseCalls = submenuOnOpenChange.mock.calls.filter(
            (args) => args[0] === false,
          );
          const staleHoverCloseCalls = submenuCloseCalls.filter(
            (args) => args[1].reason === REASONS.triggerHover,
          );
          expect(rootCloseCalls.length).toBe(1);
          expect(submenuCloseCalls.length).toBe(1);
          expect(staleHoverCloseCalls.length).toBe(0);
        },
      );

      it.skipIf(isJSDOM)(
        'returns focus to submenu triggers when closing nested menus',
        async () => {
          const { user } = await render(<TestMenu />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });
          const menu = await waitForLaterMillisecond(async () => {
            await user.click(trigger);
            return screen.findByTestId('menu');
          });
          // The menu focuses itself a frame after opening; keys sent earlier go to the trigger.
          await waitFor(() => {
            expect(menu).toHaveFocus();
          });

          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          const submenuTrigger = await screen.findByTestId('submenu-trigger');
          await waitFor(() => {
            expect(submenuTrigger).toHaveFocus();
          });

          const nestedSubmenuTrigger = await waitForLaterMillisecond(async () => {
            await user.keyboard('[ArrowRight]');
            return screen.findByTestId('nested-submenu-trigger');
          });
          await waitFor(() => {
            expect(screen.getByTestId('item-4_1')).toHaveFocus();
          });
          await user.keyboard('[ArrowDown]');
          await user.keyboard('[ArrowDown]');

          await waitFor(() => {
            expect(nestedSubmenuTrigger).toHaveFocus();
          });

          await waitForLaterMillisecond(async () => {
            await user.keyboard('[ArrowRight]');
            await screen.findByTestId('nested-submenu');
          });
          await waitFor(() => {
            expect(screen.getByTestId('item-4_3_1')).toHaveFocus();
          });

          await user.keyboard('[ArrowLeft]');

          expect(screen.queryByTestId('nested-submenu')).toBe(null);
          expect(nestedSubmenuTrigger).toHaveFocus();

          await user.keyboard('[ArrowLeft]');

          expect(screen.queryByTestId('submenu')).toBe(null);
          expect(submenuTrigger).toHaveFocus();
        },
      );
    });

    describe('nested popups', () => {
      it('keeps the menu and dialog open when pressing Shift+Tab inside a nested dialog', async () => {
        const MenuWithNestedDialog = defineComponent(() => () => (
          <Menu.Root>
            <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu-popup">
                  <Menu.Item>Item 1</Menu.Item>
                  <Dialog.Root>
                    <Menu.Item
                      as={Dialog.Trigger}
                      closeOnClick={false}
                      nativeButton
                      data-testid="dialog-trigger"
                    >
                      Open Dialog
                    </Menu.Item>
                    <Dialog.Portal>
                      <Dialog.Popup data-testid="dialog-popup">
                        <button type="button" data-testid="dialog-button">
                          Dialog Button
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </Dialog.Root>
                  <Menu.Item>Item 2</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const { user } = await render(<MenuWithNestedDialog />);

        const menuTrigger = screen.getByTestId('menu-trigger');
        await waitForLaterMillisecond(async () => {
          await user.click(menuTrigger);
          await waitFor(() => {
            expect(screen.getByTestId('menu-popup')).not.toBe(null);
          });
        });

        const dialogTrigger = screen.getByTestId('dialog-trigger');
        await waitForLaterMillisecond(async () => {
          await user.click(dialogTrigger);
          await waitFor(() => {
            expect(screen.getByTestId('dialog-popup')).not.toBe(null);
          });
        });

        const dialogButton = screen.getByTestId('dialog-button');
        dialogButton.focus();
        await flushMicrotasks();

        await waitFor(() => {
          expect(dialogButton).toHaveFocus();
        });

        // Shift+Tab inside the dialog should NOT close the menu or the dialog
        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await flushMicrotasks();

        // Both menu and dialog should still be open
        expect(screen.getByTestId('menu-popup')).toBeInTheDocument();
        expect(screen.getByTestId('dialog-popup')).toBeInTheDocument();
      });

      it.skipIf(isJSDOM)(
        'keeps focus in a nested alert dialog popup when the pointer leaves the triggering menu item',
        async () => {
          const MenuWithNestedAlertDialog = defineComponent(() => () => (
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu-popup">
                    <Menu.Item>Item 1</Menu.Item>
                    <AlertDialog.Root>
                      <Menu.Item
                        as={AlertDialog.Trigger}
                        closeOnClick={false}
                        nativeButton
                        data-testid="alert-dialog-trigger"
                      >
                        Open Alert Dialog
                      </Menu.Item>
                      <AlertDialog.Portal>
                        <AlertDialog.Backdrop data-testid="alert-dialog-backdrop" />
                        <AlertDialog.Popup data-testid="alert-dialog-popup">
                          <AlertDialog.Close data-testid="alert-dialog-close">
                            Close
                          </AlertDialog.Close>
                        </AlertDialog.Popup>
                      </AlertDialog.Portal>
                    </AlertDialog.Root>
                    <Menu.Item>Item 2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const { user } = await render(<MenuWithNestedAlertDialog />);

          const alertDialogTrigger = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('menu-trigger'));
            return screen.findByTestId('alert-dialog-trigger');
          });
          await user.click(alertDialogTrigger);

          const menuPopup = screen.getByTestId('menu-popup');
          const alertDialogPopup = await screen.findByTestId('alert-dialog-popup');

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).toBe(true);
          });

          await fireEvent.pointerLeave(alertDialogTrigger, {
            pointerType: 'mouse',
            relatedTarget: document.body,
          });

          await waitFor(() => {
            expect(alertDialogPopup.contains(document.activeElement)).toBe(true);
          });
          expect(menuPopup.contains(document.activeElement)).toBe(false);
        },
      );

      it.skipIf(isJSDOM)(
        'keeps pending focus in a nested dialog when the pointer leaves the triggering menu item',
        async () => {
          const MenuWithNestedDialog = defineComponent(() => () => (
            <Menu.Root>
              <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu-popup">
                    <Menu.Item>Item 1</Menu.Item>
                    <Dialog.Root>
                      <Menu.Item
                        closeOnClick={false}
                        data-testid="dialog-trigger"
                        v-slots={{
                          render: ({ props }: { props: HTMLProps }) => (
                            <Dialog.Trigger {...props} as="div" nativeButton={false}>
                              Open Dialog
                            </Dialog.Trigger>
                          ),
                        }}
                      />
                      <Dialog.Portal>
                        <Dialog.Popup data-testid="dialog-popup">
                          <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
                        </Dialog.Popup>
                      </Dialog.Portal>
                    </Dialog.Root>
                    <Menu.Item>Item 2</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ));

          const { user } = await render(<MenuWithNestedDialog />);

          const dialogTrigger = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByTestId('menu-trigger'));
            return screen.findByTestId('dialog-trigger');
          });

          const frameCallbacks = new Map<number, FrameRequestCallback>();
          let frameId = 0;
          const requestAnimationFrameSpy = vi
            .spyOn(window, 'requestAnimationFrame')
            .mockImplementation((callback) => {
              frameId += 1;
              frameCallbacks.set(frameId, callback);
              return frameId;
            });
          const cancelAnimationFrameSpy = vi
            .spyOn(window, 'cancelAnimationFrame')
            .mockImplementation((id) => {
              frameCallbacks.delete(id);
            });

          try {
            await fireEvent.click(dialogTrigger);
            await flushMicrotasks();
            await fireEvent.pointerLeave(dialogTrigger, {
              pointerType: 'mouse',
              relatedTarget: document.body,
            });

            const dialogClose = await screen.findByTestId('dialog-close');

            await waitFor(() => {
              expect(frameCallbacks.size).toBeGreaterThan(0);
            });

            const callbacks = Array.from(frameCallbacks.values());
            frameCallbacks.clear();
            callbacks.forEach((callback) => callback(performance.now()));
            await flushMicrotasks();

            await waitFor(() => {
              expect(dialogClose).toHaveFocus();
            });

            expect(screen.getByTestId('menu-popup').contains(document.activeElement)).toBe(false);
          } finally {
            requestAnimationFrameSpy.mockRestore();
            cancelAnimationFrameSpy.mockRestore();
          }
        },
      );

      it('keeps focus in a nested dialog that is not modal when the pointer leaves the triggering menu item', async () => {
        const MenuWithNestedDialog = defineComponent(() => () => (
          <Menu.Root>
            <Menu.Trigger data-testid="menu-trigger">Open Menu</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="menu-popup">
                  <Menu.Item>Item 1</Menu.Item>
                  <Dialog.Root modal={false}>
                    <Menu.Item
                      as={Dialog.Trigger}
                      closeOnClick={false}
                      nativeButton
                      data-testid="dialog-trigger"
                    >
                      Open Dialog
                    </Menu.Item>
                    <Dialog.Portal>
                      <Dialog.Popup data-testid="dialog-popup">
                        <Dialog.Close data-testid="dialog-close">Close</Dialog.Close>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </Dialog.Root>
                  <Menu.Item>Item 2</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const { user } = await render(<MenuWithNestedDialog />);

        await waitForLaterMillisecond(async () => {
          await user.click(screen.getByTestId('menu-trigger'));
          await screen.findByTestId('menu-popup');
        });
        const dialogTrigger = screen.getByTestId('dialog-trigger');
        // The click focuses the item itself. The first `focusin` after it then comes from the dialog.
        dialogTrigger.focus();
        await nextEvent(document, 'focusin', { action: () => user.click(dialogTrigger) });

        const dialogClose = screen.getByTestId('dialog-close');
        expect(dialogClose).toHaveFocus();
        expect(dialogTrigger).toHaveAttribute('data-highlighted');

        await user.unhover(dialogTrigger);

        expect(dialogTrigger).not.toHaveAttribute('data-highlighted');
        expect(dialogClose).toHaveFocus();
        expect(screen.getByTestId('menu-popup')).toBeInTheDocument();
      });
    });

    describe('focus management', () => {
      it('focuses the first item after the menu is opened by keyboard', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[Enter]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(firstItem!.tabIndex).toBe(0);
        });
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the first item when down arrow key opens the menu', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[ArrowDown]');

        const [firstItem, ...otherItems] = screen.getAllByRole('menuitem');
        await waitFor(() => expect(firstItem).toHaveFocus());
        expect(firstItem.tabIndex).toBe(0);
        otherItems.forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the last item when up arrow key opens the menu', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await user.keyboard('[ArrowUp]');

        const items = screen.getAllByRole('menuitem');
        await waitFor(() => {
          expect(items[4]).toHaveFocus();
        });

        expect(items[4].tabIndex).toBe(0);
        [items[0], items[1], items[2], items[3]].forEach((item) => {
          expect(item.tabIndex).toBe(-1);
        });
      });

      it('focuses the trigger after the menu is closed', async () => {
        const { user } = await render(
          <div>
            <input type="text" />
            <TestMenu />
            <input type="text" />
          </div>,
        );

        const button = screen.getByRole('button', { name: 'Toggle' });
        const menuItem = await waitForLaterMillisecond(async () => {
          await user.click(button);
          return screen.findAllByRole('menuitem');
        });
        await user.click(menuItem[0]!);

        expect(button).toHaveFocus();
      });

      it.skipIf(isJSDOM)(
        'focuses the trigger after Escape when the closing menu receives mouseleave',
        async () => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

          const { user } = await render(
            <>
              <style>
                {`
                  .transition-test-indicator {
                    transition:
                      transform 100ms ease-out,
                      opacity 100ms ease-out;
                  }

                  .transition-test-indicator[data-ending-style] {
                    opacity: 0;
                    transform: scale(0.98);
                  }
                `}
              </style>
              <TestMenu popupProps={{ class: 'transition-test-indicator' }} />
            </>,
          );

          const button = screen.getByRole('button', { name: 'Toggle' });
          const firstItem = await waitForLaterMillisecond(async () => {
            await user.click(button);
            return screen.findByTestId('item-1');
          });
          await user.hover(firstItem);
          // In WebKit, a list ignores a move with no movement.
          await fireEvent.mouseMove(firstItem, { movementX: 1 });

          await waitFor(() => {
            expect(firstItem).toHaveFocus();
          });

          const menu = screen.getByRole('menu');
          // The wait for the end of the exit starts before the Escape, so it has no time limit.
          await nextEvent(menu, 'transitionend', {
            after: 'transitionrun',
            action: async () => {
              await user.keyboard('[Escape]');

              // During an exit transition, the positioner can receive a mouseleave after Escape
              // when pointer-events change while the pointer rests over the popup.
              await fireEvent.mouseLeave(screen.getByTestId('menu-positioner'), {
                relatedTarget: document.body,
              });
            },
          });

          await waitFor(() => {
            expect(menu).not.toBeInTheDocument();
          });
          expect(screen.queryByRole('menu')).toBe(null);
          expect(button).toHaveFocus();
        },
      );

      it.skipIf(isJSDOM)(
        'focuses the trigger after the menu is closed but not unmounted',
        async () => {
          const { user } = await render(
            <div>
              <input type="text" />
              <TestMenu portalProps={{ keepMounted: true }} />
              <input type="text" />
            </div>,
          );

          const button = screen.getByRole('button', { name: 'Toggle' });
          await user.click(button);

          const menuItem = await screen.findAllByRole('menuitem');
          await user.click(menuItem[0]!);

          await waitFor(() => {
            expect(button).toHaveFocus();
          });
        },
      );
    });

    describe('focus guards', () => {
      it('closes the menu and moves focus to the next element when tabbing forward from the open menu', async () => {
        const { user } = await render(
          <div>
            <input />
            <TestMenu rootProps={{ modal: false }} />
            <input data-testid="after" />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await screen.findByTestId('menu');
        });

        const menuItem = screen.getByTestId('item-1');
        menuItem.focus();
        await flushMicrotasks();

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        expect(screen.queryByTestId('menu')).toBe(null);
      });

      it('closes the menu and moves focus to the trigger when shift-tabbing from the open menu', async () => {
        const { user } = await render(
          <div>
            <input data-testid="before" />
            <TestMenu />
            <input />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await screen.findByTestId('menu');
        });

        const menuItem = screen.getByTestId('item-1');
        menuItem.focus();
        await flushMicrotasks();

        await user.keyboard('{Shift>}{Tab}{/Shift}');

        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });

        expect(screen.queryByTestId('menu')).toBe(null);
      });
    });

    describe('prop: closeParentOnEsc', () => {
      it('does not close the parent menu when the Escape key is pressed by default', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(() => user.keyboard('[ArrowDown]'));
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await waitForLaterMillisecond(() => user.keyboard('[ArrowRight]'));
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        await user.keyboard('[Escape]');

        const menus = screen.queryAllByRole('menu', { hidden: false });
        await waitFor(() => {
          expect(menus.length).toBe(1);
        });

        expect(menus[0].dataset.testid).toBe('menu');
      });

      it('does not close the parent menu when the Escape key is pressed while focus is outside the menus', async () => {
        const { user } = await render(<TestMenu />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(() => user.keyboard('[ArrowDown]'));
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await waitForLaterMillisecond(() => user.keyboard('[ArrowRight]'));
        await waitFor(() => {
          expect(screen.getByTestId('item-4_1')).toHaveFocus();
        });

        screen.getByTestId('item-4_1').blur();
        await flushMicrotasks();
        expect(document.activeElement).toBe(document.body);

        await user.keyboard('[Escape]');

        expect(screen.queryByTestId('submenu')).toBe(null);
        expect(screen.getByTestId('menu')).not.toBe(null);
      });

      it('closes the parent menu when the Escape key is pressed  if `closeParentOnEsc=true`', async () => {
        const { user } = await render(<TestMenu submenuProps={{ closeParentOnEsc: true }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(() => user.keyboard('[ArrowDown]'));
        await waitFor(() => {
          expect(screen.getByTestId('item-1')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-2')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('item-3')).toHaveFocus();
        });

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
        });

        await waitForLaterMillisecond(() => user.keyboard('[ArrowRight]'));
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Item 4.1' })).toHaveFocus();
        });

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        expect(screen.queryByRole('menu', { hidden: false })).toBe(null);
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
          expect(screen.getByRole('menu')).not.toBe(null);
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
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });
    });

    describe('hover close', () => {
      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(<TestMenu rootProps={{ defaultOpen: true }} />);

        await waitFor(() => {
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.toBe(null);
      });
    });

    describe('controlled open interactions', () => {
      it('returns focus to the opener when a menu is opened programmatically', async () => {
        const Test = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    open.value = true;
                  }}
                >
                  Open menu programmatically
                </button>
                <Menu.Root
                  open={open.value}
                  triggerId="menu-trigger"
                  onOpenChange={(nextOpen: boolean) => {
                    open.value = nextOpen;
                  }}
                >
                  <Menu.Trigger id="menu-trigger">Menu trigger</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Close menu</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        const opener = screen.getByRole('button', { name: 'Open menu programmatically' });
        await waitForLaterMillisecond(async () => {
          await user.click(opener);
          await waitFor(() => {
            expect(screen.getByRole('menu')).not.toBe(null);
          });
        });

        await user.click(screen.getByRole('menuitem', { name: 'Close menu' }));

        expect(screen.queryByRole('menu')).toBe(null);
        expect(opener).toHaveFocus();
      });

      it('does not close after hovering out of a popup opened externally', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    open.value = true;
                  }}
                >
                  Show
                </button>
                <TestMenu
                  rootProps={{
                    open: open.value,
                    onOpenChange: (nextOpen: boolean) => {
                      open.value = nextOpen;
                    },
                  }}
                />
              </>
            );
          },
        });

        const { user } = await render(<App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        const positioner = screen.getByTestId('menu-positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestMenu
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    open.value = nextOpen;
                  },
                  modal: false,
                }}
                triggerProps={{ openOnHover: true, delay: 0 }}
              />
            );
          },
        });

        await render(<App />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(trigger);
        await fireEvent.mouseMove(trigger);

        expect(screen.queryByRole('menu')).not.toBe(null);

        const positioner = screen.getByTestId('menu-positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('menu')).toBe(null);
      });

      it('keeps the trigger that reopens the menu before its exit animation completes', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        let finishExit!: () => void;
        const exitFinished = new Promise<void>((resolve) => {
          finishExit = resolve;
        });
        const open = shallowRef(false);
        // Lets the test hold a controlled reopen back, the way React 18 can commit it only after
        // the exit animation's completion callback has run.
        let deferOpenChange = false;
        let deferredOpen: boolean | null = null;

        const App = defineComponent(() => () => (
          <Menu.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              if (deferOpenChange) {
                deferredOpen = nextOpen;
              } else {
                open.value = nextOpen;
              }
            }}
          >
            <Menu.Trigger>Trigger 1</Menu.Trigger>
            <Menu.Trigger>Trigger 2</Menu.Trigger>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const { user } = await render(<App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
        const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });
        const popup = screen.getByTestId('popup');

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        Object.defineProperty(popup, 'getAnimations', {
          value: () => [{ finished: exitFinished }],
          configurable: true,
        });

        open.value = false;
        await flushMicrotasks();
        expect(popup).toHaveAttribute('data-ending-style');

        deferOpenChange = true;
        await user.click(trigger2);
        await waitFor(() => {
          expect(deferredOpen).toBe(true);
        });

        finishExit();
        await flushMicrotasks();
        open.value = true;
        await flushMicrotasks();

        expect(trigger2).toHaveAttribute('aria-expanded', 'true');
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      it('clears the active trigger when a controlled close completes without a reopen', async () => {
        const open = shallowRef(false);

        const App = defineComponent(() => () => (
          <Menu.Root
            open={open.value}
            onOpenChange={(nextOpen: boolean) => {
              open.value = nextOpen;
            }}
          >
            <Menu.Trigger>Trigger 1</Menu.Trigger>
            <Menu.Trigger>Trigger 2</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ));

        const { user } = await render(<App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        open.value = false;
        await flushMicrotasks();
        expect(screen.queryByTestId('popup')).toBe(null);

        open.value = true;
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByTestId('popup')).not.toBe(null);
        });

        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
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
            // A lock comes in a 0 ms timer after the open.
            await wait(0);

            expect(isScrollLocked(doc)).toBe(false);
          },
        );
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the menu when the `unmount` method is called', async () => {
        let root!: Menu.Root.Actions;

        const { user } = await render(
          <TestMenu
            rootProps={{
              ref: (instance: unknown) => {
                if (instance) {
                  root = instance as Menu.Root.Actions;
                }
              },
              onOpenChange: (_open: boolean, details: Menu.Root.ChangeEventDetails) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(async () => {
          await user.keyboard('{Enter}');
          await waitFor(() => {
            expect(screen.getByRole('menu')).not.toBe(null);
          });
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        await new Promise((resolve) => {
          requestAnimationFrame(resolve);
        });

        root.unmount();
        await flushMicrotasks();

        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    describe('prop: openOnHover', () => {
      it('opens when the trigger is hovered and closes when it is no longer hovered', async () => {
        await render(<TestMenu triggerProps={{ openOnHover: true, delay: 0 }} />);

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await enterWithMouse(trigger);

        await waitFor(() => {
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        await moveMouse(trigger, document.body);

        expect(screen.queryByRole('menu')).toBe(null);
      });

      it('cancels a pending hover open when the `close` action is called', async () => {
        const handleOpenChange = vi.fn();
        let actions!: Menu.Root.Actions;
        await render(
          <TestMenu
            rootProps={{
              ref: (instance: unknown) => {
                actions = instance as Menu.Root.Actions;
              },
              onOpenChange: handleOpenChange,
            }}
            triggerProps={{ openOnHover: true, delay: 100 }}
          />,
        );

        await enterWithMouse(screen.getByRole('button', { name: 'Toggle' }));
        actions.close();
        await wait(200);

        expect(handleOpenChange).not.toHaveBeenCalled();
        expect(screen.queryByRole('menu')).toBe(null);
      });

      it('opens the submenu on hover with zero delay', async () => {
        await render(
          <ContainedTriggerMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      it('does not clear body pointer-events styles when closing a scoped submenu', async () => {
        await render(
          <TestMenu
            rootProps={{ defaultOpen: true }}
            submenuTriggerProps={{ delay: 0, closeDelay: 0 }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const previousBodyPointerEvents = document.body.style.pointerEvents;
        try {
          document.body.style.pointerEvents = 'none';

          const sibling = screen.getByTestId('item-2');
          // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
          await fireEvent.mouseMove(sibling);

          expect(screen.queryByTestId('submenu')).toBe(null);

          expect(document.body.style.pointerEvents).toBe('none');
        } finally {
          document.body.style.pointerEvents = previousBodyPointerEvents;
        }
      });

      it('scopes submenu safePolygon pointer events to the parent menu with keepMounted portal', async () => {
        await render(
          <TestMenu
            rootProps={{ defaultOpen: true }}
            popupProps={{
              children: () => (
                <>
                  <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger data-testid="submenu-trigger" delay={0}>
                      Item 2
                    </Menu.SubmenuTrigger>
                    <Menu.Portal keepMounted>
                      <Menu.Positioner data-testid="submenu-positioner">
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Item 2.1</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <Menu.Item data-testid="item-3">Item 3</Menu.Item>
                </>
              ),
            }}
          />,
        );

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const menu = screen.getByTestId('menu');
        const submenuPositioner = screen.getByTestId('submenu-positioner');

        expect(menu.style.pointerEvents).toBe('none');
        expect(submenuPositioner.style.pointerEvents).toBe('auto');
        expect(screen.getByTestId('item-3').style.pointerEvents).toBe('');
      });

      it('should not close when submenu is hovered after root menu is hovered', async () => {
        await render(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(async () => {
          await userEvent.hover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('menu')).not.toBe(null);
          });
        });

        const menu = screen.getByTestId('menu');

        await userEvent.hover(menu);

        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });

        await userEvent.hover(submenuTrigger);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });

        const submenu = screen.getByTestId('submenu');

        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        await fireEvent.mouseMove(menu);
        await fireEvent.mouseLeave(menu);
        await userEvent.hover(submenu);

        await waitFor(() => {
          expect(screen.getByTestId('menu')).not.toBe(null);
        });
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      it('keeps the parent submenu open after a third-level submenu closes due to sibling hover', async () => {
        await render(
          <ContainedTriggerMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0 }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        trigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(async () => {
          await userEvent.hover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('menu')).not.toBe(null);
          });
        });

        // Open first-level submenu
        const level1Trigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await waitForLaterMillisecond(async () => {
          await userEvent.hover(level1Trigger);
          await waitFor(() => {
            expect(screen.getByTestId('submenu')).not.toBe(null);
          });
        });

        // Open second-level submenu
        const level2Trigger = screen.getByRole('menuitem', { name: 'Item 4.3' });
        await userEvent.hover(level2Trigger);

        await waitFor(() => {
          expect(screen.getByTestId('nested-submenu')).not.toBe(null);
        });

        // Hover a sibling item in the parent submenu to close the second-level submenu
        const parentSibling = screen.getByRole('menuitem', { name: 'Item 4.2' });
        // Use fireEvent to bypass pointer-events checks during safe-polygon pointer events mutation
        await fireEvent.mouseMove(parentSibling);

        expect(screen.queryByTestId('nested-submenu')).toBe(null);

        // Now unhover the parent submenu container; it should remain open
        const submenu1 = screen.getByTestId('submenu');
        await fireEvent.mouseLeave(submenu1);

        // Parent submenu should still be open
        await waitFor(() => {
          expect(screen.getByTestId('submenu')).not.toBe(null);
        });
      });

      describe('modal behavior', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });

        afterEach(() => {
          vi.useRealTimers();
        });

        it('reopens on hover after an impatient click closes via item press', async () => {
          await render(<TestMenu triggerProps={{ openOnHover: true, delay: 100 }} />);

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          vi.advanceTimersByTime(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);

          vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD - 1);
          await fireEvent.click(trigger);

          await flushMicrotasks();

          await fireEvent.click(screen.getByTestId('item-1'));

          await flushMicrotasks();

          expect(screen.queryByRole('menu')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          vi.advanceTimersByTime(100);
          await flushMicrotasks();

          expect(screen.queryByRole('menu')).not.toBe(null);
        });

        it('treats hover-opened menus as modal after a click', async () => {
          await render(
            <Menu.Root>
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner data-testid="positioner">
                  <Menu.Popup>
                    <Menu.Item>Item 1</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('menu')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          vi.advanceTimersByTime(PATIENT_CLICK_THRESHOLD - 1);
          await fireEvent.click(trigger);

          await flushMicrotasks();
          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });
      });
    });

    describe('prop: closeDelay', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should close after delay', async () => {
        await render(<TestMenu triggerProps={{ openOnHover: true, delay: 0, closeDelay: 100 }} />);

        const anchor = screen.getByRole('button');

        await fireEvent.mouseEnter(anchor);
        await fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Item 1')).not.toBe(null);

        await fireEvent.mouseLeave(anchor);

        await tick(50);

        expect(screen.getByText('Item 1')).not.toBe(null);

        await tick(50);

        expect(screen.queryByText('Item 1')).toBe(null);
      });

      it('should close submenu after delay when hovering a sibling item', async () => {
        await render(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />,
        );

        const trigger = screen.getByRole('button');

        await waitForLaterMillisecond(async () => {
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);
          await flushMicrotasks();
        });

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await fireEvent.mouseEnter(submenuTrigger);
        await fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        await fireEvent.mouseMove(siblingItem);

        // Submenu should still be open after partial delay
        await tick(50);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Submenu should close after the full delay
        await tick(50);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('should not restart closeDelay on repeated mousemove over sibling items', async () => {
        await render(
          <TestMenu
            triggerProps={{ openOnHover: true, delay: 0 }}
            submenuTriggerProps={{ delay: 0, closeDelay: 100 }}
          />,
        );

        const trigger = screen.getByRole('button');

        await waitForLaterMillisecond(async () => {
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);
          await flushMicrotasks();
        });

        // Open the submenu by hovering its trigger
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Item 4' });
        await fireEvent.mouseEnter(submenuTrigger);
        await fireEvent.mouseMove(submenuTrigger);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Hover a sibling item in the parent menu
        const siblingItem = screen.getByRole('menuitem', { name: 'Item 1' });
        await fireEvent.mouseMove(siblingItem);

        // Wait 80ms (most of the delay), then move again over the sibling
        await tick(80);
        expect(screen.queryByTestId('submenu')).not.toBe(null);

        // Move again - this should NOT restart the timer
        await fireEvent.mouseMove(siblingItem);

        // After 20 more ms (100ms total from first move), the submenu should close
        await tick(20);
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
    });

    describe('submenu hover open', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('opens a submenu after a plain delay without waiting for the pointer to rest', async () => {
        // The menu is opened programmatically, so `allowMouseEnter` starts
        // `false`. Hovering the submenu trigger as the first item must still
        // open it after a plain delay rather than collapsing to a rest-only
        // path that requires the cursor to stop moving.
        await render(<TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />);

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        await fireEvent.mouseEnter(submenuTrigger);
        await fireEvent.mouseMove(submenuTrigger, { movementX: 10 });

        // Keep the pointer moving past the open delay so it never comes to rest.
        await tick(40);
        await fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        await tick(40);
        await fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        await tick(40);

        await flushMicrotasks();

        expect(screen.queryByTestId('submenu')).not.toBe(null);
      });

      it('cancels a pending submenu hover-open when the pointer leaves via mouseout', async () => {
        // Chrome can drop a submenu trigger's non-bubbling `mouseleave` during a
        // fast pointer sweep across adjacent triggers, but the bubbling
        // `mouseout` still fires. The pending delayed open must be cancelled from
        // that `mouseout`, otherwise a stale submenu opens for a trigger the
        // pointer has already left (stranding the parent at
        // `pointer-events: none`). See #5152.
        await render(<TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />);

        const submenuTrigger = screen.getByTestId('submenu-trigger');
        const otherItem = screen.getByTestId('item-1');

        // Arm the submenu's delayed open, then leave the trigger via `mouseout`
        // (with `relatedTarget` outside it) but without delivering `mouseleave`.
        await fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        await fireEvent.mouseEnter(submenuTrigger);
        await fireEvent.mouseOut(submenuTrigger, { relatedTarget: otherItem });

        // Let the open delay elapse.
        await tick(200);

        expect(screen.queryByTestId('submenu')).toBe(null);
      });

      it('keeps a pending submenu hover-open when mouseout stays within the trigger', async () => {
        // `mouseout` bubbles and fires as the pointer moves between elements
        // inside the trigger's own subtree. Those crossings (where
        // `relatedTarget` is still inside the trigger) must not cancel the
        // pending open, otherwise a plain hover would never open the submenu.
        // See #5152.
        await render(<TestMenu rootProps={{ open: true }} submenuTriggerProps={{ delay: 100 }} />);

        const submenuTrigger = screen.getByTestId('submenu-trigger');

        // Arm the submenu's delayed open, then fire a `mouseout` whose
        // `relatedTarget` is still inside the trigger (the trigger itself).
        await fireEvent.mouseMove(submenuTrigger, { movementX: 10 });
        await fireEvent.mouseEnter(submenuTrigger);
        await fireEvent.mouseOut(submenuTrigger, { relatedTarget: submenuTrigger });

        // Let the open delay elapse.
        await tick(200);

        expect(screen.queryByTestId('submenu')).not.toBe(null);
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

        await waitForLaterMillisecond(async () => {
          await fireEvent.mouseDown(trigger, clientCenter(trigger));
          await waitFor(() => {
            expect(screen.getByTestId('menu')).not.toBe(null);
          });
        });

        await wait(200);

        const item2 = screen.getByTestId('item-2');
        await fireEvent.mouseUp(item2);

        expect(screen.queryByTestId('menu')).toBe(null);

        expect(clickSpy.mock.calls.length).toBe(1);

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
        // The synthesized drag-release click must carry `detail: 1` so MenuRoot does
        // not classify it as a keyboard (`detail === 0`) activation.
        expect((openChangeSpy.mock.lastCall?.[1].event as MouseEvent).detail).toBe(1);
      });

      it('continues arrow navigation from a checkbox item selected by drag release', async () => {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>One</Menu.Item>
                  <Menu.CheckboxItem>Two</Menu.CheckboxItem>
                  <Menu.Item>Three</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        const firstItem = await waitForLaterMillisecond(async () => {
          await fireEvent.mouseDown(trigger, clientCenter(trigger));
          return screen.findByRole('menuitem', { name: 'One' });
        });
        const checkboxItem = screen.getByRole('menuitemcheckbox', { name: 'Two' });
        const thirdItem = screen.getByRole('menuitem', { name: 'Three' });
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        await wait(200);

        await fireEvent.mouseUp(checkboxItem);

        await waitFor(() => {
          expect(checkboxItem).toHaveAttribute('aria-checked', 'true');
        });
        expect(checkboxItem).toHaveFocus();
        expect(screen.getByRole('menu')).toBeInTheDocument();

        await user.keyboard('{ArrowDown}');
        await waitFor(() => {
          expect(thirdItem).toHaveFocus();
        });
      });

      it('focuses a disabled item on drag release without activating it', async () => {
        const onClick = vi.fn();
        await render(
          <Menu.Root highlightItemOnHover={false}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>One</Menu.Item>
                  <Menu.Item disabled onClick={onClick}>
                    Two
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        const firstItem = await waitForLaterMillisecond(async () => {
          await fireEvent.mouseDown(trigger, clientCenter(trigger));
          return screen.findByRole('menuitem', { name: 'One' });
        });
        const disabledItem = screen.getByRole('menuitem', { name: 'Two' });
        await waitFor(() => {
          expect(firstItem).toHaveFocus();
        });

        await wait(200);
        await fireEvent.mouseUp(disabledItem);
        await flushMicrotasks();

        expect(disabledItem).toHaveFocus();
        expect(onClick).not.toHaveBeenCalled();
        expect(screen.getByRole('menu')).toBeInTheDocument();
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

        await browserUserEvent.dragAndDrop(trigger, backdrop);

        expect(screen.queryByTestId('menu')).toBe(null);

        expect(openChangeSpy.mock.calls.length).toBe(2);
        expect(openChangeSpy.mock.calls[0][0]).toBe(true);
        expect(openChangeSpy.mock.lastCall?.[0]).toBe(false);
        expect(openChangeSpy.mock.lastCall?.[1].reason).toBe(REASONS.cancelOpen);
      });
    });

    describe('VaseUIChangeEventDetails', () => {
      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = await render(
          <TestMenu
            rootProps={{
              onOpenChange: (open: boolean, details: Menu.Root.ChangeEventDetails) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await waitFor(() => {
            expect(screen.getByRole('menu')).not.toBe(null);
          });
        });

        expect(trigger).toHaveAttribute('data-popup-open');
        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByRole('menu')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });
        const menu = screen.getByRole('menu');

        await user.click(trigger);
        await waitFor(() => {
          expect(menu).not.toBeInTheDocument();
        });
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });
  });

  it('does not leave a tabbable item after tabbing out of a keepMounted menu before close', async () => {
    let root!: Menu.Root.Actions;

    const { user } = await render(
      <div>
        <input />
        <DetachedTriggerMenu
          rootProps={{
            modal: false,
            ref: (instance: unknown) => {
              if (instance) {
                root = instance as Menu.Root.Actions;
              }
            },
          }}
          portalProps={{ keepMounted: true }}
        />
        <input data-testid="after" />
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Toggle' });
    trigger.focus();
    await flushMicrotasks();
    await user.keyboard('[Enter]');

    const menuItem = await screen.findByTestId('item-1');
    await waitFor(() => {
      expect(menuItem).toHaveFocus();
    });
    expect(menuItem).toHaveAttribute('tabindex', '0');

    await user.tab();

    await waitFor(() => {
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    root.close();
    await flushMicrotasks();

    expect(screen.getByTestId('menu')).not.toHaveAttribute('data-open');
    expect(menuItem).toHaveAttribute('tabindex', '-1');
  });

  // Both menus stay mounted so they can open in one update, where the submenu's effects run
  // before its root's. Blurring the focused submenu trigger lets Escape reach the document.
  describe('when a submenu opens in the same update as its root', () => {
    it('requests the submenu dismissal on Escape from the body', async () => {
      const onSubmenuOpenChange = vi.fn();

      const Test = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup(props) {
          return () => (
            <Menu.Root open={props.open}>
              <Menu.Trigger>Menu</Menu.Trigger>
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.SubmenuRoot open={props.open} onOpenChange={onSubmenuOpenChange}>
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu" />
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      const { setProps, user } = await render(<Test open={false} />);
      await setProps({ open: true });
      await waitFor(() => {
        expect(screen.getByTestId('submenu')).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
      });
      screen.getByTestId('submenu-trigger').blur();
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);

      await user.keyboard('[Escape]');

      expect(onSubmenuOpenChange.mock.calls.length).toBe(1);
      expect(onSubmenuOpenChange.mock.calls[0][0]).toBe(false);
      expect(onSubmenuOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });

    it('closes the submenu on Escape from the body when the root cancels its dismissal', async () => {
      const Test = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup(props) {
          const submenuClosed = shallowRef(false);

          return () => (
            <Menu.Root
              open={props.open}
              onOpenChange={(_nextOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
                if (eventDetails.reason === REASONS.escapeKey) {
                  eventDetails.cancel();
                }
              }}
            >
              <Menu.Trigger>Menu</Menu.Trigger>
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="menu">
                    <Menu.SubmenuRoot
                      open={props.open && !submenuClosed.value}
                      onOpenChange={(nextOpen: boolean) => {
                        submenuClosed.value = !nextOpen;
                      }}
                    >
                      <Menu.SubmenuTrigger data-testid="submenu-trigger">More</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="submenu" />
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      const { setProps, user } = await render(<Test open={false} />);
      await setProps({ open: true });
      await waitFor(() => {
        expect(screen.getByTestId('submenu')).toHaveAttribute('data-open');
      });
      await waitFor(() => {
        expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
      });
      screen.getByTestId('submenu-trigger').blur();
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);

      await user.keyboard('[Escape]');
      await flushMicrotasks();

      expect(screen.getByTestId('submenu')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('menu')).toHaveAttribute('data-open');
    });
  });

  describe.skipIf(isJSDOM || !platform.engine.blink)('opening a dialog from an item', () => {
    it('keeps the dialog open after a press-drag-release activation', async () => {
      const { cdp } = await import('vitest/browser');
      const dialogOpenChangeSpy = vi.fn();
      const documentClicks: MouseEvent[] = [];

      const App = defineComponent(() => {
        const dialogOpen = shallowRef(false);

        return () => (
          <>
            <Menu.Root>
              <Menu.Trigger>Open menu</Menu.Trigger>
              {/* `keepMounted` keeps the released item connected, like a real closing transition
                  does: the browser only synthesizes the gesture's click on the common ancestor
                  when the release target is still in the DOM. */}
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item onClick={() => (dialogOpen.value = true)}>Open dialog</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
            <Dialog.Root
              open={dialogOpen.value}
              onOpenChange={(nextOpen, eventDetails) => {
                dialogOpenChangeSpy(nextOpen, eventDetails.reason);
                dialogOpen.value = nextOpen;
              }}
            >
              <Dialog.Portal>
                <Dialog.Backdrop style={{ position: 'fixed', inset: 0 }} />
                <Dialog.Popup data-testid="dialog-popup">Dialog</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        );
      });

      await render(<App />);

      const trigger = screen.getByRole('button', { name: 'Open menu' });
      const frame = window.frameElement as HTMLIFrameElement | null;
      const frameRect = frame?.getBoundingClientRect();
      const frameOffset = {
        x: (frameRect?.left ?? 0) + (frame?.clientLeft ?? 0),
        y: (frameRect?.top ?? 0) + (frame?.clientTop ?? 0),
      };

      function centerOf(element: Element) {
        const rect = element.getBoundingClientRect();
        return {
          x: frameOffset.x + rect.left + rect.width / 2,
          y: frameOffset.y + rect.top + rect.height / 2,
        };
      }

      const session = cdp() as CDPSession;

      function recordClick(event: MouseEvent) {
        documentClicks.push(event);
      }

      document.addEventListener('click', recordClick, true);

      try {
        const triggerCenter = centerOf(trigger);
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          ...triggerCenter,
        });
        await session.send('Input.dispatchMouseEvent', {
          type: 'mousePressed',
          ...triggerCenter,
          button: 'left',
          buttons: 1,
          clickCount: 1,
        });
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByRole('menu')).not.toBe(null);
        });

        // Exceed the impatient-click threshold so releasing over the item
        // activates it instead of being treated as part of a quick click.
        await wait(200);

        const item = screen.getByRole('menuitem', { name: 'Open dialog' });
        const itemCenter = centerOf(item);
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseMoved',
          ...itemCenter,
          buttons: 1,
        });
        await session.send('Input.dispatchMouseEvent', {
          type: 'mouseReleased',
          ...itemCenter,
          button: 'left',
          buttons: 0,
          clickCount: 1,
        });
        await flushMicrotasks();

        // The item activates on release: the menu closes and the dialog opens.
        expect(screen.queryByRole('menu')).toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('dialog-popup')).not.toBe(null);
        });

        // The browser fires the gesture's native click on the common ancestor
        // of the press and release targets after the dialog is open. It must
        // not be treated as an intentional outside press on the dialog.
        await waitFor(() => {
          expect(documentClicks.some((event) => event.isTrusted)).toBe(true);
        });

        expect(screen.queryByTestId('dialog-popup')).not.toBe(null);
        expect(dialogOpenChangeSpy).not.toHaveBeenCalledWith(false, REASONS.outsidePress);
      } finally {
        document.removeEventListener('click', recordClick, true);
      }
    });
  });

  describe('prop: highlightItemOnHover', () => {
    it('highlights an item on mouse move by default', async () => {
      const onItemHighlighted = vi.fn();
      await render(
        <Menu.Root open onItemHighlighted={onItemHighlighted}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item2 = screen.getByTestId('item-2');
      await fireEvent.mouseMove(item2, { movementX: 1 });

      await waitFor(() => {
        expect(item2).toHaveFocus();
      });
      expect(onItemHighlighted).toHaveBeenLastCalledWith(item2, {
        reason: REASONS.pointer,
        label: 'Item 2',
        event: expect.any(Event),
      });
    });

    it('does not highlight items from mouse movement when disabled', async () => {
      await render(
        <Menu.Root open highlightItemOnHover={false}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item data-testid="item-1">Item 1</Menu.Item>
                <Menu.Item data-testid="item-2">Item 2</Menu.Item>
                <Menu.Item data-testid="item-3">Item 3</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const item2 = screen.getByTestId('item-2');
      await fireEvent.mouseMove(item2, { movementX: 1 });

      await flushMicrotasks();

      expect(item2).not.toHaveFocus();
    });

    it('does not highlight submenu triggers from mouse enter when disabled', async () => {
      await render(
        <TestMenuContents
          rootProps={{ open: true, highlightItemOnHover: false }}
          popupProps={{
            children: () => (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger">Submenu</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Item>Nested item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            ),
          }}
        />,
      );

      const submenuTrigger = screen.getByTestId('submenu-trigger');
      await fireEvent.mouseEnter(submenuTrigger);

      await flushMicrotasks();

      expect(submenuTrigger).not.toHaveAttribute('data-highlighted');
      expect(submenuTrigger).not.toHaveFocus();
    });
  });

  describe('prop: onOpenChangeComplete', () => {
    it('completes initial opening once when a later update replaces the container ref', async () => {
      const completed = vi.fn();

      const TestMenu = defineComponent({
        setup() {
          const container = shallowRef<HTMLElement | null>(null);
          const step = shallowRef(0);

          onMounted(() => {
            step.value = 1;
          });
          onUpdated(() => {
            if (step.value < 2) {
              step.value += 1;
            }
          });

          return () => {
            const containerId = step.value < 2 ? 'first' : 'second';
            return (
              <>
                <Menu.Root defaultOpen onOpenChangeComplete={completed}>
                  <Menu.Trigger>Toggle</Menu.Trigger>
                  <Menu.Portal container={container}>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
                <div key={containerId} ref={container} data-testid={containerId} />
              </>
            );
          };
        },
      });

      await render(<TestMenu />);

      expect(screen.getByTestId('second')).toContainElement(screen.getByRole('menu'));
      expect(completed).toHaveBeenCalledExactlyOnceWith(true);
    });
  });

  describe('prop: disabled', () => {
    it('marks items as disabled when controlled open', async () => {
      await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            children: () => (
              <>
                <Menu.Item data-testid="item">Item</Menu.Item>
                <Menu.CheckboxItem data-testid="checkbox-item">Checkbox item</Menu.CheckboxItem>
                <Menu.RadioGroup>
                  <Menu.RadioItem data-testid="radio-item" value="radio">
                    Radio item
                  </Menu.RadioItem>
                </Menu.RadioGroup>
              </>
            ),
          }}
        />,
      );

      expect(screen.getByTestId('item')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('checkbox-item')).toHaveAttribute('data-disabled');
      expect(screen.getByTestId('radio-item')).toHaveAttribute('data-disabled');
    });

    it('does not highlight items with text navigation when controlled open', async () => {
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            children: () => (
              <>
                <Menu.Item data-testid="alpha">Alpha</Menu.Item>
                <Menu.Item data-testid="beta">Beta</Menu.Item>
              </>
            ),
          }}
        />,
      );

      const alpha = screen.getByTestId('alpha');
      const beta = screen.getByTestId('beta');

      alpha.focus();
      await flushMicrotasks();

      await user.keyboard('b');
      await flushMicrotasks();

      expect(beta).not.toHaveAttribute('data-highlighted');
      expect(beta).not.toHaveFocus();
    });

    it('does not close or activate items when controlled open', async () => {
      const handleOpenChange = vi.fn();
      const handleClick = vi.fn();
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true, onOpenChange: handleOpenChange }}
          popupProps={{
            children: () => (
              <Menu.Item data-testid="item" onClick={handleClick}>
                Item
              </Menu.Item>
            ),
          }}
        />,
      );

      await user.click(screen.getByTestId('item'));

      expect(handleClick).not.toHaveBeenCalled();
      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('disables submenu triggers when controlled open', async () => {
      const { user } = await render(
        <TestMenuContents
          rootProps={{ open: true, disabled: true }}
          popupProps={{
            children: () => (
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" openOnHover={false}>
                  Submenu
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu-popup">
                      <Menu.Item>Nested item</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            ),
          }}
        />,
      );

      const submenuTrigger = screen.getByTestId('submenu-trigger');

      expect(submenuTrigger).toHaveAttribute('data-disabled');

      await user.click(submenuTrigger);
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });
  });

  describe('dynamic items', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('skips null items when navigating', async () => {
      const DynamicMenu = defineComponent({
        setup() {
          const itemsFiltered = shallowRef(false);

          return () => (
            <Menu.Root
              onOpenChange={(newOpen: boolean) => {
                if (newOpen) {
                  setTimeout(() => {
                    itemsFiltered.value = true;
                  }, 0);
                }
              }}
              onOpenChangeComplete={(newOpen: boolean) => {
                if (!newOpen) {
                  itemsFiltered.value = false;
                }
              }}
            >
              <Menu.Trigger>Toggle</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Add to Library</Menu.Item>
                    {!itemsFiltered.value && (
                      <>
                        <Menu.Item>Add to Playlist</Menu.Item>
                        <Menu.Item>Play Next</Menu.Item>
                        <Menu.Item>Play Last</Menu.Item>
                      </>
                    )}
                    <Menu.Item>Favorite</Menu.Item>
                    <Menu.Item>Share</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      const { user } = await render(<DynamicMenu />);

      const trigger = screen.getByText('Toggle');

      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });

      await user.keyboard('{ArrowDown}');
      await user.keyboard('{ArrowDown}'); // Share
      expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveFocus();
      await user.keyboard('{ArrowDown}'); // loops back to Add to Library

      expect(screen.queryByRole('menuitem', { name: 'Add to Library' })).toHaveFocus();
    });
  });

  describe('trigger render cost', () => {
    it('does not re-render the trigger while navigating the list', async () => {
      let triggerRenders = 0;

      const { user } = await render(
        <MenuRootTriggerRenderCost
          triggerRender={() => {
            triggerRenders += 1;
          }}
        />,
      );

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        await screen.findByRole('menu');
      });
      await flushMicrotasks();

      triggerRenders = 0;
      await user.keyboard('[ArrowDown][ArrowDown][ArrowDown]');
      await flushMicrotasks();

      // The trigger's props do not depend on which item is highlighted. Keeping this at zero is
      // what stops `useListNavigation` from rebuilding them on every key, which re-rendered every
      // trigger of every menu and select in the library.
      expect(triggerRenders).toBe(0);
    });
  });

  describe('prop: onItemHighlighted', () => {
    const HighlightMenu = defineComponent(
      (props: { onItemHighlighted: (...args: unknown[]) => void }) => () => (
        <Menu.Root onItemHighlighted={props.onItemHighlighted}>
          <Menu.Trigger>Toggle</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>One</Menu.Item>
                <Menu.Item>Two</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>Three</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Nested</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
      { props: ['onItemHighlighted'] },
    );

    it('passes the keydown event for keyboard highlights', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightMenu onItemHighlighted={onItemHighlighted} />);

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      trigger.focus();
      await flushMicrotasks();
      await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });

      await user.keyboard('{ArrowDown}');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.keyboard);
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe('ArrowDown');
    });

    it('passes the keydown event for typeahead highlights', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightMenu onItemHighlighted={onItemHighlighted} />);

      const trigger = screen.getByRole('button', { name: 'Toggle' });
      trigger.focus();
      await flushMicrotasks();
      await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
      });

      await user.keyboard('t');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.keyboard);
      expect(details.event).toBeInstanceOf(KeyboardEvent);
      expect(details.event.key).toBe('t');
    });

    it('passes native mouse and pointer events for pointer highlights', async () => {
      const onItemHighlighted = vi.fn();
      await render(<HighlightMenu onItemHighlighted={onItemHighlighted} />);

      const item = await waitForLaterMillisecond(async () => {
        await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
        return screen.findByRole('menuitem', { name: 'Two' });
      });
      // In WebKit, a list ignores a move with no movement.
      const hoverEvent = new MouseEvent('mousemove', { bubbles: true, movementX: 1 });
      await fireEvent(item, hoverEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(item, expect.anything());
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.pointer);
      expect(details.event).toBeInstanceOf(MouseEvent);
      expect(details.event).toBe(hoverEvent);
      expect(details.event).not.toBeInstanceOf(PointerEvent);

      await fireEvent.pointerMove(item, { pointerType: 'mouse', movementX: 1 });
      const leaveEvent = new PointerEvent('pointerleave', {
        pointerType: 'mouse',
      });
      await fireEvent(item, leaveEvent);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(
          undefined,
          expect.objectContaining({ reason: 'pointer', event: leaveEvent }),
        );
      });
      expect(onItemHighlighted.mock.lastCall?.[1].event).toBe(leaveEvent);
    });

    it('passes the mouse event when a submenu trigger is hovered', async () => {
      const onItemHighlighted = vi.fn();
      await render(<HighlightMenu onItemHighlighted={onItemHighlighted} />);

      await fireEvent.click(screen.getByRole('button', { name: 'Toggle' }));
      const submenuTrigger = await screen.findByRole('menuitem', { name: 'Three' });
      await fireEvent.mouseEnter(submenuTrigger);
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(submenuTrigger, expect.anything());
      });

      const details = onItemHighlighted.mock.lastCall?.[1];
      expect(details.reason).toBe(REASONS.pointer);
      expect(details.event).toBeInstanceOf(MouseEvent);
    });

    describe('reporting after the callback or the list changes', () => {
      const ReportingMenu = defineComponent(
        (props: { onItemHighlighted?: (...args: unknown[]) => void; inserted?: boolean }) => () => (
          <Menu.Root onItemHighlighted={props.onItemHighlighted}>
            <Menu.Trigger>Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  {props.inserted && <Menu.Item>Archive</Menu.Item>}
                  <Menu.Item>One</Menu.Item>
                  <Menu.Item>Two</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        ),
        { props: ['onItemHighlighted', 'inserted'] },
      );

      async function openWithKeyboard(user: { keyboard: (text: string) => Promise<void> }) {
        const trigger = screen.getByRole('button', { name: 'Toggle' });
        trigger.focus();
        await flushMicrotasks();
        await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'One' })).toHaveFocus();
        });
      }

      it('does not report a stale highlight reason for a later list change', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = await render(
          <ReportingMenu onItemHighlighted={onItemHighlighted} inserted={false} />,
        );

        await openWithKeyboard(user);
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus();
        });
        expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe(REASONS.keyboard);

        onItemHighlighted.mockClear();
        await setProps({ inserted: true });

        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenCalled();
        });
        expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe(REASONS.none);
      });

      it('reports highlights correctly after onItemHighlighted is removed and added back', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = await render(
          <ReportingMenu onItemHighlighted={onItemHighlighted} />,
        );

        await openWithKeyboard(user);
        const one = screen.getByRole('menuitem', { name: 'One' });
        const two = screen.getByRole('menuitem', { name: 'Two' });

        // Moving while unobserved, then back once observed again, reports the keyboard move.
        await setProps({ onItemHighlighted: undefined });
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(two).toHaveFocus();
        });
        await setProps({ onItemHighlighted });
        onItemHighlighted.mockClear();
        await user.keyboard('[ArrowUp]');
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            one,
            expect.objectContaining({ reason: REASONS.keyboard }),
          );
        });
      });

      it('reports clearing a highlight made before onItemHighlighted was added', async () => {
        const onItemHighlighted = vi.fn();
        const { setProps, user } = await render(<ReportingMenu />);

        const one = await waitForLaterMillisecond(async () => {
          await user.click(screen.getByRole('button', { name: 'Toggle' }));
          return screen.findByRole('menuitem', { name: 'One' });
        });
        await user.hover(one);
        // In WebKit, a list ignores a move with no movement.
        await fireEvent.mouseMove(one, { movementX: 1 });
        await waitFor(() => {
          expect(one).toHaveAttribute('data-highlighted');
        });

        await setProps({ onItemHighlighted });
        await fireEvent.pointerMove(one, { pointerType: 'mouse', movementX: 1 });
        await user.unhover(one);
        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            undefined,
            expect.objectContaining({ reason: REASONS.pointer }),
          );
        });
      });
    });
  });

  describe('submenu parent store subscription', () => {
    type StoreCallback = (store: MenuStore<unknown>) => void;

    const StoreCapture = defineComponent({
      props: { capture: { type: Function as PropType<StoreCallback>, required: true } },
      setup(props) {
        props.capture(useMenuRootContext().store);
        return () => null;
      },
    });

    const TestMenu = defineComponent({
      props: {
        showSubmenu: { type: Boolean, required: true },
        captureParent: { type: Function as PropType<StoreCallback>, required: true },
        captureSubmenu: Function as PropType<StoreCallback>,
      },
      setup(props) {
        return () => (
          <Menu.Root open>
            <StoreCapture capture={props.captureParent} />
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  {props.showSubmenu && (
                    <Menu.SubmenuRoot>
                      {props.captureSubmenu && <StoreCapture capture={props.captureSubmenu} />}
                      <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    </Menu.SubmenuRoot>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    it('notifies submenu subscribers when shared parent state changes under StrictMode', async () => {
      let parentStore: MenuStore<unknown> | undefined;
      let submenuStore: MenuStore<unknown> | undefined;
      await render(
        <TestMenu
          showSubmenu
          captureParent={(store) => {
            parentStore = store;
          }}
          captureSubmenu={(store) => {
            submenuStore = store;
          }}
        />,
      );

      const submenuListener = vi.fn();
      const stop = watch(() => submenuStore!.select('rootId'), submenuListener);
      parentStore!.set('rootId', 'next-root-id');
      await flushMicrotasks();
      stop();

      expect(submenuListener).toHaveBeenCalled();
    });
  });

  describe('sibling submenus', () => {
    it('keeps a pending hover open on a closed, kept-mounted submenu when a sibling opens', async () => {
      const handleSecondOpenChange = vi.fn();
      const firstOpen = shallowRef(false);

      const App = defineComponent({
        setup() {
          return () => (
            <Menu.Root defaultOpen>
              <Menu.Trigger>Toggle</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.SubmenuRoot
                      open={firstOpen.value}
                      onOpenChange={(nextOpen: boolean) => {
                        firstOpen.value = nextOpen;
                      }}
                    >
                      <Menu.SubmenuTrigger>First</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="first-popup">
                            <Menu.Item>First item</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                    <Menu.SubmenuRoot onOpenChange={handleSecondOpenChange}>
                      <Menu.SubmenuTrigger delay={100}>Second</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="second-popup">
                            <Menu.Item>Second item</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          );
        },
      });

      await render(<App />);
      expect(screen.getByTestId('second-popup')).not.toHaveAttribute('data-open');
      expect(screen.queryByTestId('first-popup')).toBe(null);

      // Fake timers keep the second submenu's open delay from ending before the first one opens.
      vi.useFakeTimers();
      try {
        await enterWithMouse(screen.getByRole('menuitem', { name: 'Second' }));
        firstOpen.value = true;
        await flushMicrotasks();
        expect(screen.getByTestId('first-popup')).not.toBe(null);
        expect(handleSecondOpenChange).not.toHaveBeenCalled();

        await tick(200);
      } finally {
        vi.useRealTimers();
      }

      expect(handleSecondOpenChange).toHaveBeenCalledWith(true, expect.anything());
      expect(screen.getByTestId('second-popup')).toHaveAttribute('data-open');
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
      expect(events).toEqual([['openChangeComplete', true]]);
      events.length = 0;

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
    it('reports a close after the parent declined a hover open without canceling it', async () => {
      const handleOpenChange = vi.fn();
      const App = defineComponent({
        setup() {
          const open = shallowRef(false);

          return () => (
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
                handleOpenChange(nextOpen, eventDetails.reason);
                if (eventDetails.reason !== REASONS.triggerHover) {
                  open.value = nextOpen;
                }
              }}
            >
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
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
      await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await enterWithMouse(trigger);
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true, REASONS.triggerHover);
      });
      expect(screen.queryByRole('menu')).toBe(null);
      await moveMouse(trigger, document.body);

      // The store can't tell a declined open from one the parent applies later, so the close is
      // reported.
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenLastCalledWith(false, REASONS.triggerHover);
      });
    });

    it('does not report a close after the parent canceled a hover open', async () => {
      const handleOpenChange = vi.fn();
      const App = defineComponent({
        setup() {
          const open = shallowRef(false);

          return () => (
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean, eventDetails: Menu.Root.ChangeEventDetails) => {
                handleOpenChange(nextOpen, eventDetails.reason);
                if (eventDetails.reason === REASONS.triggerHover) {
                  eventDetails.cancel();
                } else {
                  open.value = nextOpen;
                }
              }}
            >
              <Menu.Trigger openOnHover delay={0}>
                Toggle
              </Menu.Trigger>
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
      await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await enterWithMouse(trigger);
      await waitFor(() => {
        expect(handleOpenChange).toHaveBeenCalledWith(true, REASONS.triggerHover);
      });
      await moveMouse(trigger, document.body);
      await wait(100);

      expect(handleOpenChange.mock.calls).toEqual([[true, REASONS.triggerHover]]);
    });

    it('reports two identical requests made in one tick twice', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      const { user } = await render(
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger-a">
            Trigger A
          </Menu.Trigger>
          <Menu.Trigger handle={handle} id="trigger-b">
            Trigger B
          </Menu.Trigger>
        </>,
      );

      await user.click(screen.getByRole('button', { name: 'Trigger A' }));
      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });
      onOpenChange.mockClear();

      handle.open('trigger-b');
      handle.open('trigger-b');
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(screen.getByRole('button', { name: 'Trigger B' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
    });

    it('ignores a request made before the root has mounted', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.open('trigger');
          });
          return () => null;
        },
      });

      await render(
        <>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <OpenOnMount />
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </>,
      );

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByRole('menu')).toBe(null);
    });

    it('accepts a request made after the root has mounted in the same commit', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.open('trigger');
          });
          return () => null;
        },
      });

      await render(
        <>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <OpenOnMount />
        </>,
      );

      expect(onOpenChange.mock.calls[0][0]).toBe(true);
      expect(screen.queryByRole('menu')).not.toBe(null);
    });

    it('ignores a request identical to the open state the root committed', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      await render(
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>,
      );

      handle.open('trigger');
      await flushMicrotasks();
      expect(screen.queryByRole('menu')).not.toBe(null);
      expect(onOpenChange).toHaveBeenCalledTimes(1);

      handle.open('trigger');
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });

    it('ignores a close request while the menu is already closed', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      await render(
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>,
      );
      expect(screen.queryByRole('menu')).toBe(null);

      handle.close();
      await flushMicrotasks();

      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it('drops a request made after the root unmounts', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();

      const Fixture = defineComponent({
        props: { showRoot: { type: Boolean, required: true } },
        setup(props) {
          return () => (
            <>
              {props.showRoot && (
                <Menu.Root handle={handle} onOpenChange={onOpenChange}>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Item</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              )}
              <Menu.Trigger handle={handle} id="trigger">
                Trigger
              </Menu.Trigger>
            </>
          );
        },
      });

      const { setProps } = await render(<Fixture showRoot />);
      const store = handle.store;
      await setProps({ showRoot: false });

      store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));
      await flushMicrotasks();

      expect(onOpenChange).not.toHaveBeenCalled();
      // The emit of an unmounted root calls no listener, so the case also reads the state.
      expect(store.state.open).toBe(false);
    });

    it('reports the committed active trigger for a close that carries no trigger', async () => {
      const handle = Menu.createHandle();
      const onOpenChange = vi.fn();
      const { user } = await render(
        <>
          <Menu.Root handle={handle} onOpenChange={onOpenChange}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger-a">
            Trigger A
          </Menu.Trigger>
          <Menu.Trigger handle={handle} id="trigger-b">
            Trigger B
          </Menu.Trigger>
        </>,
      );

      await user.click(screen.getByRole('button', { name: 'Trigger B' }));
      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });
      onOpenChange.mockClear();

      handle.close();
      await flushMicrotasks();

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.calls[0]?.[1].trigger).toBe(
        screen.getByRole('button', { name: 'Trigger B' }),
      );
    });

    it('resets allowMouseEnter once the menu unmounts after closing', async () => {
      const handle = Menu.createHandle();
      await render(
        <>
          <Menu.Root handle={handle}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>,
      );

      handle.open('trigger');
      await flushMicrotasks();
      handle.store.set('allowMouseEnter', true);
      await flushMicrotasks();
      expect(handle.store.state.allowMouseEnter).toBe(true);

      handle.close();
      await flushMicrotasks();
      expect(screen.queryByRole('menu')).toBe(null);

      expect(handle.store.state.allowMouseEnter).toBe(false);
    });

    it('marks a close without a reason as a dismissal', async () => {
      const handle = Menu.createHandle();
      await render(
        <>
          <Menu.Root handle={handle}>
            <Menu.Portal keepMounted>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Trigger handle={handle} id="trigger">
            Trigger
          </Menu.Trigger>
        </>,
      );

      handle.open('trigger');
      await flushMicrotasks();
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');

      handle.store.setOpen(
        false,
        createChangeEventDetails(undefined as unknown as typeof REASONS.none),
      );
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
    });

    it('commits a hover open after the hover event has been dispatched', async () => {
      const menuPresentDuringEvent: boolean[] = [];
      await render(
        <Menu.Root>
          <Menu.Trigger openOnHover delay={0}>
            Trigger
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Item</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      function recordMenu() {
        menuPresentDuringEvent.push(screen.queryByRole('menu') !== null);
      }

      // The trigger opens from a native `mouseenter` listener. One added after it runs once the
      // menu has handled the event. Vue renders the open in a later flush.
      trigger.addEventListener('mouseenter', recordMenu);
      try {
        trigger.dispatchEvent(new MouseEvent('mouseenter'));
      } finally {
        trigger.removeEventListener('mouseenter', recordMenu);
      }

      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });
      expect(menuPresentDuringEvent).toEqual([false]);
    });

    it.skipIf(isJSDOM)(
      'reopens immediately when re-hovering the trigger during its close transition',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        // Long enough that a slow run can't finish the close before the re-enter.
        const closeTransitionMs = 10_000;
        const style = `
          @keyframes menu-reopen-during-close {
            from {
              opacity: 1;
            }
            to {
              opacity: 0.01;
            }
          }

          [data-testid="popup"][data-ending-style] {
            animation: menu-reopen-during-close ${closeTransitionMs}ms linear forwards;
          }
        `;

        const { user } = await render(
          <>
            <style>{style}</style>
            <Menu.Root>
              <Menu.Trigger openOnHover delay={500}>
                Trigger
              </Menu.Trigger>
              <Menu.Portal keepMounted>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Item>Item</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </>,
        );

        const trigger = screen.getByRole('button', { name: 'Trigger' });

        await user.hover(trigger);
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
        });

        // The ending style lasts only while the exit runs, so the case waits for the start of the
        // exit.
        await nextEvent(screen.getByTestId('popup'), 'animationstart', {
          action: () => user.unhover(trigger),
        });
        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');

        await user.hover(trigger);

        // The fast path of the close transition opens the popup in the task of the enter event. The
        // open delay would open it later.
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
        expect(screen.getByTestId('popup')).not.toHaveAttribute('data-closed');
      },
    );

    it.skipIf(isJSDOM)(
      'leaves focus outside the menu when a keepMounted submenu reopens on hover',
      async () => {
        await render(
          <>
            <button type="button">Outside</button>
            <Menu.Root open modal={false} highlightItemOnHover={false}>
              <Menu.Trigger>Trigger</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Item>Item</Menu.Item>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger delay={0}>More</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Item>Submenu item</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </>,
        );

        const outside = screen.getByRole('button', { name: 'Outside' });
        const submenuTrigger = screen.getByRole('menuitem', { name: 'More' });

        // Open and close the submenu by pressing its trigger, then move focus out of the menu.
        await fireEvent.mouseDown(submenuTrigger);
        await waitFor(() => {
          expect(submenuTrigger).toHaveAttribute('aria-expanded', 'true');
        });
        await fireEvent.mouseDown(submenuTrigger);
        await waitFor(() => {
          expect(submenuTrigger).toHaveAttribute('aria-expanded', 'false');
        });
        outside.focus();
        await flushMicrotasks();

        await enterWithMouse(submenuTrigger);
        await waitFor(() => {
          expect(submenuTrigger).toHaveAttribute('aria-expanded', 'true');
        });

        expect(outside).toHaveFocus();
      },
    );

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

      await waitForLaterMillisecond(async () => {
        middleHandle.open('middle-trigger');
        await findByTestId('middle-menu');
      });
      await waitForLaterMillisecond(async () => {
        innerHandle.open('inner-trigger');
        await findByTestId('inner-menu');
      });

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

      await waitForLaterMillisecond(() => user.keyboard('[ArrowDown]'));
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
      expect(triggerBindings(plain.store, true)).toHaveProperty('onFocusin');
      expect(triggerBindings(virtual.store, true)).not.toHaveProperty('onFocusin');
      expect(triggerBindings(virtual.store, true)).toHaveProperty('onKeydown');
    });
  });

  describe('popup', () => {
    it('sets allowMouseEnter for a mouse move over the popup', async () => {
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
      const menu = await screen.findByRole('menu');
      await wait(0);
      expect(isScrollLocked(document)).toBe(false);

      handle.close();
      await waitFor(() => {
        expect(menu).not.toBeInTheDocument();
      });
      expect(screen.queryByRole('menu')).toBe(null);

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

    it.each([
      { name: 'mounted open', initialOpen: true },
      { name: 'opened while held', initialOpen: false },
    ])(
      'VUE-5: starts the grace time of a context menu at the activation: $name',
      async ({ initialOpen }) => {
        useFakeTimers();
        const events: boolean[] = [];
        const open = shallowRef(initialOpen);
        const { HeldBranch, mountWhileHeld, show } = createHeldBranch(() => (
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen) => {
                events.push(nextOpen);
              }}
              onUpdate:open={(nextOpen) => {
                open.value = nextOpen;
              }}
            >
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        ));
        const { getByTestId } = await render(() => (
          <div>
            <button data-testid="outside" />
            <HeldBranch />
          </div>
        ));
        const pressOutside = () =>
          fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

        await mountWhileHeld();
        open.value = true;
        await flushMicrotasks();
        vi.advanceTimersByTime(500);

        expect(events).toEqual([]);

        await show();
        await pressOutside();

        expect(events).toEqual([]);

        vi.advanceTimersByTime(500);
        await pressOutside();

        expect(events).toEqual([false]);
      },
    );

    it('VUE-5: starts the grace time again when KeepAlive shows a context menu that it deactivated in the grace time', async () => {
      useFakeTimers();
      const events: boolean[] = [];
      const open = shallowRef(false);
      const { HeldBranch, hide, show } = createHeldBranch(
        () => (
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen) => {
                events.push(nextOpen);
              }}
              onUpdate:open={(nextOpen) => {
                open.value = nextOpen;
              }}
            >
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        ),
        { mounted: true },
      );
      const { getByTestId } = await render(() => (
        <div>
          <button data-testid="outside" />
          <HeldBranch />
        </div>
      ));
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      open.value = true;
      await flushMicrotasks();
      vi.advanceTimersByTime(200);
      await hide();
      vi.advanceTimersByTime(500);
      await show();
      await pressOutside();

      expect(events).toEqual([]);

      vi.advanceTimersByTime(500);
      await pressOutside();

      expect(events).toEqual([false]);
    });

    it('VUE-5: closes a context menu whose grace time ended before KeepAlive held it on the first press after the show', async () => {
      useFakeTimers();
      const events: boolean[] = [];
      const open = shallowRef(true);
      const { HeldBranch, hide, show } = createHeldBranch(
        () => (
          <ContextMenuProvider context={createContextMenuContext()}>
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen) => {
                events.push(nextOpen);
              }}
              onUpdate:open={(nextOpen) => {
                open.value = nextOpen;
              }}
            >
              <TestPopup />
            </Menu.Root>
          </ContextMenuProvider>
        ),
        { mounted: true },
      );
      const { getByTestId } = await render(() => (
        <div>
          <button data-testid="outside" />
          <HeldBranch />
        </div>
      ));
      const pressOutside = () =>
        fireEvent.pointerDown(getByTestId('outside'), { pointerType: 'mouse' });

      vi.advanceTimersByTime(500);
      await hide();
      await show();
      await pressOutside();

      expect(events).toEqual([false]);
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
