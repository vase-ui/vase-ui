import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, inject, KeepAlive, nextTick, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  fireTouch,
  flushMicrotasks,
  screen,
  useTestInteractions,
  wait,
  waitFor,
} from '#test-utils';
import type { VaseUIRenderResult } from '#test-utils';
import { PopupFixtureContext } from '../../../../test/fixtures/PopupFixture';
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import { useFloating } from '../../../../test/floating-ui-tests/useFloating';
import { ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { mergeProps } from '../../../merge-props/mergeProps';
import { createAttribute } from '../createAttribute';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import FloatingFocusManager from '../focus/FloatingFocusManager.vue';
import FloatingPortal from '../portal/FloatingPortal.vue';
import FloatingPortalLite from '../portal/FloatingPortalLite.vue';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import { useClick } from './useClick';
import { normalizeProp, useDismiss } from './useDismiss';
import type { UseDismissProps } from './useDismiss';
import { useFocus } from './useFocus';

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

/** Counts the listeners of `useDismiss` that `doc` holds. */
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
 * `portalContainer` renders it in a portal in that element.
 */
const Popup = defineComponent({
  props: {
    name: { type: String, required: true },
    defaultOpen: { type: Boolean, default: true },
    teleport: { type: Boolean, default: false },
    portalContainer: { type: Object as PropType<HTMLElement>, default: undefined },
    node: { type: Boolean, default: false },
    dismiss: { type: Object as PropType<UseDismissProps>, default: () => ({}) },
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
    const dismiss = useDismiss(context.rootStore, props.dismiss);

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
            <FloatingPortalLite container={props.portalContainer}>{popup}</FloatingPortalLite>
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

function isOpen(name: string) {
  return screen.queryByTestId(name) !== null;
}

// The pointer of the browser stays where a case leaves it, for each later test.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
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

const App = defineComponent({
  props: {
    escapeKey: { type: Boolean, default: undefined },
    referencePress: { type: Function as PropType<() => boolean>, default: undefined },
    outsidePress: {
      type: [Boolean, Function] as PropType<UseDismissProps['outsidePress']>,
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
      useDismiss(context.rootStore, {
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
            useDismiss(context.rootStore),
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
            useDismiss(context.rootStore),
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
            useDismiss(context.rootStore),
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
              useDismiss(context.rootStore),
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
            useDismiss(props.context.rootStore, {
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

          const dismiss = useDismiss(context.rootStore);
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

          const dismiss = useDismiss(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {isOpen.value && (
                <FloatingPortal container={props.shadowRoot}>
                  <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                </FloatingPortal>
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

          const dismiss = useDismiss(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <>
              <button {...getReferenceProps({ ref: refs.setReference })} />
              {isOpen.value && (
                <FloatingPortal container={props.shadowRoot}>
                  <FloatingFocusManager store={context.rootStore}>
                    <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })} />
                  </FloatingFocusManager>
                </FloatingPortal>
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

          const dismiss = useDismiss(context.rootStore);

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
        type: [Boolean, Object] as PropType<UseDismissProps['bubbles']>,
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
          useDismiss(context.rootStore, props),
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
              useDismiss(popover.context.rootStore),
            ]);
            const tooltipFocus = useFocus(tooltip.context.rootStore);
            const tooltipInteractions = useTestInteractions([
              useDismiss(tooltip.context.rootStore),
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
              useDismiss(context.rootStore, props),
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
          useDismiss(context.rootStore),
        ]);

        return () => (
          <>
            <button {...getReferenceProps({ ref: refs.setReference })} />
            {open.value && (
              <FloatingPortal>
                <FloatingFocusManager store={context.rootStore}>
                  <div {...getFloatingProps({ ref: refs.setFloating })}>
                    <span>{props.id}</span>
                    {slots.default?.()}
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
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
      // after useDismiss has seen it but before it reaches its target.
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
            useDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
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
            useDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
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
            useDismiss(floating.context.rootStore, { outsidePressEvent: 'intentional' }),
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
            useDismiss(floating.context.rootStore, { outsidePressEvent: 'intentional' }),
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
            useDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
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
            useDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
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

      await fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await flushMicrotasks();

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
            useDismiss(context.rootStore, { outsidePressEvent: 'intentional' }),
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
      await fireEvent.pointerCancel(document.body, { pointerType: 'mouse' });

      await fireEvent.click(document.body);
      expect(screen.getByRole('tooltip')).toBeInTheDocument();

      await new Promise((resolve) => {
        setTimeout(resolve, 0);
      });
      await flushMicrotasks();

      await fireEvent.click(document.body);
      expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
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
        const dismiss = useDismiss(context.rootStore);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

        return () => (
          <>
            <button ref={refs.setReference} {...getReferenceProps()}>
              {props.triggerText}
            </button>
            {open.value && (
              <FloatingPortal container={props.portalContainer}>
                <FloatingFocusManager store={context.rootStore} modal={false}>
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    {slots.default?.()}
                  </div>
                </FloatingFocusManager>
              </FloatingPortal>
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

    await user.click(screen.getByText('open 1'));
    expect(screen.getByText('open 2')).toBeInTheDocument();

    // Vue skips the later listeners of an event that comes in the millisecond when Vue attached
    // them. The first click mounts the button of the second click.
    await wait(1);
    await user.click(screen.getByText('open 2'));
    await flushMicrotasks();

    expect(screen.getByText('open 1')).toBeInTheDocument();
    expect(screen.getByText('open 2')).toBeInTheDocument();
    expect(screen.getByText('nested')).toBeInTheDocument();
  });

  describe('document listeners', () => {
    it('has none while the popup is closed, 13 while it is open, and none after a close or an unmount', async () => {
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
        open: 13,
        afterClose: 0,
        afterUnmount: 0,
      });
    });

    it.each([
      { name: 'no Escape listener', dismiss: { escapeKey: false }, listeners: 10 },
      { name: 'no outside press listener', dismiss: { outsidePress: false }, listeners: 3 },
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
      expect(count()).toBe(13);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(false);
    });

    it('adds the Escape listeners when `escapeKey` becomes true', async () => {
      const count = countListeners();
      const escapeKey = shallowRef(false);
      await render(<Popup name="popup" dismiss={{ escapeKey }} />);
      expect(count()).toBe(10);

      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(isOpen('popup')).toBe(true);

      escapeKey.value = true;
      await nextTick();
      expect(count()).toBe(13);

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
        active: 13,
        deactivated: 0,
        activated: 13,
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

      expect({ main: count(), frame: countInFrame() }).toEqual({ main: 0, frame: 13 });

      await fireEvent.pointerDown(frameDocument.body, mouse);
      expect(frameDocument.querySelector('[data-testid="popup"]')).toBe(null);
    });

    it('has none in a frame document while the popup is closed, 10 while it is open, and none after a close or an unmount', async () => {
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

      // Nine press listeners, and the `load` listener for a frame in the frame.
      expect({ closed, open, afterClose, afterUnmount: countInFrame() }).toEqual({
        closed: 0,
        open: 10,
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
    /** The popup of the fixture family, with the props of `useDismiss` on its element. */
    const DismissedPopupPart = defineComponent({
      setup() {
        const { floating } = useDismiss(inject(PopupFixtureContext)!);
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
      releasePointerAfterTest();
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
  });

  describe('popups below the popup in the component tree', () => {
    it('VUE-4: a press in a child popup that Teleport moved does not close the parent popup', async () => {
      releasePointerAfterTest();
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

    it('writes no marker to the frozen store of a popup that is above and never opens', async () => {
      const Above = defineComponent({
        setup(_, { slots }) {
          useDismiss(getEmptyRootStore());
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
      const copy: typeof import('./useDismiss') = await import('./useDismiss?copy' as string);
      expect(copy.useDismiss).not.toBe(useDismiss);

      function createLayer(dismiss: typeof useDismiss, name: string) {
        return defineComponent({
          setup() {
            const open = shallowRef(false);
            const { refs, context } = useFloating({
              open,
              onOpenChange(nextOpen) {
                open.value = nextOpen;
              },
            });
            const { floating } = dismiss(context.rootStore);
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
      const First = createLayer(useDismiss, 'first');
      const Second = createLayer(copy.useDismiss, 'second');
      const Third = createLayer(useDismiss, 'third');
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
      for (let press = 0; press < names.length; press += 1) {
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
      releasePointerAfterTest();
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
  });

  describe('frames', () => {
    it.each([
      { mode: 'sloppy', eventType: 'pointerdown' },
      { mode: 'intentional', eventType: 'click' },
    ] as const)(
      'BUG-5410: a press in a same-origin iframe closes the popup in the $mode form',
      async ({ mode, eventType }) => {
        releasePointerAfterTest();
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
      releasePointerAfterTest();
      await render(<Popup name="popup" />);
      const { frame, loaded } = addFrame();
      await loaded;

      await pressInFrame(frame);

      expect(isOpen('popup')).toBe(false);
    });

    it('BUG-5410: a press in an iframe in an iframe closes the popup', async () => {
      releasePointerAfterTest();
      const outer = addFrame();
      await outer.loaded;
      await render(<Popup name="popup" />);
      // The inner frame loads in the outer frame, which is not the document of the popup.
      const inner = addFrame({ parent: outer.frame.contentDocument!.body, top: 0 });
      await inner.loaded;

      await pressInFrame(outer.frame, { x: 40, y: 20 });

      expect(isOpen('popup')).toBe(false);
    });

    it('keeps the popup open for a press in an iframe in the popup', async () => {
      releasePointerAfterTest();
      await render(<Popup name="popup" />);
      const { frame, loaded } = addFrame({ parent: screen.getByTestId('popup') });
      frame.style.position = 'static';
      await loaded;

      await pressInFrame(frame);

      expect(isOpen('popup')).toBe(true);
    });

    it('keeps the popup open for a press in an iframe in an iframe in the popup', async () => {
      releasePointerAfterTest();
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
        releasePointerAfterTest();
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
      releasePointerAfterTest();
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
        whileThere: 10,
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
      releasePointerAfterTest();
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
      releasePointerAfterTest();
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
});
