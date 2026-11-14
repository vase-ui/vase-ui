import testingLibraryUserEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import {
  createApp,
  defineComponent,
  KeepAlive,
  nextTick,
  onBeforeUnmount,
  onMounted,
  shallowRef,
  Teleport,
  watch,
} from 'vue';
import type { PropType, ShallowRef } from 'vue';
import {
  cloneElement,
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  useTestInteractions,
  waitFor,
  within,
} from '#test-utils';
import { Main as Navigation } from '../../../../test/fixtures/Navigation';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { platform } from '../../../common/platform';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { useClick } from '../interactions/useClick';
import { useDismiss } from '../interactions/useDismiss';
import { useHoverPopupInteraction } from '../interactions/useHoverPopupInteraction';
import { useHoverTriggerInteraction } from '../interactions/useHoverTriggerInteraction';
import { usePortalContext } from '../portal/FloatingPortalContext';
import type { PortalContextValue } from '../portal/FloatingPortalContext';
import FloatingPortal from '../portal/FloatingPortal.vue';
import {
  provideFloatingNode,
  provideFloatingTree,
  useFloatingNodeId,
  useFloatingParentNodeId,
} from '../tree/FloatingTree';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { PopupPositioningContext } from '../types';
import FloatingFocusManager from './FloatingFocusManager.vue';
import type { FloatingFocusManagerProps, FocusOption } from './FloatingFocusManager.vue';
import FocusGuard from './FocusGuard.vue';

// A module namespace is read-only. The mock gives `engine` as a plain object, so a case can set the
// flag.
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

// The pointer of the browser stays where a case leaves it, for each later test.
function releasePointerAfterTest() {
  onTestFinished(async () => {
    await userEvent.pointer({ coords: { x: 0, y: 0 }, keys: '[/MouseLeft]' });
  });
}

type ManagerProps = Partial<Omit<FloatingFocusManagerProps, 'store'>>;
type PopupStore = ReturnType<typeof useFloatingRootStore>;

// A popup with a reference field. The reference opens the popup for a click, and for a
// `mousedown` as a trigger of a popup part does. With `keepMounted`, the popup element stays and
// the focus manager is disabled while the popup is closed. The default content has a button that
// closes the popup, and the slot of the content gets the same function as `close`. `name` is the
// prefix of each test id, so that a popup can hold another popup.
const Popup = defineComponent({
  props: {
    manager: { type: Object as PropType<ManagerProps>, default: () => ({}) },
    name: { type: String, default: '' },
    portal: Boolean,
    // The container of the portal.
    container: { type: Object as PropType<HTMLElement>, default: undefined },
    keepMounted: Boolean,
    role: { type: String, default: undefined },
    popupTabindex: { type: String, default: undefined },
    referenceRole: { type: String, default: undefined },
    // The reference is not in the document.
    referenceRemoved: Boolean,
    // The reference has the attribute `hidden`.
    referenceHidden: Boolean,
    // The reference comes after the popup, so Vue removes the popup first.
    referenceAfter: Boolean,
    // The popup stays open when it should close for one of these reasons.
    keepOpenFor: { type: Array as PropType<string[]>, default: () => [] },
    onOpenChange: {
      type: Function as PropType<(open: boolean, reason: string) => void>,
      default: undefined,
    },
    onStore: { type: Function as PropType<(store: PopupStore) => void>, default: undefined },
  },
  setup(props, { slots }) {
    const open = shallowRef(false);
    const reference = shallowRef<HTMLElement | null>(null);
    const floating = shallowRef<HTMLElement | null>(null);
    const testId = (id: string) => `${props.name}${id}`;
    const store = useFloatingRootStore({
      open,
      onOpenChange(nextOpen, eventDetails) {
        props.onOpenChange?.(nextOpen, eventDetails.reason);
        if (nextOpen || !props.keepOpenFor.includes(eventDetails.reason)) {
          open.value = nextOpen;
        }
      },
      elements: { anchor: reference, positionerElement: floating },
    });
    props.onStore?.(store);

    function close(event?: MouseEvent) {
      store.setOpen(false, createChangeEventDetails(REASONS.closePress, event));
    }

    return () => {
      const content =
        open.value || props.keepMounted ? (
          <FloatingFocusManager
            store={store}
            {...props.manager}
            disabled={props.keepMounted ? !open.value : props.manager.disabled}
          >
            <div
              role={props.role}
              tabindex={props.popupTabindex}
              data-testid={testId('floating')}
              ref={(el) => {
                floating.value = el as HTMLElement | null;
              }}
            >
              {slots.default?.({ close }) ?? [
                <input data-testid={testId('one')} />,
                <input data-testid={testId('two')} />,
                <button data-testid={testId('close')} onClick={close} />,
              ]}
            </div>
          </FloatingFocusManager>
        ) : null;
      const popup = props.portal ? (
        <FloatingPortal container={props.container}>{content}</FloatingPortal>
      ) : (
        content
      );
      const referenceElement = props.referenceRemoved ? null : (
        <input
          data-testid={testId('reference')}
          role={props.referenceRole}
          hidden={props.referenceHidden ? true : undefined}
          ref={(el) => {
            reference.value = el as HTMLElement | null;
          }}
          onClick={() => {
            open.value = !open.value;
          }}
          onMousedown={(event: MouseEvent) => {
            store.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));
          }}
        />
      );

      return <>{props.referenceAfter ? [popup, referenceElement] : [referenceElement, popup]}</>;
    };
  },
});

async function openPopup(root: ParentNode = document, name = '') {
  const reference = root.querySelector<HTMLElement>(`[data-testid="${name}reference"]`)!;
  reference.focus();
  await fireEvent.click(reference);
  await flushMicrotasks();
}

function nextFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
}

// Holds the animation frames until the test runs them, so that a case controls when the focus
// manager moves the focus.
function holdAnimationFrames() {
  const frames: FrameRequestCallback[] = [];
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
    frames.push(callback);
    return frames.length;
  });
  return () => frames.splice(0).forEach((callback) => callback(0));
}

function getInsideGuards(root: ParentNode = document) {
  return Array.from(root.querySelectorAll<HTMLElement>('[data-type="inside"]'));
}

type TargetRef = ShallowRef<HTMLElement | null>;

// Gives a case the store of a popup, and a close that no event of the user causes.
function captureStore() {
  let store: PopupStore | undefined;
  return {
    onStore(value: PopupStore) {
      store = value;
    },
    get store() {
      return store!;
    },
    close() {
      store!.setOpen(false, createChangeEventDetails(REASONS.imperativeAction));
    },
  };
}

// `toHaveFocus` reads only the document of the element. This helper also asks each frame element
// above it, so it tells whether an element in a frame has the focus of the page.
function isFocused(element: Element): boolean {
  let doc = element.ownerDocument;
  let current: Element = element;

  while (doc) {
    if (doc.activeElement !== current) {
      return false;
    }

    // Move up to the parent document
    const frame = doc.defaultView?.frameElement; // the <iframe> hosting this doc
    if (!frame) {
      return true;
    }

    current = frame;
    doc = frame.ownerDocument;
  }

  return true;
}

// The Base UI cases run each animation frame at once.
function runFramesAtOnce() {
  vi.spyOn(window, 'requestAnimationFrame').mockImplementation(
    (callback: FrameRequestCallback): number => {
      callback(0);
      return 0;
    },
  );
}

// Vue stamps an event with `Date.now()` in the first listener that gets it. It skips each later
// listener that was attached in that millisecond or after it. The portal of a popup that is not
// modal and the popup element of `useDismiss` have capture listeners. A case that presses a key or
// clicks in the popup in the millisecond of the open thus waits for a later millisecond first, as
// the renderer does after a mount.
async function waitForLaterMillisecond() {
  const start = Date.now();
  while (Date.now() === start) {
    await Promise.resolve();
  }
}

function setOpenOf(open: ShallowRef<boolean>) {
  return (value: boolean) => {
    open.value = value;
  };
}

const App = defineComponent({
  props: {
    initialFocus: { type: [String, Boolean] as PropType<'two' | boolean>, default: undefined },
    returnFocus: { type: [Boolean, Object, Function] as PropType<FocusOption>, default: undefined },
    modal: { type: Boolean, default: undefined },
    closeOnFocusOut: { type: Boolean, default: undefined },
  },
  setup(props, { slots }) {
    const ref = shallowRef<HTMLButtonElement | null>(null);
    const open = shallowRef(false);
    const { refs, context } = useFloating({
      open,
      onOpenChange: setOpenOf(open),
    });

    return () => (
      <>
        <button
          data-testid="reference"
          ref={refs.setReference}
          onClick={() => {
            open.value = !open.value;
          }}
        />
        {open.value && (
          <FloatingFocusManager
            {...props}
            initialFocus={props.initialFocus === 'two' ? ref : props.initialFocus}
            store={context.rootStore}
          >
            <div role="dialog" ref={refs.setFloating} data-testid="floating">
              <button data-testid="one">close</button>
              <button data-testid="two" ref={ref}>
                confirm
              </button>
              <button
                data-testid="three"
                onClick={() => {
                  open.value = false;
                }}
              >
                x
              </button>
              {slots.default?.()}
            </div>
          </FloatingFocusManager>
        )}
        <div tabindex={0} data-testid="last">
          outside
        </div>
      </>
    );
  },
});

const RadioApp = defineComponent({
  setup() {
    const open = shallowRef(false);
    const { refs, context } = useFloating({
      open,
      onOpenChange: setOpenOf(open),
    });

    return () => (
      <>
        <button
          data-testid="reference"
          ref={refs.setReference}
          onClick={() => {
            open.value = !open.value;
          }}
        />
        {open.value && (
          <FloatingFocusManager store={context.rootStore}>
            <div role="dialog" ref={refs.setFloating}>
              <input type="radio" name="group" data-testid="radio-one" />
              <input type="radio" name="group" checked data-testid="radio-two" />
              <button data-testid="after-radio">after</button>
            </div>
          </FloatingFocusManager>
        )}
      </>
    );
  },
});

const MouseDownApp = defineComponent({
  setup() {
    const open = shallowRef(false);
    const { refs, context } = useFloating({
      open,
      onOpenChange: setOpenOf(open),
    });
    const { getReferenceProps, getFloatingProps } = useTestInteractions([
      useClick(context.rootStore, { event: 'mousedown' }),
    ]);

    return () => (
      <>
        <button data-testid="reference" {...getReferenceProps({ ref: refs.setReference })} />
        {open.value && (
          <FloatingFocusManager store={context.rootStore}>
            <div role="dialog" {...getFloatingProps({ ref: refs.setFloating })}>
              <button data-testid="one">close</button>
            </div>
          </FloatingFocusManager>
        )}
      </>
    );
  },
});

// The `FloatingTree` part of Base UI: it gives a tree to the parts below it.
const FloatingTree = defineComponent({
  setup(_, { slots }) {
    provideFloatingTree();
    return () => slots.default?.();
  },
});

// The `Dialog` of the Base UI cases, and the `Dialog` of the case `mixed modality and nesting`. The
// default slot gets `close`. The `reference` slot gives the reference. The `side` slot renders after
// the portal. With `open`, the open state is controlled.
const Dialog = defineComponent({
  props: {
    open: { type: Boolean, default: undefined },
    modal: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const internalOpen = shallowRef(false);
    const nodeId = useFloatingNodeId();
    const open = () => props.open ?? internalOpen.value;

    const { refs, context } = useFloating({
      open,
      onOpenChange: setOpenOf(internalOpen),
      nodeId,
    });

    const { getReferenceProps, getFloatingProps } = useTestInteractions([
      useClick(context.rootStore),
      useDismiss(context.rootStore, { bubbles: false }),
    ]);

    provideFloatingNode(nodeId);

    return () => {
      const children = slots.reference?.()[0];
      return (
        <>
          {children &&
            cloneElement(
              children,
              getReferenceProps({ ref: refs.setReference, ...children.props }),
            )}
          <FloatingPortal>
            {open() && (
              <FloatingFocusManager store={context.rootStore} modal={props.modal}>
                <div {...getFloatingProps({ ref: refs.setFloating })}>
                  {slots.default?.({
                    close: () => {
                      internalOpen.value = false;
                    },
                  })}
                </div>
              </FloatingFocusManager>
            )}
          </FloatingPortal>
          {slots.side?.()}
        </>
      );
    };
  },
});

const NestedDialog = defineComponent({
  props: {
    open: { type: Boolean, default: undefined },
    modal: { type: Boolean, default: true },
  },
  setup(props, { slots }) {
    const parentId = useFloatingParentNodeId();

    return () => {
      if (parentId.value == null) {
        return (
          <FloatingTree>
            <Dialog open={props.open} modal={props.modal} v-slots={slots} />
          </FloatingTree>
        );
      }

      return <Dialog open={props.open} modal={props.modal} v-slots={slots} />;
    };
  },
});

// Vue has no `autoFocus`, and a browser does not apply the `autofocus` attribute to each element
// that a script inserts. This field takes the focus when it is mounted.
const AutoFocusInput = defineComponent({
  setup() {
    const input = shallowRef<HTMLInputElement | null>(null);
    onMounted(() => input.value?.focus());
    return () => <input ref={input} />;
  },
});

// The `App` of the Base UI cases of an outside press and of `focusVisible`.
const ClickDismissApp = defineComponent({
  setup() {
    const isOpen = shallowRef(false);

    const { refs, context } = useFloating({
      open: isOpen,
      onOpenChange: setOpenOf(isOpen),
    });

    const click = useClick(context.rootStore);
    const dismiss = useDismiss(context.rootStore);

    const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

    return () => (
      <>
        <button ref={refs.setReference} {...getReferenceProps()}>
          reference
        </button>
        {isOpen.value && (
          <FloatingFocusManager store={context.rootStore}>
            <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
          </FloatingFocusManager>
        )}
      </>
    );
  },
});

// The `App` of the Base UI cases of a reference that is removed with the popup.
const RemovedReferenceApp = defineComponent({
  props: { modal: { type: Boolean, default: true } },
  setup(props) {
    const isOpen = shallowRef(false);
    const removed = shallowRef(false);

    const { refs, context } = useFloating({
      open: isOpen,
      onOpenChange: setOpenOf(isOpen),
    });

    const click = useClick(context.rootStore);

    const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

    return () => (
      <>
        {!removed.value && (
          <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
        )}
        {isOpen.value && (
          <FloatingPortal>
            <FloatingFocusManager store={context.rootStore} modal={props.modal}>
              <div ref={refs.setFloating} {...getFloatingProps()}>
                <button
                  data-testid="remove"
                  onClick={() => {
                    removed.value = true;
                    isOpen.value = false;
                  }}
                >
                  remove
                </button>
              </div>
            </FloatingFocusManager>
          </FloatingPortal>
        )}
        <button data-testid="fallback" />
      </>
    );
  },
});

