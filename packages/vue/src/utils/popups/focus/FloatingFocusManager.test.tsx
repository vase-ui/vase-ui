import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, KeepAlive, nextTick, onMounted, shallowRef, Teleport } from 'vue';
import type { PropType, ShallowRef } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { platform } from '../../../common/platform';
import type { InteractionType } from '../../../common/useEnhancedClickHandler';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { useFloatingRootStore } from '../floating-root/useFloatingRootStore';
import { usePortalContext } from '../portal/FloatingPortalContext';
import type { PortalContextValue } from '../portal/FloatingPortalContext';
import FloatingPortal from '../portal/FloatingPortal.vue';
import { provideFloatingTree } from '../tree/FloatingTree';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { PopupPositioningContext } from '../types';
import FloatingFocusManager from './FloatingFocusManager.vue';
import type { FloatingFocusManagerProps } from './FloatingFocusManager.vue';
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

describe('FloatingFocusManager', () => {
  const { render } = createRenderer();

  describe('initial focus', () => {
    it('focuses the first tabbable element when the popup opens', async () => {
      await render(<Popup />);

      await openPopup();

      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
    });

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

    it('keeps the focus that a part of the popup takes when it is mounted', async () => {
      const FocusedField = defineComponent({
        setup() {
          const field = shallowRef<HTMLInputElement | null>(null);
          onMounted(() => field.value?.focus());
          return () => <input data-testid="focused" ref={field} />;
        },
      });
      await render(
        <Popup>{{ default: () => [<input data-testid="one" />, <FocusedField />] }}</Popup>,
      );

      await openPopup();
      await nextFrame();
      await nextFrame();

      expect(screen.getByTestId('focused')).toHaveFocus();
    });

    it.each([
      { name: 'in the task of a screen reader press', detail: 0, focused: 'one' },
      { name: 'one frame after a mouse press', detail: 1, focused: 'reference' },
    ])('moves the focus $name', async ({ detail, focused }) => {
      await render(<Popup />);
      const reference = screen.getByTestId('reference');
      reference.focus();
      vi.spyOn(window, 'requestAnimationFrame').mockImplementation(() => 0);

      await fireEvent.mouseDown(reference, { detail });
      await flushMicrotasks();

      expect(screen.getByTestId(focused)).toHaveFocus();
    });

    it('moves no focus when the popup closes before the frame', async () => {
      const runFrames = holdAnimationFrames();
      await render(<Popup keepMounted />);
      await openPopup();

      await fireEvent.click(screen.getByTestId('reference'));
      runFrames();

      expect(screen.getByTestId('reference')).toHaveFocus();
    });

    it('moves the focus when a disabled focus manager becomes enabled', async () => {
      const disabled = shallowRef(true);
      await render(() => <Popup manager={{ disabled: disabled.value }} />);
      await openPopup();
      await nextFrame();
      await nextFrame();
      expect(screen.getByTestId('reference')).toHaveFocus();

      disabled.value = false;

      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
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
          close: () => userEvent.click(screen.getByTestId('close')),
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

      it('forgets the close of an earlier open when a popup that stays mounted opens again', async () => {
        const returnFocus = vi.fn((_type: InteractionType) => true);
        await render(<Popup keepMounted manager={{ returnFocus }} />);
        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        screen.getByTestId('close').focus();
        await userEvent.keyboard('{Enter}');
        await waitFor(() => expect(returnFocus).toHaveBeenLastCalledWith('keyboard'));

        await openPopup();
        await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
        await fireEvent.click(screen.getByTestId('reference'));

        await waitFor(() => expect(returnFocus).toHaveBeenCalledTimes(2));
        expect(returnFocus).toHaveBeenLastCalledWith('');
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

    it('moves no focus when the reference changes while the popup is open', async () => {
      const popup = captureStore();
      await render(
        <div>
          <Popup onStore={popup.onStore} />
          <input data-testid="other" />
        </div>,
      );
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('one')).toHaveFocus());
      screen.getByTestId('two').focus();

      popup.store.set('anchorElement', screen.getByTestId('other'));
      await flushMicrotasks();
      expect(screen.getByTestId('two')).toHaveFocus();

      await fireEvent.click(screen.getByTestId('close'));

      await waitFor(() => expect(screen.getByTestId('other')).toHaveFocus());
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

    it('moves the focus into the popup above when no element that had the focus can take it', async () => {
      const removed = shallowRef(false);
      await render(() => (
        <Popup>
          {{
            default: () => [
              <input data-testid="parent-field" />,
              <Popup name="child-" referenceRemoved={removed.value}>
                {{
                  default: ({ close }: { close: () => void }) => (
                    <button
                      data-testid="child-change"
                      onClick={() => {
                        removed.value = true;
                        close();
                      }}
                    />
                  ),
                }}
              </Popup>,
            ],
          }}
        </Popup>
      ));
      await openPopup();
      await waitFor(() => expect(screen.getByTestId('parent-field')).toHaveFocus());
      await openPopup(document, 'child-');
      await waitFor(() => expect(screen.getByTestId('child-change')).toHaveFocus());

      await fireEvent.click(screen.getByTestId('child-change'));

      await waitFor(() => expect(screen.getByTestId('parent-field')).toHaveFocus());
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
    });
  });

  it('sets the tabindex of the popup again when the focus leaves the reference', async () => {
    const hasField = shallowRef(false);
    await render(() => (
      <div>
        <Popup role="dialog" manager={{ initialFocus: false }}>
          {{ default: () => (hasField.value ? <input /> : <span>text</span>) }}
        </Popup>
        <input data-testid="outside" />
      </div>
    ));
    await openPopup();
    const floating = screen.getByTestId('floating');
    expect(floating).toHaveAttribute('tabindex', '0');

    hasField.value = true;
    await nextTick();
    screen.getByTestId('outside').focus();
    await flushMicrotasks();

    expect(floating).toHaveAttribute('tabindex', '-1');
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
      const Popups = defineComponent({
        props: { disabled: Boolean },
        setup: (props) => () => (
          <Popup portal role="dialog" manager={{ disabled: props.disabled }}>
            {{
              default: () => [
                <input data-testid="one" />,
                <Popup name="child-" portal role="dialog" />,
              ],
            }}
          </Popup>
        ),
      });

      async function openBoth() {
        await openPopup();
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
        await openBoth();
        expect(marks()).toEqual(marksOfChildOnTop);

        disabled.value = false;
        await nextTick();

        expect(marks()).toEqual(marksOfChildOnTop);
      });

      it('keeps the popup above hidden after KeepAlive puts the two popups back', async () => {
        const shown = shallowRef(true);
        await render(() => <KeepAlive>{shown.value ? <Popups /> : null}</KeepAlive>);
        await openBoth();
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
});
