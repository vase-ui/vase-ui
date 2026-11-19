import { afterEach, beforeAll, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Teleport, KeepAlive, defineComponent, nextTick, onMounted, shallowRef, watch } from 'vue';
import type { PropType, VNode } from 'vue';
import {
  clientCenter,
  createRenderer,
  enterWithMouse,
  fireEvent,
  fireTouch,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  isVaporParts,
  nextAnimationsRead,
  nextCall,
  nextEvent,
  popupAnatomyTests,
  popupConformanceTests,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitForPositioned,
  waitSingleFrame,
} from '#test-utils';
import { checkFragmentChildren } from '../../../test/vaporParts/checkFragmentChildren';
import * as Combobox from '../../combobox/index.parts';
import * as Dialog from '../../dialog/index.parts';
import { PATIENT_CLICK_THRESHOLD } from '../../internals/constants';
import { createChangeEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import * as Menu from '../../menu/index.parts';
import * as Select from '../../select/index.parts';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';
import * as Popover from '../index.parts';
import { useFloatingTree } from '../../utils/popups/tree/FloatingTree';
import type { FloatingTreeType } from '../../utils/popups/types';
import { OPEN_DELAY } from '../utils/constants';
import PopoverRootHydration from './PopoverRootHydration.test.vue';

const HYDRATION_FILE = 'src/popover/root/PopoverRootHydration.test.vue';

type Change = [open: boolean, reason: string];

function recordChange(changes: Change[]) {
  return (open: boolean, details: Popover.Root.ChangeEventDetails) => {
    changes.push([open, details.reason]);
  };
}

interface RootInstance {
  close(): void;
  unmount(): void;
}

// A ref on a part gives its exposed members.
function createRootRef() {
  let root: RootInstance | undefined;
  return {
    ref(instance: unknown) {
      root = (instance as RootInstance | null) ?? root;
    },
    get current() {
      return root!;
    },
  };
}

// A part that calls the composable and gives the result to the test.
const TreeProbe = defineComponent({
  props: {
    report: { type: Function as PropType<(tree: FloatingTreeType | null) => void>, required: true },
  },
  setup(props) {
    props.report(useFloatingTree().value);
    return () => null;
  },
});

function createTreeReports() {
  const trees: Record<string, FloatingTreeType | null> = {};
  const report = (name: string) => (tree: FloatingTreeType | null) => {
    trees[name] = tree;
  };
  return { trees, report };
}

type PartProps = Record<string, unknown>;

const testPopoverProps = {
  rootProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is the text of the trigger.
  triggerProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is a function that returns content before the positioner.
  portalProps: { type: Object as PropType<PartProps>, default: undefined },
  // `children` is a function that returns the content of the popup.
  popupProps: { type: Object as PropType<PartProps>, default: undefined },
  triggerPlacement: {
    type: String as PropType<'before-content' | 'after-content'>,
    default: 'before-content',
  },
  afterTrigger: { type: Function as PropType<() => VNode>, default: undefined },
  includeTrigger: { type: Boolean, default: true },
};

const ContainedTriggerPopover = defineComponent({
  props: testPopoverProps,
  setup(props) {
    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};
      const { children: popupChildren, ...restPopupProps } = props.popupProps ?? {};
      const { children: portalChildren, ...restPortalProps } = props.portalProps ?? {};

      const renderPortal = () => (
        <Popover.Portal {...restPortalProps}>
          {typeof portalChildren === 'function' ? portalChildren() : null}
          <Popover.Positioner data-testid="positioner">
            <Popover.Popup data-testid="popover-popup" {...restPopupProps}>
              {typeof popupChildren === 'function' ? popupChildren() : 'Content'}
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      );

      const triggerElement = props.includeTrigger ? (
        <Popover.Trigger data-testid="trigger" {...restTriggerProps}>
          {triggerChildren ?? 'Toggle'}
        </Popover.Trigger>
      ) : null;

      return (
        <Popover.Root {...props.rootProps}>
          {() =>
            props.triggerPlacement === 'before-content'
              ? [triggerElement, props.afterTrigger?.(), renderPortal()]
              : [renderPortal(), triggerElement, props.afterTrigger?.()]
          }
        </Popover.Root>
      );
    };
  },
});

function createDetachedTriggerPopover(multiple: boolean) {
  return defineComponent({
    props: testPopoverProps,
    setup(props) {
      const handle = Popover.createHandle();

      return () => {
        const { children, ...triggerProps } = props.triggerProps ?? {};
        const triggers = [
          <Popover.Trigger key="trigger" data-testid="trigger" handle={handle} {...triggerProps}>
            {children ?? 'Toggle'}
          </Popover.Trigger>,
        ];
        if (props.afterTrigger) {
          triggers.push(props.afterTrigger());
        }
        if (multiple) {
          triggers.push(
            <Popover.Trigger key="trigger-2" data-testid="trigger-2" handle={handle}>
              Toggle another
            </Popover.Trigger>,
          );
        }
        const root = (
          <ContainedTriggerPopover
            key="root"
            rootProps={{ ...props.rootProps, handle }}
            portalProps={props.portalProps}
            popupProps={props.popupProps}
            includeTrigger={false}
          />
        );
        return props.triggerPlacement === 'before-content'
          ? [...triggers, root]
          : [root, ...triggers];
      };
    },
  });
}

async function tick(ms: number) {
  await flushMicrotasks();
  await vi.advanceTimersByTimeAsync(ms);
  await flushMicrotasks();
}

