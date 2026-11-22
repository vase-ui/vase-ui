import { onMounted, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { ownerDocument, ownerWindow } from '../common/owner';

// One count for each document, so that the last unlock restores the page.
const locks = new WeakMap<Document, { count: number; restore: () => void }>();

// The viewport takes its overflow from `<html>` when `<html>` has one, and from `<body>` else.
function viewportScroller(html: HTMLElement, body: HTMLElement) {
  return /auto|scroll|hidden|clip/.test(getStyle(html).overflow) ? html : body;
}

function getStyle(element: HTMLElement) {
  return ownerWindow(element).getComputedStyle(element);
}

// The `overflow` shorthand reads as empty when only one of its longhands is set, so a save of the
// shorthand would remove an `overflow-y` of the page at the restore.
function saveStyle(element: HTMLElement, names: string[]) {
  const saved = names.map((name) => [name, element.style.getPropertyValue(name)] as const);
  return () => {
    for (const [name, value] of saved) element.style.setProperty(name, value);
  };
}

/** The page or the lock of another library already stops the scroll of the view. */
function isLocked(html: HTMLElement, body: HTMLElement) {
  return /hidden|clip/.test(getStyle(viewportScroller(html, body)).overflowY);
}

/**
 * Says if a sticky element sticks in a fixed element that starts above the view. Firefox does not
 * stick it (https://bugzilla.mozilla.org/show_bug.cgi?id=1437761, test/measurements/popup.test.ts).
 */
function sticksInFixedElement(doc: Document) {
  const fixed = doc.createElement('div');
  const sticky = doc.createElement('div');
  fixed.style.cssText = 'position: fixed; top: -2px; height: 4px';
  sticky.style.cssText = 'position: sticky; top: 0';
  fixed.append(sticky);
  doc.documentElement.append(fixed);
  const sticks = sticky.getBoundingClientRect().top > fixed.getBoundingClientRect().top;
  fixed.remove();
  return sticks;
}

/**
 * Keeps the scrollbars of the view with an overflow on `scroller`, and lets `place` show the page
 * at its scroll offset with no range to scroll. `overflow: hidden` on the element that scrolls the
 * view removes a scrollbar that takes room, and the page gets wider
 * (test/measurements/popup.test.ts).
 */
function keepScrollbars(
  scroller: HTMLElement,
  place: (scrollTop: number, scrollLeft: number) => () => void,
) {
  const html = scroller.ownerDocument.documentElement;
  const { scrollTop, scrollLeft } = html;
  // The view has a vertical scrollbar that takes room. A horizontal one stays where the view has it.
  const scrollsX = ownerWindow(html).innerHeight > html.clientHeight;
  const restoreScroller = saveStyle(scroller, ['overflow-x', 'overflow-y']);
  const restoreHtml = saveStyle(html, ['scroll-behavior']);
  Object.assign(scroller.style, { overflowY: 'scroll', overflowX: scrollsX ? 'scroll' : 'hidden' });
  // A smooth scroll would animate the move back to the offset at the unlock.
  html.style.scrollBehavior = 'auto';
  const restorePlace = place(scrollTop, scrollLeft);
  return () => {
    restorePlace();
    // The overflow of the page comes back before the write. Else a `<body>` with an overflow clips
    // the page, and the view has no range for the offset (test/measurements/popup.test.ts).
    restoreScroller();
    html.scrollTop = scrollTop;
    html.scrollLeft = scrollLeft;
    restoreHtml();
  };
}

/**
 * Fixes `<html>` at its scroll offset. A fixed element adds nothing to the scroll range of the view.
 * The insets give `<html>` the box of the view, so an absolute element whose containing block was
 * the initial containing block keeps its place (test/measurements/popup.test.ts). A margin or a
 * border of `<html>` moves that element.
 */
export function fixRoot(doc: Document) {
  const html = doc.documentElement;
  // An overflow on `<html>` stops the view from taking the overflow of `<body>`. `<body>` then
  // scrolls by itself, and a stuck sticky element moves (test/measurements/popup.test.ts).
  return keepScrollbars(viewportScroller(html, doc.body), (scrollTop, scrollLeft) => {
    const restore = saveStyle(html, ['position', 'top', 'right', 'bottom', 'left']);
    Object.assign(html.style, {
      position: 'fixed',
      top: `${-scrollTop}px`,
      right: `${scrollLeft}px`,
      bottom: `${scrollTop}px`,
      left: `${-scrollLeft}px`,
    });
    return restore;
  });
}

/**
 * Gives `<body>` the size of the view and the scroll offset of the page. `<body>` becomes the
 * containing block of an absolute element whose containing block was the initial containing block,
 * so the margin and the border of `<body>` move that element.
 */
export function moveScrollToBody(doc: Document) {
  const html = doc.documentElement;
  const body = doc.body;
  const win = ownerWindow(html);
  const scrollbar = win.innerWidth - html.clientWidth;
  const scrollbarY = win.innerHeight - html.clientHeight;
  const bodyStyle = getStyle(body);
  const marginY =
    Number.parseFloat(bodyStyle.marginTop) + Number.parseFloat(bodyStyle.marginBottom);
  const marginX =
    Number.parseFloat(bodyStyle.marginLeft) + Number.parseFloat(bodyStyle.marginRight);
  // `<body>` scrolls the page, so `<html>` gives the view its overflow.
  return keepScrollbars(html, (scrollTop, scrollLeft) => {
    const restore = saveStyle(body, [
      'position',
      'width',
      'height',
      'box-sizing',
      'overflow-x',
      'overflow-y',
      'scroll-behavior',
    ]);
    Object.assign(body.style, {
      position: 'relative',
      width: `calc(100vw - ${marginX + scrollbar}px)`,
      height: `calc(100dvh - ${marginY + Math.max(0, scrollbarY)}px)`,
      boxSizing: 'border-box',
      overflow: 'hidden',
      // A smooth scroll would animate the move of `<body>` to the offset.
      scrollBehavior: 'auto',
    });
    body.scrollTop = scrollTop;
    body.scrollLeft = scrollLeft;
    return restore;
  });
}

function lock(doc: Document) {
  const html = doc.documentElement;
  // An overlay scrollbar takes no room, so `overflow: hidden` alone stops the scroll.
  if (ownerWindow(html).innerWidth - html.clientWidth <= 0) {
    const scroller = viewportScroller(html, doc.body);
    const restore = saveStyle(scroller, ['overflow-x', 'overflow-y']);
    scroller.style.overflow = 'hidden';
    return restore;
  }
  // Where a sticky element does not stick in a fixed element, a fixed `<html>` would move a stuck
  // header to its place in the page.
  return sticksInFixedElement(doc) ? fixRoot(doc) : moveScrollToBody(doc);
}

/**
 * Locks the page, or waits while the page is already locked. The lock of another overlay can end
 * after this lock starts, at the end of the leave of that overlay. A save of its styles would put
 * them back at the unlock, and its unlock would remove the styles of this lock.
 */
function lockWhenFree(doc: Document) {
  const html = doc.documentElement;
  const body = doc.body;
  if (!isLocked(html, body)) return lock(doc);
  const restores: (() => void)[] = [];
  // Another lock writes an inline style, a class, or an attribute that a style sheet selects.
  const observer = new (ownerWindow(html).MutationObserver)(() => {
    if (isLocked(html, body)) return;
    observer.disconnect();
    restores.push(lock(doc));
  });
  observer.observe(html, { attributes: true });
  observer.observe(body, { attributes: true });
  return () => {
    observer.disconnect();
    for (const restore of restores) restore();
  };
}

function acquire(doc: Document) {
  let entry = locks.get(doc);
  if (!entry) {
    entry = { count: 0, restore: lockWhenFree(doc) };
    locks.set(doc, entry);
  }
  entry.count += 1;
  const owned = entry;
  return () => {
    owned.count -= 1;
    if (owned.count > 0) return;
    locks.delete(doc);
    owned.restore();
  };
}

/**
 * Stops the scroll of the page while `enabled` is true. The document is the one of
 * `referenceElement`. Each lock of a document adds to one count, and the last unlock restores the
 * page.
 */
export function useScrollLock(
  enabled: MaybeRefOrGetter<boolean> = true,
  referenceElement: MaybeRefOrGetter<Element | null> = null,
): void {
  onMounted(() => {
    watch(
      [() => toValue(enabled), () => ownerDocument(toValue(referenceElement))],
      ([locked, doc], _, onCleanup) => {
        if (locked) onCleanup(acquire(doc));
      },
      { immediate: true, flush: 'post' },
    );
  });
}
