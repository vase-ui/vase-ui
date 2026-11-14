import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, inject, KeepAlive, nextTick, shallowRef, Teleport } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen } from '#test-utils';
import { PopupFixtureContext } from '../../../../test/fixtures/PopupFixture';
import PopupPart from '../../../../test/fixtures/PopupPart.vue';
import PopupRootPart from '../../../../test/fixtures/PopupRootPart.vue';
import { useFloating } from '../../../../test/fixtures/useFloating';
import { ownerWindow } from '../../../common/owner';
import { platform } from '../../../common/platform';
import { REASONS } from '../../../internals/reasons';
import { mergeProps } from '../../../merge-props/mergeProps';
import { createAttribute } from '../createAttribute';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import FloatingPortalLite from '../portal/FloatingPortalLite.vue';
import { provideFloatingNode, provideFloatingTree, useFloatingNodeId } from '../tree/FloatingTree';
import type { PopupOpenChangeEventDetails } from '../store';
import { useDismiss } from './useDismiss';
import type { UseDismissProps } from './useDismiss';

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
    const {
      refs: { setReference, setFloating },
      context: { rootStore },
    } = useFloating({
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
    const dismiss = useDismiss(rootStore, props.dismiss);

    function toggle() {
      open.value = !open.value;
    }

    return () => {
      const popup = open.value && (
        <div
          data-testid={props.name}
          {...mergeProps(dismiss.floating, { ref: setFloating })}
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
              ref: setReference,
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

describe('useDismiss', () => {
  const { render } = createRenderer();

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

    it('keeps the popup open and the default action when a listener cancels the change', async () => {
      await render(
        <PopupRootPart
          defaultOpen
          onOpenChange={(_: boolean, details: PopupOpenChangeEventDetails) => details.cancel()}
        >
          <DismissedPopupPart />
        </PopupRootPart>,
      );

      const notPrevented = await fireEvent.keyDown(document.body, { key: 'Escape' });

      expect(notPrevented).toBe(true);
      expect(isOpen('popup')).toBe(true);
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

    it('does not close a popup with the press on its reference that opens it', async () => {
      releasePointerAfterTest();
      await render(<Popup name="popup" defaultOpen={false} toggleOn="pointerdown" />);

      await userEvent.click(screen.getByTestId('popup-trigger'));
      await flushMicrotasks();

      expect(isOpen('popup')).toBe(true);
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
            const {
              refs: { setFloating },
              context: { rootStore },
            } = useFloating({
              open,
              onOpenChange(nextOpen) {
                open.value = nextOpen;
              },
            });
            const { floating } = dismiss(rootStore);
            return () => (
              <>
                <button data-testid={`open-${name}`} onClick={() => (open.value = true)} />
                {open.value && (
                  <div data-testid={name} {...mergeProps(floating, { ref: setFloating })} />
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
