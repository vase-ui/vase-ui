import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, h, inject, KeepAlive, nextTick, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  firePointer,
  fireTouch,
  flushMicrotasks,
  screen,
  useTestInteractions,
  wait,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import { createSlotHost } from '../../../../test/fixtures/slotHost';
import { PopupFixtureContext } from '../../../../test/fixtures/PopupFixture';
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import { useFloating } from '../../../../test/floating-ui-tests/useFloating';
import { ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { createChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import type { VaseUIChangeEventDetails } from '../../../internals/createVaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { mergeProps } from '../../../merge-props/mergeProps';
import { createAttribute } from '../createAttribute';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { FloatingFocusManager } from '../../../../test/fixtures/floatingFocusManagerHarness';
import { usePortalFocus } from '../portal/usePortalFocus';
import PopupPortal from '../portal/PopupPortal.vue';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import { useTestClick as useClick } from '../../../../test/fixtures/useFloating';
import { useTestDismiss } from '../../../../test/fixtures/useTestDismiss';
import { dismissPopupBindings, normalizeProp, useDismissLayer } from './useDismissLayer';
import type { DismissLayerOptions } from './useDismissLayer';
import { useTriggerFocus as useFocus } from '../usePopupTrigger';

// A module namespace is read-only. The mock gives `engine` as a plain object, so a case can set
// the flag.
vi.mock('../../../common/platform', async () => {
  const actual = await vi.importActual<typeof import('../../../common/platform')>(
    '../../../common/platform',
  );
  return { platform: { ...actual.platform, engine: { ...actual.platform.engine } } };
});

function setWebKit(webkit: boolean) {
  const actual = platform.engine.webkit;
  Object.defineProperty(platform.engine, 'webkit', { value: webkit, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.engine, 'webkit', { value: actual, configurable: true });
  });
}

// The focus manager moves the focus in an animation frame. As in the Base UI tests, that frame
// runs at once.
beforeEach(() => {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
});

afterEach(() => {
  vi.restoreAllMocks();
});

const DOCUMENT_LISTENER_TYPES = [
  'keydown',
  'compositionend',
  'click',
  'pointerdown',
  'pointerup',
  'pointercancel',
  'mousedown',
  'mouseup',
  'touchstart',
  'touchmove',
  'touchend',
  'load',
];

/** Counts the listeners of `useDismissLayer` that `doc` holds. */
function countListeners(doc: Document = document) {
  let total = 0;
  const add = doc.addEventListener;
  const remove = doc.removeEventListener;
  doc.addEventListener = function addEventListener(this: Document, type: string, ...rest: any[]) {
    total += DOCUMENT_LISTENER_TYPES.includes(type) ? 1 : 0;
    return (add as any).call(this, type, ...rest);
  } as typeof doc.addEventListener;
  doc.removeEventListener = function removeEventListener(
    this: Document,
    type: string,
    ...rest: any[]
  ) {
    total -= DOCUMENT_LISTENER_TYPES.includes(type) ? 1 : 0;
    return (remove as any).call(this, type, ...rest);
  } as typeof doc.removeEventListener;
  onTestFinished(() => {
    doc.addEventListener = add;
    doc.removeEventListener = remove;
  });
  return () => total;
}

interface Change {
  open: boolean;
  reason: string;
  eventType: string;
}

/**
 * A popup with a trigger that toggles it. `teleport` moves the popup element to `<body>`.
 * `portalContainer` renders it in a portal in that element, and `portalBackdrop` adds a backdrop
 * to that portal.
 */
const Popup = defineComponent({
  props: {
    name: { type: String, required: true },
    defaultOpen: { type: Boolean, default: true },
    teleport: { type: Boolean, default: false },
    portalContainer: { type: Object as PropType<HTMLElement>, default: undefined },
    portalBackdrop: { type: Boolean, default: false },
    node: { type: Boolean, default: false },
    dismiss: { type: Object as PropType<DismissLayerOptions>, default: () => ({}) },
    toggleOn: { type: String as PropType<'click' | 'pointerdown'>, default: 'click' },
    onChange: { type: Function as PropType<(change: Change) => void>, default: undefined },
    allowPropagation: { type: Boolean, default: false },
  },
  setup(props, { slots }) {
    const open = shallowRef(props.defaultOpen);
    const nodeId = props.node ? useFloatingNodeId() : undefined;
    const { refs, context } = useFloating({
      open,
      nodeId,
      onOpenChange(nextOpen, details) {
        if (props.allowPropagation) {
          details.allowPropagation();
        }
        props.onChange?.({
          open: nextOpen,
          reason: details.reason,
          eventType: details.event.type,
        });
        open.value = nextOpen;
      },
    });
    if (nodeId) {
      provideFloatingNode(nodeId);
    }
    const dismiss = useTestDismiss(context.rootStore, props.dismiss);

    function toggle() {
      open.value = !open.value;
    }

    return () => {
      const popup = open.value && (
        <div
          data-testid={props.name}
          {...mergeProps(dismiss.floating, { ref: refs.setFloating })}
          style="position: absolute; left: 200px; top: 200px; padding: 20px"
        >
          {props.name}
          {slots.default?.()}
        </div>
      );
      return (
        <>
          <button
            data-testid={`${props.name}-trigger`}
            {...mergeProps(dismiss.reference, {
              ref: refs.setReference,
              [props.toggleOn === 'click' ? 'onClick' : 'onPointerdown']: toggle,
            })}
          >
            trigger of {props.name}
          </button>
          {props.teleport && <Teleport to="body">{popup}</Teleport>}
          {props.portalContainer && (
            <PopupPortal to={props.portalContainer}>
              {props.portalBackdrop && <div data-testid={`${props.name}-backdrop`} />}
              {popup}
            </PopupPortal>
          )}
          {!props.teleport && !props.portalContainer && popup}
        </>
      );
    };
  },
});

const Tree = defineComponent({
  setup(_, { slots }) {
    provideFloatingTree();
    return () => slots.default?.();
  },
});

/**
 * A popup that a button opens. `dismiss` is `useDismissLayer`, or the function of a second copy of the
 * module.
 */
function createLayer(dismiss: typeof useDismissLayer, name: string) {
  return defineComponent({
    setup() {
      const open = shallowRef(false);
      const { refs, context } = useFloating({
        open,
        onOpenChange(nextOpen) {
          open.value = nextOpen;
        },
      });
      const floating = dismissPopupBindings(dismiss(context.rootStore));
      return () => (
        <>
          <button data-testid={`open-${name}`} onClick={() => (open.value = true)} />
          {open.value && (
            <div data-testid={name} {...mergeProps(floating, { ref: refs.setFloating })} />
          )}
        </>
      );
    },
  });
}

function isOpen(name: string) {
  return screen.queryByTestId(name) !== null;
}

function addOutsideElement() {
  const outside = document.createElement('div');
  outside.style.cssText = 'position: absolute; left: 500px; top: 20px; width: 60px; height: 60px';
  document.body.append(outside);
  onTestFinished(() => outside.remove());
  return outside;
}

/**
 * Adds an iframe that holds a button. A sandboxed iframe has an opaque origin, so it is
 * cross-origin.
 */
function addFrame({
  parent = document.body,
  sandboxed = false,
  top = 300,
}: { parent?: Element; sandboxed?: boolean; top?: number } = {}) {
  const frame = document.createElement('iframe');
  frame.srcdoc = '<button style="width: 80px; height: 40px">in the frame</button>';
  if (sandboxed) {
    frame.setAttribute('sandbox', '');
  }
  frame.style.cssText = `position: absolute; left: 20px; top: ${top}px; width: 200px; height: 100px; border: 0`;
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
  });
  parent.append(frame);
  onTestFinished(() => frame.remove());
  return { frame, loaded };
}

/** A real press in the iframe. The default position is on the button of `addFrame`. */
async function pressInFrame(frame: HTMLIFrameElement, position = { x: 20, y: 20 }) {
  await userEvent.click(frame, { position });
  await flushMicrotasks();
}

const mouse = { pointerType: 'mouse' };

async function pressAndClick(target: Element) {
  await fireEvent.pointerDown(target, mouse);
  await fireEvent.mouseDown(target);
  await fireEvent.pointerUp(target, mouse);
  await fireEvent.mouseUp(target);
  await fireEvent.click(target, { detail: 1 });
}

// A swipe of more than 10 pixels dismisses at once. A swipe of 6 to 10 pixels dismisses at the end.
// The wait lets the marker of the move go, so only a listener of the end can mark the end.
async function swipe(target: Element, distance: number) {
  const start = { clientX: 10, clientY: 10 };
  const end = { clientX: 10 + distance, clientY: 10 };
  await fireTouch.start(target, { touches: [start], changedTouches: [start] });
  await fireTouch.move(target, { touches: [end], changedTouches: [end] });
  await wait(10);
  await fireTouch.end(target, { touches: [], changedTouches: [end] });
}

// A click that no press began, such as a click of the keyboard.
async function clickWithNoPress(target: Element) {
  await fireEvent.click(target, { detail: 0 });
}

// A real drag. The browser sends the click to the common ancestor of both ends of the drag.
async function dragOnto(target: Element, outside: Element) {
  // The real pointer needs a box at the end of the drag, and the backdrop of the fixture has none.
  target.setAttribute(
    'style',
    'position: absolute; left: 350px; top: 20px; width: 60px; height: 60px',
  );
  let held = true;
  onTestFinished(async () => {
    if (held) {
      await userEvent.pointer({ keys: '[/MouseLeft]', coords: { x: 0, y: 0 } });
    }
  });
  // The press names its target, because the browser command scrolls to a target. The outside
  // element is not in the viewport of the test page.
  await userEvent.pointer({ target: outside, keys: '[MouseLeft>]' });
  // A person holds the button for more than one task, so each 0 ms timer of the press runs before
  // the release.
  await wait(0);
  await userEvent.pointer({ target, keys: '[/MouseLeft]' });
  held = false;
}

const App = defineComponent({
  props: {
    escapeKey: { type: Boolean, default: undefined },
    referencePress: { type: Function as PropType<() => boolean>, default: undefined },
    outsidePress: {
      type: [Boolean, Function] as PropType<DismissLayerOptions['outsidePress']>,
      default: undefined,
    },
    outsidePressEvent: { type: String as PropType<'intentional' | 'sloppy'>, default: undefined },
    onClose: { type: Function as PropType<() => void>, default: undefined },
  },
  setup(props) {
    const open = shallowRef(true);
    const { refs, context } = useFloating({
      open,
      onOpenChange(openArg, data) {
        open.value = openArg;
        const reason = data?.reason;
        if (props.outsidePress) {
          expect(reason).toBe(REASONS.outsidePress);
        } else if (props.escapeKey) {
          expect(reason).toBe(REASONS.escapeKey);
          if (!openArg) {
            props.onClose?.();
          }
        } else if (props.referencePress?.()) {
          expect(reason).toBe(REASONS.triggerPress);
        }
      },
    });
    const { getReferenceProps, getFloatingProps } = useTestInteractions([
      useTestDismiss(context.rootStore, {
        escapeKey: () => props.escapeKey,
        referencePress: props.referencePress,
        outsidePress: props.outsidePress,
        outsidePressEvent: () => props.outsidePressEvent,
      }),
    ]);

    return () => (
      <>
        <button {...getReferenceProps({ ref: refs.setReference })} />
        {open.value && (
          <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
            <input />
          </div>
        )}
      </>
    );
  },
});

