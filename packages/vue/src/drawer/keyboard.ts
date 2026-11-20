import { inject, onScopeDispose, watch, type InjectionKey } from 'vue';
import { platform } from '../common/platform';

/** What the keyboard needs of a drawer root. The properties are reactive. */
export interface KeyboardDrawer {
  readonly open: boolean;
  readonly modal: boolean | 'trap-focus';
  /** A dialog or a drawer is open above the drawer. */
  readonly covered: boolean;
  readonly viewport: HTMLElement | null;
}

/** The touch listeners that `Drawer.Viewport` gives to the keyboard provider. */
export interface KeyboardTouch {
  onTouchstart(event: TouchEvent): void;
  onTouchmove(event: TouchEvent): void;
  onTouchend(event: TouchEvent): void;
  onTouchcancel(): void;
}

export const keyboardKey: InjectionKey<KeyboardTouch> = Symbol('drawer keyboard');

/** The keyboard listeners of the provider around the viewport, if one is there. */
export function injectKeyboard() {
  return inject(keyboardKey, null);
}

/** A visual viewport this much shorter than the layout viewport has a keyboard below it. */
const KEYBOARD_HEIGHT = 60;
/** The room between a field and the keyboard, in pixels. */
const MARGIN = 16;
// After a move of the focus with the keyboard up, WebKit resolves its own reveal later and stops
// a smooth scroll; a transition of the layout can also run. So the alignment runs again on an
// interval, four times.
const REALIGN_INTERVAL = 150;
const REALIGN_PASSES = 4;
/** The frames that the alignment waits for a place that does not move. */
const SETTLE_FRAMES = 60;
// Chrome on Android stops a smooth scroll when its own reveal comes. A scroll that stays still for
// three frames goes out again, three times at most.
const STALL_FRAMES = 3;
const MAX_REISSUES = 3;
/** A touch that moves more than this is a drag, not a tap. */
const TAP_MOVE = 10;
/** A tap this near a field gives the field the focus. */
const TAP_SLOP = 16;
const TEXT_INPUTS = new Set(['email', 'number', 'password', 'search', 'tel', 'text', 'url']);
const INTERACTIVE = 'button,a[href],[role="button"],select,[tabindex]:not([tabindex="-1"])';

function isTextControl(element: Element) {
  if (!(element instanceof HTMLElement)) return false;
  if (element.isContentEditable) return true;
  const typeable =
    element.localName === 'textarea' ||
    (element.localName === 'input' && TEXT_INPUTS.has((element as HTMLInputElement).type));
  return typeable && !element.matches(':disabled');
}

/** The text control of a target: the target, the host of an editable text, or the control of a label. */
function textControlOf(target: EventTarget | null): HTMLElement | null {
  if (!(target instanceof HTMLElement)) return null;
  if (isTextControl(target)) {
    let host = target;
    while (host.isContentEditable && host.parentElement?.isContentEditable) {
      host = host.parentElement;
    }
    return host;
  }
  const control = target.closest('label')?.control;
  return control && isTextControl(control) ? control : null;
}

/** The container holds the node, also in a shadow root in it. */
function contains(container: Element, node: Node | null) {
  for (let current = node; current; current = (current.getRootNode() as ShadowRoot).host) {
    if (container.contains(current)) return true;
  }
  return false;
}

function activeElementOf(doc: Document) {
  let active = doc.activeElement;
  while (active?.shadowRoot?.activeElement) active = active.shadowRoot.activeElement;
  return active;
}

function targetOf(event: Event) {
  return event.composedPath()[0] ?? event.target;
}

function elementAt(root: Node, x: number, y: number) {
  return (root as Document | ShadowRoot).elementFromPoint?.(x, y) ?? null;
}

/** The nearest vertical scroller around the field, or the nearest one that can scroll. */
function scrollerOf(field: HTMLElement, viewport: HTMLElement) {
  const scrolls = (element: Element, sized: boolean) => {
    const overflow = getComputedStyle(element).overflowY;
    if (overflow !== 'auto' && overflow !== 'scroll') return false;
    return sized ? element.clientHeight > 0 : element.scrollHeight > element.clientHeight;
  };
  const find = (sized: boolean) => {
    let node: Node | null = field.assignedSlot ?? field.parentNode;
    while (node) {
      if (node instanceof HTMLElement && scrolls(node, sized)) return node;
      if (node === viewport) return null;
      node = (node as Element).assignedSlot ?? node.parentNode ?? (node as ShadowRoot).host ?? null;
    }
    return null;
  };
  return find(false) ?? find(true);
}