describe('<Popover.Root />', () => {
  const { render } = createRenderer();

  popupAnatomyTests({
    held: {
      createRoot: ({ open, onOpenChangeComplete, keepMounted, content }) => (
        <Popover.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
          <Popover.Trigger>Open</Popover.Trigger>
          <Popover.Portal keepMounted={keepMounted}>{content}</Popover.Portal>
        </Popover.Root>
      ),
      createPopup: () => (
        <Popover.Positioner>
          <Popover.Popup data-testid="popup">Popup</Popover.Popup>
        </Popover.Positioner>
      ),
    },
    createComponent: ({ open, onOpenChangeComplete, content }) => (
      <Popover.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner data-testid="shown" class="shown">
            Content
            {content}
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    createPopup: () => <Popover.Popup data-testid="popup">Popup</Popover.Popup>,
    createBackdropComponent: ({ open, onOpenChangeComplete }) => (
      <Popover.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop data-testid="shown" class="shown" />
        </Popover.Portal>
      </Popover.Root>
    ),
    createBackdropAndPositionerComponent: ({ open, onOpenChangeComplete }) => (
      <Popover.Root open={open} onOpenChangeComplete={onOpenChangeComplete}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Backdrop />
          <Popover.Positioner data-testid="shown" class="shown">
            Content
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    createPendingPositionerComponent: ({ Pending, onOpenChange }) => (
      <Popover.Root defaultOpen modal onOpenChange={onOpenChange}>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Pending>
            <Popover.Positioner data-testid="shown">
              <Popover.Popup>Popup</Popover.Popup>
            </Popover.Positioner>
          </Pending>
        </Popover.Portal>
      </Popover.Root>
    ),
    render,
  });

  describe('VUE-92: a portal part that a v-if of the consumer removes', () => {
    it.each([
      { name: 'no keepMounted', keepMounted: false },
      { name: 'keepMounted', keepMounted: true },
    ])('emits openChangeComplete with false after each close: $name', async ({ keepMounted }) => {
      const onOpenChangeComplete = vi.fn();
      const open = shallowRef(false);
      await render(() => (
        <Popover.Root open={open.value} onOpenChangeComplete={onOpenChangeComplete}>
          <Popover.Trigger>Open</Popover.Trigger>
          {open.value && (
            <Popover.Portal keepMounted={keepMounted}>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Popup</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          )}
        </Popover.Root>
      ));

      async function openAndClose(cycle: number) {
        const opened = nextCall(onOpenChangeComplete);
        open.value = true;
        await opened;
        open.value = false;
        await flushMicrotasks();

        expect(screen.queryByTestId('popup')).toBe(null);
        expect(onOpenChangeComplete).toHaveBeenCalledTimes(cycle * 2);
      }

      await openAndClose(1);
      await openAndClose(2);

      expect(onOpenChangeComplete.mock.calls).toEqual([[true], [false], [true], [false]]);
    });
  });

  describe('closing before the popup attaches', () => {
    it.skipIf(isJSDOM)('waits for the closing animation once the popup attaches', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent({
        setup() {
          const open = shallowRef(true);
          onMounted(() => {
            open.value = false;
          });
          return () => (
            <>
              <style>
                {`@keyframes popover-test-exit { from { opacity: 1; } to { opacity: 0; } }
                  .popover-test-popup[data-ending-style] { animation: popover-test-exit 100s; }`}
              </style>
              <Popover.Root
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
                onOpenChangeComplete={onOpenChangeComplete}
              >
                <Popover.Trigger>Open</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup class="popover-test-popup">Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            </>
          );
        },
      });

      await render(<App />);

      const popup = await screen.findByRole('dialog', { hidden: true });
      expect(popup).toHaveAttribute('data-ending-style');
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

      // The root reads the animations of the popup in a frame after the popup attaches. The
      // animation lasts 100 s, so the root can complete the close only when the case ends the
      // animation.
      await waitSingleFrame();
      await waitSingleFrame();
      expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      popup.getAnimations().forEach((animation) => animation.finish());

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });

    it('unmounts the popup when a layout effect closes it on mount', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent({
        setup() {
          const open = shallowRef(true);
          onMounted(() => {
            open.value = false;
          });
          return () => (
            <Popover.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        },
      });

      await render(<App />);

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });

    it('unmounts the popup when a layout effect closes it right after a press opens it', async () => {
      const onOpenChangeComplete = vi.fn();

      const App = defineComponent({
        setup() {
          const open = shallowRef(false);
          watch(
            open,
            () => {
              open.value &&= false;
            },
            { flush: 'post' },
          );
          return () => (
            <Popover.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
              onOpenChangeComplete={onOpenChangeComplete}
            >
              <Popover.Trigger data-testid="trigger">Open</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup>Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          );
        },
      });

      const { user } = await render(<App />);
      await user.click(screen.getByTestId('trigger'));

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });
      expect(screen.queryByRole('dialog', { hidden: true })).toBe(null);
    });
  });

  describe('hover intent across opens', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    function renderApp() {
      return (
        <Popover.Root modal={false}>
          <Popover.Trigger openOnHover delay={0} closeDelay={0}>
            Toggle
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner data-testid="positioner">
              <Popover.Popup>
                <button type="button" aria-haspopup="menu">
                  More
                </button>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      );
    }

    async function hoverOpen(trigger: HTMLElement) {
      await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
    }

    async function leave(trigger: HTMLElement) {
      await fireEvent.pointerLeave(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseLeave(trigger, { relatedTarget: document.body });
      await fireEvent.mouseMove(document.body);
    }

    it('closes a later hover open on leave after a press inside an earlier one', async () => {
      await render(renderApp());
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await waitForLaterMillisecond(async () => {
        await hoverOpen(trigger);
        await flushMicrotasks();
      });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await fireEvent.pointerDown(screen.getByRole('button', { name: 'More' }), {
        pointerType: 'mouse',
      });
      await leave(trigger);
      await tick(100);
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
      await tick(100);
      expect(screen.queryByRole('dialog')).toBe(null);

      await hoverOpen(trigger);
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await leave(trigger);
      await tick(100);

      expect(screen.queryByRole('dialog')).toBe(null);
    });
  });

  popupConformanceTests({
    createComponent: (props) => (
      <Popover.Root {...props.root}>
        <Popover.Trigger {...props.trigger}>Open menu</Popover.Trigger>
        <Popover.Portal {...props.portal}>
          <Popover.Positioner>
            <Popover.Popup {...props.popup}>Content</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'dialog',
  });

  describe.for([
    { name: 'contained triggers', Component: ContainedTriggerPopover },
    { name: 'detached triggers', Component: createDetachedTriggerPopover(false) },
    { name: 'multiple detached triggers', Component: createDetachedTriggerPopover(true) },
  ])('when using $name', ({ name, Component: TestPopover }) => {
    describe('the root slot without content after the trigger', () => {
      if (!isVaporParts) {
        beforeAll(checkFragmentChildren);
      }

      it.each(['before-content', 'after-content'] as const)(
        'renders the trigger and popup with placement %s',
        async (placement) => {
          await render(
            <TestPopover rootProps={{ defaultOpen: true }} triggerPlacement={placement} />,
          );

          expect(screen.getByTestId('trigger')).toHaveTextContent('Toggle');
          expect(screen.getByTestId('popover-popup')).toHaveTextContent('Content');
        },
      );
    });

    it('should render the children', async () => {
      await render(<TestPopover />);

      expect(screen.getByText('Toggle')).not.toBe(null);
    });

    describe('uncontrolled open', () => {
      it('should close when the anchor is clicked twice', async () => {
        await render(<TestPopover />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.click(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.click(anchor);

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('rewires dismiss interactions after closing and reopening', async () => {
        const { user } = await render(
          <TestPopover
            rootProps={{ modal: false }}
            popupProps={{ children: () => <Popover.Close>Close</Popover.Close> }}
          />,
        );

        const trigger = screen.getByTestId('trigger');

        await waitForLaterMillisecond(async () => {
          await user.click(trigger);
          await waitFor(() => {
            expect(screen.getByRole('dialog')).not.toBe(null);
          });
        });

        await user.keyboard('{Escape}');
        expect(screen.queryByRole('dialog')).toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        await fireEvent.click(document.body);
        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    describe('controlled open', () => {
      it('should call onChange when the open state changes', async () => {
        const handleChange = vi.fn();

        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestPopover
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    handleChange(open.value);
                    open.value = nextOpen;
                  },
                }}
              />
            );
          },
        });

        await render(<App />);

        expect(screen.queryByText('Content')).toBe(null);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.click(anchor);

        await flushMicrotasks();

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.click(anchor);

        expect(screen.queryByText('Content')).toBe(null);
        expect(handleChange.mock.calls.length).toBe(2);
        expect(handleChange.mock.calls[0]![0]).toBe(false);
        expect(handleChange.mock.calls[1]![0]).toBe(true);
      });

      it('unmounts on a normal close after preventUnmountOnClose and external reopen', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);
            let preventNextUnmount = true;

            return () => (
              <>
                <button
                  type="button"
                  onClick={() => {
                    open.value = true;
                  }}
                >
                  Open externally
                </button>
                <TestPopover
                  rootProps={{
                    open: open.value,
                    onOpenChange(nextOpen: boolean, details: Popover.Root.ChangeEventDetails) {
                      if (!nextOpen && preventNextUnmount) {
                        preventNextUnmount = false;
                        details.preventUnmountOnClose();
                      }

                      open.value = nextOpen;
                    },
                  }}
                />
              </>
            );
          },
        });

        const { user } = await render(<App />);
        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });
        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        expect(trigger).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Open externally' }));
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        expect(screen.queryByText('Content')).toBe(null);
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
                <TestPopover
                  rootProps={{
                    open: open.value,
                    onOpenChange: (nextOpen: boolean) => {
                      open.value = nextOpen;
                    },
                  }}
                  triggerProps={{ openOnHover: true, delay: 0 }}
                />
              </>
            );
          },
        });

        const { user } = await render(<App />);

        await user.click(screen.getByRole('button', { name: 'Show' }));

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('dialog')).not.toBe(null);
      });

      it('closes after hovering out of a popup opened by its trigger', async () => {
        const App = defineComponent({
          setup() {
            const open = shallowRef(false);

            return () => (
              <TestPopover
                rootProps={{
                  open: open.value,
                  onOpenChange: (nextOpen: boolean) => {
                    open.value = nextOpen;
                  },
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

        expect(screen.queryByRole('dialog')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it('cleans up the safe polygon handler after a hover-opened popup becomes click-sticky', async () => {
        const addEventListenerSpy = vi.spyOn(document, 'addEventListener');
        const removeEventListenerSpy = vi.spyOn(document, 'removeEventListener');

        try {
          await render(
            <TestPopover
              rootProps={{ modal: false }}
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);

          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');

          await fireEvent.mouseLeave(trigger, { relatedTarget: positioner });
          await fireEvent.mouseEnter(positioner);

          let documentMouseMoveHandler: EventListenerOrEventListenerObject | undefined;
          for (let i = addEventListenerSpy.mock.calls.length - 1; i >= 0; i -= 1) {
            const [eventName, listener] = addEventListenerSpy.mock.calls[i]!;
            if (eventName === 'mousemove') {
              documentMouseMoveHandler = listener;
              break;
            }
          }

          expect(documentMouseMoveHandler).toEqual(expect.any(Function));

          await fireEvent.click(trigger);
          await flushMicrotasks();

          await fireEvent.mouseLeave(positioner);

          expect(screen.queryByRole('dialog')).not.toBe(null);
          // The code removes the listener with an `options` argument, so the case checks the type
          // and the listener of the call, and not its third argument.
          expect(
            removeEventListenerSpy.mock.calls.some(
              ([eventName, listener]) =>
                eventName === 'mousemove' && listener === documentMouseMoveHandler,
            ),
          ).toBe(true);
        } finally {
          addEventListenerSpy.mockRestore();
          removeEventListenerSpy.mockRestore();
        }
      });
    });

    describe('nested menu interactions', () => {
      it('keeps the popover open when a nested menu opens via Enter using a shared container', async () => {
        const Test = defineComponent(() => {
          const dialogNode = shallowRef<HTMLDialogElement | null>(null);

          return () => (
            <dialog
              open
              ref={(node) => {
                if (node) {
                  dialogNode.value = node as HTMLDialogElement;
                }
              }}
            >
              <TestPopover
                portalProps={{ to: dialogNode.value ?? undefined }}
                popupProps={{
                  children: () => (
                    <Menu.Root>
                      <Menu.Trigger>Open nested</Menu.Trigger>
                      <Menu.Portal to={dialogNode.value ?? undefined}>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="menu-popup">Nested Menu</Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  ),
                }}
              />
            </dialog>
          );
        });

        const { user } = await render(<Test />);

        const popoverTrigger = screen.getByRole('button', { name: 'Toggle' });

        popoverTrigger.focus();
        await flushMicrotasks();

        await waitForLaterMillisecond(async () => {
          await user.keyboard('{Enter}');
          await screen.findByTestId('popover-popup');
        });

        const nestedTrigger = await screen.findByRole('button', { name: 'Open nested' });

        nestedTrigger.focus();
        await flushMicrotasks();

        await user.keyboard('{Enter}');
        await screen.findByTestId('menu-popup');

        expect(screen.getByTestId('popover-popup')).not.toBe(null);
      });

      it('keeps the popover open when a nested menu opens via pointer using a shared container', async () => {
        const Test = defineComponent(() => {
          const dialogNode = shallowRef<HTMLDialogElement | null>(null);

          return () => (
            <dialog
              open
              ref={(node) => {
                if (node) {
                  dialogNode.value = node as HTMLDialogElement;
                }
              }}
            >
              <TestPopover
                portalProps={{ to: dialogNode.value ?? undefined }}
                popupProps={{
                  children: () => (
                    <Menu.Root>
                      <Menu.Trigger>Open nested</Menu.Trigger>
                      <Menu.Portal to={dialogNode.value ?? undefined}>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="menu-popup">
                            <Menu.Item closeOnClick={false}>Item</Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  ),
                }}
              />
            </dialog>
          );
        });

        const { user } = await render(<Test />);

        const popoverTrigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await user.click(popoverTrigger);
          await screen.findByTestId('popover-popup');
        });

        const nestedTrigger = await screen.findByRole('button', { name: 'Open nested' });
        await waitForLaterMillisecond(async () => {
          await user.click(nestedTrigger);
          await screen.findByTestId('menu-popup');
        });

        const item = await screen.findByText('Item');
        // In WebKit, a list ignores a pointer move with no movement, so the item has no focus when
        // the press starts.
        await user.hover(item);
        await fireEvent.mouseMove(item, { movementX: 1 });
        await user.click(item);

        await waitFor(() => {
          expect(screen.getByTestId('popover-popup')).not.toBe(null);
        });
      });
    });

    describe('prop: defaultOpen', () => {
      it('remains uncontrolled, so a trigger click closes it', async () => {
        const { user } = await render(<TestPopover rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        await user.click(screen.getByTestId('trigger'));

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('does not close after hovering out of a popup opened without trigger hover', async () => {
        await render(
          <TestPopover rootProps={{ defaultOpen: true }} triggerProps={{ openOnHover: true }} />,
        );

        expect(screen.getByText('Content')).not.toBe(null);

        const positioner = screen.getByTestId('positioner');

        await fireEvent.mouseEnter(positioner);
        await fireEvent.mouseLeave(positioner);

        expect(screen.getByText('Content')).not.toBe(null);
      });
    });

    describe('prop: delay', () => {
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      it('should open after delay with rest type by default', async () => {
        await render(<TestPopover triggerProps={{ openOnHover: true, delay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(anchor);
        await fireEvent.mouseMove(anchor);

        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);

        await tick(100);

        expect(screen.getByText('Content')).not.toBe(null);
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
        await render(<TestPopover triggerProps={{ openOnHover: true, closeDelay: 100 }} />);

        const anchor = screen.getByRole('button', { name: 'Toggle' });

        await fireEvent.mouseEnter(anchor);
        await fireEvent.mouseMove(anchor);

        await tick(OPEN_DELAY);

        expect(screen.getByText('Content')).not.toBe(null);

        await fireEvent.mouseLeave(anchor);

        await tick(50);

        expect(screen.getByText('Content')).not.toBe(null);

        await tick(50);

        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('hover close transitions', () => {
      it.skipIf(isJSDOM)(
        'reopens immediately when re-hovering the trigger during a hover close transition',
        async () => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

          // Long enough that a slow run can't finish the close before the re-enter.
          const closeTransitionMs = 10_000;
          const style = `
            @keyframes popover-reopen-during-close {
              from {
                opacity: 1;
              }
              to {
                opacity: 0.01;
              }
            }

            .animation-test-indicator[data-ending-style] {
              animation: popover-reopen-during-close ${closeTransitionMs}ms linear forwards;
            }
          `;

          const { user } = await render(
            <>
              <style>{style}</style>
              <TestPopover
                portalProps={{ keepMounted: true }}
                // Popover.Trigger uses `delay` as `restMs`, so this remains a
                // rest-only hover reopen case with no fallback open delay.
                triggerProps={{ openOnHover: true, delay: 1 }}
                popupProps={{ class: 'animation-test-indicator' }}
              />
            </>,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await user.hover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-open');
          });

          // The ending style lasts only while the exit runs, so the case waits for the start of the
          // exit animation.
          const popup = screen.getByTestId('popover-popup');
          const exit = await nextEvent(popup, 'animationstart', {
            action: () => user.unhover(trigger),
          });
          expect((exit as AnimationEvent).animationName).toBe('popover-reopen-during-close');
          expect(popup).toHaveAttribute('data-ending-style');

          // Re-enter without a follow-up mousemove so this only passes if the
          // close-transition fast path runs from `onMouseEnter`.
          await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          await fireEvent.mouseEnter(trigger);

          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-open');
          });
          expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-closed');
        },
      );
    });

    describe('VaseUIChangeEventDetails', () => {
      it('onOpenChange cancel() prevents closing from a close press without changing the trigger', async () => {
        let closePressTriggerId: string | undefined;

        await render(
          <TestPopover
            triggerProps={{ id: 'trigger-1' }}
            rootProps={{
              onOpenChange: (nextOpen: boolean, eventDetails: Popover.Root.ChangeEventDetails) => {
                if (!nextOpen && eventDetails.reason === REASONS.closePress) {
                  closePressTriggerId = eventDetails.trigger?.id;
                  eventDetails.cancel();
                }
              },
            }}
            popupProps={{
              children: () => (
                <Popover.Close data-testid="close" id="close-button">
                  Close
                </Popover.Close>
              ),
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await waitForLaterMillisecond(async () => {
          await fireEvent.click(trigger);
          await flushMicrotasks();
        });

        await fireEvent.click(screen.getByTestId('close'));

        expect(closePressTriggerId).toBe('trigger-1');
        expect(screen.queryByTestId('close')).not.toBe(null);
      });

      it('unmounts on a later normal close after a preventUnmountOnClose cycle and reopen', async () => {
        let preventNextUnmount = true;
        const { user } = await render(
          <TestPopover
            rootProps={{
              onOpenChange: (open: boolean, details: Popover.Root.ChangeEventDetails) => {
                if (!open && preventNextUnmount) {
                  preventNextUnmount = false;
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });
        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        expect(trigger).not.toHaveAttribute('data-popup-open');
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        expect(screen.queryByText('Content')).toBe(null);
      });
    });

    describe('focus management', () => {
      it('focuses the trigger after the popover is closed but not unmounted', async () => {
        const { user } = await render(
          <div>
            <input type="text" />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{ children: () => <Popover.Close>Close</Popover.Close> }}
            />
            <input type="text" />
          </div>,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        await user.click(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        await user.click(close);

        await waitFor(() => {
          expect(toggle).toHaveFocus();
        });
      });

      it('restores temporarily disabled focus before focusing a reopened keepMounted popover', async () => {
        const { user } = await render(
          <div>
            <input />
            <TestPopover
              portalProps={{ keepMounted: true }}
              popupProps={{ children: () => <button data-testid="inside">Inside</button> }}
              afterTrigger={() => <input data-testid="after" />}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        const inside = await screen.findByTestId('inside');
        await waitFor(() => {
          expect(inside).toHaveFocus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-open');

        await user.click(trigger);

        await waitFor(() => {
          expect(inside).toHaveFocus();
        });
      });

      it('does not move focus to the popover when opened with hover', async () => {
        const { user } = await render(
          <TestPopover
            triggerProps={{ openOnHover: true, delay: 0 }}
            popupProps={{ children: () => <Popover.Close>Close</Popover.Close> }}
          />,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });

        toggle.focus();
        await flushMicrotasks();

        await user.hover(toggle);
        await flushMicrotasks();

        const close = screen.getByRole('button', { name: 'Close' });

        expect(close).not.toBe(null);
        expect(close).not.toHaveFocus();
      });

      it('does not change focus when opened with hover and closed', async () => {
        const style = `
        .popup {
          width: 100px;
          height: 100px;
          background-color: red;
          opacity: 1;
          transition: opacity 1ms;
        }

        .popup[data-exiting] {
          opacity: 0;
        }
      `;

        const { user } = await render(
          <div>
            <style>{style}</style>
            <input type="text" data-testid="first-input" />
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 0, closeDelay: 0 }}
              popupProps={{ class: 'popup' }}
            />
            <input type="text" data-testid="last-input" />
          </div>,
        );

        const toggle = screen.getByRole('button', { name: 'Toggle' });
        const firstInput = screen.getByTestId('first-input');
        const lastInput = screen.getByTestId('last-input');

        lastInput.focus();
        await flushMicrotasks();

        await user.hover(toggle);
        await flushMicrotasks();

        await user.hover(firstInput);
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);

        expect(lastInput).toHaveFocus();
      });

      describe('with the popup following immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{ children: () => <input data-testid="input-inside" /> }}
                afterTrigger={() => <input data-testid="focus-target" />}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          inputInside.focus();
          await flushMicrotasks();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        it('closes a nested combobox popup when tabbing out of the popover', async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: () => (
                    <Combobox.Root items={['a', 'b']}>
                      <Combobox.Input data-testid="combobox-input" />
                      <Combobox.Portal>
                        <Combobox.Positioner>
                          <Combobox.Popup>
                            <Combobox.List>
                              <Combobox.Item value="a">a</Combobox.Item>
                              <Combobox.Item value="b">b</Combobox.Item>
                            </Combobox.List>
                          </Combobox.Popup>
                        </Combobox.Positioner>
                      </Combobox.Portal>
                    </Combobox.Root>
                  ),
                }}
                afterTrigger={() => <input data-testid="focus-target" />}
              />
            </div>,
          );

          const comboboxInput = screen.getByTestId('combobox-input');
          await waitFor(() => {
            expect(comboboxInput).toHaveFocus();
          });

          await user.click(comboboxInput);
          await flushMicrotasks();

          expect(screen.getByRole('listbox')).toBeVisible();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-closed');
          });

          expect(screen.queryByRole('listbox')).toBe(null);
        });

        it('closes a nested combobox popup when tabbing backward to the trigger', async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: () => (
                    <Combobox.Root items={['a', 'b']}>
                      <Combobox.Input data-testid="combobox-input" />
                      <Combobox.Portal>
                        <Combobox.Positioner>
                          <Combobox.Popup>
                            <Combobox.List>
                              <Combobox.Item value="a">a</Combobox.Item>
                              <Combobox.Item value="b">b</Combobox.Item>
                            </Combobox.List>
                          </Combobox.Popup>
                        </Combobox.Positioner>
                      </Combobox.Portal>
                    </Combobox.Root>
                  ),
                }}
              />
            </div>,
          );

          const comboboxInput = screen.getByTestId('combobox-input');
          await waitFor(() => {
            expect(comboboxInput).toHaveFocus();
          });

          await user.click(comboboxInput);
          await flushMicrotasks();

          expect(screen.getByRole('listbox')).toBeVisible();

          const trigger = screen.getByTestId('trigger');
          expect(trigger).not.toHaveAttribute('aria-hidden', 'true');

          await user.tab({ shift: true });

          expect(trigger).toHaveFocus();

          expect(screen.queryByRole('listbox')).toBe(null);
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  popupProps={{ children: () => <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            const inputInside = screen.getByTestId('input-inside');
            inputInside.focus();
            await flushMicrotasks();

            await wait(50);
            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.getByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.keyboard('{Tab}');
            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );
      });

      describe('with focusable elements between the trigger and the popup', () => {
        it('closes and moves focus before the trigger when tabbing backward from the focused trigger', async () => {
          const { user } = await render(
            <div>
              <input data-testid="before" />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                popupProps={{ children: () => <input data-testid="input-inside" /> }}
              />
              <input />
            </div>,
          );

          const trigger = screen.getByTestId('trigger');
          // The popup takes the focus one frame after it opens, so a focus on the trigger before
          // that frame does not stay.
          await waitFor(() => {
            expect(screen.getByTestId('input-inside')).toHaveFocus();
          });
          trigger.focus();
          await flushMicrotasks();

          await user.tab({ shift: true });

          await waitFor(() => {
            expect(screen.getByTestId('before')).toHaveFocus();
          });

          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        it('moves focus to the element following the trigger when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                afterTrigger={() => <input data-testid="focus-target" />}
                popupProps={{ children: () => <input data-testid="input-inside" /> }}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          inputInside.focus();
          await flushMicrotasks();

          await user.tab();

          await waitFor(() => {
            expect(screen.getByTestId('focus-target')).toHaveFocus();
          });

          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  afterTrigger={() => <input />}
                  popupProps={{ children: () => <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });

            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.getByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.tab();
            await wait(50);
            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );

        it.skipIf(isJSDOM)(
          'moves focus to the element preceding the trigger when tabbing backward from the trigger while open',
          async () => {
            globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

            await render(
              <div>
                <input data-testid="focus-target" />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  afterTrigger={() => <input />}
                  popupProps={{ children: () => <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });

            // Native Tab runs a microtask checkpoint between the blur of the trigger and the focus
            // of the guard.
            await userEvent.tab({ shift: true });
            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            const popup = screen.getByTestId('popover-popup');
            await userEvent.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByTestId('focus-target')).toHaveFocus();
            });
            await waitFor(() => {
              expect(popup).not.toBeInTheDocument();
            });
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          },
        );
      });

      describe('with the popup preceding immediately the only trigger', () => {
        it('moves focus to the element following the trigger, excluding the popup, when tabbing forward from the open popup', async () => {
          const { user } = await render(
            <div>
              <input />
              <TestPopover
                rootProps={{ defaultOpen: true }}
                triggerPlacement="after-content"
                popupProps={{ children: () => <input data-testid="input-inside" /> }}
                afterTrigger={() => <input data-testid="focus-target" />}
              />
              <input />
            </div>,
          );

          const inputInside = screen.getByTestId('input-inside');
          inputInside.focus();
          await flushMicrotasks();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();

          expect(screen.queryByTestId('popover-popup')).toBe(null);
        });

        it.skipIf(isJSDOM)(
          'moves focus to the trigger when tabbing backward from the open popup then to the popup when tabbing forward',
          async () => {
            const { user } = await render(
              <div>
                <input />
                <TestPopover
                  rootProps={{ defaultOpen: true }}
                  triggerPlacement="after-content"
                  popupProps={{ children: () => <input data-testid="input-inside" /> }}
                />
                <input />
              </div>,
            );

            const inputInside = screen.getByTestId('input-inside');
            inputInside.focus();
            await flushMicrotasks();

            await wait(50);
            await user.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByRole('button', { name: 'Toggle' })).toHaveFocus();
            });

            await waitFor(() => {
              expect(screen.getByTestId('popover-popup')).toBeVisible();
            });

            await wait(50);
            await user.keyboard('{Tab}');

            await waitFor(() => {
              expect(screen.getByTestId('input-inside')).toHaveFocus();
            });
          },
        );
      });
    });

    describe('outside press event with backdrops', () => {
      it('uses intentional outside press with user backdrop (mouse): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
            portalProps={{ children: () => <Popover.Backdrop data-testid="backdrop" /> }}
          />,
        );

        const backdrop = screen.getByTestId('backdrop');

        await fireEvent.mouseDown(backdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        await fireEvent.click(backdrop);
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('uses intentional outside press with internal backdrop (modal=true): closes on click, not on mousedown', async () => {
        const handleOpenChange = vi.fn();

        await render(
          <TestPopover
            rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange, modal: true }}
          />,
        );

        const internalBackdrop = document.querySelector('[role="presentation"]') as HTMLElement;

        await fireEvent.mouseDown(internalBackdrop);
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(0);

        await fireEvent.click(internalBackdrop);
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(handleOpenChange.mock.calls.length).toBe(1);
      });

      it('closing via outside press: works when clicking another element inside the same shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        onTestFinished(() => {
          host.remove();
        });
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        await render(
          <Teleport to={container}>
            <button data-testid="outside">Outside</button>
            <TestPopover
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              portalProps={{ to: shadowRoot }}
            />
          </Teleport>,
        );

        const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;
        const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
        expect(activeTrigger).not.toBe(null);

        await fireEvent.click(outsideButton);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0]![1].reason).toBe(REASONS.outsidePress);
        expect(handleOpenChange.mock.calls[0]![1].trigger).toBe(activeTrigger);
      });

      it('closing via outside press: works when clicking outside the shadow root', async () => {
        const handleOpenChange = vi.fn();

        const host = document.body.appendChild(document.createElement('div'));
        onTestFinished(() => {
          host.remove();
        });
        const shadowRoot = host.attachShadow({ mode: 'open' });
        const container = document.createElement('div');
        shadowRoot.appendChild(container);

        await render(
          <Teleport to={container}>
            <TestPopover
              rootProps={{ defaultOpen: true, onOpenChange: handleOpenChange }}
              portalProps={{ to: shadowRoot }}
            />
          </Teleport>,
        );
        const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
        expect(activeTrigger).not.toBe(null);

        await fireEvent.click(document.body);

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);

        expect(handleOpenChange.mock.calls.length).toBe(1);
        expect(handleOpenChange.mock.calls[0]![1].reason).toBe(REASONS.outsidePress);
        expect(handleOpenChange.mock.calls[0]![1].trigger).toBe(activeTrigger);
      });
    });

    describe('non-modal focus transitions', () => {
      it('closes as soon as focus leaves the popup on pointer down outside', async () => {
        await render(
          <>
            <TestPopover
              rootProps={{ defaultOpen: true }}
              popupProps={{ children: () => <button data-testid="inside">Inside</button> }}
            />
            <button data-testid="outside">Outside</button>
          </>,
        );

        const inside = screen.getByTestId('inside');
        inside.focus();
        await flushMicrotasks();

        const outside = screen.getByTestId('outside');

        await fireEvent.pointerDown(outside);
        outside.focus();
        await flushMicrotasks();
        await fireEvent.focusOut(inside, { relatedTarget: outside });

        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it.skipIf(isJSDOM)(
        'moves focus to the next element when tabbing out of a nested menu inside the popover',
        async () => {
          const { user } = await render(
            <div>
              <TestPopover
                rootProps={{ defaultOpen: true }}
                portalProps={{ keepMounted: true }}
                popupProps={{
                  children: () => (
                    <>
                      <button type="button" data-testid="before">
                        Before
                      </button>
                      <Menu.Root>
                        <Menu.Trigger>Menu</Menu.Trigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Item>Item</Menu.Item>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.Root>
                      <button type="button" data-testid="after">
                        After
                      </button>
                    </>
                  ),
                }}
              />
            </div>,
          );

          const menu = await waitForLaterMillisecond(async () => {
            await user.click(screen.getByRole('button', { name: 'Menu' }));
            return screen.findByRole('menu');
          });
          await waitFor(() => {
            expect(menu).toHaveFocus();
          });

          await user.tab();

          expect(screen.getByTestId('after')).toHaveFocus();
          expect(screen.queryByRole('menu')).toBe(null);
          expect(screen.getByTestId('popover-popup')).toBeVisible();
        },
      );

      describe.skipIf(isJSDOM)('during the exit animation', () => {
        beforeEach(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        });

        it('moves focus to the element following the trigger when tabbing forward from the trigger', async () => {
          const onOpenChangeComplete = vi.fn();
          // The transition lasts 100 s, so the case ends it with `finish()`.
          const style = `
            .popup {
              transition: opacity 100s;
            }

            .popup[data-ending-style] {
              opacity: 0;
            }
          `;

          const { user } = await render(
            <div>
              <style>{style}</style>
              <TestPopover
                rootProps={{ onOpenChangeComplete }}
                afterTrigger={() => <input data-testid="focus-target" />}
                popupProps={{
                  class: 'popup',
                  children: () => <input data-testid="input-inside" />,
                }}
              />
            </div>,
          );

          const trigger = screen.getByTestId('trigger');
          await user.click(trigger);
          const popup = await screen.findByTestId('popover-popup');
          // The root reads the animations of the popup in a frame after the open. The wait for
          // the read of the close must start after that read.
          await waitFor(() => {
            expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
          });
          const animations = await nextAnimationsRead(popup, { action: () => user.click(trigger) });

          expect(popup).toHaveAttribute('data-ending-style');
          expect(trigger).toHaveFocus();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();
          animations.forEach((animation) => animation.finish());
          await waitFor(() => {
            expect(popup).not.toBeInTheDocument();
          });
          expect(screen.queryByTestId('popover-popup')).toBe(null);
          expect(screen.getByTestId('focus-target')).toHaveFocus();
        });
      });

      // The multiple-triggers variant has a second tabbable trigger.
      const multiTrigger = name === 'multiple detached triggers';
      describe.skipIf(isJSDOM || multiTrigger)('with no other tabbable element on the page', () => {
        // Records every focus guard that receives focus, so a test can tell "each guard handed
        // focus over once" from "the guards bounced focus back and forth".
        function trackFocusedGuards() {
          const focusedGuards: Element[] = [];
          function handleFocusIn(event: FocusEvent) {
            const target = event.target as Element;
            if (target.hasAttribute('data-vase-ui-focus-guard')) {
              focusedGuards.push(target);
            }
          }
          document.addEventListener('focusin', handleFocusIn);
          return {
            focusedGuards,
            stop: () => document.removeEventListener('focusin', handleFocusIn),
          };
        }

        beforeEach(() => {
          // With animations enabled the popup stays mounted for a short time after it closes.
          // Trigger guards that outlive `open` must not move the focus between them then.
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        });

        it('does not loop focus between guards when tabbing out of the popup', async () => {
          const { user } = await render(<TestPopover />);

          await user.click(screen.getByTestId('trigger'));
          const popup = await screen.findByRole('dialog');
          await waitFor(() => {
            expect(popup).toHaveFocus();
          });

          const { focusedGuards, stop } = trackFocusedGuards();
          try {
            await user.tab();
          } finally {
            stop();
          }

          await waitFor(() => {
            expect(popup).not.toBeInTheDocument();
          });
          expect(screen.queryByRole('dialog')).toBe(null);
          expect(new Set(focusedGuards).size).toBe(focusedGuards.length);
          expect(screen.getByTestId('trigger')).toHaveFocus();
        });

        it('does not loop focus between guards when shift-tabbing out of the trigger', async () => {
          const { user } = await render(<TestPopover />);

          const trigger = screen.getByTestId('trigger');
          await user.click(trigger);
          const popup = await screen.findByRole('dialog');
          await waitFor(() => {
            expect(popup).toHaveFocus();
          });
          trigger.focus();
          await flushMicrotasks();

          const { focusedGuards, stop } = trackFocusedGuards();
          try {
            await user.keyboard('{Shift>}{Tab}{/Shift}');
          } finally {
            stop();
          }

          await waitFor(() => {
            expect(popup).not.toBeInTheDocument();
          });
          expect(screen.queryByRole('dialog')).toBe(null);
          expect(new Set(focusedGuards).size).toBe(focusedGuards.length);
          expect(screen.getByTestId('trigger')).toHaveFocus();
        });
      });
    });

    describe.skipIf(isJSDOM)('pointerdown removal', () => {
      it('moves focus to the popup when a focused child is removed on pointerdown and outside press still dismisses', async () => {
        const Test = defineComponent({
          setup() {
            const showButton = shallowRef(true);

            return () => (
              <TestPopover
                rootProps={{ defaultOpen: true, modal: 'trap-focus' }}
                popupProps={{
                  children: () =>
                    showButton.value ? (
                      <button
                        data-testid="remove"
                        onPointerdown={() => {
                          showButton.value = false;
                        }}
                      >
                        Remove on pointer down
                      </button>
                    ) : null,
                }}
              />
            );
          },
        });

        const { user } = await render(<Test />);

        const removeButton = screen.getByTestId('remove');
        await waitFor(() => {
          expect(removeButton).toHaveFocus();
        });
        await fireEvent.pointerDown(removeButton);

        const popup = screen.getByTestId('popover-popup');
        await waitFor(() => {
          expect(popup).toHaveFocus();
        });

        await user.click(document.body);

        expect(screen.queryByRole('dialog')).toBe(null);
      });
    });

    describe('prop: actionsRef', () => {
      it('unmounts the popover when the `unmount` method is called', async () => {
        const root = createRootRef();

        const { user } = await render(
          <TestPopover
            rootProps={{
              ref: root.ref,
              onOpenChange: (_open: boolean, details: Popover.Root.ChangeEventDetails) => {
                details.preventUnmountOnClose();
              },
            }}
          />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        root.current.unmount();
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
      });

      it('does not repeat closing completion when `unmount` is called after the automatic unmount', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();

        const { user } = await render(
          <TestPopover rootProps={{ ref: root.ref, onOpenChangeComplete }} />,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);
        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

        root.current.unmount();
        await flushMicrotasks();
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('keeps the opt-out when a controlled close is applied in a transition', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        const App = defineComponent({
          setup() {
            const open = shallowRef(true);
            return () => (
              <TestPopover
                rootProps={{
                  open: open.value,
                  ref: root.ref,
                  onOpenChangeComplete,
                  onOpenChange: (nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                    if (!nextOpen) {
                      details.preventUnmountOnClose();
                    }
                    // Vue has no low-priority update. The write comes in the tick after the event.
                    void nextTick(() => {
                      open.value = nextOpen;
                    });
                  },
                }}
              />
            );
          },
        });

        const { user } = await render(<App />);
        const trigger = screen.getByRole('button', { name: 'Toggle' });
        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
        });
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);

        root.current.unmount();
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('ignores `unmount` while the popup is open', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        await render(
          <TestPopover rootProps={{ defaultOpen: true, ref: root.ref, onOpenChangeComplete }} />,
        );
        const popup = screen.getByRole('dialog');

        root.current.unmount();
        await flushMicrotasks();

        expect(screen.getByRole('dialog')).toBe(popup);
        expect(popup).not.toHaveAttribute('data-starting-style');
        expect(onOpenChangeComplete).not.toHaveBeenCalledWith(false);
      });

      it('unmounts when `close` and `unmount` are called in one batch', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        await render(
          <TestPopover
            rootProps={{
              defaultOpen: true,
              ref: root.ref,
              onOpenChangeComplete,
              onOpenChange: (open: boolean, details: Popover.Root.ChangeEventDetails) => {
                if (!open) {
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        root.current.close();
        root.current.unmount();
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('unmounts when `close` and `unmount` are called in one batch while controlled', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();

        const App = defineComponent({
          setup() {
            const open = shallowRef(true);
            return () => (
              <TestPopover
                rootProps={{
                  open: open.value,
                  ref: root.ref,
                  onOpenChangeComplete,
                  onOpenChange: (nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                    if (!nextOpen) {
                      details.preventUnmountOnClose();
                    }
                    open.value = nextOpen;
                  },
                }}
              />
            );
          },
        });

        await render(<App />);

        root.current.close();
        root.current.unmount();
        await flushMicrotasks();

        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('still unmounts on a later close after `unmount` was called while open', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        const { user } = await render(
          <TestPopover rootProps={{ defaultOpen: true, ref: root.ref, onOpenChangeComplete }} />,
        );

        root.current.unmount();
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
      });

      it('still unmounts on a later close after `unmount` and a reopen in one batch', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        let reopenOnComplete = true;
        let optOut = true;
        const App = defineComponent({
          setup() {
            const open = shallowRef(true);
            return () => (
              <TestPopover
                rootProps={{
                  open: open.value,
                  ref: root.ref,
                  onOpenChange: (nextOpen: boolean, details: Popover.Root.ChangeEventDetails) => {
                    if (!nextOpen && optOut) {
                      details.preventUnmountOnClose();
                    }
                    open.value = nextOpen;
                  },
                  onOpenChangeComplete: (nextOpen: boolean) => {
                    onOpenChangeComplete(nextOpen);
                    // An exit-animation callback that reopens right after it unmounts.
                    if (!nextOpen && reopenOnComplete) {
                      reopenOnComplete = false;
                      open.value = true;
                    }
                  },
                }}
              />
            );
          },
        });

        const { user } = await render(<App />);
        root.current.close();
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).not.toBe(null);

        root.current.unmount();
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).not.toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);

        optOut = false;
        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(2);
      });

      it('completes closing once when `unmount` is called twice in one batch', async () => {
        const root = createRootRef();
        const onOpenChangeComplete = vi.fn();
        const { user } = await render(
          <TestPopover
            rootProps={{
              defaultOpen: true,
              ref: root.ref,
              onOpenChangeComplete,
              onOpenChange: (open: boolean, details: Popover.Root.ChangeEventDetails) => {
                if (!open) {
                  details.preventUnmountOnClose();
                }
              },
            }}
          />,
        );

        await user.click(screen.getByRole('button', { name: 'Toggle' }));
        expect(screen.queryByRole('dialog')).not.toBe(null);

        root.current.unmount();
        root.current.unmount();
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).toBe(null);
        expect(onOpenChangeComplete.mock.calls.filter(([open]) => !open)).toHaveLength(1);
      });

      it('closes the popover when the `close` method is called', async () => {
        const root = createRootRef();
        await render(<TestPopover rootProps={{ defaultOpen: true, ref: root.ref }} />);

        root.current.close();
        await flushMicrotasks();

        expect(screen.queryByText('Content')).toBe(null);
      });

      it('clears the active trigger when `unmount` is called right after a controlled close', async () => {
        const root = createRootRef();
        const open = shallowRef(false);

        const App = defineComponent({
          setup() {
            // Runs before the root gets the new `open` prop, so the unmount is deferred to the
            // closing render.
            watch(open, () => {
              if (!open.value) {
                root.current.unmount();
              }
            });

            return () => (
              <Popover.Root
                ref={root.ref}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
              >
                <Popover.Trigger>Trigger 1</Popover.Trigger>
                <Popover.Trigger>Trigger 2</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="popup">Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            );
          },
        });

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

      it('clears the active trigger when a popup part calls `unmount` as a controlled close renders', async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const root = createRootRef();
        const open = shallowRef(false);

        // Its watcher runs in the flush in which the popup renders as closed, after the DOM update
        // of that flush.
        const UnmountOnClose = defineComponent({
          props: { open: { type: Boolean, required: true } },
          setup(props) {
            watch(
              () => props.open,
              (isOpen) => {
                if (!isOpen) {
                  root.current.unmount();
                }
              },
              { flush: 'post' },
            );
            return () => null;
          },
        });

        const App = defineComponent({
          setup() {
            return () => (
              <Popover.Root
                ref={root.ref}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  open.value = nextOpen;
                }}
              >
                <Popover.Trigger>Trigger 1</Popover.Trigger>
                <Popover.Trigger>Trigger 2</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup
                      data-testid="popup"
                      v-slots={{
                        render: ({
                          props,
                          state,
                        }: {
                          props: HTMLProps;
                          state: { open: boolean };
                        }) => (
                          <div {...props}>
                            <UnmountOnClose open={state.open} />
                          </div>
                        ),
                      }}
                    />
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            );
          },
        });

        const { user } = await render(<App />);
        const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });

        await user.click(trigger1);
        await waitFor(() => {
          expect(trigger1).toHaveAttribute('aria-expanded', 'true');
        });

        // A pending exit animation leaves the call of the part to `unmount` as the only one.
        Object.defineProperty(screen.getByTestId('popup'), 'getAnimations', {
          value: () => [{ finished: new Promise(() => {}) }],
          configurable: true,
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

    describe('prop: modal', () => {
      it('should render an internal backdrop when `true`', async () => {
        const { user } = await render(
          <div>
            <TestPopover rootProps={{ modal: true }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
      });

      it('should only render focus guards inside the popup when `true`', async () => {
        const { user } = await render(
          <div>
            <TestPopover
              rootProps={{ modal: true }}
              popupProps={{ children: () => <Popover.Close>Close</Popover.Close> }}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        expect(
          trigger.previousElementSibling?.hasAttribute('data-vase-ui-focus-guard') ?? false,
        ).toBe(false);
        expect(trigger.nextElementSibling?.hasAttribute('data-vase-ui-focus-guard') ?? false).toBe(
          false,
        );
        expect(
          document.querySelectorAll('[data-vase-ui-focus-guard][data-type="inside"]'),
        ).toHaveLength(2);
      });

      it('should keep trigger focus guards when `true` without a close part', async () => {
        const { user } = await render(
          <div>
            <TestPopover
              rootProps={{ defaultOpen: true, modal: true }}
              popupProps={{ children: () => <input data-testid="input-inside" /> }}
              afterTrigger={() => <input data-testid="focus-target" />}
            />
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });
        expect(trigger.previousElementSibling).toHaveAttribute('data-vase-ui-focus-guard');
        expect(trigger.nextElementSibling).toHaveAttribute('data-vase-ui-focus-guard');

        screen.getByTestId('input-inside').focus();
        await flushMicrotasks();

        await user.tab();

        expect(screen.getByTestId('focus-target')).toHaveFocus();

        expect(screen.queryByTestId('popover-popup')).toBe(null);
      });

      it('should not render an internal backdrop when `false`', async () => {
        const { user } = await render(
          <div>
            <TestPopover rootProps={{ modal: false }} />
            <button>Outside</button>
          </div>,
        );

        const trigger = screen.getByRole('button', { name: 'Toggle' });

        await user.click(trigger);

        await waitFor(() => {
          expect(screen.getByRole('dialog')).not.toBe(null);
        });

        const positioner = screen.getByTestId('positioner');

        expect(positioner.previousElementSibling).toBe(null);
      });

      describe('with openOnHover', () => {
        beforeEach(() => {
          vi.useFakeTimers();
        });

        afterEach(() => {
          vi.useRealTimers();
        });

        it('enables modal behavior after a hover-open is clicked', async () => {
          await render(
            <TestPopover
              rootProps={{ modal: true }}
              triggerProps={{ openOnHover: true, delay: 0 }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger);

          await flushMicrotasks();
          expect(screen.queryByRole('dialog')).not.toBe(null);

          const positioner = screen.getByTestId('positioner');
          expect(positioner.previousElementSibling).toBe(null);

          await tick(PATIENT_CLICK_THRESHOLD - 1);
          await fireEvent.click(trigger);

          await flushMicrotasks();

          expect(positioner.previousElementSibling).toHaveAttribute('role', 'presentation');
        });

        it('reopens on hover after an impatient click is followed by a close button press', async () => {
          await render(
            <TestPopover
              triggerProps={{ openOnHover: true, delay: 100 }}
              popupProps={{ children: () => <Popover.Close>Close</Popover.Close> }}
            />,
          );

          const trigger = screen.getByRole('button', { name: 'Toggle' });

          await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          await tick(100);

          expect(screen.queryByRole('dialog')).not.toBe(null);

          await tick(PATIENT_CLICK_THRESHOLD - 1);
          await fireEvent.click(trigger);
          await flushMicrotasks();

          await fireEvent.click(screen.getByRole('button', { name: 'Close' }));
          await flushMicrotasks();

          expect(screen.queryByRole('dialog')).toBe(null);

          // Re-enter with mouse events only. A fresh pointerenter can be
          // missed after the click-driven close, but hover should still work.
          await fireEvent.mouseEnter(trigger);
          await fireEvent.mouseMove(trigger, { movementX: 10, movementY: 0 });

          await tick(100);

          expect(screen.queryByRole('dialog')).not.toBe(null);
        });
      });
    });

    describe.skipIf(isJSDOM)('scroll locking', () => {
      describe('touch scroll lock', () => {
        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'applies scroll lock when a touch-opened popup $name covers the viewport width',
          async ({ keepMounted }) => {
            await render(
              <Popover.Root modal>
                <Popover.Trigger>Open</Popover.Trigger>
                <Popover.Portal keepMounted={keepMounted}>
                  <Popover.Positioner
                    data-testid="positioner"
                    style={{ width: 'calc(100vw - 10px)' }}
                  >
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);
            await fireEvent.click(trigger, { detail: 1 });

            const popup = await screen.findByRole('dialog');
            const doc = popup.ownerDocument;

            await waitFor(() => {
              expect(isScrollLocked(doc)).toBe(true);
            });
          },
        );

        it.each([
          { name: 'unmounted while closed', keepMounted: false },
          { name: 'kept mounted while closed', keepMounted: true },
        ])(
          'does not apply scroll lock when a touch-opened popup $name is narrower than the viewport',
          async ({ keepMounted }) => {
            await render(
              <Popover.Root modal>
                <Popover.Trigger>Open</Popover.Trigger>
                <Popover.Portal keepMounted={keepMounted}>
                  <Popover.Positioner data-testid="positioner" style={{ width: '240px' }}>
                    <Popover.Popup>Content</Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>,
            );

            const trigger = screen.getByRole('button', { name: 'Open' });

            await fireEvent.pointerDown(trigger, { pointerType: 'touch' });
            await fireEvent.mouseDown(trigger);
            await fireEvent.click(trigger, { detail: 1 });

            const popup = await screen.findByRole('dialog');
            const doc = popup.ownerDocument;

            await waitSingleFrame();
            // A lock comes in a 0 ms timer after the open.
            await wait(0);

            expect(isScrollLocked(doc)).toBe(false);
          },
        );
      });
    });

    describe('nested popup interactions', () => {
      it('returns focus through nested programmatic popovers in close order', async () => {
        const Test = defineComponent({
          setup() {
            const childOpen = shallowRef(false);

            return () => (
              <Popover.Root>
                <Popover.Trigger>Parent trigger</Popover.Trigger>
                <Popover.Portal>
                  <Popover.Positioner>
                    <Popover.Popup data-testid="parent-popup">
                      <button
                        type="button"
                        onClick={() => {
                          childOpen.value = true;
                        }}
                      >
                        Open child programmatically
                      </button>

                      <Popover.Root
                        open={childOpen.value}
                        triggerId="child-reference"
                        onOpenChange={(nextOpen: boolean) => {
                          childOpen.value = nextOpen;
                        }}
                      >
                        <Popover.Trigger id="child-reference">Child reference</Popover.Trigger>
                        <Popover.Portal>
                          <Popover.Positioner>
                            <Popover.Popup data-testid="child-popup">
                              <Popover.Close>Close child</Popover.Close>
                            </Popover.Popup>
                          </Popover.Positioner>
                        </Popover.Portal>
                      </Popover.Root>

                      <Popover.Close>Close parent</Popover.Close>
                    </Popover.Popup>
                  </Popover.Positioner>
                </Popover.Portal>
              </Popover.Root>
            );
          },
        });

        const { user } = await render(<Test />);

        const parentTrigger = screen.getByRole('button', { name: 'Parent trigger' });
        await waitForLaterMillisecond(async () => {
          await user.click(parentTrigger);
          await waitFor(() => {
            expect(screen.getByTestId('parent-popup')).not.toBe(null);
          });
        });

        const childOpener = screen.getByRole('button', {
          name: 'Open child programmatically',
        });
        await waitForLaterMillisecond(async () => {
          await user.click(childOpener);
          await waitFor(() => {
            expect(screen.getByTestId('child-popup')).not.toBe(null);
          });
        });

        await user.click(screen.getByRole('button', { name: 'Close child' }));

        expect(screen.queryByTestId('child-popup')).toBe(null);
        expect(childOpener).toHaveFocus();
        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Close parent' }));

        expect(screen.queryByTestId('parent-popup')).toBe(null);
        expect(parentTrigger).toHaveFocus();
      });

      it('keeps the parent popover open when press starts in nested popover and ends outside', async () => {
        const parentChanges: Change[] = [];
        const childPress = vi.fn();
        const Test = defineComponent({
          setup() {
            return () => (
              <div>
                <button
                  type="button"
                  data-testid="outside"
                  style={{ position: 'fixed', right: '10px', bottom: '10px' }}
                >
                  Outside
                </button>

                <Popover.Root defaultOpen onOpenChange={recordChange(parentChanges)}>
                  <Popover.Trigger>Parent</Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner data-testid="parent-positioner">
                      <Popover.Popup data-testid="parent-popup">
                        <Popover.Root>
                          <Popover.Trigger>Child</Popover.Trigger>
                          <Popover.Portal>
                            <Popover.Positioner side="right" data-testid="child-positioner">
                              <Popover.Popup data-testid="child-popup" onPointerdown={childPress}>
                                Child content
                              </Popover.Popup>
                            </Popover.Positioner>
                          </Popover.Portal>
                        </Popover.Root>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            );
          },
        });

        await render(<Test />);

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);

        const childTrigger = screen.getByRole('button', { name: 'Child' });
        await waitForPositioned(screen.getByTestId('parent-positioner'));
        await waitFor(() => {
          expect(childTrigger).toHaveFocus();
        });

        const childPopup = await waitForLaterMillisecond(async () => {
          await userEvent.click(childTrigger);
          return screen.findByTestId('child-popup');
        });
        await waitForPositioned(screen.getByTestId('child-positioner'));
        const outside = screen.getByTestId('outside');
        const from = clientCenter(childPopup);
        const to = clientCenter(outside);
        const destination = { x: to.clientX, y: to.clientY };
        let held = true;
        onTestFinished(async () => {
          if (held) {
            await userEvent.pointer({ coords: destination, keys: '[/MouseLeft]' });
          }
        });

        await userEvent.pointer({
          coords: { x: from.clientX, y: from.clientY },
          keys: '[MouseLeft>]',
        });
        expect(childPress).toHaveBeenCalledOnce();
        // The inside marker expires in a timer task before the release.
        await wait(0);
        await userEvent.pointer({ coords: destination });
        // The release gives a click to the common ancestor of the two targets.
        await nextEvent(document, 'click', {
          action: () => userEvent.pointer({ coords: destination, keys: '[/MouseLeft]' }),
        });
        held = false;
        await flushMicrotasks();

        expect(parentChanges).toEqual([]);
        const parentPopup = screen.getByTestId('parent-popup');
        expect(parentPopup).toBeInTheDocument();
        expect(screen.queryByTestId('child-popup')).not.toBe(null);

        await userEvent.click(outside);
        expect(parentChanges).toEqual([[false, 'outside-press']]);
        await waitFor(() => {
          expect(parentPopup).not.toBeInTheDocument();
        });
        expect(screen.queryByTestId('child-popup')).toBe(null);
      });

      it.each([
        {
          name: 'Select',
          renderChild: (onChildPress: (event: PointerEvent) => void) => (
            <Select.Root modal={false}>
              <Select.Trigger data-testid="child-trigger">Child</Select.Trigger>
              <Select.Portal>
                <Select.Positioner
                  alignItemWithTrigger={false}
                  side="right"
                  data-testid="child-positioner"
                >
                  <Select.Popup
                    data-testid="child-popup"
                    style={{ padding: '30px' }}
                    onPointerdown={onChildPress}
                  >
                    <Select.Item value="a">a</Select.Item>
                  </Select.Popup>
                </Select.Positioner>
              </Select.Portal>
            </Select.Root>
          ),
        },
        {
          name: 'Menu',
          renderChild: (onChildPress: (event: PointerEvent) => void) => (
            <Menu.Root modal={false}>
              <Menu.Trigger data-testid="child-trigger">Child</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner side="right" data-testid="child-positioner">
                  <Menu.Popup
                    data-testid="child-popup"
                    style={{ padding: '30px' }}
                    onPointerdown={onChildPress}
                  >
                    <Menu.Item>a</Menu.Item>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          ),
        },
      ])(
        'VUE-4: keeps the parent popover open when a drag from a non-modal $name child ends outside',
        async ({ renderChild }) => {
          const parentChanges: Change[] = [];
          const childPress = vi.fn<(event: PointerEvent) => void>();
          const Test = defineComponent({
            setup() {
              // The outside target takes no focus. A press on a focusable element moves the focus,
              // and the parent then closes with `focus-out` before the click.
              return () => (
                <div>
                  <div
                    data-testid="outside"
                    style={{
                      position: 'fixed',
                      right: '10px',
                      bottom: '10px',
                      width: '40px',
                      height: '40px',
                    }}
                  />

                  <Popover.Root defaultOpen onOpenChange={recordChange(parentChanges)}>
                    <Popover.Trigger>Parent</Popover.Trigger>
                    <Popover.Portal>
                      <Popover.Positioner data-testid="parent-positioner">
                        <Popover.Popup data-testid="parent-popup">
                          {renderChild(childPress)}
                        </Popover.Popup>
                      </Popover.Positioner>
                    </Popover.Portal>
                  </Popover.Root>
                </div>
              );
            },
          });

          await render(<Test />);

          expect(screen.queryByTestId('parent-popup')).not.toBe(null);

          const childTrigger = screen.getByTestId('child-trigger');
          await waitForPositioned(screen.getByTestId('parent-positioner'));
          await waitFor(() => {
            expect(childTrigger).toHaveFocus();
          });

          const childPopup = await waitForLaterMillisecond(async () => {
            await userEvent.click(childTrigger);
            return screen.findByTestId('child-popup');
          });
          await waitForPositioned(screen.getByTestId('child-positioner'));
          const childRect = childPopup.getBoundingClientRect();
          const outside = screen.getByTestId('outside');
          const to = clientCenter(outside);
          const destination = { x: to.clientX, y: to.clientY };
          let held = true;
          onTestFinished(async () => {
            if (held) {
              await userEvent.pointer({ coords: destination, keys: '[/MouseLeft]' });
            }
          });

          await userEvent.pointer({
            coords: { x: childRect.left + 15, y: childRect.top + 15 },
            keys: '[MouseLeft>]',
          });
          expect(childPress).toHaveBeenCalledOnce();
          expect(childPress.mock.calls[0]?.[0].target).toBe(childPopup);
          // The inside marker expires in a timer task before the release.
          await wait(0);
          await userEvent.pointer({ coords: destination });
          // The release gives a click to the common ancestor of the two targets.
          await nextEvent(document, 'click', {
            action: () => userEvent.pointer({ coords: destination, keys: '[/MouseLeft]' }),
          });
          held = false;
          await flushMicrotasks();

          expect(parentChanges).toEqual([]);
          const parentPopup = screen.getByTestId('parent-popup');
          expect(parentPopup).toBeInTheDocument();

          await userEvent.click(outside);
          expect(parentChanges).toEqual([[false, 'outside-press']]);
          await waitFor(() => {
            expect(parentPopup).not.toBeInTheDocument();
          });
        },
      );

      it.skipIf(isJSDOM)(
        'should not close popover when scrolling nested popup on touch',
        async () => {
          const fruits = Array.from({ length: 50 }, (_, i) => i);
          await render(
            <TestPopover
              rootProps={{ defaultOpen: true }}
              popupProps={{
                children: () => (
                  <Combobox.Root items={fruits} defaultOpen>
                    <Combobox.Input placeholder="Choose a fruit" />
                    <Combobox.Portal>
                      <Combobox.Positioner>
                        <Combobox.Popup
                          data-testid="combobox-popup"
                          style={{ maxHeight: '200px', overflow: 'auto' }}
                        >
                          <Combobox.List>
                            {{
                              item: ({ item }: { item: number }) => (
                                <Combobox.Item key={item} value={item} style={{ height: '100px' }}>
                                  {item}
                                </Combobox.Item>
                              ),
                            }}
                          </Combobox.List>
                        </Combobox.Popup>
                      </Combobox.Positioner>
                    </Combobox.Portal>
                  </Combobox.Root>
                ),
              }}
            />,
          );

          const popoverPopup = screen.getByTestId('popover-popup');
          expect(popoverPopup).not.toBe(null);

          await flushMicrotasks();

          const comboboxPopup = screen.getByTestId('combobox-popup');
          expect(comboboxPopup).not.toBe(null);

          // Simulate touch scroll: touchstart + touchmove on the scrollable list
          await fireTouch.start(comboboxPopup, { touches: [{ clientX: 100, clientY: 100 }] });

          // Wait for the timeout that marks the press as inside the popup tree to finish
          await wait(0);

          await fireTouch.move(comboboxPopup, { touches: [{ clientX: 100, clientY: 50 }] });

          await fireTouch.end(comboboxPopup, { changedTouches: [{ clientX: 100, clientY: 50 }] });

          await flushMicrotasks();

          expect(screen.queryByTestId('popover-popup')).not.toBe(null);
          expect(screen.queryByTestId('combobox-popup')).not.toBe(null);
        },
      );

      it('should close child popover when clicking parent popover', async () => {
        const { user } = await render(
          <TestPopover
            triggerProps={{ 'data-testid': 'parent-trigger' }}
            popupProps={{
              'data-testid': 'parent-popup',
              children: () => (
                <ContainedTriggerPopover
                  triggerProps={{ 'data-testid': 'child-trigger' }}
                  popupProps={{ 'data-testid': 'child-popup', children: () => null }}
                />
              ),
            }}
          />,
        );

        expect(screen.queryByTestId('parent-popup')).toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const parentTrigger = screen.getByTestId('parent-trigger');
        await waitForLaterMillisecond(async () => {
          await user.click(parentTrigger);
          await flushMicrotasks();
        });

        const parentPopup = screen.getByTestId('parent-popup');

        expect(parentPopup).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);

        const childTrigger = screen.getByTestId('child-trigger');
        await waitForLaterMillisecond(async () => {
          await user.click(childTrigger);
          await flushMicrotasks();
        });

        expect(parentPopup).not.toBe(null);
        expect(screen.getByTestId('child-popup')).not.toBe(null);

        await user.click(parentPopup);
        await flushMicrotasks();

        expect(screen.queryByTestId('parent-popup')).not.toBe(null);
        expect(screen.queryByTestId('child-popup')).toBe(null);
      });
    });
  });

  it('keeps the popover open when Escape closes a nested dialog after a backdrop press', async () => {
    const onPopoverOpenChange = vi.fn();
    const { user } = await render(
      <Popover.Root defaultOpen onOpenChange={onPopoverOpenChange}>
        <Popover.Trigger>Popover trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popover">
              <Dialog.Root disablePointerDismissal>
                <Dialog.Trigger>Open dialog</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Backdrop data-testid="backdrop" />
                  <Dialog.Popup data-testid="dialog">
                    <input data-testid="input" />
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    await user.click(screen.getByRole('button', { name: 'Open dialog' }));
    await waitFor(() => {
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    // `disablePointerDismissal` keeps the dialog open, but the press still moves focus to the body.
    await user.click(screen.getByTestId('backdrop'));
    expect(document.activeElement).toBe(document.body);
    expect(screen.queryByTestId('dialog')).not.toBe(null);

    await user.keyboard('[Escape]');

    expect(screen.queryByTestId('dialog')).toBe(null);
    expect(screen.queryByTestId('popover')).not.toBe(null);
    expect(onPopoverOpenChange).not.toHaveBeenCalled();
  });

  describe('outside press in a dialog outside its React tree', () => {
    type User = Awaited<ReturnType<typeof render>>['user'];

    it.each([
      {
        name: 'clicking a button',
        submits: false,
        press: async (user: User) => {
          await user.click(screen.getByRole('button', { name: 'Inside dialog' }));
        },
      },
      {
        // Implicit form submission dispatches a click on the submit button.
        name: 'pressing Enter in a form input',
        submits: true,
        press: async (user: User) => {
          await user.keyboard('[Enter]');
        },
      },
    ])(
      'stays open when $name inside a modal dialog opened after it',
      async ({ press, submits }) => {
        const dialogHandle = Dialog.createHandle();
        const onPopoverOpenChange = vi.fn();
        const onSubmit = vi.fn((event: Event) => event.preventDefault());

        const { user } = await render(
          <>
            <Popover.Root defaultOpen onOpenChange={onPopoverOpenChange}>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popover">
                    <Dialog.Trigger handle={dialogHandle}>Open dialog</Dialog.Trigger>
                  </Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Dialog.Root handle={dialogHandle}>
              <Dialog.Portal>
                <Dialog.Popup data-testid="dialog">
                  <form onSubmit={onSubmit}>
                    <input data-testid="input" />
                    <button type="submit">Submit</button>
                  </form>
                  <button type="button">Inside dialog</button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>,
        );

        await waitForLaterMillisecond(async () => {
          await user.click(screen.getByRole('button', { name: 'Open dialog' }));
          await waitFor(() => {
            expect(screen.getByTestId('dialog')).not.toBe(null);
          });
        });
        expect(screen.queryByTestId('popover')).not.toBe(null);
        await waitFor(() => {
          expect(screen.getByTestId('input')).toHaveFocus();
        });

        await press(user);

        expect(onSubmit.mock.calls.length).toBe(submits ? 1 : 0);
        expect(screen.queryByTestId('dialog')).not.toBe(null);
        expect(screen.queryByTestId('popover')).not.toBe(null);
        expect(onPopoverOpenChange).not.toHaveBeenCalled();
      },
    );

    it('closes when pressing inside a modal dialog opened before it', async () => {
      const popoverHandle = Popover.createHandle();
      const onPopoverOpenChange = vi.fn();

      const { user } = await render(
        <>
          <Dialog.Root defaultOpen>
            <Dialog.Portal>
              <Dialog.Popup data-testid="dialog">
                <Popover.Trigger handle={popoverHandle}>Open popover</Popover.Trigger>
                {/* Keeps focus where it is, so only the outside press can close the popover. */}
                <button type="button" onMousedown={(event: MouseEvent) => event.preventDefault()}>
                  Inside dialog
                </button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <Popover.Root handle={popoverHandle} onOpenChange={onPopoverOpenChange}>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popover" />
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>,
      );

      await user.click(screen.getByRole('button', { name: 'Open popover' }));
      await waitFor(() => {
        expect(screen.getByTestId('popover')).not.toBe(null);
      });
      onPopoverOpenChange.mockClear();

      await user.click(screen.getByRole('button', { name: 'Inside dialog' }));

      expect(screen.queryByTestId('popover')).toBe(null);
      expect(onPopoverOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
      expect(screen.queryByTestId('dialog')).not.toBe(null);
    });
  });

  describe('preventUnmountOnClose()', () => {
    it('does not leak from a canceled close into a synchronous second close', async () => {
      const popover = Popover.createHandle();
      let closeAttempts = 0;

      const { user } = await render(
        <>
          <button type="button" onClick={() => popover.close()}>
            Close popover
          </button>
          <Popover.Root
            handle={popover}
            defaultOpen
            defaultTriggerId="trigger"
            onOpenChange={(open: boolean, details: Popover.Root.ChangeEventDetails) => {
              if (open) {
                return;
              }

              closeAttempts += 1;

              if (closeAttempts === 1) {
                details.preventUnmountOnClose();
                details.cancel();
                popover.close();
              }
            }}
          >
            <Popover.Trigger handle={popover} id="trigger">
              Toggle
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </>,
      );

      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Close popover' }));

      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('unmounts on a normal close after a prevented close and initially open remount', async () => {
      const popover = Popover.createHandle();
      let preventNextUnmount = true;

      const App = defineComponent({
        setup() {
          const showRoot = shallowRef(true);
          const remountOpen = shallowRef(false);

          return () => (
            <>
              <button
                type="button"
                onClick={() => {
                  showRoot.value = false;
                }}
              >
                Unmount root
              </button>
              <button
                type="button"
                onClick={() => {
                  remountOpen.value = true;
                  showRoot.value = true;
                }}
              >
                Remount open
              </button>
              {showRoot.value && (
                <Popover.Root
                  handle={popover}
                  defaultOpen={remountOpen.value}
                  defaultTriggerId="trigger"
                  onOpenChange={(open: boolean, details: Popover.Root.ChangeEventDetails) => {
                    if (!open && preventNextUnmount) {
                      preventNextUnmount = false;
                      details.preventUnmountOnClose();
                    }
                  }}
                >
                  <Popover.Trigger handle={popover} id="trigger">
                    Toggle
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup data-testid="popup">Content</Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              )}
            </>
          );
        },
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Toggle' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });

      await user.click(trigger);
      expect(trigger).not.toHaveAttribute('data-popup-open');
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByTestId('popup')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount open' }));
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Toggle' })).toHaveAttribute('data-popup-open');
      });
      expect(screen.queryByTestId('popup')).not.toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle' }));
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe('close requests', () => {
    it('reports the active trigger for an outside press close', async () => {
      const onOpenChange = vi.fn();
      const { user } = await render(
        <div>
          <button type="button">Outside</button>
          <Popover.Root onOpenChange={onOpenChange}>
            <Popover.Trigger>Trigger A</Popover.Trigger>
            <Popover.Trigger>Trigger B</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup>Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        </div>,
      );
      const triggerB = screen.getByRole('button', { name: 'Trigger B' });

      await user.click(triggerB);
      expect(screen.queryByText('Content')).not.toBe(null);
      await fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
      expect(screen.queryByText('Content')).toBe(null);

      expect(onOpenChange).toHaveBeenCalledTimes(2);
      expect(onOpenChange.mock.calls[1]![1].reason).toBe(REASONS.outsidePress);
      expect(onOpenChange.mock.calls[1]![1].trigger).toBe(triggerB);
    });

    it('marks a close without a reason as a dismissal', async () => {
      const handle = Popover.createHandle();
      await render(
        <Popover.Root handle={handle} defaultOpen>
          <Popover.Trigger handle={handle}>Trigger</Popover.Trigger>
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');

      handle.store.setOpen(
        false,
        createChangeEventDetails(undefined as unknown as typeof REASONS.none),
      );
      await flushMicrotasks();

      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
    });
  });

  describe('hover open after a dismissal', () => {
    it('renders the open popup without the dismissal instant type', async () => {
      const renders: { open: boolean; instant: string | undefined }[] = [];

      const { user } = await render(
        <Popover.Root>
          <Popover.Trigger openOnHover delay={0}>
            Trigger
          </Popover.Trigger>
          <Popover.Portal keepMounted>
            <Popover.Positioner>
              <Popover.Popup
                data-testid="popup"
                v-slots={{
                  default: ({ state }: { state: Popover.Popup.State }) => {
                    renders.push({ open: state.open, instant: state.instant });
                    return 'Content';
                  },
                }}
              />
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });
      await user.keyboard('[Escape]');
      expect(screen.getByTestId('popup')).not.toHaveAttribute('data-open');
      expect(screen.getByTestId('popup')).toHaveAttribute('data-instant', 'dismiss');
      await user.unhover(trigger);
      renders.length = 0;

      await fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
      await fireEvent.mouseEnter(trigger);
      await fireEvent.mouseMove(trigger);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      });

      expect(renders.find((entry) => entry.open)).toEqual({ open: true, instant: undefined });
    });

    it('cancels a pending hover open when the `close` action is called', async () => {
      const onOpenChange = vi.fn();
      const root = createRootRef();
      await render(() => (
        <Popover.Root ref={root.ref} onOpenChange={onOpenChange}>
          <Popover.Trigger openOnHover delay={100}>
            Trigger
          </Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="popup">Content</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>
      ));

      await enterWithMouse(screen.getByRole('button', { name: 'Trigger' }));
      root.current.close();
      await flushMicrotasks();
      await wait(200);

      expect(onOpenChange).not.toHaveBeenCalled();
      expect(screen.queryByTestId('popup')).toBe(null);
    });
  });

  describe('after a close from a trigger', () => {
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
              Open externally
            </button>
            <Popover.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
            >
              <Popover.Trigger>Trigger A</Popover.Trigger>
              <Popover.Trigger>Trigger B</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="popup">Content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
            <Popover.Root>
              <Popover.Trigger>Other popover</Popover.Trigger>
              <Popover.Portal>
                <Popover.Positioner>
                  <Popover.Popup data-testid="other-popup">Other content</Popover.Popup>
                </Popover.Positioner>
              </Popover.Portal>
            </Popover.Root>
          </>
        );
      },
    });

    it('closes when that trigger is pressed after a controlled open without a trigger', async () => {
      const { user } = await render(<App />);
      const triggerA = screen.getByRole('button', { name: 'Trigger A' });

      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
      await user.click(triggerA);
      expect(screen.queryByTestId('popup')).toBe(null);

      await fireEvent.click(screen.getByRole('button', { name: 'Open externally' }));
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });

      await user.click(triggerA);
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('returns focus to that trigger when a later open started from the body', async () => {
      const { user } = await render(<App />);
      const triggerA = screen.getByRole('button', { name: 'Trigger A' });
      const otherTrigger = screen.getByRole('button', { name: 'Other popover' });

      await user.click(triggerA);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
      await user.click(triggerA);
      expect(screen.queryByTestId('popup')).toBe(null);

      // Another popover is the last one opened from a focused element.
      await user.click(otherTrigger);
      await waitFor(() => {
        expect(screen.getByTestId('other-popup')).not.toBe(null);
      });
      await user.click(otherTrigger);
      expect(screen.queryByTestId('other-popup')).toBe(null);

      otherTrigger.blur();
      await flushMicrotasks();
      expect(document.activeElement).toBe(document.body);

      await fireEvent.click(screen.getByRole('button', { name: 'Open externally' }));
      await waitFor(() => {
        expect(screen.getByTestId('popup')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });

      await user.keyboard('[Escape]');
      expect(screen.queryByTestId('popup')).toBe(null);
      await waitFor(() => {
        expect(triggerA).toHaveFocus();
      });
    });
  });

  it('opens with defaultOpen and marks the trigger of defaultTriggerId', async () => {
    await render(
      <Popover.Root defaultOpen defaultTriggerId="first">
        <Popover.Trigger id="first">First</Popover.Trigger>
        <Popover.Trigger id="second">Second</Popover.Trigger>
      </Popover.Root>,
    );

    const first = screen.getByRole('button', { name: 'First' });
    const second = screen.getByRole('button', { name: 'Second' });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('data-popup-open');
    // No popup is mounted, so the trigger names none.
    expect(first).not.toHaveAttribute('aria-controls');
    expect(second).toHaveAttribute('aria-expanded', 'false');
    expect(second).not.toHaveAttribute('data-popup-open');
    expect(second).not.toHaveAttribute('aria-controls');
  });

  it('emits openChange and then update:open', async () => {
    const handle = Popover.createHandle<unknown>();
    const events: unknown[] = [];
    await render(
      <Popover.Root
        handle={handle}
        onOpenChange={(open, details) => events.push(['openChange', open, details.reason])}
        {...{ 'onUpdate:open': (open: boolean) => events.push(['update:open', open]) }}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>,
    );

    handle.open('trigger');
    handle.close();

    expect(events).toEqual([
      ['openChange', true, 'imperative-action'],
      ['update:open', true],
      ['openChange', false, 'imperative-action'],
      ['update:open', false],
    ]);
  });

  it('does not emit update:open after cancel()', async () => {
    const handle = Popover.createHandle<unknown>();
    const changes: Change[] = [];
    const updates: boolean[] = [];
    await render(
      <Popover.Root
        handle={handle}
        onOpenChange={(open, details) => {
          changes.push([open, details.reason]);
          details.cancel();
        }}
        {...{ 'onUpdate:open': (open: boolean) => updates.push(open) }}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>,
    );

    handle.open('trigger');
    await flushMicrotasks();

    expect(changes).toEqual([[true, 'imperative-action']]);
    expect(updates).toEqual([]);
    expect(handle.isOpen).toBe(false);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('follows v-model:open', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Popover.Root
        open={open.value}
        {...{
          'onUpdate:open': (value: boolean) => {
            open.value = value;
          },
        }}
      >
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>
    ));
    const trigger = screen.getByRole('button');
    expect(trigger).toHaveAttribute('aria-expanded', 'false');

    open.value = true;
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger).toHaveAttribute('data-popup-open');

    open.value = false;
    await flushMicrotasks();
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('closes with Escape and reports the active trigger', async () => {
    const details: Popover.Root.ChangeEventDetails[] = [];
    const { user } = await render(
      <Popover.Root
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={(_open, eventDetails) => details.push(eventDetails)}
      >
        <Popover.Trigger id="trigger">Open</Popover.Trigger>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });

    await user.keyboard('[Escape]');

    expect(details).toHaveLength(1);
    expect(details[0].reason).toBe('escape-key');
    expect(details[0].trigger).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  it.each<{
    name: string;
    modal: boolean | 'trap-focus';
    closesOnPointerdown: boolean;
    event: string;
  }>([
    {
      name: 'closes on the click of an outside press',
      modal: false,
      closesOnPointerdown: false,
      event: 'click',
    },
    {
      name: 'closes on the pointerdown, trap-focus',
      modal: 'trap-focus',
      closesOnPointerdown: true,
      event: 'pointerdown',
    },
  ])('$name', async ({ modal, closesOnPointerdown, event }) => {
    const details: Popover.Root.ChangeEventDetails[] = [];
    await render(
      <div>
        <button data-testid="outside" />
        <Popover.Root
          defaultOpen
          defaultTriggerId="trigger"
          modal={modal}
          onOpenChange={(_open, eventDetails) => details.push(eventDetails)}
        >
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>
      </div>,
    );
    const outside = screen.getByTestId('outside');
    const trigger = screen.getByRole('button', { name: 'Open' });

    await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
    expect(trigger).toHaveAttribute('aria-expanded', closesOnPointerdown ? 'false' : 'true');

    await fireEvent.mouseDown(outside);
    await fireEvent.pointerUp(outside, { pointerType: 'mouse' });
    await fireEvent.mouseUp(outside);
    await fireEvent.click(outside, { detail: 1 });

    expect(trigger).toHaveAttribute('aria-expanded', 'false');
    expect(details.map((item) => [item.reason, item.event.type])).toEqual([
      ['outside-press', event],
    ]);
  });

  it('BUG-5410: a press in a same-origin frame closes a popover that is not modal', async () => {
    const changes: Change[] = [];
    await render(
      <div>
        <iframe data-testid="frame" srcdoc="<button id='inside'>in the frame</button>" />
        <Popover.Root defaultOpen defaultTriggerId="trigger" onOpenChange={recordChange(changes)}>
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>
      </div>,
    );
    const frame = screen.getByTestId<HTMLIFrameElement>('frame');
    await waitFor(() => {
      expect(frame.contentDocument?.getElementById('inside')).not.toBe(null);
    });
    await flushMicrotasks();
    const button = frame.contentDocument!.getElementById('inside')!;
    const frameWindow = frame.contentWindow as Window & typeof globalThis;

    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      const EventType = type.startsWith('pointer')
        ? frameWindow.PointerEvent
        : frameWindow.MouseEvent;
      button.dispatchEvent(
        new EventType(type, { bubbles: true, cancelable: true, composed: true, detail: 1 }),
      );
    }
    await flushMicrotasks();

    expect(changes).toEqual([[false, 'outside-press']]);
    expect(screen.getByRole('button', { name: 'Open' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('registers a trigger outside the root', async () => {
    const handle = Popover.createHandle<unknown>();
    await render(
      <>
        <Popover.Trigger id="before" handle={handle}>
          Before
        </Popover.Trigger>
        <Popover.Root handle={handle}>
          <Popover.Trigger id="inside">Inside</Popover.Trigger>
        </Popover.Root>
        <Popover.Trigger id="after" handle={handle}>
          After
        </Popover.Trigger>
      </>,
    );
    const before = screen.getByRole('button', { name: 'Before' });
    const inside = screen.getByRole('button', { name: 'Inside' });
    const after = screen.getByRole('button', { name: 'After' });

    handle.open('after');
    await flushMicrotasks();
    expect([before, inside, after].map((item) => item.getAttribute('aria-expanded'))).toEqual([
      'false',
      'false',
      'true',
    ]);

    handle.open('before');
    await flushMicrotasks();
    expect([before, inside, after].map((item) => item.getAttribute('aria-expanded'))).toEqual([
      'true',
      'false',
      'false',
    ]);
  });

  it('exposes close and unmount', async () => {
    const changes: Change[] = [];
    const root = createRootRef();
    await render(() => (
      <Popover.Root
        ref={root.ref}
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={recordChange(changes)}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>
    ));

    expect(Object.keys(root.current)).toEqual(['unmount', 'close']);

    root.current.close();
    await flushMicrotasks();

    expect(changes).toEqual([[false, 'imperative-action']]);
    expect(screen.getByRole('button')).toHaveAttribute('aria-expanded', 'false');
  });

  it('gives the modal prop to the store', async () => {
    const handle = Popover.createHandle<unknown>();
    const modal = shallowRef<boolean | 'trap-focus'>('trap-focus');
    await render(() => (
      <Popover.Root handle={handle} modal={modal.value}>
        <Popover.Trigger />
      </Popover.Root>
    ));
    expect(handle.store.select('modal')).toBe('trap-focus');

    modal.value = true;
    await flushMicrotasks();

    expect(handle.store.select('modal')).toBe(true);
  });

  it('clears the interaction type of the open when the popover closes', async () => {
    const handle = Popover.createHandle<unknown>();
    const { user } = await render(
      <Popover.Root handle={handle}>
        <Popover.Trigger>Open</Popover.Trigger>
      </Popover.Root>,
    );
    const trigger = screen.getByRole('button');

    await fireEvent.pointerDown(trigger, { pointerType: 'mouse' });
    await fireEvent.click(trigger, { detail: 1 });
    expect(handle.isOpen).toBe(true);
    expect(handle.store.state.openMethod).toBe('mouse');

    await user.keyboard('[Escape]');

    expect(handle.isOpen).toBe(false);
    expect(handle.store.state.openMethod).toBe(null);
  });

  describe('timer of a patient press', () => {
    async function renderOpenRoot() {
      const handle = Popover.createHandle<unknown>();
      const { unmount } = await render(
        <Popover.Root handle={handle} defaultOpen defaultTriggerId="trigger">
          <Popover.Trigger id="trigger" />
        </Popover.Root>,
      );
      const { stickIfOpenTimeout } = handle.store.context;
      onTestFinished(stickIfOpenTimeout.clear);
      stickIfOpenTimeout.start(60_000, () => {});
      expect(stickIfOpenTimeout.isStarted()).toBe(true);
      return { handle, stickIfOpenTimeout, unmount };
    }

    it('stops when the popover closes', async () => {
      const { handle, stickIfOpenTimeout } = await renderOpenRoot();

      handle.close();
      await flushMicrotasks();

      expect(stickIfOpenTimeout.isStarted()).toBe(false);
    });

    it('stops when the root unmounts', async () => {
      const { stickIfOpenTimeout, unmount } = await renderOpenRoot();

      unmount();

      expect(stickIfOpenTimeout.isStarted()).toBe(false);
    });
  });

  describe('tree', () => {
    it('starts a tree when no popover is above it', async () => {
      const { trees, report } = createTreeReports();
      await render(
        <div>
          <TreeProbe report={report('outside')} />
          <Popover.Root>
            <TreeProbe report={report('first')} />
          </Popover.Root>
          <Popover.Root>
            <TreeProbe report={report('second')} />
          </Popover.Root>
        </div>,
      );

      expect(trees.outside).toBe(null);
      expect(trees.first).not.toBe(null);
      expect(trees.second).not.toBe(null);
      expect(trees.first).not.toBe(trees.second);
    });

    it('joins the tree of the popover above it', async () => {
      const { trees, report } = createTreeReports();
      await render(
        <Popover.Root>
          <TreeProbe report={report('parent')} />
          <Popover.Root>
            <TreeProbe report={report('child')} />
          </Popover.Root>
        </Popover.Root>,
      );

      expect(trees.parent).not.toBe(null);
      expect(trees.child).toBe(trees.parent);
    });
  });

  it('VUE-5: keeps its open state and its popup under KeepAlive, and hears no Escape while deactivated', async () => {
    const changes: Change[] = [];
    const Page = defineComponent({
      name: 'Page',
      setup() {
        return () => (
          <Popover.Root defaultOpen defaultTriggerId="trigger" onOpenChange={recordChange(changes)}>
            <Popover.Trigger id="trigger">Open</Popover.Trigger>
            <Popover.Portal>
              <Popover.Positioner>
                <Popover.Popup data-testid="popup">Content</Popover.Popup>
              </Popover.Positioner>
            </Popover.Portal>
          </Popover.Root>
        );
      },
    });
    const visible = shallowRef(true);
    const { user } = await render(() => (
      <KeepAlive>{visible.value ? <Page key="page" /> : <p key="other">other</p>}</KeepAlive>
    ));
    const trigger = screen.getByRole('button', { name: 'Open' });
    const popup = await screen.findByTestId('popup');

    visible.value = false;
    await flushMicrotasks();
    expect(popup.isConnected).toBe(false);
    await user.keyboard('[Escape]');
    await fireEvent.click(document.body, { detail: 1 });
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByRole('button', { name: 'Open' })).toBe(trigger);
    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(screen.getByTestId('popup')).toBe(popup);
    expect(popup).toHaveAttribute('data-open');

    await user.keyboard('[Escape]');
    expect(changes).toEqual([[false, 'escape-key']]);
    expect(trigger).toHaveAttribute('aria-expanded', 'false');
  });

  describe('VUE-4: a popover in the popup of a popover', () => {
    function renderNestedPopovers(changes: [name: string, open: boolean, reason: string][]) {
      const record =
        (name: string) => (open: boolean, details: Popover.Root.ChangeEventDetails) => {
          changes.push([name, open, details.reason]);
        };
      return render(
        <Popover.Root defaultOpen onOpenChange={record('parent')}>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup data-testid="parent-popup">
                <span>In the parent</span>
                <Popover.Root defaultOpen onOpenChange={record('child')}>
                  <Popover.Portal>
                    <Popover.Positioner>
                      <Popover.Popup data-testid="child-popup">
                        <button type="button">In the child</button>
                      </Popover.Popup>
                    </Popover.Positioner>
                  </Popover.Portal>
                </Popover.Root>
              </Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
    }

    it('keeps both open for a press in the child, and closes only the child for a press in the parent', async () => {
      const changes: [string, boolean, string][] = [];
      const { user } = await renderNestedPopovers(changes);
      const parentPopup = await screen.findByTestId('parent-popup');
      const childPopup = await screen.findByTestId('child-popup');
      expect(parentPopup.contains(childPopup)).toBe(false);

      await user.click(screen.getByRole('button', { name: 'In the child' }));
      expect(changes).toEqual([]);

      // The press gives the focus to the parent popup, which the child popup counts as inside. A
      // press on a field of the parent closes the child sooner, with `focus-out`.
      await user.click(screen.getByText('In the parent'));
      expect(changes).toEqual([['child', false, 'outside-press']]);
      expect(parentPopup).toHaveAttribute('data-open');
    });

    it('closes the child with the first Escape and the parent with the second', async () => {
      const changes: [string, boolean, string][] = [];
      const { user } = await renderNestedPopovers(changes);
      await screen.findByTestId('child-popup');

      await user.keyboard('[Escape]');
      expect(changes).toEqual([['child', false, 'escape-key']]);

      await user.keyboard('[Escape]');
      expect(changes).toEqual([
        ['child', false, 'escape-key'],
        ['parent', false, 'escape-key'],
      ]);
    });
  });

  describe('hydration', () => {
    interface TriggerValues {
      expanded: string | null;
      controls: string | null;
      open: boolean;
    }

    // The triggers, in the order of the document.
    function readTriggers(root: ParentNode): TriggerValues[] {
      return Array.from(root.querySelectorAll('button'), (trigger) => ({
        expanded: trigger.getAttribute('aria-expanded'),
        controls: trigger.getAttribute('aria-controls'),
        open: trigger.hasAttribute('data-popup-open'),
      }));
    }

    const closed: TriggerValues = { expanded: 'false', controls: null, open: false };
    const open: TriggerValues = {
      expanded: 'true',
      controls: expect.stringMatching(/^vase-ui-/) as string,
      open: true,
    };
    // A portal renders the popup after the mount, so an open trigger of the server HTML names no
    // popup.
    const openOnServer: TriggerValues = { expanded: 'true', controls: null, open: true };

    // A server registers no trigger and attaches no store to a handle. Vue does not patch an
    // attribute of a bound object when it hydrates, so the first render of each trigger must have
    // the values of the server HTML.
    it.each<{
      name: string;
      props: Record<string, unknown>;
      server: TriggerValues[];
      client: TriggerValues[];
    }>([
      {
        name: 'closed',
        props: {},
        server: [closed],
        client: [closed],
      },
      {
        name: 'open with defaultTriggerId',
        props: { defaultOpen: true, defaultTriggerId: 'inside' },
        server: [openOnServer],
        client: [open],
      },
      {
        name: 'a trigger with a handle',
        props: { defaultOpen: true, defaultTriggerId: 'detached', detached: true },
        server: [closed, closed],
        client: [open, closed],
      },
    ])('hydrates the server HTML of a root: $name', async ({ props, server, client }) => {
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      expect(readTriggers(template.content)).toEqual(server);

      const { container } = await hydrate(PopoverRootHydration, { serverHtml, props });

      expect(readTriggers(container)).toEqual(client);
    });

    it('shows the popup of an open root in the body after the hydration, with its labels', async () => {
      const props = { defaultOpen: true, defaultTriggerId: 'inside' };
      const serverHtml = await renderOnServer(HYDRATION_FILE, props);

      const { container } = await hydrate(PopoverRootHydration, { serverHtml, props });

      const popup = await screen.findByTestId('popup');
      expect(container.contains(popup)).toBe(false);
      expect(screen.getByRole('button', { name: 'Inside' })).toHaveAttribute(
        'aria-controls',
        popup.id,
      );
      await waitFor(() => {
        expect(popup).toHaveAttribute('aria-labelledby', screen.getByText('Title').id);
      });
      expect(popup).toHaveAttribute('aria-describedby', screen.getByText('Description').id);
    });
  });
});