describe('useDismiss', () => {
  const { render } = createRenderer();

  it('treats a child positioner as outside after its dismissal scope unmounts', async () => {
    const childElement = shallowRef<HTMLElement | null>(null);
    const active = shallowRef(true);
    const change = vi.fn();
    const Child = defineComponent(() => {
      useTestDismiss(useFloatingRootStore({ elements: { positionerElement: childElement } }));
      return () => null;
    });
    const Parent = defineComponent(() => {
      useTestDismiss(useFloatingRootStore({ open: true, onOpenChange: change }));
      return () => (active.value ? <Child /> : null);
    });
    await render(() => (
      <>
        <button ref={childElement}>Child</button>
        <Parent />
      </>
    ));
    const child = screen.getByRole('button');
    await fireEvent.pointerDown(child, { pointerType: 'mouse' });
    expect(change).not.toHaveBeenCalled();

    active.value = false;
    await nextTick();
    await fireEvent.pointerDown(child, { pointerType: 'mouse' });
    expect(change).toHaveBeenCalledWith(
      false,
      expect.objectContaining({ reason: REASONS.outsidePress }),
    );
  });

  describe('default options', () => {
    it('registers outside press touch listeners as passive', async () => {
      const addEventListenerSpy = vi.spyOn(document, 'addEventListener');

      try {
        await render(<App />);

        await Promise.all(
          ['touchstart', 'touchmove', 'touchend'].map((eventName) =>
            waitFor(() => {
              expect(addEventListenerSpy).toHaveBeenCalledWith(eventName, expect.any(Function), {
                capture: true,
                passive: true,
              });
            }),
          ),
        );
      } finally {
        addEventListenerSpy.mockRestore();
      }
    });

    it('dismisses with escape key', async () => {
      await render(<App />);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await flushMicrotasks();
    });

    it('calls preventDefault on escape key dismiss', async () => {
      await render(<App />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      await flushMicrotasks();
      expect(event.defaultPrevented).toBe(true);
    });

    it('does not call preventDefault on escape key if close is canceled', async () => {
      const CancelApp = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange(_openArg, data) {
              data?.cancel();
              open.value = true;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<CancelApp />);
      const event = new KeyboardEvent('keydown', {
        key: 'Escape',
        bubbles: true,
        cancelable: true,
      });
      document.body.dispatchEvent(event);
      await flushMicrotasks();
      expect(event.defaultPrevented).toBe(false);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('does not dismiss with escape key if IME is active', async () => {
      const onClose = vi.fn();

      await render(<App onClose={onClose} escapeKey />);

      const textbox = screen.getByRole('textbox');

      textbox.focus();
      await flushMicrotasks();

      // Simulate behavior when "あ" (Japanese) is entered and Esc is pressed for IME
      // cancellation.
      await fireEvent.input(textbox, { target: { value: 'あ' } });
      await fireEvent.compositionStart(textbox);
      await fireEvent.keyDown(textbox, { key: 'Escape', isComposing: true });
      await fireEvent.compositionEnd(textbox);

      // Wait for the compositionend timeout tick due to Safari. The window is 5 ms in WebKit, so
      // the wait is longer.
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });

      expect(onClose).toHaveBeenCalledTimes(0);

      await fireEvent.keyDown(textbox, { key: 'Escape' });

      expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('does not dismiss with escape key while a composition spans a reopen', async () => {
      const PersistentDismiss = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              <button onClick={() => (open.value = true)}>open</button>
              <button onClick={() => (open.value = false)}>close</button>
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<PersistentDismiss />);

      await fireEvent.compositionStart(document.body);
      await fireEvent.click(screen.getByRole('button', { name: 'close' }));
      await fireEvent.click(screen.getByRole('button', { name: 'open' }));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await fireEvent.keyDown(document.body, { key: 'Escape', isComposing: true });
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('dismisses with escape key after closing during IME composition', async () => {
      const PersistentDismiss = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              <button onClick={() => (open.value = true)}>open</button>
              <button onClick={() => (open.value = false)}>close</button>
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                  <input />
                </div>
              )}
            </>
          );
        },
      });

      await render(<PersistentDismiss />);

      // The composable stays mounted while closed, so the composition that ends after closing must not
      // keep blocking Escape once it reopens.
      await fireEvent.compositionStart(screen.getByRole('textbox'));
      await fireEvent.click(screen.getByRole('button', { name: 'close' }));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      await fireEvent.compositionEnd(document.body);

      await fireEvent.click(screen.getByRole('button', { name: 'open' }));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it.each([6, 12])(
      'does not dismiss a reopened popup when an old touch moves %s pixels and ends',
      async (distance) => {
        const ReopenApp = defineComponent({
          setup() {
            const open = shallowRef(true);
            const { refs, context } = useFloating({
              open,
              onOpenChange: (value) => {
                open.value = value;
              },
            });
            const { getReferenceProps, getFloatingProps } = useTestInteractions([
              useTestDismiss(context.rootStore),
            ]);

            return () => (
              <>
                <button
                  {...getReferenceProps({
                    ref: refs.setReference,
                    onClick: () => {
                      open.value = !open.value;
                    },
                  })}
                />
                {open.value && (
                  <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
                )}
              </>
            );
          },
        });

        await render(<ReopenApp />);

        const touch = { clientX: 10, clientY: 10 };
        await fireTouch.start(document.body, { touches: [touch], changedTouches: [touch] });

        await fireEvent.click(screen.getByRole('button'));
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        await fireEvent.click(screen.getByRole('button'));
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        // Both the deferred touchend dismissal and the immediate touchmove dismissal belong
        // to the previous session, even though the interaction composable never unmounted.
        const movedTouch = { ...touch, clientX: touch.clientX + distance };
        await fireTouch.move(document.body, {
          touches: [movedTouch],
          changedTouches: [movedTouch],
        });
        await fireTouch.end(document.body, { touches: [], changedTouches: [movedTouch] });
        expect(screen.getByRole('tooltip')).toBeInTheDocument();

        // A new gesture in this session must still dismiss normally.
        await fireTouch.start(document.body, { touches: [touch], changedTouches: [touch] });
        await fireTouch.move(document.body, {
          touches: [{ ...touch, clientX: 22 }],
          changedTouches: [{ ...touch, clientX: 22 }],
        });
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      },
    );

    it('dismisses with outside pointer press', async () => {
      const { user } = await render(<App />);
      await user.click(document.body);
      await flushMicrotasks();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('clears the inside marker when the interaction owner unmounts (strict: %s)', async () => {
      const DismissInteraction = defineComponent({
        props: {
          context: {
            type: Object as PropType<ReturnType<typeof useFloating>['context']>,
            required: true,
          },
          outsidePress: { type: Boolean, required: true },
        },
        setup(props) {
          const { getFloatingProps } = useTestInteractions([
            useTestDismiss(props.context.rootStore, {
              outsidePress: props.outsidePress,
              outsidePressEvent: 'sloppy',
            }),
          ]);

          return () => <button type="button" {...getFloatingProps()} />;
        },
      });

      const PersistentRootApp = defineComponent({
        props: {
          interactionMounted: { type: Boolean, required: true },
          outsidePress: { type: Boolean, required: true },
        },
        setup(props) {
          const open = shallowRef(true);
          const { context, refs } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });

          return () =>
            open.value && (
              <div role="tooltip" ref={refs.setFloating}>
                {props.interactionMounted && (
                  <DismissInteraction context={context} outsidePress={props.outsidePress} />
                )}
              </div>
            );
        },
      });

      const { rerender } = await render(
        <PersistentRootApp interactionMounted outsidePress={false} />,
      );

      await fireEvent.click(screen.getByRole('button'));
      await rerender(<PersistentRootApp interactionMounted={false} outsidePress />);
      await rerender(<PersistentRootApp interactionMounted outsidePress />);
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });

      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dismisses with reference press', async () => {
      await render(<App referencePress={() => true} />);
      await fireEvent.pointerDown(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dismisses with native click', async () => {
      await render(<App referencePress={() => true} />);
      await fireEvent.click(screen.getByRole('button'));
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('outsidePress function guard', async () => {
      const { user } = await render(<App outsidePress={() => false} />);
      await user.click(document.body);
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('outsidePress ignored for third party elements', async () => {
      const App = defineComponent({
        setup() {
          const isOpen = shallowRef(true);

          const { context, refs } = useFloating({
            open: isOpen,
            onOpenChange: (value) => {
              isOpen.value = value;
            },
          });

          const dismiss = useTestDismiss(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore}>
                  <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                </FloatingFocusManager>
              )}
            </>
          );
        },
      });

      const { user } = await render(<App />);
      await flushMicrotasks();

      const thirdParty = document.createElement('div');
      thirdParty.setAttribute('data-testid', 'third-party');
      document.body.append(thirdParty);
      await user.click(thirdParty);
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      thirdParty.remove();
    });

    it('dismisses when clicking outside a shared shadow root', async () => {
      const App = defineComponent({
        props: { shadowRoot: { type: Object as PropType<ShadowRoot>, required: true } },
        setup(props) {
          const isOpen = shallowRef(true);

          const { context, refs } = useFloating({
            open: isOpen,
            onOpenChange: (value) => {
              isOpen.value = value;
            },
          });

          const dismiss = useTestDismiss(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {isOpen.value && (
                <PopupPortal guards={usePortalFocus} to={props.shadowRoot}>
                  <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                </PopupPortal>
              )}
            </>
          );
        },
      });

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        const { user } = await render(
          <Teleport to={container}>
            <App shadowRoot={shadowRoot} />
          </Teleport>,
        );

        await user.click(document.body);
        await flushMicrotasks();

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    it('dismisses when clicking outside a shared shadow root while focus is managed', async () => {
      const App = defineComponent({
        props: { shadowRoot: { type: Object as PropType<ShadowRoot>, required: true } },
        setup(props) {
          const isOpen = shallowRef(true);

          const { context, refs } = useFloating({
            open: isOpen,
            onOpenChange: (value) => {
              isOpen.value = value;
            },
          });

          const dismiss = useTestDismiss(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {isOpen.value && (
                <PopupPortal guards={usePortalFocus} to={props.shadowRoot}>
                  <FloatingFocusManager store={context.rootStore}>
                    <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                  </FloatingFocusManager>
                </PopupPortal>
              )}
            </>
          );
        },
      });

      const host = document.body.appendChild(document.createElement('div'));
      const shadowRoot = host.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      shadowRoot.appendChild(container);

      try {
        const { user } = await render(
          <Teleport to={container}>
            <App shadowRoot={shadowRoot} />
          </Teleport>,
        );
        await flushMicrotasks();

        await user.click(document.body);
        await flushMicrotasks();

        expect(shadowRoot.querySelector('[role="dialog"]')).toBe(null);
      } finally {
        host.remove();
      }
    });

    it('outsidePress not ignored for nested floating elements', async () => {
      const Popover = defineComponent({
        props: {
          id: { type: String, required: true },
          modal: { type: Boolean as PropType<boolean | null>, default: null },
        },
        setup(props, { slots }) {
          const isOpen = shallowRef(true);

          const { context, refs } = useFloating({
            open: isOpen,
            onOpenChange: (value) => {
              isOpen.value = value;
            },
          });

          const dismiss = useTestDismiss(context.rootStore);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => {
            const dialogJsx = (
              <div
                role="dialog"
                data-testid={props.id}
                {...getFloatingProps({ ref: refs.setFloating })}
              >
                {slots.default?.()}
              </div>
            );

            return (
              <>
                <button {...getReferenceProps({ ref: refs.setReference })} />
                {isOpen.value && (
                  <>
                    {props.modal == null ? (
                      dialogJsx
                    ) : (
                      <FloatingFocusManager store={context.rootStore} modal={props.modal}>
                        {dialogJsx}
                      </FloatingFocusManager>
                    )}
                  </>
                )}
              </>
            );
          };
        },
      });

      const App = defineComponent({
        props: {
          modal: { type: Array as unknown as PropType<[boolean, boolean] | null>, default: null },
        },
        setup(props) {
          return () => (
            <Popover id="popover-1" modal={props.modal ? props.modal[0] : true}>
              <Popover id="popover-2" modal={props.modal ? props.modal[1] : null} />
            </Popover>
          );
        },
      });

      const { user, unmount } = await render(<App modal={[true, true]} />);
      await flushMicrotasks();

      let popover1 = screen.getByTestId('popover-1');
      let popover2 = screen.getByTestId('popover-2');
      await user.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await user.click(popover1);
      await flushMicrotasks();
      expect(popover2).not.toBeInTheDocument();

      unmount();

      const { unmount: unmount2 } = await render(<App modal={[true, false]} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await user.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await user.click(popover1);
      await flushMicrotasks();
      expect(popover2).not.toBeInTheDocument();

      unmount2();

      const { unmount: unmount3 } = await render(<App modal={[false, true]} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await user.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await user.click(popover1);
      await flushMicrotasks();
      expect(popover2).not.toBeInTheDocument();

      unmount3();

      await render(<App modal={null} />);
      await flushMicrotasks();

      popover1 = screen.getByTestId('popover-1');
      popover2 = screen.getByTestId('popover-2');

      await user.click(popover2);
      expect(popover1).toBeInTheDocument();
      expect(popover2).toBeInTheDocument();
      await user.click(popover1);
      await flushMicrotasks();
      expect(popover2).not.toBeInTheDocument();
    });
  });

  describe('options set to false', () => {
    it('does not dismiss with escape key', async () => {
      await render(<App escapeKey={false} />);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('does not dismiss with outside press', async () => {
      const { user } = await render(<App outsidePress={false} />);
      await user.click(document.body);
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('does not dismiss with reference pointer down', async () => {
      const { user } = await render(<App referencePress={() => false} />);
      await user.click(screen.getByRole('button'));
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('does not dismiss when clicking portaled children', async () => {
      const AppWithPortaledChildren = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });

          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {open.value && (
                <div {...getFloatingProps({ ref: refs.setFloating })}>
                  <PopupPortal guards={usePortalFocus}>
                    <button data-testid="portaled-button" />
                  </PopupPortal>
                </div>
              )}
            </>
          );
        },
      });

      await render(<AppWithPortaledChildren />);

      await fireEvent.pointerDown(screen.getByTestId('portaled-button'), { bubbles: true });
      await flushMicrotasks();

      expect(screen.getByTestId('portaled-button')).toBeInTheDocument();
    });

    it('outsidePress function guard', async () => {
      const { user } = await render(<App outsidePress={() => true} />);
      await user.click(document.body);
      await flushMicrotasks();
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });
  });

  describe('prop: bubbles', () => {
    const dialogProps = {
      testId: { type: String, required: true },
      bubbles: {
        type: [Boolean, Object] as PropType<DismissLayerOptions['bubbles']>,
        default: undefined,
      },
    } as const;

    const Dialog = defineComponent({
      props: dialogProps,
      setup(props, { slots }) {
        const open = shallowRef(true);
        const nodeId = useFloatingNodeId();

        const { refs, context } = useFloating({
          open,
          onOpenChange: (value) => {
            open.value = value;
          },
          nodeId,
        });
        provideFloatingNode(nodeId);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          useTestDismiss(context.rootStore, props),
        ]);

        return () => (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open.value && (
              <FloatingFocusManager store={context.rootStore}>
                <div {...getFloatingProps({ ref: refs.setFloating })} data-testid={props.testId}>
                  {slots.default?.()}
                </div>
              </FloatingFocusManager>
            )}
          </>
        );
      },
    });

    const NestedDialog = defineComponent({
      props: dialogProps,
      setup(props, { slots }) {
        const parentId = useFloatingParentNodeId();

        return () =>
          parentId.value == null ? (
            <Tree>
              <Dialog {...props}>{slots.default?.()}</Dialog>
            </Tree>
          ) : (
            <Dialog {...props}>{slots.default?.()}</Dialog>
          );
      },
    });

    describe('normalizeProp', () => {
      it('undefined', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp();

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      it('when false', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } =
          normalizeProp(false);

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });

      it('{}', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp(
          {},
        );

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      it('{ escapeKey: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          escapeKey: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(true);
      });

      it('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyBubbles, outsidePress: outsidePressBubbles } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyBubbles).toBe(false);
        expect(outsidePressBubbles).toBe(false);
      });
    });

    describe('prop: bubbles.outsidePress', () => {
      it('when true', async () => {
        await render(
          <NestedDialog testId="outer">
            <NestedDialog testId="inner">
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      it('when false', async () => {
        await render(
          <NestedDialog testId="outer" bubbles={{ outsidePress: false }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      it('mixed', async () => {
        await render(
          <NestedDialog testId="outer" bubbles={{ outsidePress: true }}>
            <NestedDialog testId="inner" bubbles={{ outsidePress: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: bubbles.escapeKey', () => {
      it('without FloatingTree', async () => {
        const App = defineComponent({
          setup() {
            const popoverOpen = shallowRef(true);
            const tooltipOpen = shallowRef(false);

            const popover = useFloating({
              open: popoverOpen,
              onOpenChange: (value) => {
                popoverOpen.value = value;
              },
            });
            const tooltip = useFloating({
              open: tooltipOpen,
              onOpenChange: (value) => {
                tooltipOpen.value = value;
              },
            });

            const popoverInteractions = useTestInteractions([
              useTestDismiss(popover.context.rootStore),
            ]);
            const tooltipFocus = useFocus(tooltip.context.rootStore);
            const tooltipInteractions = useTestInteractions([
              useTestDismiss(tooltip.context.rootStore),
            ]);

            return () => (
              <>
                <button
                  ref={popover.refs.setReference}
                  {...popoverInteractions.getReferenceProps()}
                />
                {popoverOpen.value && (
                  <div
                    role="dialog"
                    ref={popover.refs.setFloating}
                    {...popoverInteractions.getFloatingProps()}
                  >
                    <button
                      data-testid="focus-button"
                      ref={tooltip.refs.setReference}
                      {...tooltipFocus}
                      {...tooltipInteractions.getReferenceProps()}
                    />
                  </div>
                )}
                {tooltipOpen.value && (
                  <div
                    role="tooltip"
                    ref={tooltip.refs.setFloating}
                    {...tooltipInteractions.getFloatingProps()}
                  />
                )}
              </>
            );
          },
        });

        const { user } = await render(<App />);

        await flushMicrotasks();
        screen.getByTestId('focus-button').focus();

        await waitFor(() => {
          expect(screen.getByRole('tooltip')).toBeInTheDocument();
        });

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
      });

      it('when true', async () => {
        const { user } = await render(
          <NestedDialog testId="outer" bubbles>
            <NestedDialog testId="inner" bubbles>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      it('when false', async () => {
        const { user } = await render(
          <NestedDialog testId="outer" bubbles={{ escapeKey: false }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      it('mixed', async () => {
        const { user } = await render(
          <NestedDialog testId="outer" bubbles={{ escapeKey: true }}>
            <NestedDialog testId="inner" bubbles={{ escapeKey: false }}>
              <button>test button</button>
            </NestedDialog>
          </NestedDialog>,
        );

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.getByTestId('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.getByTestId('outer')).toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
      });

      describe('when Escape reaches the document', () => {
        // Layers that share no FloatingTree, like a Dialog opened from a Popover.
        const Layer = defineComponent({
          props: {
            testId: { type: String, required: true },
            defaultOpen: { type: Boolean, default: false },
            bubbles: { type: Object as PropType<{ escapeKey?: boolean }>, default: undefined },
            outsidePress: { type: Boolean, default: undefined },
          },
          setup(props, { slots }) {
            const open = shallowRef(props.defaultOpen);
            const { refs, context } = useFloating({
              open,
              onOpenChange: (value) => {
                open.value = value;
              },
            });
            const { getReferenceProps, getFloatingProps } = useTestInteractions([
              useClick(context.rootStore),
              useTestDismiss(context.rootStore, props),
            ]);

            return () => (
              <>
                <button
                  data-testid={`${props.testId}-trigger`}
                  {...getReferenceProps({ ref: refs.setReference })}
                />
                {open.value && (
                  <div data-testid={props.testId} {...getFloatingProps({ ref: refs.setFloating })}>
                    {slots.default?.()}
                  </div>
                )}
              </>
            );
          },
        });

        async function openInnerAndBlur(user: VaseUIRenderResult['user']) {
          await user.click(screen.getByTestId('inner-trigger'));
          expect(screen.getByTestId('inner')).toBeInTheDocument();

          (document.activeElement as HTMLElement).blur();
          await flushMicrotasks();
          expect(document.activeElement).toBe(document.body);
        }

        it('closes only the most recently opened layer', async () => {
          const { user } = await render(
            <Layer testId="outer" defaultOpen>
              <Layer testId="inner" />
            </Layer>,
          );

          await openInnerAndBlur(user);

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });

        it('closes the layers below when the layers above bubble', async () => {
          const { user } = await render(
            <Layer testId="outer" defaultOpen>
              <Layer testId="inner" bubbles={{ escapeKey: true }} />
            </Layer>,
          );

          await openInnerAndBlur(user);

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });

        it('handles the Escape again once the layer above closed', async () => {
          const { user } = await render(
            <>
              <Layer testId="outer" defaultOpen outsidePress={false} />
              <Layer testId="inner" />
            </>,
          );

          await openInnerAndBlur(user);

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          await user.click(screen.getByTestId('inner-trigger'));
          expect(screen.getByTestId('inner')).toBeInTheDocument();

          (document.activeElement as HTMLElement).blur();
          await flushMicrotasks();

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('inner')).not.toBeInTheDocument();
          expect(screen.getByTestId('outer')).toBeInTheDocument();

          await fireEvent.keyDown(document.body, { key: 'Escape' });

          expect(screen.queryByTestId('outer')).not.toBeInTheDocument();
        });
      });
    });
  });

  describe('prop: capture', () => {
    describe('normalizeProp', () => {
      it('undefined', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp();

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      it('{}', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp(
          {},
        );

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(true);
      });

      it('when true', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(true);

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      it('when false', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } =
          normalizeProp(false);

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });

      it('{ escapeKey: true }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          escapeKey: true,
        });

        expect(escapeKeyCapture).toBe(true);
        expect(outsidePressCapture).toBe(true);
      });

      it('{ outsidePress: false }', () => {
        const { escapeKey: escapeKeyCapture, outsidePress: outsidePressCapture } = normalizeProp({
          outsidePress: false,
        });

        expect(escapeKeyCapture).toBe(false);
        expect(outsidePressCapture).toBe(false);
      });
    });

    const Overlay = defineComponent({
      setup(_, { slots }) {
        return () => (
          <div
            style="width: 100vw; height: 100vh"
            onPointerdown={(event: PointerEvent) => event.stopPropagation()}
            onKeydown={(event: KeyboardEvent) => {
              if (event.key === 'Escape') {
                event.stopPropagation();
              }
            }}
          >
            <span>outside</span>
            {slots.default?.()}
          </div>
        );
      },
    });

    const Dialog = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props, { slots }) {
        const open = shallowRef(true);
        const nodeId = useFloatingNodeId();

        const { refs, context } = useFloating({
          open,
          onOpenChange: (value) => {
            open.value = value;
          },
          nodeId,
        });
        provideFloatingNode(nodeId);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          useTestDismiss(context.rootStore),
        ]);

        return () => (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open.value && (
              <PopupPortal guards={usePortalFocus}>
                <FloatingFocusManager store={context.rootStore}>
                  <div {...getFloatingProps({ ref: refs.setFloating })}>
                    <span>{props.id}</span>
                    {slots.default?.()}
                  </div>
                </FloatingFocusManager>
              </PopupPortal>
            )}
          </>
        );
      },
    });

    const NestedDialog = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props, { slots }) {
        const parentId = useFloatingParentNodeId();

        return () =>
          parentId.value == null ? (
            <Tree>
              <Dialog {...props}>{slots.default?.()}</Dialog>
            </Tree>
          ) : (
            <Dialog {...props}>{slots.default?.()}</Dialog>
          );
      },
    });

    describe('prop: capture.outsidePress', () => {
      it('when true', async () => {
        const { user } = await render(
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner" />
            </NestedDialog>
          </Overlay>,
        );

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.click(screen.getByText('outer'));
        await flushMicrotasks();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.click(screen.getByText('outside'));
        await flushMicrotasks();

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });

    describe('prop: capture.escapeKey', () => {
      it('when false', async () => {
        const { user } = await render(
          <Overlay>
            <NestedDialog id="outer">
              <NestedDialog id="inner" />
            </NestedDialog>
          </Overlay>,
        );

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.getByText('inner')).toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.getByText('outer')).toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();

        await user.keyboard('{Escape}');
        await flushMicrotasks();

        expect(screen.queryByText('outer')).not.toBeInTheDocument();
        expect(screen.queryByText('inner')).not.toBeInTheDocument();
      });
    });
  });

  describe('outsidePressEvent: intentional', () => {
    it('dragging outside the floating element does not close', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      await fireEvent.mouseDown(floatingEl);
      await fireEvent.mouseUp(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('dragging inside the floating element does not close', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      await fireEvent.mouseDown(document.body);
      await fireEvent.mouseUp(floatingEl);
      // The browser fires the gesture's click on the common ancestor of the
      // mousedown and mouseup targets; the mouseup inside the floating element
      // marks the component tree so this click must not dismiss.
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
      await flushMicrotasks();
    });

    it('dragging outside the floating element then clicking outside closes', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      await fireEvent.mouseDown(floatingEl);
      await fireEvent.mouseUp(document.body);
      // A click event will have fired before the proper outside click.
      await fireEvent.click(document.body);
      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('dragging outside the floating element then clicking outside closes with mouse clicks', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      await fireEvent.pointerDown(floatingEl, { pointerType: 'mouse' });
      await fireEvent.mouseDown(floatingEl);
      await fireEvent.mouseUp(document.body);

      // Real mouse clicks carry `detail: 1`. This one passes the press-observed guard
      // and is consumed by the one-shot drag suppression.
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next press-backed mouse click closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('an outside click stopped before its target does not close on a later click inside', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const input = screen.getByRole('textbox');

      // Another document capture listener, like a drag library's after a drop, stops the click
      // after useDismissLayer has seen it but before it reaches its target.
      const stopClick = (event: MouseEvent) => event.stopPropagation();
      document.addEventListener('click', stopClick, { capture: true, once: true });
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // This click bubbles to the body, where the stopped click was headed.
      await fireEvent.pointerDown(input, { pointerType: 'mouse' });
      await fireEvent.mouseDown(input);
      await fireEvent.mouseUp(input);
      await fireEvent.click(input, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();
    });

    it('mouse click whose press started before open does not close', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // The trailing click of a press that began before open, e.g. a menu item activated
      // by drag-release opening a dialog.
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed while open still closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('compatibility events whose pointerdown opened the floating element do not count as a new press', async () => {
      const OpenOnPointerDownApp = defineComponent({
        setup() {
          const open = shallowRef(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button onPointerdown={() => (open.value = true)}>Open</button>
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<OpenOnPointerDownApp />);

      const openButton = screen.getByRole('button', { name: 'Open' });
      await fireEvent.pointerDown(openButton, { pointerType: 'mouse' });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The pointerdown happened before the floating element opened. Its
      // compatibility events arrive after opening but belong to the same press.
      await fireEvent.mouseDown(openButton);
      await fireEvent.mouseUp(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A new pointer press that begins while open still dismisses.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('keyboard-generated outside click without a prior press closes', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // Keyboard activations produce `detail: 0` clicks with no press.
      await fireEvent.click(document.body, { detail: 0 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press-less outside click reporting a pointer type closes', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // Android assistive technology reports `pointerType: 'mouse'` with no press behind
      // it, so the click count is what separates the two.
      const click = new MouseEvent('click', { bubbles: true, detail: 0 });
      Object.defineProperty(click, 'pointerType', { value: 'mouse' });
      await fireEvent(document.body, click);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press seen in a previous open session does not leak into a reopen', async () => {
      const ReopenApp = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button
                {...getReferenceProps({
                  ref: refs.setReference,
                  onClick: () => {
                    open.value = true;
                  },
                })}
              />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<ReopenApp />);

      // A genuine outside press closes and leaves a press on record.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

      await fireEvent.click(screen.getByRole('button'));
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The reopened session must not inherit the previous session's press:
      // a press-less trailing click still must not count as an outside press.
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press seen before a same-batch close and reopen does not leak into the new session', async () => {
      let context!: ReturnType<typeof useFloating>['context'];

      const BatchReopenApp = defineComponent({
        setup() {
          const open = shallowRef(true);
          const floating = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          context = floating.context;
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(floating.context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: floating.refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: floating.refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<BatchReopenApp />);

      // A press lands while the first session is open.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);

      // Vue never shows `open === false` to a watcher here, so only `openchange` can observe the
      // session boundary.
      context.rootStore.setOpen(false, createChangeEventDetails(REASONS.none));
      context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The gesture's trailing click belongs to the previous session and must
      // not dismiss the reopened floating element.
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A press observed in the new session still closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press survives a redundant open dispatch while already open', async () => {
      let context!: ReturnType<typeof useFloating>['context'];

      const RedundantOpenApp = defineComponent({
        setup() {
          const open = shallowRef(true);
          const floating = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          context = floating.context;
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(floating.context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: floating.refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: floating.refs.setFloating })} />
              )}
            </>
          );
        },
      });

      await render(<RedundantOpenApp />);

      // A genuine outside press lands while open.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);

      // A redundant open dispatch mid-gesture (hovering an inactive trigger does this)
      // does not end the session, so the press stays on record.
      context.rootStore.setOpen(true, createChangeEventDetails(REASONS.none));
      await flushMicrotasks();
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press survives listener re-attachment while open', async () => {
      const { rerender } = await render(<App outsidePressEvent="intentional" />);

      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.mouseDown(document.body);

      // Changing a source of the listeners mid-gesture re-attaches the document listeners;
      // the observed press must survive that.
      await rerender(<App outsidePressEvent="intentional" escapeKey={false} />);

      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('pointerdown-only press while open allows the outside click to close', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // Pointer-event browsers may deliver `pointerdown` without a compat
      // `mousedown`; it must count as an observed press on its own.
      await fireEvent.pointerDown(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('non-primary-button press does not count as an outside press', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // A right-button press produces `contextmenu`, not `click`, so it must
      // not vouch for a later press-less click.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 2 });
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A primary-button press still closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('cancelled press does not count as an outside press', async () => {
      await render(<App outsidePressEvent="intentional" />);

      // A press whose gesture is cancelled produces no click, so it must not
      // vouch for a later press-less click.
      await fireEvent.pointerDown(document.body, { pointerType: 'touch' });
      await fireEvent.pointerCancel(document.body);
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // A completed press still closes.
      await fireEvent.pointerDown(document.body, { pointerType: 'mouse' });
      await fireEvent.click(document.body, { detail: 1 });
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('inside click then programmatic outside click closes', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const insideInput = screen.getByRole('textbox');

      await fireEvent.mouseDown(insideInput);
      await fireEvent.mouseUp(insideInput);
      await fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('inside click after drag does not cause immediate close on first outside click', async () => {
      await render(<App outsidePressEvent="intentional" />);
      const floatingEl = screen.getByRole('tooltip');
      const insideInput = screen.getByRole('textbox');

      await fireEvent.mouseDown(floatingEl);
      await fireEvent.mouseUp(document.body);

      // Inside clicks should never dismiss, and they should not consume the
      // one-shot outside click suppression from the drag that started inside.
      await fireEvent.click(insideInput);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // First true outside click after that drag is still ignored once.
      await fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      // The next outside click is a deliberate outside press and dismisses.
      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('drag ending on outsidePress-ignored target does not consume next outside click', async () => {
      await render(
        <App
          outsidePressEvent="intentional"
          outsidePress={(event) => !(event.target as Element)?.closest('[data-testid="ignore"]')}
        />,
      );
      const floatingEl = screen.getByRole('tooltip');
      const ignored = document.createElement('div');
      ignored.setAttribute('data-testid', 'ignore');
      document.body.append(ignored);

      await fireEvent.mouseDown(floatingEl);
      await fireEvent.mouseUp(ignored);

      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      ignored.remove();
    });

    it('press start prevented inside does not require double outside click', async () => {
      const AppWithPreventedPressStart = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                  <div
                    data-testid="scrubber"
                    onPointerdown={(event: PointerEvent) => event.preventDefault()}
                  />
                </div>
              )}
            </>
          );
        },
      });

      await render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      await fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(scrubber, { button: 0 });
      await fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseUp(document.body, { button: 0 });

      // Wait a tick: if no immediate synthetic click occurred after pointerup,
      // the next user click should still dismiss.
      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await flushMicrotasks();

      await fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(document.body, { button: 0 });
      await fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseUp(document.body, { button: 0 });
      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('press start prevented inside suppresses only immediate outside click', async () => {
      const AppWithPreventedPressStart = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                  <div
                    data-testid="scrubber"
                    onPointerdown={(event: PointerEvent) => event.preventDefault()}
                  />
                </div>
              )}
            </>
          );
        },
      });

      await render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      await fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(scrubber, { button: 0 });
      await wait(0);
      // The release starts the 0 ms timer that ends the suppression. The immediate click comes
      // before that timer.
      await Promise.all([
        fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 }),
        fireEvent.mouseUp(document.body, { button: 0 }),
        fireEvent.click(document.body),
      ]);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await wait(0);

      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    it('pointercancel after prevented press start suppresses immediate outside click', async () => {
      const AppWithPreventedPressStart = defineComponent({
        setup() {
          const open = shallowRef(true);
          const { refs, context } = useFloating({
            open,
            onOpenChange: (value) => {
              open.value = value;
            },
          });
          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            useTestDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
          ]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {open.value && (
                <div role="tooltip" {...getFloatingProps({ ref: refs.setFloating })}>
                  <div
                    data-testid="scrubber"
                    onPointerdown={(event: PointerEvent) => event.preventDefault()}
                  />
                </div>
              )}
            </>
          );
        },
      });

      await render(<AppWithPreventedPressStart />);
      const scrubber = screen.getByTestId('scrubber');

      await fireEvent.pointerDown(scrubber, { pointerType: 'mouse', button: 0 });
      await fireEvent.mouseDown(scrubber, { button: 0 });
      await wait(0);
      // The cancel starts the 0 ms timer that ends the suppression. The immediate click comes
      // before that timer.
      await Promise.all([
        fireEvent.pointerCancel(document.body, { pointerType: 'mouse' }),
        fireEvent.click(document.body),
      ]);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await wait(0);

      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
    });

    // Vue skips a Vue listener that it attached in the millisecond of an event when an earlier Vue
    // listener got that event. The frozen clock puts the open and the press in one millisecond.
    it('keeps a popup in a portal open for a drag out of it in the millisecond of its open', async () => {
      const outside = addOutsideElement();
      await render(
        <Popup
          name="popup"
          defaultOpen={false}
          portalContainer={document.body}
          dismiss={{ outsidePressEvent: 'intentional' }}
        />,
      );
      const dateNow = vi.spyOn(Date, 'now').mockReturnValue(Date.now());
      onTestFinished(() => dateNow.mockRestore());

      await fireEvent.click(screen.getByTestId('popup-trigger'));
      await flushMicrotasks();
      const popup = screen.getByTestId('popup');
      await fireEvent.pointerDown(popup, mouse);
      await fireEvent.mouseDown(popup);
      await fireEvent.pointerUp(outside, mouse);
      await fireEvent.mouseUp(outside);
      await fireEvent.click(document.body, { detail: 1 });
      await flushMicrotasks();

      expect(isOpen('popup')).toBe(true);
    });
  });

  it('nested floating elements with different portal containers', async () => {
    const ButtonWithFloating = defineComponent({
      props: {
        portalContainer: { type: Object as PropType<HTMLElement>, default: undefined },
        triggerText: { type: String, required: true },
      },
      setup(props, { slots }) {
        const open = shallowRef(false);
        const { refs, context } = useFloating({
          open,
          onOpenChange: (value) => {
            open.value = value;
          },
        });

        const click = useClick(context.rootStore);
        const dismiss = useTestDismiss(context.rootStore);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

        return () => (
          <>
            <button ref={refs.setReference} {...getReferenceProps()}>
              {props.triggerText}
            </button>
            {open.value && (
              <PopupPortal guards={usePortalFocus} to={props.portalContainer}>
                <FloatingFocusManager store={context.rootStore} modal={false}>
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    {slots.default?.()}
                  </div>
                </FloatingFocusManager>
              </PopupPortal>
            )}
          </>
        );
      },
    });

    const App = defineComponent({
      setup() {
        const otherContainer = shallowRef<HTMLDivElement | null>(null);

        return () => {
          const portal1 = undefined;
          const portal2 = otherContainer.value ?? undefined;

          return (
            <>
              <ButtonWithFloating portalContainer={portal1} triggerText="open 1">
                <ButtonWithFloating portalContainer={portal2} triggerText="open 2">
                  <button>nested</button>
                </ButtonWithFloating>
              </ButtonWithFloating>
              <div ref={otherContainer} />
            </>
          );
        };
      },
    });

    const { user } = await render(<App />);

    // Vue skips the later listeners of an event that comes in the millisecond when Vue attached
    // them. The first click mounts the button of the second click.
    await waitForLaterMillisecond(async () => {
      await user.click(screen.getByText('open 1'));
      expect(screen.getByText('open 2')).toBeInTheDocument();
    });
    await user.click(screen.getByText('open 2'));
    await flushMicrotasks();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });

  describe('document listeners', () => {
    it('has none while the popup is closed, 18 while it is open, and none after a close or an unmount', async () => {
      const count = countListeners();
      const { unmount } = await render(<Popup name="popup" defaultOpen={false} />);
      const closed = count();

      await fireEvent.click(screen.getByTestId('popup-trigger'));
      const open = count();

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      const afterClose = count();

      await fireEvent.click(screen.getByTestId('popup-trigger'));
      unmount();

      expect({ closed, open, afterClose, afterUnmount: count() }).toEqual({
        closed: 0,
        open: 18,
        afterClose: 0,
        afterUnmount: 0,
      });
    });

    it.each([
      { name: 'no Escape listener', dismiss: { escapeKey: false }, listeners: 15 },
      { name: 'no outside press listener', dismiss: { outsidePress: false }, listeners: 9 },
      { name: 'no listener while not enabled', dismiss: { enabled: false }, listeners: 0 },
    ])('has $name for its option', async ({ dismiss, listeners }) => {
      const count = countListeners();
      await render(<Popup name="popup" dismiss={dismiss} />);
      expect(count()).toBe(listeners);
    });

    it('adds the listeners when `enabled` becomes true', async () => {
      const count = countListeners();
      const enabled = shallowRef(false);
      await render(<Popup name="popup" dismiss={{ enabled }} />);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(true);

      enabled.value = true;
      await nextTick();
      expect(count()).toBe(18);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(false);
    });

    it('adds the Escape listeners when `escapeKey` becomes true', async () => {
      const count = countListeners();
      const escapeKey = shallowRef(false);
      await render(<Popup name="popup" dismiss={{ escapeKey }} />);
      expect(count()).toBe(15);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(true);

      escapeKey.value = true;
      await nextTick();
      expect(count()).toBe(18);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(false);
    });

    it('releases the listeners while KeepAlive holds the popup, and takes them back', async () => {
      const count = countListeners();
      const page = shallowRef('popup');
      const Other = defineComponent({ setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>
          {page.value === 'popup' ? <Popup name="popup" key="popup" /> : <Other key="other" />}
        </KeepAlive>
      ));
      const active = count();

      page.value = 'other';
      await nextTick();
      const deactivated = count();
      await fireEvent.keyDown(document.body, { key: 'Escape' });

      page.value = 'popup';
      await nextTick();
      const activated = count();
      const openAfterActivation = isOpen('popup');

      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect({
        active,
        deactivated,
        activated,
        openAfterActivation,
        open: isOpen('popup'),
      }).toEqual({
        active: 18,
        deactivated: 0,
        activated: 18,
        openAfterActivation: true,
        open: false,
      });
    });

    it('moves the listeners to the document of a popup element that mounts after the open', async () => {
      const frame = document.createElement('iframe');
      document.body.append(frame);
      onTestFinished(() => frame.remove());
      const frameDocument = frame.contentDocument!;
      const count = countListeners();
      const countInFrame = countListeners(frameDocument);
      // The portal renders its `Teleport` one flush after its mount.
      await render(<Popup name="popup" portalContainer={frameDocument.body} />);

      expect({ main: count(), frame: countInFrame() }).toEqual({ main: 0, frame: 18 });

      await fireEvent.pointerDown(frameDocument.body, mouse);
      expect(frameDocument.querySelector('[data-testid="popup"]')).toBe(null);
    });

    it('has none in a frame document while the popup is closed, 15 while it is open, and none after a close or an unmount', async () => {
      const { frame, loaded } = addFrame();
      await loaded;
      const countInFrame = countListeners(frame.contentDocument!);
      const { unmount } = await render(<Popup name="popup" defaultOpen={false} />);
      const closed = countInFrame();

      await fireEvent.click(screen.getByTestId('popup-trigger'));
      const open = countInFrame();

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      const afterClose = countInFrame();

      await fireEvent.click(screen.getByTestId('popup-trigger'));
      unmount();

      // Fourteen press listeners, and the `load` listener for a frame in the frame.
      expect({ closed, open, afterClose, afterUnmount: countInFrame() }).toEqual({
        closed: 0,
        open: 15,
        afterClose: 0,
        afterUnmount: 0,
      });
    });

    it('gives the popup element a passive capture listener for touchmove', async () => {
      const calls: [string, unknown][] = [];
      const add = HTMLElement.prototype.addEventListener;
      HTMLElement.prototype.addEventListener = function addEventListener(
        this: HTMLElement,
        type: string,
        ...rest: any[]
      ) {
        if (this.dataset.testid === 'popup') {
          calls.push([type, rest[1]]);
        }
        return (add as any).call(this, type, ...rest);
      } as typeof add;
      onTestFinished(() => {
        HTMLElement.prototype.addEventListener = add;
      });

      await render(<Popup name="popup" />);

      expect(calls).toContainEqual(['touchmove', { capture: true, passive: true }]);
      expect(calls).toContainEqual(['click', { capture: true }]);
    });
  });

  describe('open change', () => {
    /** The popup of the fixture family, with the props of `useDismissLayer` on its element. */
    const DismissedPopupPart = defineComponent({
      setup() {
        const { floating } = useTestDismiss(inject(PopupFixtureContext)!);
        return () => <PopupPart data-testid="popup" {...floating} />;
      },
    });

    it('gives the reason and the event of an Escape press to the popup store, and prevents the default action', async () => {
      const onOpenChange = vi.fn();
      await render(
        <PopupRootPart defaultOpen onOpenChange={onOpenChange}>
          <DismissedPopupPart />
        </PopupRootPart>,
      );

      const notPrevented = await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      const [open, details] = onOpenChange.mock.calls[0];
      expect({ open, reason: details.reason, eventType: details.event.type }).toEqual({
        open: false,
        reason: REASONS.escapeKey,
        eventType: 'keydown',
      });
      expect(notPrevented).toBe(false);
      expect(isOpen('popup')).toBe(false);
    });

    it('closes from a handler of its props only while it is enabled', async () => {
      const changes: Change[] = [];
      const enabled = shallowRef(false);
      await render(
        <Popup
          name="popup"
          toggleOn="pointerdown"
          dismiss={{ enabled, referencePress: () => true }}
          onChange={(change: Change) => changes.push(change)}
        />,
      );
      const trigger = screen.getByTestId('popup-trigger');

      await fireEvent.click(trigger);
      await fireEvent.keyDown(screen.getByTestId('popup'), { key: 'Escape' });
      expect(changes).toEqual([]);

      enabled.value = true;
      await fireEvent.click(trigger);
      expect(changes).toEqual([{ open: false, reason: REASONS.triggerPress, eventType: 'click' }]);
    });
  });

  describe('outside press', () => {
    it.each([
      { name: 'on pointerdown in the sloppy form', mode: 'sloppy', eventType: 'pointerdown' },
      { name: 'on click in the intentional form', mode: 'intentional', eventType: 'click' },
    ] as const)('closes $name', async ({ mode, eventType }) => {
      const outside = addOutsideElement();
      const changes: Change[] = [];
      await render(
        <Popup
          name="popup"
          dismiss={{ outsidePressEvent: mode }}
          onChange={(change: Change) => changes.push(change)}
        />,
      );

      await userEvent.click(outside);
      await flushMicrotasks();

      expect(changes).toEqual([{ open: false, reason: REASONS.outsidePress, eventType }]);
    });

    it.each([
      { name: 'click on a button', mode: 'intentional', eventType: 'click', child: false },
      {
        name: 'click on a child of a button',
        mode: 'intentional',
        eventType: 'click',
        child: true,
      },
      { name: 'pointerdown on a button', mode: 'sloppy', eventType: 'pointerdown', child: false },
      {
        name: 'pointerdown on a child of a button',
        mode: 'sloppy',
        eventType: 'pointerdown',
        child: true,
      },
    ] as const)(
      'closes before a listener of the pressed button runs: $name',
      async ({ mode, eventType, child }) => {
        const order: string[] = [];
        await render(
          <>
            <Popup
              name="popup"
              dismiss={{ outsidePressEvent: mode }}
              onChange={(change: Change) => order.push(`${change.reason} ${change.eventType}`)}
            />
            <button
              type="button"
              {...{
                [eventType === 'click' ? 'onClick' : 'onPointerdown']: () => order.push('listener'),
              }}
            >
              {child ? <span data-testid="child">outside</span> : 'outside'}
            </button>
          </>,
        );
        expect(isOpen('popup')).toBe(true);

        await userEvent.click(
          child ? screen.getByTestId('child') : screen.getByRole('button', { name: 'outside' }),
        );
        await flushMicrotasks();

        expect(order).toEqual([`${REASONS.outsidePress} ${eventType}`, 'listener']);
      },
    );
  });

  describe('popups below the popup in the component tree', () => {
    const intentional = { outsidePressEvent: 'intentional' } as const;
    const popupTree = ['parent', 'child', 'grandchild'];

    function renderDescendants(withNodes: boolean, onParentChange?: (change: Change) => void) {
      const descendants = () => (
        <Popup name="parent" node={withNodes} dismiss={intentional} onChange={onParentChange}>
          <Popup name="child" node={withNodes} teleport dismiss={intentional}>
            <Popup name="grandchild" node={withNodes} teleport dismiss={intentional}>
              <button
                type="button"
                data-testid="scrubber"
                onPointerdown={(event: PointerEvent) => event.preventDefault()}
              >
                Scrub
              </button>
            </Popup>
          </Popup>
        </Popup>
      );
      return render(withNodes ? <Tree>{descendants()}</Tree> : descendants());
    }

    describe.each([
      { name: 'in the popup tree', withNodes: true },
      { name: 'outside the popup tree', withNodes: false },
    ])('descendants $name', ({ withNodes }) => {
      it.each([
        { name: 'pointerdown', press: fireEvent.pointerDown, release: fireEvent.pointerUp },
        { name: 'mousedown', press: fireEvent.mouseDown, release: fireEvent.mouseUp },
      ])(
        'VUE-4: a $name drag from a descendant keeps each ancestor open',
        async ({ press, release }) => {
          const parentChanges: Change[] = [];
          await renderDescendants(withNodes, (change) => parentChanges.push(change));

          await press(screen.getByTestId('grandchild'), { pointerType: 'mouse', button: 0 });
          // The inside marker expires before the release.
          await wait(0);
          await release(document.body, { pointerType: 'mouse', button: 0 });
          await fireEvent.click(document.body);
          expect(parentChanges).toEqual([]);
          expect(popupTree.map(isOpen)).toEqual([true, true, true]);

          await fireEvent.click(document.body);
          expect(parentChanges.map(({ reason }) => reason)).toEqual([REASONS.outsidePress]);
          expect(popupTree.map(isOpen)).toEqual([false, false, false]);
        },
      );

      it('VUE-4: the suppression of a prevented press in a descendant expires in each ancestor', async () => {
        await renderDescendants(withNodes);

        await fireEvent.pointerDown(screen.getByTestId('scrubber'), {
          pointerType: 'mouse',
          button: 0,
        });
        await wait(0);
        await fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
        // A prevented press can produce no click, so only the timer ends its suppression.
        await wait(0);
        await fireEvent.click(document.body);
        expect(popupTree.map(isOpen)).toEqual([false, false, false]);
      });
    });

    it('VUE-4: a press in a descendant outside the popup tree suppresses no later click', async () => {
      await render(
        <Popup name="parent" dismiss={intentional}>
          <Popup name="child" teleport dismiss={intentional} />
        </Popup>,
      );

      await pressAndClick(screen.getByTestId('child'));
      expect(['parent', 'child'].map(isOpen)).toEqual([true, true]);

      // The inside marker of the click expires.
      await wait(0);
      await fireEvent.click(document.body);
      expect(['parent', 'child'].map(isOpen)).toEqual([false, false]);
    });

    it('VUE-4: a drag from a child popup to its own backdrop suppresses no later click in the popup above', async () => {
      const parentChanges: Change[] = [];
      await render(
        <Popup
          name="parent"
          dismiss={intentional}
          onChange={(change: Change) => parentChanges.push(change)}
        >
          <Popup
            name="child"
            portalContainer={document.body}
            portalBackdrop
            dismiss={intentional}
          />
        </Popup>,
      );

      const child = screen.getByTestId('child');
      const childBackdrop = screen.getByTestId('child-backdrop');
      const portal = childBackdrop.parentElement;
      if (!portal) {
        throw new Error('Expected portal element');
      }

      await Promise.all([
        fireEvent.pointerDown(child, { pointerType: 'mouse', button: 0 }),
        fireEvent.mouseDown(child, { button: 0 }),
      ]);
      await wait(0);
      await Promise.all([
        fireEvent.pointerUp(childBackdrop, { pointerType: 'mouse', button: 0 }),
        fireEvent.mouseUp(childBackdrop, { button: 0 }),
        fireEvent.click(portal, { detail: 1 }),
      ]);
      expect(isOpen('parent')).toBe(true);

      await wait(0);
      await clickWithNoPress(document.body);
      expect(parentChanges.map(({ reason }) => reason)).toEqual([REASONS.outsidePress]);
      expect(isOpen('parent')).toBe(false);
    });

    it('VUE-4: a press in a child popup that Teleport moved does not close the parent popup', async () => {
      const outside = addOutsideElement();
      await render(
        <Popup name="parent">
          <Popup name="child" teleport />
        </Popup>,
      );
      const child = screen.getByTestId('child');
      expect(screen.getByTestId('parent').contains(child)).toBe(false);

      await userEvent.click(child);
      await flushMicrotasks();
      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: true,
      });

      await userEvent.click(outside);
      await flushMicrotasks();
      expect(isOpen('parent')).toBe(false);
    });

    it('closes no popup above a teleported popup for a click in it', async () => {
      const dismiss = { outsidePressEvent: 'intentional' } as const;
      await render(
        <Popup name="parent" dismiss={dismiss}>
          <Popup name="child" teleport dismiss={dismiss}>
            <Popup name="grandchild" teleport dismiss={dismiss} />
          </Popup>
        </Popup>,
      );

      await pressAndClick(screen.getByTestId('grandchild'));

      expect(['parent', 'child', 'grandchild'].map(isOpen)).toEqual([true, true, true]);
    });

    it.each<{
      name: string;
      dismiss: DismissLayerOptions;
      press: (target: Element, outside: Element) => Promise<void>;
    }>([
      { name: 'a mouse press', dismiss: {}, press: pressAndClick },
      {
        name: 'a click',
        dismiss: { outsidePressEvent: 'intentional' },
        press: pressAndClick,
      },
      {
        name: 'a click with no press',
        dismiss: { outsidePressEvent: 'intentional' },
        press: clickWithNoPress,
      },
      {
        name: 'a drag that ends',
        dismiss: { outsidePressEvent: 'intentional' },
        press: dragOnto,
      },
      { name: 'a swipe', dismiss: {}, press: (target) => swipe(target, 12) },
      { name: 'a short swipe', dismiss: {}, press: (target) => swipe(target, 8) },
    ])(
      'VUE-4: $name on the backdrop of a child popup closes only the child',
      async ({ dismiss, press }) => {
        const outside = addOutsideElement();
        const childChanges: Change[] = [];
        await render(
          <Popup name="parent" dismiss={dismiss}>
            <Popup
              name="child"
              portalContainer={document.body}
              portalBackdrop
              dismiss={dismiss}
              onChange={(change: Change) => childChanges.push(change)}
            />
          </Popup>,
        );

        await press(screen.getByTestId('child-backdrop'), outside);
        await flushMicrotasks();

        expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
          parent: true,
          child: false,
        });
        expect(childChanges.map(({ reason }) => reason)).toEqual([REASONS.outsidePress]);

        // The press leaves no marker behind.
        await userEvent.click(outside);
        await flushMicrotasks();
        expect(isOpen('parent')).toBe(false);
      },
    );

    it('VUE-4: a press in a portal that no popup owns does not close the popup above', async () => {
      const outside = addOutsideElement();
      await render(
        <Popup name="parent">
          <PopupPortal guards={usePortalFocus}>
            <button type="button" data-testid="portaled" />
          </PopupPortal>
        </Popup>,
      );
      expect(screen.getByTestId('parent').contains(screen.getByTestId('portaled'))).toBe(false);

      await pressAndClick(screen.getByTestId('portaled'));
      await flushMicrotasks();
      expect(isOpen('parent')).toBe(true);

      await userEvent.click(outside);
      await flushMicrotasks();
      expect(isOpen('parent')).toBe(false);
    });

    it.each([
      { name: 'pointerdown', press: fireEvent.pointerDown, release: fireEvent.pointerUp },
      { name: 'mousedown', press: fireEvent.mouseDown, release: fireEvent.mouseUp },
    ])(
      'VUE-4: a $name drag from a portal that no popup owns keeps the popup above open',
      async ({ press, release }) => {
        const parentChanges: Change[] = [];
        await render(
          <Popup
            name="parent"
            dismiss={intentional}
            onChange={(change: Change) => parentChanges.push(change)}
          >
            <PopupPortal guards={usePortalFocus}>
              <button type="button" data-testid="portaled" />
            </PopupPortal>
          </Popup>,
        );

        await press(screen.getByTestId('portaled'), { pointerType: 'mouse', button: 0 });
        await wait(0);
        await release(document.body, { pointerType: 'mouse', button: 0 });
        await fireEvent.click(document.body);
        expect(parentChanges).toEqual([]);
        expect(isOpen('parent')).toBe(true);

        await fireEvent.click(document.body);
        expect(parentChanges.map(({ reason }) => reason)).toEqual([REASONS.outsidePress]);
        expect(isOpen('parent')).toBe(false);
      },
    );

    it('VUE-4: the suppression of a prevented press in a portal that no popup owns expires in the popup above', async () => {
      await render(
        <Popup name="parent" dismiss={intentional}>
          <PopupPortal guards={usePortalFocus}>
            <button
              type="button"
              data-testid="portaled"
              onPointerdown={(event: PointerEvent) => event.preventDefault()}
            />
          </PopupPortal>
        </Popup>,
      );

      await fireEvent.pointerDown(screen.getByTestId('portaled'), {
        pointerType: 'mouse',
        button: 0,
      });
      await wait(0);
      await fireEvent.pointerUp(document.body, { pointerType: 'mouse', button: 0 });
      await wait(0);
      await fireEvent.click(document.body);
      expect(isOpen('parent')).toBe(false);
    });

    it('writes no marker to the frozen store of a popup that is above and never opens', async () => {
      const Above = defineComponent({
        setup(_, { slots }) {
          useTestDismiss(getEmptyRootStore());
          return () => slots.default?.();
        },
      });
      await render(
        <Above>
          <Popup name="popup" />
        </Above>,
      );

      // A handler that throws fails the dispatch.
      await fireEvent.click(screen.getByTestId('popup'));

      expect(isOpen('popup')).toBe(true);
    });

    it('VUE-4: Escape closes the top popup first', async () => {
      await render(
        <Popup name="parent">
          <Popup name="child" teleport defaultOpen={false} />
        </Popup>,
      );
      await fireEvent.click(screen.getByTestId('child-trigger'));

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: false,
      });

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('parent')).toBe(false);
    });

    it('closes the child first when a parent and its child are open at the mount', async () => {
      await render(
        <Popup name="parent">
          <Popup name="child" teleport />
        </Popup>,
      );

      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: false,
      });
    });

    it('stops an Escape press in a teleported child, so the document does not get it', async () => {
      const onKeydown = vi.fn();
      document.addEventListener('keydown', onKeydown);
      onTestFinished(() => document.removeEventListener('keydown', onKeydown));
      await render(
        <Popup name="parent">
          <Popup name="child" teleport>
            <input data-testid="input" />
          </Popup>
        </Popup>,
      );

      await fireEvent.keyDown(screen.getByTestId('input'), { key: 'Escape' });

      expect(onKeydown).not.toHaveBeenCalled();
      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: false,
      });
    });

    it('gives an Escape press that a teleported child lets propagate to the parent popup', async () => {
      await render(
        <Popup name="parent">
          <Popup name="child" teleport allowPropagation>
            <input data-testid="input" />
          </Popup>
        </Popup>,
      );

      await fireEvent.keyDown(screen.getByTestId('input'), { key: 'Escape' });

      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: false,
        child: false,
      });
    });

    it('gives an Escape press in a child in the parent element to the parent one time', async () => {
      const changes: Change[] = [];
      await render(
        <Popup name="parent" allowPropagation onChange={(change: Change) => changes.push(change)}>
          <Popup name="child" allowPropagation>
            <input data-testid="input" />
          </Popup>
        </Popup>,
      );

      await fireEvent.keyDown(screen.getByTestId('input'), { key: 'Escape' });

      expect(changes).toEqual([{ open: false, reason: REASONS.escapeKey, eventType: 'keydown' }]);
    });

    it('gives the same numbers to the popups of a second copy of the module', async () => {
      const copy: typeof import('./useDismissLayer') = await import(
        './useDismissLayer?copy' as string
      );
      expect(copy.useDismissLayer).not.toBe(useDismissLayer);

      const First = createLayer(useDismissLayer, 'first');
      const Second = createLayer(copy.useDismissLayer, 'second');
      const Third = createLayer(useDismissLayer, 'third');
      await render(
        <>
          <First />
          <Second />
          <Third />
        </>,
      );
      const names = ['first', 'second', 'third'];
      for (const name of names) {
        await fireEvent.click(screen.getByTestId(`open-${name}`));
      }

      const closed: string[][] = [];
      for (const _name of names) {
        const before = names.filter(isOpen);
        await fireEvent.keyDown(document.body, { key: 'Escape' });
        closed.push(before.filter((name) => !isOpen(name)));
      }

      expect(closed).toEqual([['third'], ['second'], ['first']]);
    });
  });

  describe('floating tree', () => {
    it('keeps an outside press for a child node that does not let it bubble', async () => {
      const dismiss = { bubbles: { outsidePress: false } };
      await render(
        <Tree>
          <Popup name="parent" node dismiss={dismiss}>
            <Popup name="child" node teleport dismiss={dismiss} />
          </Popup>
        </Tree>,
      );

      await fireEvent.pointerDown(document.body, mouse);
      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: false,
      });

      await fireEvent.pointerDown(document.body, mouse);
      expect(isOpen('parent')).toBe(false);
    });

    it('closes the child node for an Escape press in the popup of its parent', async () => {
      await render(
        <Tree>
          <Popup name="parent" node>
            <input data-testid="input" />
            <Popup name="child" node teleport />
          </Popup>
        </Tree>,
      );

      await fireEvent.keyDown(screen.getByTestId('input'), { key: 'Escape' });

      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: false,
      });
    });
  });

  describe('input methods', () => {
    it('BUG-6158: Escape directly after compositionend closes the popup', async () => {
      setWebKit(false);
      await render(<Popup name="popup" />);

      await fireEvent.compositionEnd(document.body);
      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(isOpen('popup')).toBe(false);
    });

    it('ignores Escape for 5 ms after compositionend in WebKit', async () => {
      setWebKit(true);
      vi.useFakeTimers();
      onTestFinished(() => {
        vi.useRealTimers();
      });
      await render(<Popup name="popup" />);

      await fireEvent.compositionEnd(document.body);
      vi.advanceTimersByTime(4);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(true);

      vi.advanceTimersByTime(1);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(false);
    });
  });

  describe('shadow roots', () => {
    it('takes a press in a popup in a closed shadow root for a press inside', async () => {
      const outside = addOutsideElement();
      const host = document.createElement('div');
      document.body.append(host);
      onTestFinished(() => host.remove());
      const shadowRoot = host.attachShadow({ mode: 'closed' });
      await render(
        <Teleport to={shadowRoot as unknown as HTMLElement}>
          <Popup name="popup">
            <button data-testid="inside">inside</button>
          </Popup>
        </Teleport>,
      );
      const isOpenInShadow = () => shadowRoot.querySelector('[data-testid="popup"]') !== null;
      const hostRect = host.getBoundingClientRect();
      const insideRect = shadowRoot
        .querySelector('[data-testid="inside"]')!
        .getBoundingClientRect();

      // A locator cannot name an element in a closed shadow root.
      await userEvent.click(host, {
        position: { x: insideRect.left - hostRect.left + 5, y: insideRect.top - hostRect.top + 5 },
      });
      await flushMicrotasks();
      expect(isOpenInShadow()).toBe(true);

      await userEvent.click(outside);
      await flushMicrotasks();
      expect(isOpenInShadow()).toBe(false);
    });

    it('takes a press in a popup in a closed shadow root in another closed shadow root for a press inside', async () => {
      const outerHost = document.createElement('div');
      document.body.append(outerHost);
      onTestFinished(() => outerHost.remove());
      const host = document.createElement('div');
      outerHost.attachShadow({ mode: 'closed' }).append(host);
      const shadowRoot = host.attachShadow({ mode: 'closed' });
      await render(
        <Teleport to={shadowRoot as unknown as HTMLElement}>
          <Popup name="popup">
            <button data-testid="inside">inside</button>
          </Popup>
        </Teleport>,
      );
      expect(shadowRoot.querySelector('[data-testid="popup"]')).not.toBe(null);
      const outerHostRect = outerHost.getBoundingClientRect();
      const insideRect = shadowRoot
        .querySelector('[data-testid="inside"]')!
        .getBoundingClientRect();

      // Outside both shadow roots, the target of the press is the outer host.
      await userEvent.click(outerHost, {
        position: {
          x: insideRect.left - outerHostRect.left + 5,
          y: insideRect.top - outerHostRect.top + 5,
        },
      });
      await flushMicrotasks();

      expect(shadowRoot.querySelector('[data-testid="popup"]')).not.toBe(null);
    });
  });

  describe('frames', () => {
    it.each([
      { mode: 'sloppy', eventType: 'pointerdown' },
      { mode: 'intentional', eventType: 'click' },
    ] as const)(
      'BUG-5410: a press in a same-origin iframe closes the popup in the $mode form',
      async ({ mode, eventType }) => {
        const { frame, loaded } = addFrame();
        await loaded;
        const changes: Change[] = [];
        await render(
          <Popup
            name="popup"
            dismiss={{ outsidePressEvent: mode }}
            onChange={(change: Change) => changes.push(change)}
          />,
        );

        await pressInFrame(frame);

        expect(changes).toEqual([{ open: false, reason: REASONS.outsidePress, eventType }]);
      },
    );

    it('BUG-5410: a press in an iframe that loads while the popup is open closes the popup', async () => {
      await render(<Popup name="popup" />);
      const { frame, loaded } = addFrame();
      await loaded;

      await pressInFrame(frame);

      expect(isOpen('popup')).toBe(false);
    });

    it('BUG-5410: a press in an iframe in an iframe closes the popup', async () => {
      const outer = addFrame();
      await outer.loaded;
      await render(<Popup name="popup" />);
      // The inner frame loads in the outer frame, which is not the document of the popup.
      const inner = addFrame({ parent: outer.frame.contentDocument!.body, top: 0 });
      await inner.loaded;

      await pressInFrame(outer.frame, { x: 40, y: 20 });

      expect(isOpen('popup')).toBe(false);
    });

    it('VUE-138: keeps the popup open for a press in a frame assigned to its slot', async () => {
      const button = document.createElement('button');
      const root = createSlotHost(button);
      const { frame, loaded } = addFrame({ parent: root.host });
      await render(
        <Teleport to={root}>
          <Popup name="popup">{h('slot')}</Popup>
        </Teleport>,
      );
      await loaded;
      const popup = root.querySelector('[data-testid="popup"]')!;
      expect(popup.contains(frame.assignedSlot)).toBe(true);

      await pressAndClick(button);
      expect(popup).toBeInTheDocument();
      await pressAndClick(frame.contentDocument!.querySelector('button')!);
      expect(popup).toBeInTheDocument();

      await pressAndClick(document.body);
      expect(popup).not.toBeInTheDocument();
    });

    it('keeps the popup open for a press in an iframe in the popup', async () => {
      await render(<Popup name="popup" />);
      const { frame, loaded } = addFrame({ parent: screen.getByTestId('popup') });
      frame.style.position = 'static';
      await loaded;

      await pressInFrame(frame);

      expect(isOpen('popup')).toBe(true);
    });

    it('keeps the popup open for a press in an iframe in an iframe in the popup', async () => {
      await render(<Popup name="popup" />);
      const outer = addFrame({ parent: screen.getByTestId('popup') });
      outer.frame.style.position = 'static';
      await outer.loaded;
      // The inner frame loads in the outer frame, which is not the document of the popup.
      const inner = addFrame({ parent: outer.frame.contentDocument!.body, top: 0 });
      await inner.loaded;

      await pressInFrame(outer.frame, { x: 40, y: 20 });

      expect(isOpen('popup')).toBe(true);
    });

    it.each([{ mode: 'sloppy' }, { mode: 'intentional' }] as const)(
      'keeps the popup open in the $mode form for a press in an iframe in a popup that Teleport moved',
      async ({ mode }) => {
        const dismiss = { outsidePressEvent: mode };
        await render(
          <Popup name="parent" dismiss={dismiss}>
            <Popup name="child" teleport dismiss={dismiss} />
          </Popup>,
        );
        const { frame, loaded } = addFrame({ parent: screen.getByTestId('child') });
        frame.style.position = 'static';
        await loaded;

        await pressInFrame(frame);

        expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
          parent: true,
          child: true,
        });
      },
    );

    it('keeps the popup above open for a press in an iframe in a node of its tree', async () => {
      // The child listens for no press, so only the floating tree links it to the popup above.
      await render(
        <Tree>
          <Popup name="parent" node>
            <Popup name="child" node teleport dismiss={{ outsidePress: false }} />
          </Popup>
        </Tree>,
      );
      const { frame, loaded } = addFrame({ parent: screen.getByTestId('child') });
      frame.style.position = 'static';
      await loaded;

      await pressInFrame(frame);

      expect({ parent: isOpen('parent'), child: isOpen('child') }).toEqual({
        parent: true,
        child: true,
      });
    });

    it('removes the listeners of a frame that left the page when it searches the frames again', async () => {
      const first = addFrame();
      await first.loaded;
      const countInFirst = countListeners(first.frame.contentDocument!);
      await render(<Popup name="popup" />);
      const whileThere = countInFirst();

      first.frame.remove();
      const second = addFrame({ top: 420 });
      await second.loaded;

      expect({ whileThere, afterSearch: countInFirst() }).toEqual({
        whileThere: 15,
        afterSearch: 0,
      });
    });

    it('does not search the frames again for the load of an element that is not a frame', async () => {
      const { frame, loaded } = addFrame();
      await loaded;
      await render(<Popup name="popup" />);
      const addToFrame = vi.spyOn(frame.contentDocument!, 'addEventListener');

      await fireEvent.load(document.body);

      expect(addToFrame).not.toHaveBeenCalled();
    });

    it('skips a cross-origin iframe and listens in the frames after it', async () => {
      const crossOrigin = addFrame({ sandboxed: true });
      const sameOrigin = addFrame({ top: 420 });
      await Promise.all([crossOrigin.loaded, sameOrigin.loaded]);
      // The document of a cross-origin frame throws on a read. The popup must not.
      expect(() => crossOrigin.frame.contentWindow!.document).toThrow();
      await render(<Popup name="popup" />);

      await pressInFrame(sameOrigin.frame);

      expect(isOpen('popup')).toBe(false);
    });

    it('does not close for a press on the scrollbar of an iframe', async () => {
      const { frame, loaded } = addFrame();
      await loaded;
      const frameDocument = frame.contentDocument!;
      const scroller = frameDocument.createElement('div');
      scroller.style.cssText = 'width: 100px; height: 100px; overflow: scroll';
      scroller.innerHTML = '<div style="height: 400px"></div>';
      frameDocument.body.append(scroller);
      await render(<Popup name="popup" />);
      const FramePointerEvent = ownerWindow(scroller).PointerEvent;

      const onScrollbar = new FramePointerEvent('pointerdown', {
        bubbles: true,
        pointerType: 'mouse',
      });
      Object.defineProperty(onScrollbar, 'offsetX', { value: scroller.clientWidth + 1 });
      await fireEvent(scroller, onScrollbar);
      expect(isOpen('popup')).toBe(true);

      await fireEvent(
        scroller,
        new FramePointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse' }),
      );
      expect(isOpen('popup')).toBe(false);
    });

    it('takes a press in an iframe for a press on its element when the document has inert markers', async () => {
      const host = document.createElement('div');
      host.innerHTML = `<div ${createAttribute('inert')}></div>`;
      document.body.append(host);
      onTestFinished(() => host.remove());
      // The first iframe is in the part of the document that has a marker. A third party injected
      // the second iframe, after the markers.
      const marked = addFrame({ parent: host });
      const injected = addFrame({ top: 420 });
      await Promise.all([marked.loaded, injected.loaded]);
      await render(<Popup name="popup" />);

      await pressInFrame(injected.frame);
      expect(isOpen('popup')).toBe(true);

      await pressInFrame(marked.frame);
      expect(isOpen('popup')).toBe(false);
    });
  });

  describe('a store that changes', () => {
    /**
     * A popup element with the props of `useDismissLayer` for the store that `current` names. Both
     * stores are open, and each records its changes.
     */
    function renderSwitchingStores(dismissProps: DismissLayerOptions = {}) {
      const current = shallowRef<'a' | 'b'>('a');
      const changes: (Change & { store: string })[] = [];
      const stores: Record<'a' | 'b', ReturnType<typeof useFloatingRootStore>> = {} as never;

      const Popup = defineComponent(() => {
        const floating = shallowRef<HTMLElement | null>(null);
        for (const name of ['a', 'b'] as const) {
          stores[name] = useFloatingRootStore({
            open: true,
            onOpenChange(open, details) {
              changes.push({
                store: name,
                open,
                reason: details.reason,
                eventType: details.event.type,
              });
            },
            elements: { positionerElement: floating },
          });
        }
        const dismiss = useTestDismiss(() => stores[current.value], dismissProps);

        return () => (
          <div
            data-testid="popup"
            {...mergeProps(dismiss.floating, {
              ref: (element: unknown) => {
                floating.value = element as HTMLElement | null;
              },
            })}
          >
            popup
          </div>
        );
      });

      return { current, changes, stores, Popup };
    }

    it('closes the popup of the store that the getter gives at the time of the press', async () => {
      const { current, changes, Popup } = renderSwitchingStores();
      await render(<Popup />);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      current.value = 'b';
      await flushMicrotasks();
      await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(changes).toEqual([
        { store: 'a', open: false, reason: REASONS.escapeKey, eventType: 'keydown' },
        { store: 'b', open: false, reason: REASONS.escapeKey, eventType: 'keydown' },
      ]);
    });

    it('moves its openchange listener to the new store', async () => {
      const { current, stores, Popup } = renderSwitchingStores();
      await render(<Popup />);
      const offA = vi.spyOn(stores.a.context.events, 'off');
      const onB = vi.spyOn(stores.b.context.events, 'on');

      current.value = 'b';
      await flushMicrotasks();

      expect(offA).toHaveBeenCalledWith('openchange', expect.any(Function));
      expect(onB).toHaveBeenCalledWith('openchange', offA.mock.calls[0][1]);
    });

    it('clears a press in the new store when the owner unmounts before the next flush', async () => {
      const { current, stores, Popup } = renderSwitchingStores();
      const { unmount } = await render(<Popup />);

      current.value = 'b';
      screen.getByTestId('popup').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(stores.b.context.insideComponentTree).toBe(true);
      unmount();

      expect(stores.b.context.insideComponentTree).toBe(false);
    });

    it('dismisses on the next outside press after a press in the new store before the flush', async () => {
      const enabled = shallowRef(false);
      const { current, stores, changes, Popup } = renderSwitchingStores({ enabled });
      await render(<Popup />);

      current.value = 'b';
      enabled.value = true;
      screen.getByTestId('popup').dispatchEvent(new MouseEvent('mouseup', { bubbles: true }));
      expect(stores.b.context.insideComponentTree).toBe(true);
      await wait(0);
      await fireEvent.pointerDown(document.body, mouse);

      expect(changes).toEqual([
        { store: 'b', open: false, reason: REASONS.outsidePress, eventType: 'pointerdown' },
      ]);
    });

    it('clears the inside marker of the last store, so that its next outside press closes it', async () => {
      const { current, changes, Popup } = renderSwitchingStores();
      await render(<Popup />);

      // A press in the popup sets the marker of store a, and a 0 ms timer clears it.
      await fireEvent.pointerDown(screen.getByTestId('popup'), mouse);
      current.value = 'b';
      await flushMicrotasks();
      current.value = 'a';
      await flushMicrotasks();

      await fireEvent.pointerDown(document.body, mouse);

      expect(changes).toEqual([
        { store: 'a', open: false, reason: REASONS.outsidePress, eventType: 'pointerdown' },
      ]);
    });
  });

  describe('popups that opened later', () => {
    it.each([
      { name: 'that closes for an outside press', dismiss: {} },
      { name: 'that does not close for one', dismiss: { outsidePress: false } },
    ])(
      'BUG-5410: keeps the popup open for a press in an iframe in a newer popup $name',
      async ({ dismiss }) => {
        const changes: string[] = [];
        await render(
          <>
            <Popup name="older" onChange={() => changes.push('older')} />
            <Popup
              name="newer"
              defaultOpen={false}
              dismiss={dismiss}
              onChange={() => changes.push('newer')}
            />
          </>,
        );
        await fireEvent.click(screen.getByTestId('newer-trigger'));
        const { frame, loaded } = addFrame({ parent: screen.getByTestId('newer') });
        frame.style.position = 'static';
        await loaded;

        await pressInFrame(frame);

        expect(changes).toEqual([]);
      },
    );

    // The older popup checks a different press event in each row: `pointerdown` and `mousedown`,
    // `click`, `touchmove` or `touchend`. Only the capture listener of the popup element for that
    // event records the number of the newer popup.
    it.each<{
      name: string;
      dismiss: DismissLayerOptions;
      press: (target: Element) => Promise<void>;
    }>([
      { name: 'a mouse press', dismiss: {}, press: pressAndClick },
      { name: 'a click', dismiss: { outsidePressEvent: 'intentional' }, press: pressAndClick },
      { name: 'a swipe', dismiss: {}, press: (target) => swipe(target, 12) },
      { name: 'a short swipe', dismiss: {}, press: (target) => swipe(target, 8) },
    ])(
      'VUE-79: keeps the popup open for $name in a newer popup in a closed shadow root',
      async ({ dismiss, press }) => {
        const host = document.createElement('div');
        document.body.append(host);
        onTestFinished(() => host.remove());
        const shadowRoot = host.attachShadow({ mode: 'closed' });
        const changes: string[] = [];
        // Both popups are open at the mount, and each takes its number in the order of the tree.
        // Thus `newer` has the higher number.
        await render(
          <>
            <Popup name="older" dismiss={dismiss} onChange={() => changes.push('older')} />
            <Teleport to={shadowRoot as unknown as HTMLElement}>
              <Popup name="newer" onChange={() => changes.push('newer')} />
            </Teleport>
          </>,
        );

        await press(shadowRoot.querySelector('[data-testid="newer"]')!);

        expect(changes).toEqual([]);
      },
    );

    it('keeps the popup open for a press in a newer popup of a second copy of the module', async () => {
      const copy: typeof import('./useDismissLayer') = await import(
        './useDismissLayer?copy' as string
      );
      const First = createLayer(useDismissLayer, 'first');
      const Second = createLayer(copy.useDismissLayer, 'second');
      await render(
        <>
          <First />
          <Second />
        </>,
      );
      await fireEvent.click(screen.getByTestId('open-first'));
      await waitForLaterMillisecond(() => fireEvent.click(screen.getByTestId('open-second')));

      await fireEvent.pointerDown(screen.getByTestId('second'), mouse);

      expect({ first: isOpen('first'), second: isOpen('second') }).toEqual({
        first: true,
        second: true,
      });
    });

    it('VUE-79: keeps the popup open for a press in a newer popup of a second copy of the module in a closed shadow root', async () => {
      const copy: typeof import('./useDismissLayer') = await import(
        './useDismissLayer?copy' as string
      );
      const First = createLayer(useDismissLayer, 'first');
      const Second = createLayer(copy.useDismissLayer, 'second');
      const host = document.createElement('div');
      document.body.append(host);
      onTestFinished(() => host.remove());
      const shadowRoot = host.attachShadow({ mode: 'closed' });
      await render(
        <>
          <First />
          <Teleport to={shadowRoot as unknown as HTMLElement}>
            <Second />
          </Teleport>
        </>,
      );
      const inShadow = (testId: string) => shadowRoot.querySelector(`[data-testid="${testId}"]`);
      await fireEvent.click(screen.getByTestId('open-first'));
      await waitForLaterMillisecond(() => fireEvent.click(inShadow('open-second')!));

      await fireEvent.pointerDown(inShadow('second')!, mouse);

      expect({ first: isOpen('first'), second: inShadow('second') !== null }).toEqual({
        first: true,
        second: true,
      });
    });
  });
});