/** Hides the geometry of an element for a focus call, and gives a function that restores it. */
function moveForFocus(field: HTMLElement, translateY: number) {
  const { opacity, transform, transition } = field.style;
  field.style.transition = 'none';
  field.style.opacity = '0';
  field.style.transform = `translateY(${translateY}px)`;
  return () => Object.assign(field.style, { opacity, transform, transition });
}

/**
 * Keeps a focused text field of a drawer above the software keyboard. The viewport gets
 * `--drawer-keyboard-inset`, and the scroller of the field gets room below its content.
 */
export function useVirtualKeyboard(drawer: () => KeyboardDrawer): KeyboardTouch {
  let field: HTMLElement | null = null;
  let programmaticFocus = false;
  let openKeyboard: (() => { top: number; bottom: number; resizing: boolean } | null) | null = null;
  let touchStart: { x: number; y: number } | null = null;
  let touchMoved = false;
  let room: {
    element: HTMLElement;
    overflowAnchor: string;
    paddingBottom: string;
    scrollPaddingBottom: string;
    padding: number;
    scrollPadding: number;
  } | null = null;

  function restoreRoom() {
    if (!room) return;
    const { element, overflowAnchor, paddingBottom, scrollPaddingBottom } = room;
    Object.assign(element.style, { overflowAnchor, paddingBottom, scrollPaddingBottom });
    room = null;
  }

  function setRoom(element: HTMLElement, height: number) {
    const slack = Math.max(0, Math.ceil(height));
    if (room && (!room.element.isConnected || room.element !== element || slack === 0)) {
      restoreRoom();
    }
    if (slack === 0) return;
    if (!room) {
      const style = getComputedStyle(element);
      room = {
        element,
        overflowAnchor: element.style.overflowAnchor,
        paddingBottom: element.style.paddingBottom,
        scrollPaddingBottom: element.style.scrollPaddingBottom,
        padding: Number.parseFloat(style.paddingBottom) || 0,
        scrollPadding: Number.parseFloat(style.scrollPaddingBottom) || 0,
      };
    }
    element.style.overflowAnchor = 'none';
    // The last field keeps the margin above the keyboard also in a scroller with less padding.
    element.style.paddingBottom = `${slack + Math.max(room.padding, MARGIN)}px`;
    element.style.scrollPaddingBottom = `${room.scrollPadding + MARGIN}px`;
  }

  watch(
    () => {
      const { open, viewport } = drawer();
      return open ? viewport : null;
    },
    (viewport, _, onCleanup) => {
      field = null;
      restoreRoom();
      if (!viewport) return;
      onCleanup(follow(viewport));
    },
    { flush: 'post', immediate: true },
  );
  onScopeDispose(restoreRoom);

  function follow(viewport: HTMLElement) {
    const doc = viewport.ownerDocument;
    const win = doc.defaultView!;
    const visual = win.visualViewport;
    let frame = 0;
    let realign: ReturnType<typeof setTimeout> | undefined;
    // The bookkeeping of the scroll that the alignment sends: its element and its destination,
    // how often it waited for a place that does not move, and the last place that it saw.
    let scrolling: HTMLElement | null = null;
    let destination = 0;
    let checks = 0;
    let observed = -1;
    let stalled = 0;
    let reissues = 0;
    let keyboardHeight = -1;
    let tallest = win.innerHeight;
    let width = win.innerWidth;
    let probe: HTMLElement | null = null;
    let restoreFocusGeometry: (() => void) | null = null;
    const baseX = win.scrollX;
    const baseY = win.scrollY;

    const requestFrame = (callback: () => void) => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(callback);
    };

    // Chrome on iOS makes `svh` and then the layout viewport as short as the visual viewport,
    // and moves fixed content itself. The keyboard stays known by its height until that height
    // changes by much.
    function keyboard() {
      if (!visual || visual.scale !== 1) return null;
      const layoutHeight = win.innerHeight;
      const visualHeight = visual.height;
      // A keyboard that resizes the layout viewport gives no overlap. On Android it shows as a
      // drop from the tallest layout viewport; on iOS the toolbar of Safari changes it as much.
      let shrunk = false;
      if (platform.os.android) {
        if (win.innerWidth !== width) {
          width = win.innerWidth;
          tallest = layoutHeight;
        }
        tallest = Math.max(tallest, layoutHeight);
        shrunk = tallest - layoutHeight > KEYBOARD_HEIGHT;
      }
      if (layoutHeight - visualHeight > KEYBOARD_HEIGHT || shrunk) {
        keyboardHeight = visualHeight;
      } else if (Math.abs(visualHeight - keyboardHeight) > KEYBOARD_HEIGHT) {
        keyboardHeight = -1;
        return null;
      }
      if (!probe) {
        probe = doc.createElement('div');
        probe.style.cssText = 'position:fixed;top:0;height:100svh;visibility:hidden';
        doc.body.append(probe);
      }
      const followsKeyboard = probe.offsetHeight - visualHeight <= KEYBOARD_HEIGHT;
      const top = Math.max(0, visual.offsetTop);
      return {
        top,
        // Fixed content is already above the keyboard, so an inset would move it two times.
        bottom: followsKeyboard ? layoutHeight : Math.min(layoutHeight, top + visualHeight),
        resizing: followsKeyboard && Math.abs(layoutHeight - visualHeight) >= 1,
      };
    }
    openKeyboard = keyboard;

    function setInset(inset: number) {
      if (inset > 0) viewport.style.setProperty('--drawer-keyboard-inset', `${Math.ceil(inset)}px`);
      else viewport.style.removeProperty('--drawer-keyboard-inset');
    }

    // WebKit can scroll a locked page to reveal a field, for example after the arrows of the
    // keyboard move the focus. A modal drawer puts the page back.
    function restorePageScroll() {
      const { modal, covered } = drawer();
      if (
        modal !== true ||
        covered ||
        !field ||
        (win.scrollX === baseX && win.scrollY === baseY) ||
        !keyboard()
      ) {
        return false;
      }
      // `instant`: a page with `scroll-behavior: smooth` would animate the restore.
      win.scrollTo({ left: baseX, top: baseY, behavior: 'instant' });
      return true;
    }

    function consumeFocusGeometry() {
      restoreFocusGeometry?.();
      restoreFocusGeometry = null;
    }

    function align() {
      consumeFocusGeometry();
      const target = field;
      if (drawer().covered || !target || !contains(viewport, target)) {
        setInset(0);
        restoreRoom();
        return;
      }
      restorePageScroll();
      const visible = keyboard();
      if (!visible) {
        setInset(0);
        restoreRoom();
        return;
      }
      setInset(win.innerHeight - visible.bottom);
      const scroller = scrollerOf(target, viewport);
      if (!scroller) {
        restoreRoom();
        return;
      }
      const box = scroller.getBoundingClientRect();
      const clippedBottom = Math.min(box.bottom, visible.bottom);
      const overlap = box.bottom - visible.bottom;
      setRoom(scroller, overlap > 1 ? overlap : 0);
      const max = Math.max(0, scroller.scrollHeight - scroller.clientHeight);
      if (max <= 0) return;
      const clippedTop = Math.max(box.top, visible.top);
      const visibleTop = clippedTop + MARGIN;
      const visibleBottom = clippedBottom - MARGIN;
      if (visibleBottom <= visibleTop) return;
      // iOS shows a field at the center of the band above the keyboard. Android shows a covered
      // field with the least scroll and leaves a field in view where it is.
      const android = platform.os.android;
      const rect = target.getBoundingClientRect();
      let offset = (rect.top + rect.bottom - visibleTop - visibleBottom) / 2;
      if (android) {
        const margin = Math.min(
          Math.max((clippedBottom - clippedTop - rect.height) / 2, 0),
          MARGIN,
        );
        offset = 0;
        if (rect.top < clippedTop) offset = rect.top - clippedTop - margin;
        else if (rect.bottom > clippedBottom) {
          offset = Math.min(rect.bottom - clippedBottom + margin, rect.top - clippedTop - margin);
        }
      }
      const next = Math.round(Math.min(Math.max(scroller.scrollTop + offset, 0), max));
      if (android && Math.abs(scroller.scrollTop - next) <= 1) {
        scrolling = null;
        return;
      }
      const settled =
        scrolling === scroller && !visible.resizing && Math.abs(destination - next) <= 1;
      if (!settled) {
        // A layout that reacts to the focus can still move the destination. The scroll goes out
        // when two checks give the same destination, or after 60 frames.
        checks = scrolling === scroller ? checks + 1 : 1;
        scrolling = scroller;
        destination = next;
        observed = -1;
        reissues = 0;
        if (checks <= SETTLE_FRAMES) {
          requestFrame(align);
          return;
        }
      } else if (observed >= 0) {
        // A scroll is out. A new one starts its easing again, so it goes out again only when the
        // browser stopped it short.
        const current = scroller.scrollTop;
        if (!android) {
          if (Math.abs(current - next) <= 1 || current !== observed) {
            observed = current;
            return;
          }
        } else {
          if (current !== observed) {
            observed = current;
            stalled = 0;
            requestFrame(align);
            return;
          }
          stalled += 1;
          if (stalled < STALL_FRAMES) {
            requestFrame(align);
            return;
          }
          if (reissues >= MAX_REISSUES) return;
          reissues += 1;
        }
      }
      scrolling = scroller;
      destination = next;
      checks = 0;
      observed = scroller.scrollTop;
      stalled = 0;
      const reduce = win.matchMedia('(prefers-reduced-motion: reduce)').matches;
      scroller.scrollTo({ top: next, behavior: reduce ? 'auto' : 'smooth' });
      if (android) requestFrame(align);
    }

    function scheduleRealign() {
      clearTimeout(realign);
      let passes = REALIGN_PASSES;
      const pass = () => {
        align();
        passes -= 1;
        if (passes > 0) realign = setTimeout(pass, REALIGN_INTERVAL);
      };
      realign = setTimeout(pass, REALIGN_INTERVAL);
    }

    function release() {
      field = null;
      keyboardHeight = -1;
      clearTimeout(realign);
      // A tap moves the focus at its `mousedown`, before its `click` finds the same point. The
      // room stays one more frame.
      requestFrame(align);
    }

    function capture(target: EventTarget | null) {
      if (drawer().covered) return false;
      const control = textControlOf(target);
      if (!control || !contains(viewport, control)) return false;
      if (field !== control) scrolling = null;
      field = control;
      return true;
    }

    function onFocus(event: FocusEvent) {
      // iOS reads the focus options after `focus` and before `focusin`, so the arrows of the
      // keyboard keep `preventScroll` only from here.
      if (restoreFocusGeometry && field && field === targetOf(event)) {
        field.focus({ preventScroll: true });
      }
    }

    function onFocusin(event: FocusEvent) {
      programmaticFocus = false;
      consumeFocusGeometry();
      if (!capture(targetOf(event))) {
        release();
        return;
      }
      if (keyboard()) scheduleRealign();
      requestFrame(align);
    }

    function onFocusout(event: FocusEvent) {
      if (programmaticFocus) return;
      if (capture(event.relatedTarget)) {
        // WebKit scrolls to a field before its `focusin`. The field shows at the center of the
        // band above the keyboard for the focus, so that scroll has nothing to do.
        const visible = keyboard();
        if (field && visible) {
          consumeFocusGeometry();
          const rect = field.getBoundingClientRect();
          restoreFocusGeometry = moveForFocus(
            field,
            (visible.top + visible.bottom - rect.top - rect.bottom) / 2,
          );
        }
        requestFrame(align);
        return;
      }
      release();
    }

    function onViewportChange() {
      if (field || capture(activeElementOf(doc))) requestFrame(align);
    }

    function onScroll() {
      if (restorePageScroll()) requestFrame(align);
    }

    // A finger on the screen owns the scroll.
    function onPointerdown() {
      if (field) cancelAnimationFrame(frame);
      clearTimeout(realign);
      scrolling = null;
    }

    const listeners: [EventTarget, string, EventListener, boolean?][] = [
      [doc, 'focus', onFocus as EventListener, true],
      [doc, 'focusin', onFocusin as EventListener, true],
      [doc, 'focusout', onFocusout as EventListener, true],
      [win, 'scroll', onScroll],
      [doc, 'pointerdown', onPointerdown, true],
    ];
    if (visual) {
      listeners.push(
        [visual, 'resize', onViewportChange],
        [visual, 'scroll', onViewportChange],
        // Chrome can resize the layout viewport after the events of the visual viewport.
        [win, 'resize', onViewportChange],
      );
    }
    for (const [target, type, listener, capture] of listeners) {
      target.addEventListener(type, listener, capture);
    }
    if (capture(activeElementOf(doc))) requestFrame(align);

    return () => {
      for (const [target, type, listener, capture] of listeners) {
        target.removeEventListener(type, listener, capture);
      }
      consumeFocusGeometry();
      field = null;
      restoreRoom();
      cancelAnimationFrame(frame);
      clearTimeout(realign);
      openKeyboard = null;
      probe?.remove();
      viewport.style.removeProperty('--drawer-keyboard-inset');
    };
  }

  function resetTouch() {
    touchStart = null;
    touchMoved = false;
  }

  /** The text field of a tap at a point, `false` for a tap on another control, else `null`. */
  function tapTargetAt(root: Node, x: number, y: number) {
    const exact = elementAt(root, x, y);
    const control = textControlOf(exact);
    if (control) return { focus: control, click: exact as HTMLElement };
    // iOS can move a tap while the page reacts to the keyboard, so the points around it count.
    // A tap on another control or on a label stays its own.
    if (exact?.closest(`${INTERACTIVE},label`)) return false;
    for (const [dx, dy] of [
      [0, TAP_SLOP],
      [0, -TAP_SLOP],
      [TAP_SLOP, 0],
      [-TAP_SLOP, 0],
    ] as const) {
      const near = textControlOf(elementAt(root, x + dx, y + dy));
      if (near) return { focus: near, click: near };
    }
    return null;
  }

  return {
    onTouchstart(event) {
      const touch = event.touches[0];
      touchMoved = false;
      touchStart = touch ? { x: touch.clientX, y: touch.clientY } : null;
    },
    onTouchmove(event) {
      const touch = event.touches[0];
      if (!touch || !touchStart || touchMoved) return;
      touchMoved =
        Math.abs(touch.clientX - touchStart.x) > TAP_MOVE ||
        Math.abs(touch.clientY - touchStart.y) > TAP_MOVE;
    },
    onTouchend(event) {
      const { open, covered, viewport } = drawer();
      const touch = event.changedTouches[0] ?? event.touches[0];
      if (!open || covered || !viewport || !touchStart || touchMoved || !touch) {
        resetTouch();
        return;
      }
      resetTouch();
      const atPoint = tapTargetAt(viewport.getRootNode(), touch.clientX, touch.clientY);
      if (atPoint === false) return;
      const fromTarget = textControlOf(targetOf(event));
      const target =
        atPoint ?? (fromTarget && { focus: fromTarget, click: targetOf(event) as HTMLElement });
      if (!target || !contains(viewport, target.focus) || !contains(viewport, target.click)) return;
      const win = target.focus.ownerDocument.defaultView!;
      // A page that the person zoomed keeps the native tap.
      if (win.visualViewport && win.visualViewport.scale !== 1) return;
      // A tap on the focused field with the keyboard up moves the caret. Android shows a closed
      // keyboard again at a native tap.
      const doc = target.focus.ownerDocument;
      if (
        activeElementOf(doc) === target.focus &&
        (platform.os.android || !win.visualViewport || openKeyboard?.())
      ) {
        return;
      }
      // iOS opens the keyboard only for a focus in the touch. A sheet with a `transform` makes
      // iOS scroll the page also with `preventScroll`, so the field moves away for the call.
      event.preventDefault();
      programmaticFocus = true;
      const restore = moveForFocus(target.focus, -2000);
      try {
        if (activeElementOf(doc) === target.focus) target.focus.blur();
        target.focus.focus({ preventScroll: true });
      } finally {
        restore();
        programmaticFocus = false;
      }
      // `preventDefault()` at `touchend` stops the `click` too.
      target.click.dispatchEvent(
        new PointerEvent('click', {
          bubbles: true,
          cancelable: true,
          clientX: touch.clientX,
          clientY: touch.clientY,
          detail: 1,
          view: win,
        }),
      );
      // iOS 27 shows no keyboard after the person closed it, until a second focus of the field. A
      // label also takes the focus again with no `preventScroll`.
      if (activeElementOf(doc) === target.focus) target.focus.focus({ preventScroll: true });
    },
    onTouchcancel: resetTouch,
  };
}
