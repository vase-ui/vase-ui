import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { Teleport, KeepAlive, defineComponent, onMounted, shallowRef, watch } from 'vue';
import type { PropType, VNodeChild } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  popupConformanceTests,
  renderOnServer,
  screen,
  wait,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import * as Combobox from '../../combobox/index.parts';
import { REASONS } from '../../internals/reasons';
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
  afterTrigger: { type: Function as PropType<() => VNodeChild>, default: undefined },
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
          {props.triggerPlacement === 'before-content' ? (
            <>
              {triggerElement}
              {props.afterTrigger?.()}
              {renderPortal()}
            </>
          ) : (
            <>
              {renderPortal()}
              {triggerElement}
              {props.afterTrigger?.()}
            </>
          )}
        </Popover.Root>
      );
    };
  },
});

const DetachedTriggerPopover = defineComponent({
  props: testPopoverProps,
  setup(props) {
    const popoverHandle = Popover.createHandle();

    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};

      const trigger = (
        <>
          <Popover.Trigger data-testid="trigger" handle={popoverHandle} {...restTriggerProps}>
            {triggerChildren ?? 'Toggle'}
          </Popover.Trigger>
          {props.afterTrigger?.()}
        </>
      );

      return (
        <>
          {props.triggerPlacement === 'before-content' && trigger}
          <ContainedTriggerPopover
            rootProps={{ ...props.rootProps, handle: popoverHandle }}
            portalProps={props.portalProps}
            popupProps={props.popupProps}
            includeTrigger={false}
          />
          {props.triggerPlacement === 'after-content' && trigger}
        </>
      );
    };
  },
});

const MultipleDetachedTriggersPopover = defineComponent({
  props: testPopoverProps,
  setup(props) {
    const popoverHandle = Popover.createHandle();

    return () => {
      const { children: triggerChildren, ...restTriggerProps } = props.triggerProps ?? {};

      const triggers = (
        <>
          <Popover.Trigger data-testid="trigger" handle={popoverHandle} {...restTriggerProps}>
            {triggerChildren ?? 'Toggle'}
          </Popover.Trigger>
          {props.afterTrigger?.()}
          <Popover.Trigger data-testid="trigger-2" handle={popoverHandle}>
            Toggle another
          </Popover.Trigger>
        </>
      );

      return (
        <>
          {props.triggerPlacement === 'before-content' && triggers}
          <ContainedTriggerPopover
            rootProps={{ ...props.rootProps, handle: popoverHandle }}
            portalProps={props.portalProps}
            popupProps={props.popupProps}
            includeTrigger={false}
          />
          {props.triggerPlacement === 'after-content' && triggers}
        </>
      );
    };
  },
});

async function tick(ms: number) {
  await flushMicrotasks();
  await vi.advanceTimersByTimeAsync(ms);
  await flushMicrotasks();
}