describe('FloatingFocusManager', () => {
  const { render } = createRenderer();

  describe('initial focus', () => {
    it('focuses the popup with no scroll when the popup has no tabbable element', async () => {
      const runFrames = holdAnimationFrames();
      await render(<Popup role="dialog">{{ default: () => <span>text</span> }}</Popup>);
      await openPopup();
      const floating = screen.getByTestId('floating');
      const focus = vi.spyOn(floating, 'focus');

      runFrames();

      expect(floating).toHaveFocus();
      expect(focus).toHaveBeenCalledWith({ preventScroll: true });
    });

    const target = shallowRef<HTMLElement | null>(null);
    const guard = shallowRef<InstanceType<typeof FocusGuard> | null>(null);

    it.each<{
      name: string;
      initialFocus: ManagerProps['initialFocus'] | 'element' | 'component';
      focused: string;
    }>([
      { name: 'a ref of an element', initialFocus: target, focused: 'two' },
      { name: 'a ref of a component', initialFocus: guard, focused: 'exposed' },
      { name: 'an element', initialFocus: 'element', focused: 'two' },
      { name: 'a component', initialFocus: 'component', focused: 'exposed' },
      {
        name: 'a function that returns an element',
        initialFocus: () => target.value,
        focused: 'two',
      },
      { name: 'a function that returns true', initialFocus: () => true, focused: 'one' },
      { name: 'a function that returns null', initialFocus: () => null, focused: 'one' },
      { name: 'an empty ref', initialFocus: shallowRef(null), focused: 'one' },
      { name: 'a ref with no value', initialFocus: shallowRef(), focused: 'one' },
      { name: 'false', initialFocus: false, focused: 'reference' },
      {
        name: 'a function that returns nothing',
        initialFocus: () => undefined,
        focused: 'reference',
      },
    ])('takes initialFocus as $name', async ({ initialFocus, focused }) => {
      // A template gives the value of a ref, so the prop is first `null` and then the element or
      // the component.
      const getInitialFocus = () => {
        if (initialFocus === 'element') {
          return target.value;
        }
        return initialFocus === 'component' ? guard.value : initialFocus;
      };
      await render(() => (
        <Popup manager={{ initialFocus: getInitialFocus(), modal: false }}>
          {{
            default: () => [
              <input data-testid="one" />,
              <input
                data-testid="two"
                ref={(el) => {
                  target.value = el as HTMLElement | null;
                }}
              />,
              <FocusGuard
                data-testid="exposed"
                ref={(instance) => {
                  guard.value = instance as InstanceType<typeof FocusGuard> | null;
                }}
              />,
            ],
          }}
        </Popup>
      ));

      await openPopup();
      await nextFrame();
      await nextFrame();

      expect(screen.getByTestId(focused)).toHaveFocus();
    });

    it('gives the open interaction type to an initialFocus function', async () => {
      const initialFocus = vi.fn(() => true);
      await render(<Popup manager={{ initialFocus, openInteractionType: 'touch' }} />);

      await openPopup();

      expect(initialFocus).toHaveBeenCalledWith('touch');
    });

    it('moves no focus when the popup closes before the frame', async () => {
      const runFrames = holdAnimationFrames();
      await render(<Popup keepMounted />);
      await openPopup();

      await fireEvent.click(screen.getByTestId('reference'));
      runFrames();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });
  });

  describe('modal popup', () => {
    it('keeps the Tab key in the popup', async () => {
      await render(
        <div>
          <input data-testid="before" />
          <Popup>
            {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
          </Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await userEvent.tab();
      expect(screen.getByTestId('two')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('two')).toHaveFocus();
    });

    it('keeps the focus on a popup that has no tabbable element', async () => {
      await render(
        <div>
          <Popup role="dialog">{{ default: () => <span>text</span> }}</Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      const floating = screen.getByTestId('floating');
      await waitFor(() => expect(floating).toHaveFocus());

      await userEvent.tab();
      expect(floating).toHaveFocus();
      await userEvent.tab({ shift: true });
      expect(floating).toHaveFocus();
    });

    it.each<{ name: string; props: Record<string, unknown>; guards: number }>([
      { name: 'a modal popup', props: {}, guards: 2 },
      {
        name: 'a non-modal popup with no portal',
        props: { manager: { modal: false } },
        guards: 0,
      },
      {
        name: 'a non-modal popup in a portal',
        props: { manager: { modal: false }, portal: true },
        guards: 2,
      },
      { name: 'a disabled focus manager', props: { manager: { disabled: true } }, guards: 0 },
      {
        name: 'a combobox field with no initial focus',
        props: { manager: { initialFocus: false }, referenceRole: 'combobox' },
        guards: 0,
      },
    ])('renders $guards guards for $name', async ({ props, guards }) => {
      await render(<Popup {...props} />);

      await openPopup();

      expect(getInsideGuards()).toHaveLength(guards);
    });
  });

  describe('popup that is not modal, in a portal', () => {
    async function renderPortalPopup(manager: ManagerProps = {}) {
      const handleOpenChange = vi.fn();
      await render(
        <div>
          <input data-testid="before" />
          <Popup portal manager={{ modal: false, ...manager }} onOpenChange={handleOpenChange}>
            {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
          </Popup>
          <input data-testid="after" />
        </div>,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      return handleOpenChange;
    }

    it('sends Shift+Tab from the first field to the reference, and Tab back into the popup', async () => {
      const handleOpenChange = await renderPortalPopup();

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('one')).toHaveFocus();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it('sends Tab from the last field to the field after the reference, and closes the popup', async () => {
      const handleOpenChange = await renderPortalPopup();
      screen.getByTestId('two').focus();

      await userEvent.tab();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
    });

    it('sends the focus to previousFocusableElement and to nextFocusableElement', async () => {
      const previous = shallowRef<HTMLElement | null>(null);
      const next = shallowRef<HTMLElement | null>(null);
      await render(() => (
        <div>
          <input data-testid="previous" ref={previous} />
          <input data-testid="next" ref={next} />
          <Popup
            portal
            manager={{
              modal: false,
              previousFocusableElement: previous,
              nextFocusableElement: () => next.value,
            }}
          >
            {{ default: () => <input data-testid="one" /> }}
          </Popup>
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await userEvent.tab({ shift: true });
      expect(screen.getByTestId('previous')).toHaveFocus();

      screen.getByTestId('one').focus();
      await userEvent.tab();
      expect(screen.getByTestId('next')).toHaveFocus();
    });

    describe('VUE-33: a ref or a getter that gives no element', () => {
      it('sends Shift+Tab to the guard of the portal for previousFocusableElement', async () => {
        const handleOpenChange = await renderPortalPopup({
          previousFocusableElement: shallowRef(),
        });

        await userEvent.tab({ shift: true });

        expect(screen.getByTestId('reference')).toHaveFocus();
        expect(handleOpenChange).not.toHaveBeenCalled();
      });

      it('sends Tab to the guard of the portal for nextFocusableElement', async () => {
        const handleOpenChange = await renderPortalPopup({ nextFocusableElement: () => null });
        screen.getByTestId('two').focus();

        await userEvent.tab();

        expect(screen.getByTestId('after')).toHaveFocus();
        expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
      });
    });

    it('writes the first guard to beforeContentFocusGuardRef, and clears it at the unmount', async () => {
      const guardRef: ShallowRef<HTMLSpanElement | null> = shallowRef(null);
      await renderPortalPopup({ beforeContentFocusGuardRef: guardRef });

      expect(guardRef.value).toBe(getInsideGuards()[0]);

      await fireEvent.click(screen.getByTestId('reference'));
      expect(guardRef.value).toBe(null);
    });
  });

  describe('two focus managers in one portal', () => {
    it('keeps the guards of a focus manager that mounted later when an earlier one unmounts', async () => {
      let portalContext: PortalContextValue | undefined;
      const Probe = defineComponent({
        setup() {
          portalContext = usePortalContext();
          return () => null;
        },
      });
      const guardRef: ShallowRef<HTMLSpanElement | null> = shallowRef(null);
      const Manager = defineComponent({
        setup() {
          const store = useFloatingRootStore({ open: true });
          return () => (
            <FloatingFocusManager store={store} modal={false} beforeContentFocusGuardRef={guardRef}>
              <input />
            </FloatingFocusManager>
          );
        },
      });
      const hasFirst = shallowRef(true);
      const hasSecond = shallowRef(false);
      await render(() => (
        <FloatingPortal>
          <Probe />
          {hasFirst.value ? <Manager key="first" /> : null}
          {hasSecond.value ? <Manager key="second" /> : null}
        </FloatingPortal>
      ));

      // The second manager writes its guards in an update before the first manager unmounts. When
      // one update replaces the first manager, the first manager clears its refs before the second
      // manager writes them.
      hasSecond.value = true;
      await nextTick();
      const [secondBefore, secondAfter] = getInsideGuards().slice(2);
      expect(guardRef.value).toBe(secondBefore);
      expect(portalContext!.beforeInsideRef.value).toBe(secondBefore);
      expect(portalContext!.afterInsideRef.value).toBe(secondAfter);

      hasFirst.value = false;
      await nextTick();

      expect(getInsideGuards()).toHaveLength(2);
      expect(guardRef.value).toBe(secondBefore);
      expect(portalContext!.beforeInsideRef.value).toBe(secondBefore);
      expect(portalContext!.afterInsideRef.value).toBe(secondAfter);
    });
  });

  describe('tabindex of the popup', () => {
    it.each<{
      name: string;
      props: Record<string, unknown>;
      empty: boolean;
      expected: (string | null)[];
    }>([
      {
        name: 'a dialog with no tabbable element',
        props: { role: 'dialog' },
        empty: true,
        expected: ['0', '0'],
      },
      {
        name: 'a dialog with a tabbable element',
        props: { role: 'dialog' },
        empty: false,
        expected: ['-1', '-1'],
      },
      {
        name: 'a popup with another role',
        props: { role: 'listbox' },
        empty: true,
        expected: [null, null],
      },
      {
        name: 'a dialog with a tabindex of its own',
        props: { role: 'dialog', popupTabindex: '-1' },
        empty: true,
        expected: ['-1', null],
      },
    ])('for $name', async ({ props, empty, expected }) => {
      await render(
        <Popup {...props} manager={{ initialFocus: false }}>
          {{ default: () => (empty ? <span>text</span> : <input />) }}
        </Popup>,
      );

      await openPopup();

      const floating = screen.getByTestId('floating');
      expect([floating.getAttribute('tabindex'), floating.getAttribute('data-tabindex')]).toEqual(
        expected,
      );
    });
  });

  describe('text field of a popup that closes and stays mounted', () => {
    // The return of the focus is off, so that only the blur can take the focus from the field.
    async function closeWithFocusInField() {
      await render(<Popup keepMounted manager={{ returnFocus: false }} />);
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('reference'));
    }

    it('loses the focus when the engine is WebKit', async () => {
      setWebKit(true);
      await closeWithFocusInField();

      expect(screen.getByTestId('one')).not.toHaveFocus();
    });

    it('keeps the focus when the engine is not WebKit', async () => {
      setWebKit(false);
      await closeWithFocusInField();

      expect(screen.getByTestId('one')).toHaveFocus();
    });
  });

  describe('return of the focus', () => {
    type ReturnFocus = ManagerProps['returnFocus'];

    // A field outside the popup is the target of the rows. A click on the close button does not
    // move the focus.
    async function closeWithTarget(returnFocus: (target: TargetRef) => ReturnFocus) {
      const target: TargetRef = shallowRef(null);
      await render(() => (
        <div>
          <input data-testid="target" ref={target} />
          <Popup manager={{ returnFocus: returnFocus(target) }} />
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();
    }

    it('returns the focus to the reference when the popup closes', async () => {
      await render(<Popup />);
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
    });

    it('returns the focus to the reference when a popup that stays mounted closes', async () => {
      await render(<Popup keepMounted />);
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
    });

    it.each<{ name: string; returnFocus: (target: TargetRef) => ReturnFocus }>([
      { name: 'an element', returnFocus: (target) => target.value },
      { name: 'a ref of an element', returnFocus: (target) => target },
      { name: 'a function that gives an element', returnFocus: (target) => () => target.value },
    ])('moves the focus to the target when returnFocus is $name', async ({ returnFocus }) => {
      await closeWithTarget(returnFocus);

      expect(screen.getByTestId('target')).toHaveFocus();
    });

    it.each<{ name: string; markup: string; focused: string }>([
      {
        name: 'is focusable and not tabbable',
        markup: '<div tabindex="-1" data-testid="target"></div>',
        focused: 'target',
      },
      {
        name: 'has a tabbable child',
        markup: '<div data-testid="target"><input data-testid="child" /></div>',
        focused: 'child',
      },
      {
        name: 'is tabbable and has a tabbable child',
        markup: '<button data-testid="target"><input data-testid="child" /></button>',
        focused: 'target',
      },
    ])('moves the focus to $focused when the target $name', async ({ markup, focused }) => {
      const container = document.createElement('div');
      container.innerHTML = markup;
      document.body.append(container);
      onTestFinished(() => container.remove());
      await render(
        <Popup manager={{ returnFocus: () => container.firstElementChild as Element }} />,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId(focused)).toHaveFocus());
    });

    it.each<{ name: string; returnFocus: () => ReturnFocus }>([
      { name: 'true', returnFocus: () => true },
      { name: 'null', returnFocus: () => null },
      { name: 'an empty ref', returnFocus: () => shallowRef(null) },
      { name: 'a function that gives true', returnFocus: () => () => true },
      { name: 'a function that gives null', returnFocus: () => () => null },
    ])('moves the focus to the reference when returnFocus is $name', async ({ returnFocus }) => {
      await closeWithTarget(returnFocus);

      expect(screen.getByTestId('reference')).toHaveFocus();
    });

    it.each<{ name: string; returnFocus: () => ReturnFocus }>([
      { name: 'false', returnFocus: () => false },
      { name: 'a function that gives false', returnFocus: () => () => false },
      { name: 'a function that gives nothing', returnFocus: () => () => undefined },
    ])('moves no focus when returnFocus is $name', async ({ returnFocus }) => {
      await closeWithTarget(returnFocus);

      expect(document.body).toHaveFocus();
    });

    it.each<{ name: string; manager: ManagerProps; focusBefore: boolean; focused: string }>([
      {
        name: 'the open interaction type is empty',
        manager: {},
        focusBefore: true,
        focused: 'reference',
      },
      {
        name: 'the open interaction type is null',
        manager: { openInteractionType: null },
        focusBefore: true,
        focused: 'before',
      },
      {
        name: 'null type, and the body had the focus',
        manager: { openInteractionType: null },
        focusBefore: false,
        focused: 'reference',
      },
    ])('moves the focus to the $focused when $name', async ({ manager, focusBefore, focused }) => {
      await render(
        <div>
          <input data-testid="before" />
          <Popup manager={manager} />
        </div>,
      );
      if (focusBefore) {
        screen.getByTestId('before').focus();
      }
      await fireEvent.click(screen.getByTestId('reference'));
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId(focused)).toHaveFocus());
    });

    // A focus guard moves the focus itself, and a hover popup closes when the pointer leaves it.
    it.each<{
      name: string;
      reason: string;
      event: () => Event;
      trigger?: () => Element;
      focused: string;
    }>([
      {
        name: 'a focus guard closes the popup',
        reason: REASONS.focusOut,
        event: () => new FocusEvent('focusin'),
        trigger() {
          const guard = document.createElement('span');
          guard.setAttribute('data-vase-ui-focus-guard', '');
          return guard;
        },
        focused: 'body',
      },
      {
        name: 'the pointer leaves a hover popup',
        reason: REASONS.triggerHover,
        event: () => new MouseEvent('mouseleave'),
        focused: 'body',
      },
      {
        name: 'the focus leaves to a plain element',
        reason: REASONS.focusOut,
        event: () => new FocusEvent('focusout'),
        trigger: () => document.createElement('span'),
        focused: 'reference',
      },
      {
        name: 'the pointer moves in a hover popup',
        reason: REASONS.triggerHover,
        event: () => new MouseEvent('mousemove'),
        focused: 'reference',
      },
    ])(
      'moves the focus to the $focused when $name',
      async ({ reason, event, trigger, focused }) => {
        const popup = captureStore();
        await render(<Popup onStore={popup.onStore} />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

        popup.store.setOpen(false, createChangeEventDetails(reason, event(), trigger?.()));
        await flushMicrotasks();

        expect(focused === 'body' ? document.body : screen.getByTestId(focused)).toHaveFocus();
      },
    );

    describe('type of the close', () => {
      // The press before the close is the last interaction that the focus manager saw.
      it.each<{
        name: string;
        interact?: () => Promise<unknown>;
        event: () => Event;
        type: InteractionType;
      }>([
        {
          name: 'a key press',
          event: () => new KeyboardEvent('keydown', { key: 'Escape' }),
          type: 'keyboard',
        },
        {
          name: 'a pen click',
          event: () => new PointerEvent('click', { pointerType: 'pen' }),
          type: 'pen',
        },
        {
          name: 'a click of a screen reader',
          event: () => new PointerEvent('click', { pointerType: '', detail: 0 }),
          type: 'keyboard',
        },
        {
          name: 'a click that has no pointer type',
          event: () => new PointerEvent('click', { pointerType: '', detail: 1 }),
          type: 'mouse',
        },
        {
          name: 'a click after a touch press',
          interact: () => fireEvent.pointerDown(document.body, { pointerType: 'touch' }),
          event: () => new PointerEvent('click', { pointerType: '', detail: 1 }),
          type: 'touch',
        },
        {
          name: 'a mouse event that has no detail',
          event: () => new MouseEvent('click', { detail: 0 }),
          type: 'keyboard',
        },
        {
          name: 'a mouse event after a pen press',
          interact: () => fireEvent.pointerDown(document.body, { pointerType: 'pen' }),
          event: () => new MouseEvent('click', { detail: 1 }),
          type: 'pen',
        },
        {
          name: 'a focus event after a touch press',
          interact: () => fireEvent.pointerDown(document.body, { pointerType: 'touch' }),
          event: () => new FocusEvent('focusout'),
          type: 'touch',
        },
        {
          name: 'a mouse event after a key press',
          interact: () => fireEvent.keyDown(document.body, { key: 'a' }),
          event: () => new MouseEvent('click', { detail: 1 }),
          type: 'keyboard',
        },
        {
          name: 'a mouse event after an untyped press',
          interact: () => fireEvent.pointerDown(document.body),
          event: () => new MouseEvent('click', { detail: 1 }),
          type: 'keyboard',
        },
        {
          name: 'a touch event',
          event: () => Object.assign(new Event('touchstart'), { touches: [] }),
          type: 'touch',
        },
        { name: 'a focus event', event: () => new FocusEvent('focusout'), type: 'keyboard' },
        { name: 'an event that has no input type', event: () => new Event('close'), type: '' },
      ])('gives $type to returnFocus after $name', async ({ interact, event, type }) => {
        const returnFocus = vi.fn((_type: InteractionType) => true);
        const popup = captureStore();
        await render(<Popup manager={{ returnFocus }} onStore={popup.onStore} />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        await interact?.();

        popup.store.setOpen(false, createChangeEventDetails(REASONS.none, event()));

        await waitFor(() => expect(returnFocus).toHaveBeenCalledWith(type));
      });

      it('gives keyboard to returnFocus after a key event of a frame', async () => {
        const frame = document.createElement('iframe');
        document.body.append(frame);
        onTestFinished(() => frame.remove());
        const frameDocument = frame.contentDocument!;
        const target = frameDocument.createElement('button');
        frameDocument.body.append(target);
        const frameWindow = frame.contentWindow as Window & typeof globalThis;
        const event = new frameWindow.KeyboardEvent('keydown', { key: 'Escape' });
        target.dispatchEvent(event);
        const returnFocus = vi.fn((_type: InteractionType) => true);
        const popup = captureStore();
        await render(<Popup manager={{ returnFocus }} onStore={popup.onStore} />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

        popup.store.setOpen(false, createChangeEventDetails(REASONS.none, event));

        await waitFor(() => expect(returnFocus).toHaveBeenCalledWith('keyboard'));
      });

      it.each<{
        name: string;
        close: () => Promise<unknown>;
        options: Record<string, boolean>;
      }>([
        {
          name: 'a press of the mouse',
          close: () => {
            releasePointerAfterTest();
            return userEvent.click(screen.getByTestId('close'));
          },
          options: { preventScroll: true },
        },
        {
          name: 'a key press',
          close: async () => {
            screen.getByTestId('close').focus();
            await userEvent.keyboard('{Enter}');
          },
          options: { preventScroll: true, focusVisible: true },
        },
      ])('calls focus on the reference after $name', async ({ close, options }) => {
        await render(<Popup />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        const focus = vi.spyOn(screen.getByTestId('reference'), 'focus');

        await close();

        await waitFor(() => expect(focus).toHaveBeenCalledWith(options));
      });

      it('forgets the press of an earlier open when a popup that stays mounted opens again', async () => {
        const returnFocus = vi.fn((_type: InteractionType) => true);
        const popup = captureStore();
        await render(<Popup keepMounted manager={{ returnFocus }} onStore={popup.onStore} />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        await fireEvent.pointerDown(document.body, { pointerType: 'touch' });
        popup.close();
        await waitFor(() => expect(returnFocus).toHaveBeenCalledTimes(1));

        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        popup.store.setOpen(
          false,
          createChangeEventDetails(REASONS.none, new MouseEvent('click', { detail: 1 })),
        );

        await waitFor(() => expect(returnFocus).toHaveBeenCalledTimes(2));
        expect(returnFocus).toHaveBeenLastCalledWith('mouse');
      });
    });

    describe('focus that moved outside the popup', () => {
      async function closeAfterMovingFocusOutside(manager: ManagerProps) {
        const popup = captureStore();
        await render(
          <div>
            <Popup manager={manager} onStore={popup.onStore} />
            <input data-testid="outside" />
          </div>,
        );
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        screen.getByTestId('outside').focus();

        popup.close();
        await flushMicrotasks();
      }

      it.each<{ name: string; manager: ManagerProps }>([
        { name: 'returnFocus is true', manager: {} },
        {
          name: 'explicitReturnFocus is false',
          manager: { returnFocus: () => true, explicitReturnFocus: false },
        },
      ])('stays where it is when $name', async ({ manager }) => {
        await closeAfterMovingFocusOutside(manager);

        expect(screen.getByTestId('outside')).toHaveFocus();
      });

      it.each<{ name: string; manager: ManagerProps }>([
        { name: 'returnFocus is a function', manager: { returnFocus: () => true } },
        { name: 'explicitReturnFocus is true', manager: { explicitReturnFocus: true } },
      ])('goes to the reference when $name', async ({ manager }) => {
        await closeAfterMovingFocusOutside(manager);

        expect(screen.getByTestId('reference')).toHaveFocus();
      });

      it('uses the latest explicitReturnFocus at the close, and moves no focus while the popup is open', async () => {
        const explicit = shallowRef(true);
        const popup = captureStore();
        await render(() => (
          <div>
            <Popup manager={{ explicitReturnFocus: explicit.value }} onStore={popup.onStore} />
            <input data-testid="outside" />
          </div>
        ));
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

        explicit.value = false;
        await flushMicrotasks();
        expect(screen.getByTestId('one')).toHaveFocus();

        screen.getByTestId('outside').focus();
        popup.close();
        await flushMicrotasks();

        expect(screen.getByTestId('outside')).toHaveFocus();
      });

      it('returns the focus when it is in the popup of a node below, in the popup tree', async () => {
        const tree = new FloatingTreeStore();
        const Tree = defineComponent({
          setup(_, { slots }) {
            provideFloatingTree(tree);
            return () => slots.default?.();
          },
        });
        const popup = captureStore();
        await render(() => (
          <Tree>
            <Popup
              onStore={(store) => {
                popup.onStore(store);
                store.context.positioning = {
                  open: true,
                  nodeId: 'parent',
                  elements: { reference: null, floating: null, domReference: null },
                  rootStore: store,
                };
              }}
            />
            <div data-testid="child-popup">
              <input data-testid="child-field" />
            </div>
          </Tree>
        ));
        tree.addNode({
          id: 'child',
          parentId: 'parent',
          context: {
            open: true,
            nodeId: 'child',
            elements: {
              reference: null,
              floating: screen.getByTestId('child-popup'),
              domReference: null,
            },
          } as PopupPositioningContext,
        });
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        screen.getByTestId('child-field').focus();

        popup.close();

        await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
      });
    });

    describe('Tab key that leaves a popup that is not modal', () => {
      async function renderPopup(props: {
        keepOpen?: boolean;
        keepMounted?: boolean;
        manager?: ManagerProps;
      }) {
        const popup = captureStore();
        await render(
          <div>
            <input data-testid="before" />
            <Popup
              portal
              keepMounted={props.keepMounted}
              keepOpenFor={props.keepOpen ? ['focus-out'] : []}
              manager={{ modal: false, ...props.manager }}
              onStore={popup.onStore}
            >
              {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
            </Popup>
            <input data-testid="after" />
          </div>,
        );
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        return popup;
      }

      it('returns no focus after the Tab key closes the popup, also for an explicit target', async () => {
        await renderPopup({ manager: { explicitReturnFocus: true } });
        screen.getByTestId('two').focus();

        await userEvent.tab();
        await flushMicrotasks();

        expect(screen.getByTestId('after')).toHaveFocus();
      });

      it('returns the focus when the popup that the Tab key closed closes again', async () => {
        const popup = await renderPopup({ keepMounted: true });
        screen.getByTestId('two').focus();
        await userEvent.tab();
        await flushMicrotasks();
        expect(screen.getByTestId('after')).toHaveFocus();

        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        popup.close();

        await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
      });

      it('returns the focus when the popup closes after the Tab key came back in through the first guard', async () => {
        const popup = await renderPopup({ keepOpen: true });
        screen.getByTestId('two').focus();
        await userEvent.tab();
        expect(screen.getByTestId('after')).toHaveFocus();
        screen.getByTestId('reference').focus();
        await userEvent.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        popup.close();

        await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
      });
    });

    it('does not record the body in the list', async () => {
      const removed = shallowRef(false);
      const popup = captureStore();
      await render(() => (
        <div>
          <input data-testid="before" />
          <Popup
            manager={{ openInteractionType: null }}
            referenceRemoved={removed.value}
            onStore={popup.onStore}
          />
        </div>
      ));
      await fireEvent.click(screen.getByTestId('reference'));
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      removed.value = true;
      popup.close();
      await flushMicrotasks();

      expect(document.body).toHaveFocus();
    });

    it('removes its listener from the store when the popup closes', async () => {
      const popup = captureStore();
      await render(<Popup onStore={popup.onStore} />);
      const on = vi.spyOn(popup.store.context.events, 'on');
      const off = vi.spyOn(popup.store.context.events, 'off');
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      expect(on).toHaveBeenCalledWith('openchange', expect.any(Function));

      await fireEvent.click(screen.getByTestId('close'));
      await flushMicrotasks();

      expect(off.mock.calls).toEqual(on.mock.calls);
    });

    // The 20 fields and the reference of the last open are 21 elements, so the list drops `field-0`.
    // Each field but one is hidden. That field gets the focus only when the list kept it.
    it.each<{ name: string; visible: number; focused: string }>([
      { name: 'the 21st is dropped', visible: 0, focused: 'body' },
      { name: 'the 20th is kept', visible: 1, focused: 'field-1' },
    ])('keeps only the newest 20 elements in the list: $name', async ({ visible, focused }) => {
      const removed = shallowRef(false);
      const popup = captureStore();
      await render(() => (
        <div>
          {Array.from({ length: 20 }, (_, index) => (
            <input data-testid={`field-${index}`} />
          ))}
          <Popup referenceRemoved={removed.value} onStore={popup.onStore} />
        </div>
      ));
      // Each open records the field that has the focus.
      for (let index = 0; index < 20; index += 1) {
        screen.getByTestId(`field-${index}`).focus();
        await fireEvent.click(screen.getByTestId('reference'));
        popup.close();
        await flushMicrotasks();
      }
      for (let index = 0; index < 20; index += 1) {
        screen.getByTestId(`field-${index}`).hidden = index !== visible;
      }
      // The body has the focus at the last open, so the focus manager records the reference.
      (document.activeElement as HTMLElement).blur();
      await fireEvent.click(screen.getByTestId('reference'));

      removed.value = true;
      popup.close();
      await flushMicrotasks();

      expect(focused === 'body' ? document.body : screen.getByTestId(focused)).toHaveFocus();
    });

    it('moves no focus when KeepAlive deactivates the popup', async () => {
      const shown = shallowRef(true);
      const Page = defineComponent({
        setup: () => () => (
          <Popup portal role="dialog">
            {{ default: () => <input data-testid="one" /> }}
          </Popup>
        ),
      });
      await render(() => (
        <div>
          <input data-testid="outside" />
          <KeepAlive>{shown.value ? <Page /> : null}</KeepAlive>
        </div>
      ));
      screen.getByTestId('outside').focus();
      await fireEvent.click(screen.getByTestId('reference'));
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      shown.value = false;
      await nextTick();
      await flushMicrotasks();

      expect(document.body).toHaveFocus();
    });
  });

  describe('BUG-6037: the element that takes the focus when a popup closes', () => {
    // A button that closes the popup, and runs `change` in the same update.
    function changeAndClose(change: () => void) {
      return ({ close }: { close: () => void }) => (
        <button
          data-testid="change"
          onClick={() => {
            change();
            close();
          }}
        />
      );
    }

    async function openFrom(before: string) {
      screen.getByTestId(before).focus();
      await fireEvent.click(screen.getByTestId('reference'));
      await waitFor(() => expect(screen.getByTestId('change')).toHaveFocus());
    }

    it('skips a target of returnFocus that is not in the document', async () => {
      await render(<Popup manager={{ returnFocus: document.createElement('input') }} />);
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
    });

    it('skips a reference that is hidden', async () => {
      const hidden = shallowRef(false);
      await render(() => (
        <div>
          <input data-testid="before" />
          <Popup referenceHidden={hidden.value}>
            {{ default: changeAndClose(() => (hidden.value = true)) }}
          </Popup>
        </div>
      ));
      await openFrom('before');

      await fireEvent.click(screen.getByTestId('change'));

      await waitFor(() => expect(screen.getByTestId('before')).toHaveFocus());
    });

    it('keeps the focus that the closing update moved, when the reference is hidden', async () => {
      const Autofocus = defineComponent({
        setup() {
          const field = shallowRef<HTMLElement | null>(null);
          onMounted(() => field.value?.focus());
          return () => <input data-testid="moved" ref={field} />;
        },
      });
      const changed = shallowRef(false);
      await render(() => (
        <div>
          <input data-testid="before" />
          <Popup referenceHidden={changed.value}>
            {{ default: changeAndClose(() => (changed.value = true)) }}
          </Popup>
          {changed.value && <Autofocus />}
        </div>
      ));
      await openFrom('before');

      await fireEvent.click(screen.getByTestId('change'));
      await flushMicrotasks();

      expect(screen.getByTestId('moved')).toHaveFocus();
    });

    it('moves the focus to the element that had it before the open, when Vue removes the reference with the popup', async () => {
      const removed = shallowRef(false);
      await render(() => (
        <div>
          <input data-testid="before" />
          <Popup referenceAfter referenceRemoved={removed.value}>
            {{ default: changeAndClose(() => (removed.value = true)) }}
          </Popup>
        </div>
      ));
      await openFrom('before');

      await fireEvent.click(screen.getByTestId('change'));

      await waitFor(() => expect(screen.getByTestId('before')).toHaveFocus());
    });

    // A popup with two fields that holds a popup. The button of the inner popup removes the
    // reference of the inner popup in the update that closes it. The first field has the focus.
    async function renderPopupInPopup() {
      const removed = shallowRef(false);
      await render(() => (
        <Popup>
          {{
            default: () => [
              <input data-testid="parent-field" />,
              <input data-testid="parent-second-field" />,
              <Popup name="child-" referenceRemoved={removed.value}>
                {{ default: changeAndClose(() => (removed.value = true)) }}
              </Popup>,
            ],
          }}
        </Popup>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('parent-field')).toHaveFocus());
    }

    it('moves the focus into the popup above when no element that had the focus can take it', async () => {
      await renderPopupInPopup();
      await openPopup(document, 'child-');
      await waitFor(() => expect(screen.getByTestId('change')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('change'));

      await waitFor(() => expect(screen.getByTestId('parent-field')).toHaveFocus());
    });

    it('moves the focus to the element that had it before the open, and not into the popup above', async () => {
      await renderPopupInPopup();
      screen.getByTestId('parent-second-field').focus();
      // The click leaves the focus on the second field. `openPopup` would focus the reference.
      await fireEvent.click(screen.getByTestId('child-reference'));
      await waitFor(() => expect(screen.getByTestId('change')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('change'));

      await waitFor(() => expect(screen.getByTestId('parent-second-field')).toHaveFocus());
    });

    // The focus is on the body at each open, so the focus manager records the reference.
    async function openAndClose(name: string) {
      await fireEvent.click(screen.getByTestId(`${name}reference`));
      await waitFor(() => expect(screen.getByTestId(`${name}one`)).toHaveFocus());
      await fireEvent.click(screen.getByTestId(`${name}close`));
      await waitFor(() => expect(screen.getByTestId(`${name}reference`)).toHaveFocus());
      screen.getByTestId(`${name}reference`).blur();
    }

    it.each<{ name: string; attribute: string | null; focused: string }>([
      { name: 'an element in the document', attribute: null, focused: 'first-reference' },
      { name: 'a hidden element is skipped', attribute: 'hidden', focused: 'zero-reference' },
      {
        name: 'a marked element is skipped',
        attribute: 'data-vase-ui-inert',
        focused: 'zero-reference',
      },
    ])(
      'moves the focus to the newest element of the list: $name',
      async ({ attribute, focused }) => {
        const removed = shallowRef(false);
        await render(() => (
          <div>
            <Popup name="zero-" />
            <Popup name="first-" />
            <Popup name="second-" referenceRemoved={removed.value}>
              {{
                default: ({ close }: { close: () => void }) => (
                  <button
                    data-testid="second-change"
                    onClick={() => {
                      removed.value = true;
                      close();
                    }}
                  />
                ),
              }}
            </Popup>
          </div>
        ));
        await openAndClose('zero-');
        await openAndClose('first-');
        if (attribute) {
          screen.getByTestId('first-reference').setAttribute(attribute, '');
        }
        await fireEvent.click(screen.getByTestId('second-reference'));
        await waitFor(() => expect(screen.getByTestId('second-change')).toHaveFocus());

        await fireEvent.click(screen.getByTestId('second-change'));

        await waitFor(() => expect(screen.getByTestId(focused)).toHaveFocus());
      },
    );

    // The first popup opens with a null interaction type while the body has the focus, so it
    // records nothing. Its reference is then not in the list when the second popup closes.
    it('leaves the reference out of the list when the open interaction type is null', async () => {
      const removed = shallowRef(false);
      await render(() => (
        <div>
          <Popup name="first-" manager={{ openInteractionType: null }} />
          <Popup name="second-" referenceRemoved={removed.value}>
            {{ default: changeAndClose(() => (removed.value = true)) }}
          </Popup>
        </div>
      ));
      await openAndClose('first-');
      await fireEvent.click(screen.getByTestId('second-reference'));
      await waitFor(() => expect(screen.getByTestId('change')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('change'));
      await flushMicrotasks();

      expect(document.body).toHaveFocus();
    });

    describe('press outside the popup, in a browser that gives no preventScroll option', () => {
      // A browser without the option does not read the options of `focus`. This function does not
      // read them either.
      function ignoreFocusOptions() {
        const focus = HTMLElement.prototype.focus;
        const spy = vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function (
          this: HTMLElement,
        ) {
          focus.call(this);
        });
        onTestFinished(() => spy.mockRestore());
      }

      const mousePress = () =>
        new PointerEvent('pointerdown', { pointerType: 'mouse', buttons: 1, pressure: 0.5 });
      // Chromium gives a press of a screen reader as a mouse event of 1 by 1 pixel with no pressure.
      const screenReaderPress = () =>
        new PointerEvent('pointerdown', { pointerType: 'mouse', width: 1, height: 1, pressure: 0 });

      it.each<{
        name: string;
        ignoreOptions: boolean;
        press: () => PointerEvent;
        manager: (target: TargetRef) => ManagerProps;
        nested?: boolean;
        focused: string;
      }>([
        {
          name: 'a mouse press, preventScroll works',
          ignoreOptions: false,
          press: mousePress,
          manager: () => ({}),
          focused: 'reference',
        },
        {
          name: 'a mouse press',
          ignoreOptions: true,
          press: mousePress,
          manager: () => ({}),
          focused: 'body',
        },
        {
          name: 'a mouse press, and a target',
          ignoreOptions: true,
          press: mousePress,
          manager: (target) => ({ returnFocus: target }),
          focused: 'target',
        },
        {
          name: 'a screen reader press',
          ignoreOptions: true,
          press: screenReaderPress,
          manager: () => ({}),
          focused: 'reference',
        },
        {
          name: 'a mouse press on a nested popup',
          ignoreOptions: true,
          press: mousePress,
          manager: () => ({}),
          nested: true,
          focused: 'reference',
        },
      ])(
        'puts the focus on the $focused after $name',
        async ({ ignoreOptions, press, manager, nested, focused }) => {
          const target: TargetRef = shallowRef(null);
          const popup = captureStore();
          await render(() => (
            <div>
              <input data-testid="target" ref={target} />
              <Popup manager={manager(target)} onStore={popup.onStore} />
            </div>
          ));
          await openPopup();
          await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
          if (ignoreOptions) {
            ignoreFocusOptions();
          }
          if (nested) {
            popup.store.context.nested = true;
          }

          popup.store.setOpen(false, createChangeEventDetails(REASONS.outsidePress, press()));
          await flushMicrotasks();

          expect(focused === 'body' ? document.body : screen.getByTestId(focused)).toHaveFocus();
        },
      );
    });
  });

  describe('close when the focus leaves a popup that is not modal', () => {
    // With `openFrom`, that field has the focus at the open. The list of the elements that had the
    // focus then ends with that field, and not with the reference.
    async function renderPopup(
      manager: ManagerProps = {},
      options: { portal?: boolean; openFrom?: string } = {},
    ) {
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <Popup
            portal={options.portal}
            manager={{ modal: false, ...manager }}
            onOpenChange={handleOpenChange}
          />
          <input data-testid="outside" />
          <input data-testid="inside" />
        </div>
      ));
      if (options.openFrom) {
        screen.getByTestId(options.openFrom).focus();
        await fireEvent.click(screen.getByTestId('reference'));
      } else {
        await openPopup();
      }
      if (manager.initialFocus !== false) {
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      }
      return handleOpenChange;
    }

    async function moveFocusTo(testId: string) {
      screen.getByTestId(testId).focus();
      await flushMicrotasks();
    }

    it.each<{ name: string; manager: ManagerProps }>([
      { name: 'popup', manager: {} },
      { name: 'reference', manager: { initialFocus: false } },
    ])(
      'closes the popup when the focus moves from the $name to an element outside',
      async ({ manager }) => {
        const handleOpenChange = await renderPopup(manager);

        await moveFocusTo('outside');

        expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
        expect(screen.queryByTestId('floating')).toBe(null);
      },
    );

    it('returns no focus after the close, also for an explicit target', async () => {
      await renderPopup({ explicitReturnFocus: true });

      await moveFocusTo('outside');

      expect(screen.getByTestId('outside')).toHaveFocus();
    });

    it.each<{ name: string; manager: ManagerProps; target: string }>([
      { name: 'the reference', manager: {}, target: 'reference' },
      {
        name: 'an element of getInsideElements',
        manager: { getInsideElements: () => [screen.getByTestId('inside')] },
        target: 'inside',
      },
    ])('keeps the popup open when the focus moves to $name', async ({ manager, target }) => {
      const handleOpenChange = await renderPopup(manager, { openFrom: 'outside' });

      await moveFocusTo(target);

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('floating')).toBeInTheDocument();
    });

    it.each<{ name: string; manager: ManagerProps }>([
      { name: 'the popup is modal', manager: { modal: true } },
      { name: 'closeOnFocusOut is false', manager: { closeOnFocusOut: false } },
    ])('keeps the popup open when the focus leaves it and $name', async ({ manager }) => {
      const handleOpenChange = await renderPopup(manager);

      await moveFocusTo('outside');

      expect(handleOpenChange).not.toHaveBeenCalled();
      expect(screen.getByTestId('floating')).toBeInTheDocument();
    });

    it('keeps the popup open when the focus moves into the popup of a node below, in externalTree', async () => {
      const tree = new FloatingTreeStore();
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <Popup
            manager={{ modal: false, externalTree: tree }}
            onOpenChange={handleOpenChange}
            onStore={(store) => {
              store.context.positioning = {
                open: true,
                nodeId: 'parent',
                elements: { reference: null, floating: null, domReference: null },
                rootStore: store,
              };
            }}
          />
          <div data-testid="child-popup">
            <input data-testid="child-field" />
          </div>
        </div>
      ));
      tree.addNode({
        id: 'child',
        parentId: 'parent',
        context: {
          open: true,
          nodeId: 'child',
          elements: {
            reference: null,
            floating: screen.getByTestId('child-popup'),
            domReference: null,
          },
        } as PopupPositioningContext,
      });
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      screen.getByTestId('child-field').focus();
      await flushMicrotasks();

      expect(handleOpenChange).not.toHaveBeenCalled();
    });

    it.each<{
      name: string;
      manager: ManagerProps;
      pressed: string;
      clickTrigger?: boolean;
      calls: unknown[];
    }>([
      { name: 'a click trigger', manager: {}, pressed: 'outside', clickTrigger: true, calls: [] },
      { name: 'the reference', manager: { initialFocus: false }, pressed: 'reference', calls: [] },
      { name: 'another element', manager: {}, pressed: 'outside', calls: [[false, 'focus-out']] },
    ])(
      'handles a press on $name that moves the focus out',
      async ({ manager, pressed, clickTrigger, calls }) => {
        const handleOpenChange = await renderPopup(manager);
        if (clickTrigger) {
          screen.getByTestId(pressed).setAttribute('data-vase-ui-click-trigger', '');
        }

        await fireEvent.pointerDown(screen.getByTestId(pressed));
        await moveFocusTo('outside');

        expect(handleOpenChange.mock.calls).toEqual(calls);
      },
    );

    describe('popup in a portal', () => {
      it('keeps the popup open when the focus leaves its popup element with no press', async () => {
        const handleOpenChange = await renderPopup({}, { portal: true });

        await moveFocusTo('outside');

        expect(handleOpenChange).not.toHaveBeenCalled();
      });

      it('keeps the popup open when the focus leaves it after a press outside ended', async () => {
        const handleOpenChange = await renderPopup({}, { portal: true });

        await fireEvent.pointerDown(screen.getByTestId('outside'));
        await fireEvent.pointerUp(screen.getByTestId('outside'));
        await moveFocusTo('outside');

        expect(handleOpenChange).not.toHaveBeenCalled();
      });

      it('closes the popup when a press outside moves the focus', async () => {
        const handleOpenChange = await renderPopup({}, { portal: true });

        await fireEvent.pointerDown(screen.getByTestId('outside'));
        await moveFocusTo('outside');

        expect(handleOpenChange.mock.calls).toEqual([[false, 'focus-out']]);
      });

      it('keeps the popup open when the focus leaves it in a press on another element of its portal', async () => {
        const handleOpenChange = vi.fn();
        await render(() => (
          <div>
            <Popup portal manager={{ modal: false }} onOpenChange={handleOpenChange}>
              {{
                default: () => [
                  <input data-testid="one" />,
                  <FloatingPortal>
                    <input data-testid="nested" />
                  </FloatingPortal>,
                ],
              }}
            </Popup>
            <input data-testid="outside" />
          </div>
        ));
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

        await fireEvent.pointerDown(screen.getByTestId('nested'));
        await moveFocusTo('outside');

        expect(handleOpenChange).not.toHaveBeenCalled();
      });
    });
  });

  it('records the element that loses the focus to the body, for a later return of the focus', async () => {
    const removed = shallowRef(false);
    const second = captureStore();
    await render(() => (
      <div>
        <Popup name="first-" />
        <Popup name="second-" referenceRemoved={removed.value} onStore={second.onStore} />
      </div>
    ));
    await openPopup(document, 'first-');
    await waitFor(() => expect(screen.getByTestId('first-one')).toHaveFocus());
    screen.getByTestId('first-two').focus();
    screen.getByTestId('first-two').blur();
    await flushMicrotasks();
    await fireEvent.click(screen.getByTestId('second-reference'));
    await waitFor(() => expect(screen.getByTestId('second-one')).toHaveFocus());

    removed.value = true;
    second.close();

    await waitFor(() => expect(screen.getByTestId('first-two')).toHaveFocus());
  });

  describe('VUE-47: a focused element that Vue removes', () => {
    async function renderAndFocusTwo(restoreFocus: ManagerProps['restoreFocus']) {
      const removed = shallowRef(false);
      await render(() => (
        <Popup role="dialog" manager={{ restoreFocus }}>
          {{
            default: () => [
              <input data-testid="one" />,
              removed.value ? null : <input data-testid="two" />,
              <input data-testid="three" />,
            ],
          }}
        </Popup>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      screen.getByTestId('two').focus();
      return removed;
    }

    it.each<{ name: string; restoreFocus: ManagerProps['restoreFocus']; focused: string }>([
      { name: 'true', restoreFocus: true, focused: 'three' },
      { name: 'popup', restoreFocus: 'popup', focused: 'floating' },
    ])(
      'moves the focus back into the popup for restoreFocus $name',
      async ({ restoreFocus, focused }) => {
        const removed = await renderAndFocusTwo(restoreFocus);

        removed.value = true;

        await waitFor(() => expect(screen.getByTestId(focused)).toHaveFocus());
      },
    );

    it('moves the focus back into the popup in a browser that sends no focusout at the removal', async () => {
      // Firefox and WebKit send no `focusout` when they remove the focused element. This listener
      // makes Chromium the same.
      const stop = (event: FocusEvent) => event.stopPropagation();
      window.addEventListener('focusout', stop, true);
      onTestFinished(() => window.removeEventListener('focusout', stop, true));
      const removed = await renderAndFocusTwo(true);

      removed.value = true;

      await waitFor(() => expect(screen.getByTestId('three')).toHaveFocus());
    });

    it('moves no focus when the focus left the popup before the removal', async () => {
      const removed = await renderAndFocusTwo(true);
      screen.getByTestId('two').blur();
      await flushMicrotasks();

      removed.value = true;
      await nextTick();
      await flushMicrotasks();

      expect(document.body).toHaveFocus();
    });

    it('moves no focus for an element that had the focus in the last open of a kept popup', async () => {
      const removed = shallowRef(false);
      const initialFocus = shallowRef(true);
      await render(() => (
        <Popup
          keepMounted
          role="dialog"
          manager={{ restoreFocus: true, initialFocus: initialFocus.value }}
        >
          {{
            default: ({ close }: { close: () => void }) => [
              <input data-testid="one" />,
              removed.value ? null : <input data-testid="two" />,
              <button data-testid="close" onClick={() => close()} />,
            ],
          }}
        </Popup>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      screen.getByTestId('two').focus();
      await fireEvent.click(screen.getByTestId('close'));
      await waitFor(() => expect(screen.getByTestId('reference')).toHaveFocus());
      initialFocus.value = false;
      await openPopup();
      screen.getByTestId('reference').blur();
      await flushMicrotasks();

      removed.value = true;
      await nextTick();
      await flushMicrotasks();

      expect(document.body).toHaveFocus();
    });

    it('moves no focus when another element has the focus after the removal', async () => {
      await renderAndFocusTwo(true);

      screen.getByTestId('two').remove();
      screen.getByTestId('reference').focus();
      await flushMicrotasks();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });
  });

  describe('marks outside the popup', () => {
    async function renderMarkedPopup(manager: ManagerProps = {}) {
      await render(() => (
        <div>
          <div data-testid="outside">
            <input data-testid="outside-field" />
          </div>
          <div data-testid="live" aria-live="polite" />
          <div data-testid="inert-before" inert />
          <Popup manager={manager} />
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    }

    it('hides the outside elements of a modal popup, and removes the marks at the close', async () => {
      await renderMarkedPopup();

      const outside = screen.getByTestId('outside');
      expect(outside).toHaveAttribute('aria-hidden', 'true');
      expect(outside).toHaveAttribute('data-vase-ui-inert');
      expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
      expect(screen.getByTestId('live')).not.toHaveAttribute('aria-hidden');
      expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
      expect(outside).not.toHaveAttribute('inert');

      await fireEvent.click(screen.getByTestId('close'));

      expect(outside).not.toHaveAttribute('aria-hidden');
      expect(outside).not.toHaveAttribute('data-vase-ui-inert');
      expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
    });

    it('marks the outside elements of a popup that is not modal, and hides none', async () => {
      await renderMarkedPopup({ modal: false });

      const outside = screen.getByTestId('outside');
      expect(outside).toHaveAttribute('data-vase-ui-inert');
      expect(outside).not.toHaveAttribute('aria-hidden');
    });

    it('leaves getInsideElements, previousFocusableElement and nextFocusableElement visible', async () => {
      const previous: TargetRef = shallowRef(null);
      await render(() => (
        <div>
          <div data-testid="outside" />
          <input data-testid="inside" />
          <input data-testid="previous" ref={previous} />
          <input data-testid="next" />
          <Popup
            manager={{
              getInsideElements: () => [screen.getByTestId('inside')],
              previousFocusableElement: previous,
              nextFocusableElement: () => screen.getByTestId('next'),
            }}
          />
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      expect(screen.getByTestId('outside')).toHaveAttribute('aria-hidden', 'true');
      expect(
        ['inside', 'previous', 'next'].map((id) =>
          screen.getByTestId(id).getAttribute('aria-hidden'),
        ),
      ).toEqual([null, null, null]);
    });

    it('leaves a portal in the portal of the popup free of the marks', async () => {
      await render(() => (
        <div>
          <div data-testid="outside" />
          <Popup portal keepMounted>
            {{
              default: () => [
                <input data-testid="one" />,
                <FloatingPortal>
                  <input data-testid="nested" />
                </FloatingPortal>,
              ],
            }}
          </Popup>
        </div>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());

      const nestedPortal = screen.getByTestId('nested').closest('[data-vase-ui-portal]')!;
      expect(screen.getByTestId('outside').closest('[aria-hidden="true"]')).not.toBe(null);
      expect(nestedPortal).not.toHaveAttribute('aria-hidden');
      expect(nestedPortal).not.toHaveAttribute('data-vase-ui-inert');
    });

    describe('BUG-4678: inert outside a modal popup', () => {
      it('gives inert to the elements that it hides, and removes it at the close', async () => {
        await renderMarkedPopup({ outsideElementsInert: true });

        const outside = screen.getByTestId('outside');
        expect(outside).toHaveAttribute('inert');
        expect(screen.getByTestId('live')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        screen.getByTestId('outside-field').focus();
        expect(screen.getByTestId('one')).toHaveFocus();

        await fireEvent.click(screen.getByTestId('close'));

        expect(outside).not.toHaveAttribute('inert');
        expect(screen.getByTestId('inert-before')).toHaveAttribute('inert');
      });

      it.each<{ name: string; manager: ManagerProps }>([
        {
          name: 'a popup that is not modal',
          manager: { modal: false, outsideElementsInert: true },
        },
        { name: 'outsideElementsInert is false', manager: {} },
      ])('gives no inert for $name', async ({ manager }) => {
        await renderMarkedPopup(manager);

        expect(screen.getByTestId('outside')).not.toHaveAttribute('inert');
      });
    });

    describe('BUG-5577: a popup in a container that an earlier popup marked', () => {
      it('takes the focus, and the container gets the marks back at its close', async () => {
        const container = document.createElement('div');
        const containerField = document.createElement('input');
        container.append(containerField);
        document.body.append(container);
        onTestFinished(() => container.remove());
        await render(() => (
          <Popup portal manager={{ outsideElementsInert: true }}>
            {{
              default: () => [
                <input data-testid="one" />,
                <Popup name="child-" portal container={container} manager={{ modal: false }} />,
              ],
            }}
          </Popup>
        ));
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        expect(container).toHaveAttribute('inert');

        await openPopup(document, 'child-');

        await waitFor(() => expect(screen.getByTestId('child-one')).toHaveFocus());
        expect(container).not.toHaveAttribute('inert');
        expect(container).not.toHaveAttribute('aria-hidden');
        expect(containerField).toHaveAttribute('inert');

        await fireEvent.click(screen.getByTestId('child-close'));

        expect(container).toHaveAttribute('inert');
        expect(containerField).not.toHaveAttribute('inert');
      });
    });

    describe('popup in the content of a modal popup', () => {
      // With `middle`, the popup is in a popup whose focus manager is disabled, and that popup is
      // in the content of the modal popup.
      const Popups = defineComponent({
        props: { disabled: Boolean, middle: Boolean },
        setup: (props) => () => {
          const child = <Popup name="child-" portal role="dialog" />;
          return (
            <Popup portal role="dialog" manager={{ disabled: props.disabled }}>
              {{
                default: () => [
                  <input data-testid="one" />,
                  props.middle ? (
                    <Popup name="middle-" portal manager={{ disabled: true }}>
                      {{ default: () => child }}
                    </Popup>
                  ) : (
                    child
                  ),
                ],
              }}
            </Popup>
          );
        },
      });

      async function openEach(middle = false) {
        await openPopup();
        if (middle) {
          await openPopup(document, 'middle-');
        }
        await openPopup(document, 'child-');
        await waitFor(() => expect(screen.getByTestId('child-one')).toHaveFocus());
      }

      const marks = () =>
        ['floating', 'child-floating'].map((id) => {
          const element = screen.getByTestId(id);
          return ['aria-hidden', 'data-vase-ui-inert'].filter((name) => element.hasAttribute(name));
        });
      const marksOfChildOnTop = [['aria-hidden', 'data-vase-ui-inert'], []];

      it('keeps the popup above hidden when that popup takes its marks later', async () => {
        const disabled = shallowRef(true);
        await render(() => <Popups disabled={disabled.value} />);
        await openEach();
        expect(marks()).toEqual(marksOfChildOnTop);

        disabled.value = false;
        await nextTick();

        expect(marks()).toEqual(marksOfChildOnTop);
      });

      it.each([
        { name: 'two popups', middle: false },
        { name: 'three popups, the middle one disabled', middle: true },
      ])('keeps the popup above hidden after KeepAlive puts $name back', async ({ middle }) => {
        const shown = shallowRef(true);
        await render(() => (
          <KeepAlive>{shown.value ? <Popups middle={middle} /> : null}</KeepAlive>
        ));
        await openEach(middle);
        expect(marks()).toEqual(marksOfChildOnTop);

        shown.value = false;
        await nextTick();
        shown.value = true;
        await nextTick();

        expect(marks()).toEqual(marksOfChildOnTop);
      });
    });

    it('removes the marks while KeepAlive holds the popup, and puts them back', async () => {
      const shown = shallowRef(true);
      const Page = defineComponent({
        setup: () => () => (
          <Popup portal role="dialog">
            {{ default: () => <input data-testid="one" /> }}
          </Popup>
        ),
      });
      await render(() => (
        <div>
          <input data-testid="outside" />
          <KeepAlive>{shown.value ? <Page /> : null}</KeepAlive>
        </div>
      ));
      // A focus guard has `aria-hidden` of its own.
      const marks = () => [
        document.querySelectorAll('[aria-hidden="true"]:not([data-vase-ui-focus-guard])').length,
        document.querySelectorAll('[data-vase-ui-inert]').length,
      ];
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      const marksWhileOpen = marks();
      expect(screen.getByTestId('outside').closest('[aria-hidden="true"]')).not.toBe(null);

      shown.value = false;
      await nextTick();
      expect(marks()).toEqual([0, 0]);

      shown.value = true;
      await nextTick();
      expect(marks()).toEqual(marksWhileOpen);
    });
  });

  it('releases its document listeners while KeepAlive holds the popup, and takes them back', async () => {
    const added = vi.spyOn(document, 'addEventListener');
    const removed = vi.spyOn(document, 'removeEventListener');
    const count = (type: string) =>
      added.mock.calls.filter(([name]) => name === type).length -
      removed.mock.calls.filter(([name]) => name === type).length;
    const before = { keydown: count('keydown'), pointerdown: count('pointerdown') };
    // The Tab stop and the record of the pointer state each hold a `keydown` listener. The record
    // holds the `pointerdown` listener.
    const listeners = () => ({
      keydown: count('keydown') - before.keydown,
      pointerdown: count('pointerdown') - before.pointerdown,
    });
    const shown = shallowRef(true);
    const Page = defineComponent({
      setup: () => () => (
        <Popup portal role="dialog">
          {{ default: () => <input data-testid="one" /> }}
        </Popup>
      ),
    });
    await render(() => <KeepAlive>{shown.value ? <Page /> : null}</KeepAlive>);
    await openPopup();
    await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    const guards = getInsideGuards();
    expect(listeners()).toEqual({ keydown: 2, pointerdown: 1 });

    shown.value = false;
    await nextTick();
    expect(listeners()).toEqual({ keydown: 0, pointerdown: 0 });
    expect(screen.queryByTestId('floating')).toBe(null);

    shown.value = true;
    await nextTick();
    expect(listeners()).toEqual({ keydown: 2, pointerdown: 1 });
    expect(getInsideGuards().map((guard, index) => guard === guards[index])).toEqual([true, true]);
    await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
  });

  it('manages the focus of a popup in a shadow root', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    onTestFinished(() => host.remove());
    const root = host.attachShadow({ mode: 'open' });
    await render(
      <Teleport to={root as unknown as HTMLElement}>
        <Popup>
          {{ default: () => [<input data-testid="one" />, <input data-testid="two" />] }}
        </Popup>
      </Teleport>,
    );
    const query = (id: string) => root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

    await openPopup(root);
    await waitFor(() => expect(root.activeElement).toBe(query('one')));

    await userEvent.tab();
    await userEvent.tab();
    expect(root.activeElement).toBe(query('one'));
  });

  it('manages the focus of a popup in the document of a frame', async () => {
    const frame = document.createElement('iframe');
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    const frameDocument = frame.contentDocument!;
    const added = vi.spyOn(frameDocument, 'addEventListener');
    await render(
      <Teleport to={frameDocument.body}>
        <Popup role="dialog" />
      </Teleport>,
    );

    await openPopup(frameDocument);

    await waitFor(() =>
      expect(frameDocument.activeElement).toBe(frameDocument.querySelector('[data-testid="one"]')),
    );
    expect(added.mock.calls.filter(([type]) => type === 'keydown')).toHaveLength(2);
    expect(added.mock.calls.filter(([type]) => type === 'pointerdown')).toHaveLength(1);
  });

  describe('JSDOM-only coverage', () => {
    beforeEach(runFramesAtOnce);

    describe('prop: initialFocus', () => {
      test('default behavior focuses first tabbable element', async () => {
        await render(<App />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('default behavior focuses the checked radio in a named group', async () => {
        await render(<RadioApp />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('radio-two')).toHaveFocus();
      });

      test('ref', async () => {
        await render(<App initialFocus="two" />);
        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('two')).toHaveFocus();
      });

      test('respects autoFocus', async () => {
        await render(
          <App>
            <AutoFocusInput data-testid="input" />
          </App>,
        );
        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('input')).toHaveFocus();
      });

      test('focuses without a frame delay when a screen reader press opens it', async () => {
        await render(<MouseDownApp />);

        // A screen reader press is a `mousedown` with `detail: 0`.
        // The dispatch is synchronous, and Vue updates after it. The spy thus holds the frame of the
        // initial focus, as in Base UI.
        const pressed = fireEvent.mouseDown(screen.getByTestId('reference'), { detail: 0 });

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        await pressed;
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('keeps the frame delay for a real mouse press', async () => {
        await render(<MouseDownApp />);

        const pressed = fireEvent.mouseDown(screen.getByTestId('reference'), { detail: 1 });

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);
        await pressed;
        await flushMicrotasks();

        expect(screen.getByTestId('one')).not.toHaveFocus();
      });
    });

    describe('prop: returnFocus', () => {
      test('when true', async () => {
        const { rerender } = await render(<App />);

        screen.getByTestId('reference').focus();
        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        screen.getByTestId('two').focus();
        await flushMicrotasks();

        await rerender(<App returnFocus={false} />);

        expect(screen.getByTestId('two')).toHaveFocus();

        await fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('when false', async () => {
        await render(<App returnFocus={false} />);

        screen.getByTestId('reference').focus();
        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('one')).toHaveFocus();

        await fireEvent.click(screen.getByTestId('three'));
        expect(screen.getByTestId('reference')).not.toHaveFocus();
      });

      test('ref', async () => {
        const Test = defineComponent({
          setup() {
            const ref = shallowRef<HTMLInputElement | null>(null);
            return () => (
              <div>
                <input />
                <input data-testid="focus-target" ref={ref} />
                <input />
                <App returnFocus={ref} />
              </div>
            );
          },
        });

        await render(<Test />);
        screen.getByTestId('reference').focus();
        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await fireEvent.click(screen.getByTestId('three'));
        await flushMicrotasks();
        expect(screen.getByTestId('focus-target')).toHaveFocus();
      });

      test('always returns to the reference for nested elements', async () => {
        const { user } = await render(
          <NestedDialog>
            {{
              default: ({ close }: { close: () => void }) => [
                <NestedDialog>
                  {{
                    default: ({ close: closeNested }: { close: () => void }) => (
                      <button onClick={closeNested} data-testid="close-nested-dialog" />
                    ),
                    reference: () => <button data-testid="open-nested-dialog" />,
                  }}
                </NestedDialog>,
                <button onClick={close} data-testid="close-dialog" />,
              ],
              reference: () => <button data-testid="open-dialog" />,
            }}
          </NestedDialog>,
        );

        await user.click(screen.getByTestId('open-dialog'));
        await waitForLaterMillisecond();
        await user.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-nested-dialog')).not.toBeInTheDocument();

        await fireEvent.pointerDown(document.body);

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();
      });

      test('return to the first focusable descendent of the reference, if the reference is not focusable', async () => {
        const { user } = await render(
          <Dialog>
            {{
              default: ({ close }: { close: () => void }) => (
                <button onClick={close} data-testid="close-dialog" />
              ),
              reference: () => (
                <div data-testid="non-focusable-reference">
                  <button data-testid="open-dialog" />
                </div>
              ),
            }}
          </Dialog>,
        );
        screen.getByTestId('open-dialog').focus();
        await user.keyboard('{Enter}');

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();

        await user.keyboard('{Escape}');

        expect(screen.queryByTestId('close-dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('open-dialog')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (modal)', async () => {
        const { user } = await render(<RemovedReferenceApp />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await user.tab();

        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test('preserves tabbable context next to reference element if removed (non-modal)', async () => {
        const { user } = await render(<RemovedReferenceApp modal={false} />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await fireEvent.click(screen.getByTestId('remove'));
        await flushMicrotasks();

        await user.tab();

        expect(screen.getByTestId('fallback')).toHaveFocus();
      });

      test('does not return focus to reference on outside press when preventScroll is not supported', async () => {
        // A browser reads the options of `focus`. Base UI runs this case only in jsdom, whose
        // `focus` reads none.
        const focus = HTMLElement.prototype.focus;
        vi.spyOn(HTMLElement.prototype, 'focus').mockImplementation(function focusWithNoOptions(
          this: HTMLElement,
        ) {
          focus.call(this);
        });

        const { user } = await render(<ClickDismissApp />);

        await user.click(screen.getByText('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        await user.click(document.body);
        await flushMicrotasks();

        expect(screen.getByText('reference')).not.toHaveFocus();
      });

      test('returns focus to reference on outside press when preventScroll is supported', async () => {
        const originalFocus = HTMLElement.prototype.focus;
        Object.defineProperty(HTMLElement.prototype, 'focus', {
          configurable: true,
          writable: true,
          value(options: any) {
            // eslint-disable-next-line @typescript-eslint/no-unused-expressions
            options && options.preventScroll;
            return originalFocus.call(this, options);
          },
        });
        onTestFinished(() => {
          HTMLElement.prototype.focus = originalFocus;
        });

        const { user } = await render(<ClickDismissApp />);

        await user.click(screen.getByText('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        await user.click(document.body);
        await flushMicrotasks();

        expect(screen.getByText('reference')).toHaveFocus();
      });

      test('passes focusVisible when returning focus after keyboard close', async () => {
        const { user } = await render(<ClickDismissApp />);

        const reference = screen.getByText('reference');
        await user.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await user.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('omits focusVisible when returning focus after pointer close', async () => {
        const { user } = await render(<ClickDismissApp />);

        const reference = screen.getByText('reference');
        await user.click(reference);
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toHaveFocus();

        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          // Closing with a pointer must not force `:focus-visible`; `focusVisible`
          // is omitted entirely so the browser's own heuristics decide.
          await user.click(reference);

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('does not return focus while open when the reference changes', async () => {
        const Test = defineComponent({
          props: { useSecond: Boolean },
          setup(props) {
            const isOpen = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);
            const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

            return () => (
              <>
                <button
                  data-testid="first"
                  ref={props.useSecond ? undefined : refs.setReference}
                  {...getReferenceProps()}
                />
                <button
                  data-testid="second"
                  ref={props.useSecond ? refs.setReference : undefined}
                />
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button data-testid="child" />
                      <button
                        data-testid="close"
                        onClick={() => {
                          isOpen.value = false;
                        }}
                      />
                    </div>
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        const { rerender, user } = await render(<Test />);

        await user.click(screen.getByTestId('first'));
        await flushMicrotasks();

        const child = screen.getByTestId('child');
        child.focus();
        await flushMicrotasks();

        // The return-focus effect re-arms for the new reference while the popup stays open, so
        // the cleanup's queued return focus must be cancelled rather than yank focus mid-open.
        await rerender(<Test useSecond />);
        await flushMicrotasks();

        expect(child).toHaveFocus();

        await user.click(screen.getByTestId('close'));
        await flushMicrotasks();

        // The cancelled job must not have left return focus suppressed for the real close.
        expect(screen.getByTestId('second')).toHaveFocus();
      });

      test('does not insert fallback element when return element is falsy', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);
            const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

            return () => (
              <>
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <FloatingPortal>
                  {isOpen.value && (
                    <FloatingFocusManager store={context.rootStore} returnFocus={() => undefined}>
                      <div ref={refs.setFloating} {...getFloatingProps()}>
                        <button
                          data-testid="close"
                          onClick={() => {
                            isOpen.value = false;
                          }}
                        />
                      </div>
                    </FloatingFocusManager>
                  )}
                </FloatingPortal>
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        const reference = screen.getByTestId('reference');
        await user.click(reference);
        await flushMicrotasks();

        expect(reference.nextElementSibling).toBeNull();

        await user.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.queryByTestId('close')).toBeNull();
        });

        expect(reference.nextElementSibling).toBeNull();
      });
    });

    describe('iframe focus navigation', () => {
      // The popup slot gives the content of the popover.
      const Popover = defineComponent({
        props: { portalRef: { type: Object as PropType<HTMLElement>, default: undefined } },
        setup(props, { slots }) {
          const open = shallowRef(false);

          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpenOf(open),
          });

          const click = useClick(context.rootStore);
          const dismiss = useDismiss(context.rootStore);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

          return () => (
            <>
              {cloneElement(slots.default!()[0], getReferenceProps({ ref: refs.setReference }))}
              {open.value && (
                <FloatingPortal container={props.portalRef}>
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      {slots.popup?.()}
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              )}
            </>
          );
        },
      });

      const FrameApp = defineComponent({
        props: { iframe: { type: Object as PropType<HTMLElement>, required: true } },
        setup(props) {
          return () => (
            <div>
              <a href="#">prev iframe link</a>
              <Popover portalRef={props.iframe}>
                {{
                  default: () => <button>Open</button>,
                  popup: () => (
                    <div data-testid="popover">
                      <a href="#">popover link 1</a>
                      <a href="#">popover link 2</a>
                    </div>
                  ),
                }}
              </Popover>
              <a href="#">next iframe link</a>
            </div>
          );
        },
      });

      const IframeApp = defineComponent({
        setup() {
          let frameApp: ReturnType<typeof createApp> | undefined;

          onMounted(() => {
            function createIframe() {
              const innerRoot = document.querySelector('#innerRoot');
              const iframe = document.createElement('iframe');
              iframe.setAttribute('data-testid', 'iframe');
              iframe.src = 'about:blank';
              iframe.style.height = '300px';

              innerRoot?.appendChild(iframe);

              // Properly open, write, and close the iframe document.
              const iframeDoc = iframe.contentWindow?.document;
              if (iframeDoc) {
                iframeDoc.open();
                iframeDoc.write(`<div id="rootIframe"></div>`);
                iframeDoc.close();
              }

              const rootIframe = iframe.contentWindow?.document.getElementById('rootIframe');
              return rootIframe;
            }

            const root = createIframe();
            if (root) {
              frameApp = createApp(FrameApp, { iframe: root });
              frameApp.mount(root);
            }
          });
          onBeforeUnmount(() => frameApp?.unmount());

          return () => (
            <>
              <a href="#">Outside link 1</a>
              <div id="innerRoot" />
              <a href="#">Outside link 2</a>
            </>
          );
        },
      });

      test('tabs from the popover to the next element in the iframe', async () => {
        await render(<IframeApp />);

        const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

        // The popover renders inside an iframe and the renderer's `user` is bound to the
        // top-level document, so user-event needs an instance for the iframe's document.
        const user = testingLibraryUserEvent.setup({ document: iframeDoc });

        await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

        // Vue makes each element with the document of the page, so the element has the class of
        // that window. The DOM matchers refuse an element whose class is not of its own window.
        expect(iframeWithin.getByTestId('popover').isConnected).toBe(true);
        await waitForLaterMillisecond();

        await user.tab();
        await user.tab();

        expect(isFocused(iframeWithin.getByText('next iframe link'))).toBe(true);
      });

      test('shift+tab from the popover to the previous element in the iframe', async () => {
        await render(<IframeApp />);

        const iframe: HTMLIFrameElement = await screen.findByTestId('iframe');
        const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
        const iframeWithin = iframeDoc ? within(iframeDoc.body) : screen;

        // The popover renders inside an iframe and the renderer's `user` is bound to the
        // top-level document, so user-event needs an instance for the iframe's document.
        const user = testingLibraryUserEvent.setup({ document: iframeDoc });

        await user.click(iframeWithin.getByRole('button', { name: 'Open' }));

        // Vue makes each element with the document of the page, so the element has the class of
        // that window. The DOM matchers refuse an element whose class is not of its own window.
        expect(iframeWithin.getByTestId('popover').isConnected).toBe(true);
        await waitForLaterMillisecond();

        await user.tab({ shift: true });

        expect(isFocused(iframeWithin.getByRole('button', { name: 'Open' }))).toBe(true);
      });
    });

    describe('prop: modal', () => {
      test('when true', async () => {
        const { user } = await render(<App modal />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await user.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('two')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('one')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('one')).toHaveFocus();
      });

      test('wraps focus within the same frame as the Tab', async () => {
        const { user } = await render(<App modal />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        screen.getByTestId('three').focus();
        await flushMicrotasks();
        expect(screen.getByTestId('three')).toHaveFocus();

        vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

        await user.tab();
        expect(screen.getByTestId('one')).toHaveFocus();

        await user.tab({ shift: true });
        expect(screen.getByTestId('three')).toHaveFocus();
      });

      test('when false', async () => {
        const { user } = await render(<App modal={false} />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await user.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        await user.tab();

        // Wait for the setTimeout that wraps onOpenChange(false).
        await new Promise((resolve) => {
          setTimeout(resolve);
        });
        await flushMicrotasks();

        // Focus leaving the floating element closes it.
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('closeOnFocusOut: false keeps a non-modal element open when focus leaves', async () => {
        const { user } = await render(<App modal={false} closeOnFocusOut={false} />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await user.tab();
        expect(screen.getByTestId('two')).toHaveFocus();

        await user.tab();
        expect(screen.getByTestId('three')).toHaveFocus();

        // Move focus out of the floating element entirely.
        await user.tab();

        // Wait for the (potential) setTimeout that wraps onOpenChange(false).
        await new Promise((resolve) => {
          setTimeout(resolve);
        });
        await flushMicrotasks();

        // With `closeOnFocusOut={false}`, focus leaving the floating element does not close it.
        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('clicking a nested click trigger does not suppress the next focus-out close', async () => {
        const Test = defineComponent({
          setup() {
            const open = shallowRef(false);
            const { refs, context } = useFloating({
              open,
              onOpenChange: setOpenOf(open),
            });

            return () => (
              <>
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    open.value = true;
                  }}
                />
                {open.value && (
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div role="dialog" ref={refs.setFloating} data-testid="floating">
                      <button data-vase-ui-click-trigger="" data-testid="nested-trigger" />
                    </div>
                  </FloatingFocusManager>
                )}
                <button data-testid="last" />
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await user.click(screen.getByTestId('nested-trigger'));
        await new Promise((resolve) => {
          setTimeout(resolve);
        });
        await flushMicrotasks();

        await user.tab();
        await new Promise((resolve) => {
          setTimeout(resolve);
        });
        await flushMicrotasks();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('false - comboboxes do not hide all other nodes', async () => {
        const Test = defineComponent({
          setup() {
            const open = shallowRef(false);
            const { refs, context } = useFloating({
              open,
              onOpenChange: setOpenOf(open),
            });

            return () => (
              <>
                <input
                  role="combobox"
                  data-testid="reference"
                  ref={refs.setReference}
                  onFocus={() => {
                    open.value = true;
                  }}
                />
                <button data-testid="btn-1" />
                <button data-testid="btn-2" />
                {open.value && (
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.focus(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
      });

      test('fallback to floating element when it has no tabbable content', async () => {
        const Test = defineComponent({
          setup() {
            const { refs, context } = useFloating({ open: true });
            return () => (
              <>
                <button data-testid="reference" ref={refs.setReference} />
                <FloatingFocusManager store={context.rootStore} modal>
                  <div ref={refs.setFloating} data-testid="floating" tabindex={-1} />
                </FloatingFocusManager>
              </>
            );
          },
        });

        const { user } = await render(<Test />);
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
        await user.tab();
        expect(screen.getByTestId('floating')).toHaveFocus();
        await user.tab({ shift: true });
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('mixed modality and nesting', async () => {
        const Test = defineComponent({
          setup() {
            const sideDialogOpen = shallowRef(false);
            return () => (
              <NestedDialog modal={false}>
                {{
                  default: ({ close }: { close: () => void }) => [
                    <button onClick={close} data-testid="close-dialog" />,
                    <button
                      onClick={() => {
                        sideDialogOpen.value = true;
                      }}
                      data-testid="open-nested-dialog"
                    />,
                  ],
                  side: () => (
                    <NestedDialog modal open={sideDialogOpen.value}>
                      {{
                        default: ({ close }: { close: () => void }) => (
                          <button onClick={close} data-testid="close-nested-dialog" />
                        ),
                      }}
                    </NestedDialog>
                  ),
                  reference: () => <button data-testid="open-dialog" />,
                }}
              </NestedDialog>
            );
          },
        });

        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('open-dialog'));
        await waitForLaterMillisecond();
        await user.click(screen.getByTestId('open-nested-dialog'));

        expect(screen.getByTestId('close-dialog')).toBeInTheDocument();
        expect(screen.getByTestId('close-nested-dialog')).toBeInTheDocument();
      });

      test('true - applies aria-hidden to outside nodes', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = !isOpen.value;
                  }}
                />
                <div data-testid="outside-wrapper">
                  <div data-testid="aria-live" aria-live="polite" />
                  <button data-testid="btn-1" />
                  <button data-testid="btn-2" />
                </div>
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore}>
                    <div ref={refs.setFloating} data-testid="floating" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('reference')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).toHaveAttribute('aria-hidden', 'true');
        expect(screen.getByTestId('btn-2')).toHaveAttribute('aria-hidden', 'true');

        await fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('aria-hidden');
      });

      test('true - keeps supplied inside elements outside the floating node exposed to assistive tech', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const dismissRef = shallowRef<HTMLButtonElement | null>(null);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = !isOpen.value;
                  }}
                />
                <div data-testid="outside-wrapper">
                  <button data-testid="outside-button" />
                </div>
                {isOpen.value && (
                  <FloatingFocusManager
                    store={context.rootStore}
                    getInsideElements={() => [dismissRef.value]}
                  >
                    <div ref={refs.setFloating} data-testid="floating" />
                    <button ref={dismissRef} data-testid="dismiss" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('dismiss')).not.toHaveAttribute('aria-hidden');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('aria-hidden', 'true');
      });

      test('false - does not apply inert to outside nodes', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <input
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = !isOpen.value;
                  }}
                />
                <div data-testid="outside-wrapper">
                  <div data-testid="aria-live" aria-live="polite" />
                  <button data-testid="btn-1" />
                  <button data-testid="btn-2" />
                </div>
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('aria-live')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('reference')).toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-vase-ui-inert');

        await fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-vase-ui-inert');
      });

      test('false - keeps marker on top-level outside ancestor when reference has siblings', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <div data-testid="outside-wrapper">
                  <input
                    data-testid="reference"
                    ref={refs.setReference}
                    onClick={() => {
                      isOpen.value = !isOpen.value;
                    }}
                  />
                  <button data-testid="btn-1" />
                  <button data-testid="btn-2" />
                  <div data-testid="nested-wrapper">
                    <button data-testid="nested-btn" />
                  </div>
                </div>
                <div data-testid="outside-sibling" />
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div role="listbox" ref={refs.setFloating} data-testid="floating" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveAttribute('inert');
        expect(screen.getByTestId('outside-wrapper')).toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('outside-sibling')).toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-vase-ui-inert');

        await fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('outside-wrapper')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('outside-sibling')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-1')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('btn-2')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('nested-wrapper')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('nested-btn')).not.toHaveAttribute('data-vase-ui-inert');
      });
    });

    describe('prop: disabled', () => {
      test('true -> false', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const disabled = shallowRef(true);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = !isOpen.value;
                  }}
                />
                <button
                  data-testid="toggle"
                  onClick={() => {
                    disabled.value = !disabled.value;
                  }}
                />
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore} disabled={disabled.value}>
                    <div ref={refs.setFloating} data-testid="floating" role="dialog" />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).not.toHaveFocus();
        await fireEvent.click(screen.getByTestId('toggle'));
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByTestId('floating')).toHaveFocus();
        });
      });

      test('when false', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const disabled = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);

            const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

            return () => (
              <>
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <button
                  data-testid="toggle"
                  onClick={() => {
                    disabled.value = !disabled.value;
                  }}
                />
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore} disabled={disabled.value}>
                    <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()} />
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        await render(<Test />);

        await fireEvent.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();
      });

      test('supports keepMounted behavior', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);
            const dismiss = useDismiss(context.rootStore);

            const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

            return () => (
              <>
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <FloatingFocusManager
                  store={context.rootStore}
                  disabled={!isOpen.value}
                  modal={false}
                >
                  <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                    <button data-testid="child" />
                  </div>
                </FloatingFocusManager>
                <button data-testid="after" />
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        await flushMicrotasks();

        expect(screen.getByTestId('floating')).not.toHaveFocus();

        await fireEvent.click(screen.getByTestId('reference'));

        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await user.tab();

        expect(screen.getByTestId('after')).toHaveFocus();

        await user.tab({ shift: true });

        await fireEvent.click(screen.getByTestId('reference'));

        expect(screen.getByTestId('child')).toHaveFocus();

        await user.keyboard('{Escape}');

        expect(screen.getByTestId('reference')).toHaveFocus();
      });

      test('treats a returnFocus resolver returning true as explicit', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = true;
                  }}
                />
                <button
                  data-testid="close"
                  onClick={() => {
                    isOpen.value = false;
                  }}
                />
                {isOpen.value && (
                  <FloatingFocusManager store={context.rootStore} returnFocus={() => true}>
                    <div ref={refs.setFloating}>
                      <button data-testid="child" />
                    </div>
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('reference'));
        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await user.click(screen.getByTestId('close'));

        await waitFor(() => {
          expect(screen.getByTestId('reference')).toHaveFocus();
        });
      });

      test('uses the latest explicitReturnFocus value without moving focus while open', async () => {
        const Test = defineComponent({
          props: { explicitReturnFocus: Boolean },
          setup(props) {
            const isOpen = shallowRef(false);
            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            return () => (
              <>
                <button
                  data-testid="reference"
                  ref={refs.setReference}
                  onClick={() => {
                    isOpen.value = true;
                  }}
                />
                <button
                  data-testid="close"
                  onClick={() => {
                    isOpen.value = false;
                  }}
                />
                {isOpen.value && (
                  <FloatingFocusManager
                    store={context.rootStore}
                    explicitReturnFocus={props.explicitReturnFocus}
                    modal={false}
                  >
                    <div ref={refs.setFloating}>
                      <button data-testid="child" />
                    </div>
                  </FloatingFocusManager>
                )}
              </>
            );
          },
        });

        const { rerender, user } = await render(<Test explicitReturnFocus />);

        await user.click(screen.getByTestId('reference'));
        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await rerender(<Test explicitReturnFocus={false} />);
        expect(screen.getByTestId('child')).toHaveFocus();

        const close = screen.getByTestId('close');
        await user.click(close);
        expect(close).toHaveFocus();
      });

      test('resets close modality between keep-mounted open sessions', async () => {
        const finalFocus = vi.fn((_closeType: InteractionType) => true);

        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);
            const dismiss = useDismiss(context.rootStore);
            const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

            return () => (
              <>
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <button
                  data-testid="controlled-open"
                  onClick={() => {
                    isOpen.value = true;
                  }}
                />
                <button
                  data-testid="controlled-close"
                  onClick={() => {
                    isOpen.value = false;
                  }}
                />
                <FloatingPortal>
                  <FloatingFocusManager
                    store={context.rootStore}
                    disabled={!isOpen.value}
                    returnFocus={finalFocus}
                  >
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button data-testid="child" />
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await user.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await user.keyboard('{Escape}');
          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenLastCalledWith('keyboard');

          focusSpy.mockClear();

          await user.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await fireEvent.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenLastCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          await fireEvent.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await fireEvent.pointerDown(reference, { pointerType: 'mouse' });
          await fireEvent.click(screen.getByTestId('controlled-close'));

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({ preventScroll: true });
          });
          expect(focusSpy).not.toHaveBeenCalledWith(
            expect.objectContaining({ focusVisible: true }),
          );
          expect(finalFocus).toHaveBeenCalledWith('');

          focusSpy.mockClear();
          finalFocus.mockClear();

          await fireEvent.click(screen.getByTestId('controlled-open'));
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await fireEvent.click(reference, { detail: 0 });

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(finalFocus).toHaveBeenCalledWith('keyboard');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test.each<{
        name: string;
        pointerType: string | null;
        detail: number;
        expected: InteractionType;
      }>([
        {
          name: 'zero detail after a mouse pointerdown',
          pointerType: 'mouse',
          detail: 0,
          expected: 'keyboard',
        },
        {
          name: 'nonzero detail after a touch pointerdown',
          pointerType: 'touch',
          detail: 1,
          expected: 'touch',
        },
        {
          name: 'nonzero detail after a pen pointerdown',
          pointerType: 'pen',
          detail: 1,
          expected: 'pen',
        },
        {
          name: 'nonzero detail without a pointerdown',
          pointerType: null,
          detail: 1,
          expected: 'mouse',
        },
      ])(
        'classifies a click with an empty pointerType: $name',
        async ({ pointerType, detail, expected }) => {
          const finalFocus = vi.fn((_closeType: InteractionType) => true);

          const Test = defineComponent({
            setup() {
              const isOpen = shallowRef(true);

              const { refs, context } = useFloating({
                open: isOpen,
                onOpenChange: setOpenOf(isOpen),
              });

              const click = useClick(context.rootStore);
              const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

              return () => (
                <>
                  <button
                    data-testid="reference"
                    ref={refs.setReference}
                    {...getReferenceProps()}
                  />
                  <FloatingPortal>
                    {isOpen.value && (
                      <FloatingFocusManager store={context.rootStore} returnFocus={finalFocus}>
                        <div ref={refs.setFloating} {...getFloatingProps()}>
                          <button data-testid="child" />
                        </div>
                      </FloatingFocusManager>
                    )}
                  </FloatingPortal>
                </>
              );
            },
          });

          await render(<Test />);

          const reference = screen.getByTestId('reference');

          if (pointerType) {
            await fireEvent.pointerDown(reference, { pointerType });
          }
          // Synthesized click shape: `PointerEvent` with an empty `pointerType`.
          await fireEvent(
            reference,
            new PointerEvent('click', { bubbles: true, cancelable: true, detail, pointerType: '' }),
          );

          await waitFor(() => {
            expect(finalFocus).toHaveBeenCalledWith(expected);
          });
        },
      );

      test('preserves keyboard close modality when reopening before focus restoration', async () => {
        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);
            const reopenOnClose = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            const click = useClick(context.rootStore);
            const dismiss = useDismiss(context.rootStore);
            const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

            watch(
              [isOpen, reopenOnClose],
              () => {
                if (!isOpen.value && reopenOnClose.value) {
                  reopenOnClose.value = false;
                  isOpen.value = true;
                }
              },
              { flush: 'post' },
            );

            return () => (
              <>
                <span data-testid="open-state">{String(isOpen.value)}</span>
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <button
                  data-testid="reopen-on-close"
                  onClick={() => {
                    reopenOnClose.value = true;
                  }}
                />
                <FloatingPortal>
                  <FloatingFocusManager store={context.rootStore} disabled={!isOpen.value}>
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button data-testid="child" />
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        const reference = screen.getByTestId('reference');
        const focusSpy = vi.spyOn(reference, 'focus');

        try {
          await user.click(reference);
          await waitFor(() => {
            expect(screen.getByTestId('child')).toHaveFocus();
          });

          await fireEvent.click(screen.getByTestId('reopen-on-close'));
          await user.keyboard('{Escape}');

          await waitFor(() => {
            expect(focusSpy).toHaveBeenCalledWith({
              preventScroll: true,
              focusVisible: true,
            });
          });
          expect(screen.getByTestId('open-state')).toHaveTextContent('true');
        } finally {
          focusSpy.mockRestore();
        }
      });

      test('clears outside pointer state between keep-mounted open sessions', async () => {
        let readInsideComponentTree: () => boolean | undefined = () => false;

        const Test = defineComponent({
          setup() {
            const isOpen = shallowRef(false);

            const { refs, context } = useFloating({
              open: isOpen,
              onOpenChange: setOpenOf(isOpen),
            });

            readInsideComponentTree = () => context.rootStore.context.insideComponentTree;

            const click = useClick(context.rootStore);
            const dismiss = useDismiss(context.rootStore);

            const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

            return () => (
              <>
                <span data-testid="open-state">{String(isOpen.value)}</span>
                <button data-testid="before" />
                <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
                <FloatingPortal>
                  <FloatingFocusManager
                    store={context.rootStore}
                    disabled={!isOpen.value}
                    modal={false}
                  >
                    <div ref={refs.setFloating} data-testid="floating" {...getFloatingProps()}>
                      <button data-testid="child" />
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
                <button data-testid="after" />
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        await fireEvent.pointerDown(screen.getByTestId('after'));
        await flushMicrotasks();

        expect(screen.getByTestId('open-state')).toHaveTextContent('false');

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        await waitFor(() => {
          expect(screen.getByTestId('child')).toHaveFocus();
        });

        const focusedOut = fireEvent.focusOut(screen.getByTestId('child'), {
          relatedTarget: screen.getByTestId('after'),
        });

        // The focus manager clears the marker in a microtask, so the case reads it in the task of
        // the event.
        expect(readInsideComponentTree()).toBe(true);
        await focusedOut;
      });
    });

    describe('non-modal + FloatingPortal', () => {
      // The `App` of four cases of this block. `portalOwnerRole` goes to the portal.
      const PortalApp = defineComponent({
        props: { portalOwnerRole: { type: String, default: undefined } },
        setup(props) {
          const open = shallowRef(false);
          const { refs, context } = useFloating({
            open,
            onOpenChange: setOpenOf(open),
          });

          return () => (
            <>
              <span tabindex={0} data-testid="first" />
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => {
                  open.value = true;
                }}
              />
              <FloatingPortal portalOwnerRole={props.portalOwnerRole}>
                {open.value && (
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div data-testid="floating" ref={refs.setFloating}>
                      <span tabindex={0} data-testid="inside" />
                    </div>
                  </FloatingFocusManager>
                )}
              </FloatingPortal>
              <span tabindex={0} data-testid="last" />
            </>
          );
        },
      });

      test('focuses inside element, tabbing out focuses last document element', async () => {
        const { user } = await render(<PortalApp />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('inside')).toHaveFocus();
        await waitForLaterMillisecond();

        await user.tab();

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
        expect(screen.getByTestId('last')).toHaveFocus();
      });

      test('does not mark reference siblings due to outside focus guards', async () => {
        const Test = defineComponent({
          setup() {
            const open = shallowRef(false);
            const { refs, context } = useFloating({
              open,
              onOpenChange: setOpenOf(open),
            });

            return () => (
              <>
                <div data-testid="reference-wrapper">
                  <button
                    data-testid="reference"
                    ref={refs.setReference}
                    onClick={() => {
                      open.value = true;
                    }}
                  />
                  <span data-testid="reference-sibling-1" />
                  <span data-testid="reference-sibling-2" />
                </div>
                <FloatingPortal>
                  {open.value && (
                    <FloatingFocusManager store={context.rootStore} modal={false}>
                      <div data-testid="floating" ref={refs.setFloating}>
                        <span tabindex={0} data-testid="inside" />
                      </div>
                    </FloatingFocusManager>
                  )}
                </FloatingPortal>
              </>
            );
          },
        });

        const { user } = await render(<Test />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByTestId('floating')).toBeInTheDocument();
        expect(screen.getByTestId('reference')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('reference-sibling-1')).not.toHaveAttribute('data-vase-ui-inert');
        expect(screen.getByTestId('reference-sibling-2')).not.toHaveAttribute('data-vase-ui-inert');
      });

      test('renders the aria-owns owner without changing regular reference semantics', async () => {
        const { user } = await render(<PortalApp />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const reference = screen.getByTestId('reference');
        const portalNode = screen.getByTestId('floating').closest('[data-vase-ui-portal]');
        const portalNodeId = portalNode?.id ?? '';
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNodeId).not.toBe('');
        expect(owner).not.toHaveAttribute('role');
        expect(owner).toHaveAttribute('aria-owns', portalNodeId);
        expect(reference).not.toHaveAttribute('aria-owns');
      });

      test('supports setting the aria-owns owner role explicitly', async () => {
        const { user } = await render(<PortalApp portalOwnerRole="group" />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const portalNode = screen.getByTestId('floating').closest('[data-vase-ui-portal]');
        const owner = portalNode?.ownerDocument.querySelector('span[aria-owns]');

        expect(portalNode).not.toBe(null);
        expect(owner).toHaveAttribute('role', 'group');
      });

      test('shift+tab', async () => {
        const { user } = await render(<PortalApp />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();
        await waitForLaterMillisecond();

        await user.tab({ shift: true });

        expect(screen.getByTestId('floating')).toBeInTheDocument();

        await user.tab({ shift: true });

        expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
      });
    });

    describe('Navigation', () => {
      // Base UI calls the functions of `userEvent` directly. Each call makes a new instance of
      // user-event, so the pointer of a call does not start on the element of the call before. The
      // pointer thus does not leave the reference when a case clicks the popup.
      test('does not focus reference when hovering it', async () => {
        await render(<Navigation />);
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await testingLibraryUserEvent.unhover(screen.getByText('Product'));
        expect(screen.getByText('Product')).not.toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by esc key', async () => {
        await render(<Navigation />);
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await testingLibraryUserEvent.keyboard('{Escape}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('returns focus to reference when floating element was opened by hover but is closed by an explicit close button', async () => {
        await render(<Navigation />);
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await flushMicrotasks();
        await waitForLaterMillisecond();
        await testingLibraryUserEvent.click(screen.getByText('Close').parentElement!);
        await testingLibraryUserEvent.keyboard('{Tab}');
        expect(screen.getByText('Close')).toHaveFocus();
        await testingLibraryUserEvent.keyboard('{Enter}');
        expect(screen.getByText('Product')).toHaveFocus();
      });

      test('does not re-open after closing via escape key', async () => {
        await render(<Navigation />);
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await testingLibraryUserEvent.keyboard('{Escape}');
        expect(screen.queryByText('Link 1')).not.toBeInTheDocument();
      });

      test('closes when unhovering floating element even when focus is inside it', async () => {
        await render(<Navigation />);
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await testingLibraryUserEvent.click(screen.getByTestId('subnavigation'));
        await testingLibraryUserEvent.unhover(screen.getByTestId('subnavigation'));
        await testingLibraryUserEvent.hover(screen.getByText('Product'));
        await testingLibraryUserEvent.unhover(screen.getByText('Product'));
        expect(screen.queryByTestId('subnavigation')).not.toBeInTheDocument();
      });
    });
  });

  describe('prop: closeOnFocusOut', () => {
    beforeEach(runFramesAtOnce);

    // The floating element stays mounted after it closes, as a popup does during its exit
    // animation or after `preventUnmountOnClose()`.
    const KeptMountedApp = defineComponent({
      props: {
        onOpenChange: {
          type: Function as PropType<(open: boolean, reason: string) => void>,
          required: true,
        },
      },
      setup(props) {
        const open = shallowRef(true);
        const { refs, context } = useFloating({
          open,
          onOpenChange(nextOpen, eventDetails) {
            props.onOpenChange(nextOpen, eventDetails.reason);
            open.value = nextOpen;
          },
        });

        return () => (
          <>
            <FloatingFocusManager
              store={context.rootStore}
              modal={false}
              initialFocus={false}
              closeOnFocusOut
            >
              <div
                role="dialog"
                ref={refs.setFloating}
                data-testid="floating"
                data-open={String(open.value)}
              />
            </FloatingFocusManager>
            <button
              data-testid="close"
              onClick={() => {
                open.value = false;
              }}
            >
              close
            </button>
            <button data-testid="reference" ref={refs.setReference} />
            <button data-testid="last" />
          </>
        );
      },
    });

    test.each([
      {
        name: 'closes the floating element while it is open',
        closeFirst: false,
        expectedCalls: [[false, 'focus-out']],
      },
      {
        name: 'does not close again a floating element that already closed',
        closeFirst: true,
        expectedCalls: [],
      },
    ])('focus leaving the reference $name', async ({ closeFirst, expectedCalls }) => {
      const handleOpenChange = vi.fn();
      const { user } = await render(<KeptMountedApp onOpenChange={handleOpenChange} />);

      if (closeFirst) {
        await fireEvent.click(screen.getByTestId('close'));
      }
      expect(screen.getByTestId('floating')).toHaveAttribute('data-open', String(!closeFirst));

      screen.getByTestId('reference').focus();
      await flushMicrotasks();
      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('last')).toHaveFocus();
      expect(handleOpenChange.mock.calls).toEqual(expectedCalls);
    });
  });

  describe('prop: restoreFocus', () => {
    beforeEach(runFramesAtOnce);

    const RestoreApp = defineComponent({
      props: {
        restoreFocus: {
          type: [Boolean, String] as PropType<boolean | 'popup'>,
          default: true,
        },
      },
      setup(props) {
        const isOpen = shallowRef(false);
        const removed = shallowRef(false);
        const twoRef = shallowRef<HTMLButtonElement | null>(null);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setOpenOf(isOpen),
        });

        const click = useClick(context.rootStore);
        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return () => (
          <>
            <button
              onClick={() => {
                removed.value = true;
              }}
            >
              remove
            </button>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            {isOpen.value && (
              <FloatingFocusManager
                store={context.rootStore}
                restoreFocus={props.restoreFocus}
                initialFocus={twoRef}
              >
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button>one</button>
                  {!removed.value && <button ref={twoRef}>two</button>}
                  <button>three</button>
                </div>
              </FloatingFocusManager>
            )}
          </>
        );
      },
    });

    test.skipIf(isJSDOM)(
      'true: restores focus to nearest tabbable element if currently focused element is removed',
      async () => {
        const { user } = await render(<RestoreApp />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        await fireEvent.click(remove);

        await waitFor(() => {
          expect(three).toHaveFocus();
        });
      },
    );

    test.skipIf(isJSDOM)(
      'false: does not restore focus to nearest tabbable element if currently focused element is removed',
      async () => {
        const { user } = await render(<RestoreApp restoreFocus={false} />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const remove = screen.getByText('remove');

        expect(two).toHaveFocus();

        await fireEvent.click(remove);
        await flushMicrotasks();

        await waitFor(() => {
          expect(document.body).toHaveFocus();
        });
      },
    );

    test.skipIf(isJSDOM)(
      'popup: keeps focus that moved elsewhere before the deferred re-focus',
      async () => {
        const { user } = await render(<RestoreApp restoreFocus="popup" />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        const two = screen.getByRole('button', { name: 'two' });
        const three = screen.getByRole('button', { name: 'three' });

        expect(two).toHaveFocus();

        const runAnimationFrames = holdAnimationFrames();
        await fireEvent.click(screen.getByText('remove'));
        await flushMicrotasks();
        expect(screen.getByTestId('floating')).toHaveFocus();

        // the app moves focus before the next frame
        three.focus();
        runAnimationFrames();

        expect(three).toHaveFocus();
      },
    );

    test.skipIf(isJSDOM)(
      'popup: re-focuses the popup when focus is still lost on the next frame',
      async () => {
        const { user } = await render(<RestoreApp restoreFocus="popup" />);

        await user.click(screen.getByTestId('reference'));
        await flushMicrotasks();

        expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();

        const runAnimationFrames = holdAnimationFrames();
        await fireEvent.click(screen.getByText('remove'));
        await flushMicrotasks();
        const floating = screen.getByTestId('floating');
        expect(floating).toHaveFocus();

        // focus is lost again before the next frame
        floating.blur();
        expect(document.body).toHaveFocus();
        runAnimationFrames();

        expect(floating).toHaveFocus();
      },
    );

    test('restores focus to the nearest tabbable element when the focused element becomes hidden', async () => {
      const { user } = await render(<RestoreApp />);

      await user.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      const two = screen.getByRole('button', { name: 'two' });
      const three = screen.getByRole('button', { name: 'three' });

      expect(two).toHaveFocus();

      document.body.tabIndex = -1;
      onTestFinished(() => document.body.removeAttribute('tabindex'));
      two.style.visibility = 'hidden';
      document.body.focus();

      await waitFor(() => {
        expect(three).toHaveFocus();
      });
    });
  });

  describe('JSDOM-only coverage: combobox, focus return, hover and tabIndex scenarios', () => {
    beforeEach(runFramesAtOnce);

    // The `role` entry of these Base UI cases: the ARIA props of the reference and of the popup.
    function roleProps(isOpen: boolean, role: 'listbox' | 'dialog') {
      return {
        reference: {
          ...(role === 'dialog' ? { 'aria-haspopup': 'dialog' as const } : {}),
          'aria-expanded': isOpen,
          'aria-controls': isOpen ? 'floating' : undefined,
        },
        floating: {
          id: 'floating',
          role,
        },
      };
    }

    test('trapped combobox prevents focus moving outside floating element', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const role = () => roleProps(isOpen.value, 'listbox');
          const dismiss = useDismiss(context.rootStore);
          const click = useClick(context.rootStore);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            role,
            dismiss,
            click,
          ]);

          return () => (
            <div class="App">
              <input
                ref={refs.setReference}
                {...getReferenceProps()}
                data-testid="input"
                role="combobox"
              />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore}>
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    <button>one</button>
                    <button>two</button>
                  </div>
                </FloatingFocusManager>
              )}
            </div>
          );
        },
      });

      const { user } = await render(<Test />);
      await user.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).not.toHaveFocus();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'two' })).toHaveFocus();
      await user.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await flushMicrotasks();
    });

    test('untrapped combobox creates non-modal focus management', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const role = () => roleProps(isOpen.value, 'listbox');
          const dismiss = useDismiss(context.rootStore);
          const click = useClick(context.rootStore);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([
            role,
            dismiss,
            click,
          ]);

          return () => (
            <>
              <input
                ref={refs.setReference}
                {...getReferenceProps()}
                data-testid="input"
                role="combobox"
              />
              {isOpen.value && (
                <FloatingPortal>
                  <FloatingFocusManager
                    store={context.rootStore}
                    initialFocus={false}
                    modal={false}
                  >
                    <div ref={refs.setFloating} {...getFloatingProps()}>
                      <button>one</button>
                      <button>two</button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              )}
              <button>outside</button>
            </>
          );
        },
      });

      const { user } = await render(<Test />);
      await user.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await waitForLaterMillisecond();
      await user.tab();
      expect(screen.getByRole('button', { name: 'one' })).toHaveFocus();
      await user.tab({ shift: true });
      expect(screen.getByTestId('input')).toHaveFocus();
    });

    test('returns focus to last connected element', async () => {
      const Drawer = defineComponent({
        props: {
          open: { type: Boolean, required: true },
          onOpenChange: { type: Function as PropType<(open: boolean) => void>, required: true },
        },
        setup(props) {
          const { refs, context } = useFloating({
            open: () => props.open,
            onOpenChange: (open) => props.onOpenChange(open),
          });
          const dismiss = useDismiss(context.rootStore);
          const { getFloatingProps } = useTestInteractions([dismiss]);

          return () => (
            <FloatingFocusManager store={context.rootStore}>
              <div ref={refs.setFloating} {...getFloatingProps()}>
                <button data-testid="child-reference" />
              </div>
            </FloatingFocusManager>
          );
        },
      });

      const Parent = defineComponent({
        setup() {
          const isOpen = shallowRef(false);
          const isDrawerOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const dismiss = useDismiss(context.rootStore);
          const click = useClick(context.rootStore);

          const { getReferenceProps, getFloatingProps } = useTestInteractions([click, dismiss]);

          return () => (
            <>
              <button
                ref={refs.setReference}
                data-testid="parent-reference"
                {...getReferenceProps()}
              />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore}>
                  <div ref={refs.setFloating} {...getFloatingProps()}>
                    Parent Floating
                    <button
                      data-testid="parent-floating-reference"
                      onClick={() => {
                        isDrawerOpen.value = true;
                        isOpen.value = false;
                      }}
                    />
                  </div>
                </FloatingFocusManager>
              )}
              {isDrawerOpen.value && (
                <Drawer open={isDrawerOpen.value} onOpenChange={setOpenOf(isDrawerOpen)} />
              )}
            </>
          );
        },
      });

      const { user } = await render(<Parent />);
      await user.click(screen.getByTestId('parent-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('parent-floating-reference')).toHaveFocus();
      await waitForLaterMillisecond();
      await user.click(screen.getByTestId('parent-floating-reference'));
      await flushMicrotasks();
      expect(screen.getByTestId('child-reference')).toHaveFocus();
      await user.keyboard('{Escape}');
      expect(screen.getByTestId('parent-reference')).toHaveFocus();
    });

    test('focus is placed on element with floating props when floating element is a wrapper', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const role = () => roleProps(isOpen.value, 'dialog');

          const { getReferenceProps, getFloatingProps } = useTestInteractions([role]);

          return () => (
            <>
              <button
                ref={refs.setReference}
                {...getReferenceProps({
                  onClick: () => {
                    isOpen.value = !isOpen.value;
                  },
                })}
              />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore}>
                  <div ref={refs.setFloating} data-testid="outer">
                    <div {...getFloatingProps()} data-testid="inner" />
                  </div>
                </FloatingFocusManager>
              )}
            </>
          );
        },
      });

      const { user } = await render(<Test />);

      await user.click(screen.getByRole('button'));
      await flushMicrotasks();

      expect(screen.getByTestId('inner')).toHaveFocus();
    });

    // The `App` of the two cases of a typeable combobox that the Tab key leaves. The option has
    // `tabindex="-1"`, so the popup has no tabbable element.
    const TypeableComboboxApp = defineComponent({
      props: { modal: { type: Boolean, default: undefined } },
      setup(props) {
        const isOpen = shallowRef(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setOpenOf(isOpen),
        });

        const click = useClick(context.rootStore);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

        return () => (
          <>
            <input
              ref={refs.setReference}
              {...getReferenceProps()}
              data-testid="input"
              role="combobox"
            />
            {isOpen.value && (
              <FloatingFocusManager
                store={context.rootStore}
                initialFocus={false}
                modal={props.modal}
              >
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating">
                  <button tabindex={-1}>one</button>
                </div>
              </FloatingFocusManager>
            )}
            <button data-testid="after" />
          </>
        );
      },
    });

    test('floating element closes upon tabbing out of modal combobox', async () => {
      const { user } = await render(<TypeableComboboxApp />);
      await user.click(screen.getByTestId('input'));
      await flushMicrotasks();
      expect(screen.getByTestId('input')).toHaveFocus();
      await user.tab();
      await flushMicrotasks();
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    test('untrapped typeable combobox closes on second tab sequence (click -> tab -> click -> tab)', async () => {
      const { user } = await render(<TypeableComboboxApp modal />);

      await user.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();

      await user.click(screen.getByTestId('input'));
      await flushMicrotasks();

      expect(screen.getByTestId('input')).toHaveFocus();

      await user.tab();
      await flushMicrotasks();

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.queryByTestId('floating')).not.toBeInTheDocument();
    });

    // The `App` of the two cases of a popup that hover opens.
    const HoverApp = defineComponent({
      setup() {
        const isOpen = shallowRef(false);

        const { refs, context } = useFloating({
          open: isOpen,
          onOpenChange: setOpenOf(isOpen),
        });

        const hoverReferenceProps = useHoverTriggerInteraction(context.rootStore, {
          triggerElement: refs.reference,
        });
        useHoverPopupInteraction(context.rootStore);

        const { getReferenceProps, getFloatingProps } = useTestInteractions([
          { reference: hoverReferenceProps },
        ]);

        return () => (
          <>
            <button ref={refs.setReference} {...getReferenceProps()} data-testid="reference" />
            {isOpen.value && (
              <FloatingFocusManager store={context.rootStore}>
                <div ref={refs.setFloating} {...getFloatingProps()} data-testid="floating" />
              </FloatingFocusManager>
            )}
            <button>outside</button>
          </>
        );
      },
    });

    test('focus does not return to reference when floating element is triggered by hover', async () => {
      const { user } = await render(<HoverApp />);

      const reference = screen.getByTestId('reference');

      reference.focus();
      await flushMicrotasks();

      await user.hover(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveFocus();

      await user.unhover(screen.getByTestId('floating'));

      expect(screen.queryByTestId('floating')).toBe(null);
      expect(screen.getByTestId('reference')).not.toHaveFocus();
    });

    test('uses aria-hidden instead of inert on outside nodes if opened with hover and modal=true', async () => {
      const { user } = await render(<HoverApp />);

      await user.hover(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByText('outside')).not.toHaveAttribute('inert');
      expect(screen.getByText('outside')).toHaveAttribute('aria-hidden', 'true');
    });

    test('floating element with no focusable elements and no listbox role gets tabIndex=0 when initialFocus is -1', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          return () => (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => {
                  isOpen.value = true;
                }}
              />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore} initialFocus={false} modal={false}>
                  <div ref={refs.setFloating} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              )}
            </>
          );
        },
      });

      const { user } = await render(<Test />);

      const reference = screen.getByTestId('reference');
      await user.click(reference);
      await flushMicrotasks();
      await fireEvent.focusOut(reference);
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
    });

    test('floating element with managed tabIndex is downgraded once content becomes tabbable', async () => {
      const Test = defineComponent({
        props: { hasTabbableContent: Boolean },
        setup(props) {
          const { refs, context } = useFloating({
            open: true,
            onOpenChange() {},
          });

          return () => (
            <>
              <button data-testid="reference" ref={refs.setReference} />
              <FloatingFocusManager store={context.rootStore} initialFocus={false} modal={false}>
                <div ref={refs.setFloating} data-testid="floating" role="dialog">
                  {props.hasTabbableContent && <button data-testid="inside" />}
                </div>
              </FloatingFocusManager>
            </>
          );
        },
      });

      const { rerender } = await render(<Test />);
      await flushMicrotasks();

      const reference = screen.getByTestId('reference');
      reference.focus();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '0');

      await rerender(<Test hasTabbableContent />);
      await flushMicrotasks();

      await fireEvent.focusOut(reference, { relatedTarget: screen.getByTestId('inside') });
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('floating')).toHaveAttribute('data-tabindex', '-1');
    });

    test('floating element with listbox role ignores tabIndex setting', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const click = useClick(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return () => (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => {
                  isOpen.value = true;
                }}
                {...getReferenceProps()}
              >
                ref
              </button>
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore} initialFocus={false} modal={false}>
                  <div
                    ref={refs.setFloating}
                    role="listbox"
                    data-testid="floating"
                    {...getFloatingProps()}
                  >
                    floating
                  </div>
                </FloatingFocusManager>
              )}
            </>
          );
        },
      });

      const { user } = await render(<Test />);
      await user.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
    });

    test('handles manual tabindex on dialog floating element', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          return () => (
            <>
              <button
                data-testid="reference"
                ref={refs.setReference}
                onClick={() => {
                  isOpen.value = true;
                }}
              />
              {isOpen.value && (
                <FloatingFocusManager store={context.rootStore} modal={false}>
                  <div ref={refs.setFloating} data-testid="floating" role="dialog" />
                </FloatingFocusManager>
              )}
            </>
          );
        },
      });

      const { user } = await render(<Test />);

      await user.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '0');
      await user.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await user.tab();
      expect(screen.getByTestId('floating')).toHaveFocus();
    });

    test('standard tabbing back and forth of a non-modal floating element', async () => {
      const Test = defineComponent({
        setup() {
          const isOpen = shallowRef(false);

          const { refs, context } = useFloating({
            open: isOpen,
            onOpenChange: setOpenOf(isOpen),
          });

          const click = useClick(context.rootStore);
          const { getReferenceProps, getFloatingProps } = useTestInteractions([click]);

          return () => (
            <>
              <button data-testid="reference" ref={refs.setReference} {...getReferenceProps()} />
              {isOpen.value && (
                <FloatingPortal>
                  <FloatingFocusManager store={context.rootStore} modal={false}>
                    <div
                      ref={refs.setFloating}
                      data-testid="floating"
                      role="dialog"
                      {...getFloatingProps()}
                    >
                      <button data-testid="inner">inner</button>
                    </div>
                  </FloatingFocusManager>
                </FloatingPortal>
              )}
            </>
          );
        },
      });
      const { user } = await render(<Test />);

      await user.click(screen.getByTestId('reference'));
      await flushMicrotasks();

      expect(screen.getByTestId('floating')).toHaveAttribute('tabindex', '-1');
      expect(screen.getByTestId('inner')).toHaveFocus();
      await waitForLaterMillisecond();
      await user.tab({ shift: true });
      expect(screen.getByTestId('reference')).toHaveFocus();
      await user.tab();
      expect(screen.getByTestId('inner')).toHaveFocus();
    });
  });
});