describe('press ownership across independent non-modal layers', () => {
  const { render: renderLayers } = createRenderer();

  type OnOpenChange = (open: boolean, details: VaseUIChangeEventDetails<string>) => void;

  const Layer = defineComponent({
    props: {
      id: { type: String, required: true },
      open: { type: Boolean, required: true },
      mode: { type: String as PropType<'intentional' | 'sloppy'>, required: true },
      onOpenChange: { type: Function as PropType<OnOpenChange>, required: true },
    },
    setup(props) {
      const { refs, context } = useFloating({
        open: () => props.open,
        onOpenChange: props.onOpenChange,
      });
      const { getFloatingProps } = useTestInteractions([
        useTestDismiss(context.rootStore, { outsidePressEvent: props.mode }),
      ]);
      return () => (
        <div
          data-testid={props.id}
          data-open={context.rootStore.select('open') ? '' : undefined}
          {...getFloatingProps({ ref: refs.setFloating })}
        />
      );
    },
  });

  describe.each([
    { name: 'later-opened', targetIsLater: true, expectedCloses: 0 },
    { name: 'earlier-opened', targetIsLater: false, expectedCloses: 1 },
  ])('$name layer', ({ targetIsLater, expectedCloses }) => {
    it.each([
      {
        name: 'intentional mouse click',
        mode: 'intentional' as const,
        press: async (target: HTMLElement) => {
          await firePointer.down(target, { pointerType: 'mouse', timeStamp: 1 });
          await fireEvent.mouseDown(target);
          await firePointer.up(target, { pointerType: 'mouse', timeStamp: 2 });
          await fireEvent.mouseUp(target);
          await fireEvent.click(target, { detail: 1 });
        },
      },
      {
        name: 'sloppy pointerdown',
        mode: 'sloppy' as const,
        press: async (target: HTMLElement) => {
          await firePointer.down(target, { pointerType: 'mouse', timeStamp: 1 });
        },
      },
      {
        name: 'sloppy mousedown',
        mode: 'sloppy' as const,
        press: async (target: HTMLElement) => {
          await fireEvent.mouseDown(target);
        },
      },
      {
        name: 'sloppy touchend',
        mode: 'sloppy' as const,
        press: async (target: HTMLElement) => {
          const touch = { clientX: 0, clientY: 0 };
          await fireTouch.start(target, { touches: [touch], changedTouches: [touch] });
          const moved = { clientX: 6, clientY: 0 };
          await fireTouch.move(target, { touches: [moved], changedTouches: [moved] });
          await fireTouch.end(target, { touches: [], changedTouches: [moved] });
        },
      },
      {
        name: 'sloppy touchmove',
        mode: 'sloppy' as const,
        press: async (target: HTMLElement) => {
          const touch = { clientX: 0, clientY: 0 };
          await fireTouch.start(target, { touches: [touch], changedTouches: [touch] });
          const moved = { clientX: 12, clientY: 0 };
          await fireTouch.move(target, { touches: [moved], changedTouches: [moved] });
        },
      },
    ])('$name respects opening order', async ({ mode, press }) => {
      const onOlderOpenChange = vi.fn<OnOpenChange>();
      const onTargetOpenChange = vi.fn<OnOpenChange>();
      const Fixture = defineComponent({
        props: { bothOpen: { type: Boolean, required: true } },
        setup(props) {
          return () => (
            <>
              <Layer
                id="older"
                open={props.bothOpen || targetIsLater}
                mode={mode}
                onOpenChange={onOlderOpenChange}
              />
              <Layer
                id="target"
                open={props.bothOpen || !targetIsLater}
                mode={mode}
                onOpenChange={onTargetOpenChange}
              />
            </>
          );
        },
      });
      const { setProps } = await renderLayers(<Fixture bothOpen={false} />);
      await setProps({ bothOpen: true });
      expect(screen.getByTestId('older')).toHaveAttribute('data-open');
      expect(screen.getByTestId('target')).toHaveAttribute('data-open');
      expect(onOlderOpenChange).not.toHaveBeenCalled();
      expect(onTargetOpenChange).not.toHaveBeenCalled();
      await press(screen.getByTestId('target'));
      expect(onOlderOpenChange).toHaveBeenCalledTimes(expectedCloses);
      expect(
        onOlderOpenChange.mock.calls.map(([open, details]) => ({ open, reason: details.reason })),
      ).toEqual(expectedCloses ? [{ open: false, reason: REASONS.outsidePress }] : []);
      expect(onTargetOpenChange).not.toHaveBeenCalled();
    });
  });
});