describe('<Popover.Root />', () => {
  const { render } = createRenderer();

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

      // The popup reads its animations in the frames after it attaches. The animation lasts 100 s,
      // so the popup can complete only when the case ends the animation.
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
              if (open.value) {
                open.value = false;
              }
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

      await hoverOpen(trigger);
      await flushMicrotasks();
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
    { name: 'detached triggers', Component: DetachedTriggerPopover },
    { name: 'multiple detached triggers', Component: MultipleDetachedTriggersPopover },
  ])('when using $name', ({ name, Component: TestPopover }) => {
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

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.keyboard('{Escape}');
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await fireEvent.click(document.body);
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
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
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(screen.getByRole('button', { name: 'Open externally' }));
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
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
          expect(screen.queryByRole('dialog')).not.toBe(null);
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
          // The code removes the listener with an `options` argument, so the case checks the
          // listener and not the arguments of the call.
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

    describe('prop: defaultOpen', () => {
      it('remains uncontrolled, so a trigger click closes it', async () => {
        const { user } = await render(<TestPopover rootProps={{ defaultOpen: true }} />);

        expect(screen.getByText('Content')).not.toBe(null);

        await user.click(screen.getByTestId('trigger'));

        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
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

          await user.unhover(trigger);
          await waitFor(() => {
            expect(screen.getByTestId('popover-popup')).toHaveAttribute('data-ending-style');
          });

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

    describe('BaseUIChangeEventDetails', () => {
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
        await fireEvent.click(trigger);
        await flushMicrotasks();

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
          expect(screen.queryByRole('dialog')).not.toBe(null);
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).not.toHaveAttribute('data-popup-open');
        });
        expect(screen.queryByText('Content')).not.toBe(null);

        await user.click(trigger);
        await waitFor(() => {
          expect(trigger).toHaveAttribute('data-popup-open');
        });

        await user.click(trigger);
        await waitFor(() => {
          expect(screen.queryByText('Content')).toBe(null);
        });
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

        await waitFor(
          () => {
            expect(toggle).toHaveFocus();
          },
          { timeout: 1500 },
        );
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
        await waitFor(() => {
          expect(screen.getByTestId('popover-popup')).not.toHaveAttribute('data-open');
        });

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
              popupProps={{ class: 'popup', children: () => null }}
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

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });

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

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
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

          await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBe(null);
          });
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

          await waitFor(() => {
            expect(screen.queryByRole('listbox')).toBe(null);
          });
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
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
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

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
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

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
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
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
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

            await userEvent.tab({ shift: true });

            await waitFor(() => {
              expect(screen.getByTestId('focus-target')).toHaveFocus();
            });
            await waitFor(() => {
              expect(screen.queryByTestId('popover-popup')).toBe(null);
            });
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

          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
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
              expect(screen.queryByTestId('popover-popup')).toBeVisible();
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
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
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
        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
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
              portalProps={{ container: shadowRoot }}
            />
          </Teleport>,
        );

        const outsideButton = shadowRoot.querySelector('[data-testid="outside"]') as HTMLElement;
        const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
        expect(activeTrigger).not.toBe(null);

        await fireEvent.click(outsideButton);

        await waitFor(() => {
          expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
        });

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
              portalProps={{ container: shadowRoot }}
            />
          </Teleport>,
        );
        const activeTrigger = shadowRoot.querySelector('[aria-expanded="true"]');
        expect(activeTrigger).not.toBe(null);

        await fireEvent.click(document.body);

        await waitFor(() => {
          expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
        });

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

      describe.skipIf(isJSDOM)('during the exit animation', () => {
        beforeEach(() => {
          globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        });

        it('moves focus to the element following the trigger when tabbing forward from the trigger', async () => {
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
          await user.click(trigger);

          expect(popup).toHaveAttribute('data-ending-style');
          expect(trigger).toHaveFocus();

          await user.tab();

          expect(screen.getByTestId('focus-target')).toHaveFocus();
          popup.getAnimations().forEach((animation) => animation.finish());
          await waitFor(() => {
            expect(screen.queryByTestId('popover-popup')).toBe(null);
          });
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
          // With animations enabled the popup stays mounted for a microtask after it closes.
          // Trigger guards that outlived `open` used to bounce focus between each other then.
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
            expect(screen.queryByRole('dialog')).toBe(null);
          });
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
            expect(screen.queryByRole('dialog')).toBe(null);
          });
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

        await waitFor(() => {
          expect(screen.queryByRole('dialog')).toBe(null);
        });
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
    expect(first.getAttribute('aria-controls')).toMatch(/^vase-ui-/);
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
    const trigger = screen.getByRole('button');

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

  it('gives the payload of the active trigger to the default slot', async () => {
    const handle = Popover.createHandle<string>();
    await render(
      <Popover.Root
        handle={handle}
        v-slots={{
          default: ({ payload }: { payload: string | undefined }) => (
            <>
              <p data-testid="payload">{payload ?? 'none'}</p>
              <Popover.Trigger id="one" payload="first" />
              <Popover.Trigger id="two" payload="second" />
            </>
          ),
        }}
      />,
    );
    const payload = screen.getByTestId('payload');
    expect(payload).toHaveTextContent('none');

    handle.open('one');
    await flushMicrotasks();
    expect(payload).toHaveTextContent('first');

    handle.open('two');
    await flushMicrotasks();
    expect(payload).toHaveTextContent('second');
  });

  describe('handle', () => {
    it('opens and closes from the handle and reports isOpen', async () => {
      const handle = Popover.createHandle<unknown>();
      await render(
        <Popover.Root handle={handle}>
          <Popover.Trigger id="trigger">Open</Popover.Trigger>
        </Popover.Root>,
      );
      const trigger = screen.getByRole('button');
      expect(handle.isOpen).toBe(false);

      handle.open('trigger');
      await flushMicrotasks();
      expect(handle.isOpen).toBe(true);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      handle.close();
      await flushMicrotasks();
      expect(handle.isOpen).toBe(false);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
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

    it('throws when open() names no registered trigger', async () => {
      const handle = Popover.createHandle<unknown>();
      await render(
        <Popover.Root handle={handle}>
          <Popover.Trigger id="trigger" />
        </Popover.Root>,
      );

      expect(() => handle.open('missing')).toThrow(/Vase UI: PopoverHandle\.open\(\)/);
    });
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

  it('emits openChangeComplete when unmount() ends the close', async () => {
    const completions: boolean[] = [];
    const root = createRootRef();
    await render(() => (
      <Popover.Root
        ref={root.ref}
        defaultOpen
        defaultTriggerId="trigger"
        onOpenChange={(_open, details) => details.preventUnmountOnClose()}
        onOpenChangeComplete={(open) => completions.push(open)}
      >
        <Popover.Trigger id="trigger" />
      </Popover.Root>
    ));

    root.current.close();
    await flushMicrotasks();
    expect(completions).toEqual([]);

    root.current.unmount();
    await flushMicrotasks();
    expect(completions).toEqual([false]);
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
    const trigger = screen.getByRole('button');
    const popup = await screen.findByTestId('popup');

    visible.value = false;
    await flushMicrotasks();
    expect(popup.isConnected).toBe(false);
    await user.keyboard('[Escape]');
    await fireEvent.click(document.body, { detail: 1 });
    expect(changes).toEqual([]);

    visible.value = true;
    await flushMicrotasks();
    expect(screen.getByRole('button')).toBe(trigger);
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
        server: [open],
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
