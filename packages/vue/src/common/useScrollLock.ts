import { onMounted, toValue, watch, type MaybeRefOrGetter } from 'vue';
import { getPortalLocation } from '../utils/popups/portal/portalElements';
import { ownerDocument, ownerWindow } from './owner';

// One count for each document, so that the last unlock restores the page.
const locks = new WeakMap<Document, { count: number; restore: () => void }>();

// The viewport takes its overflow from `<html>` when `<html>` has one, and from `<body>` else.
function viewportScroller(html: HTMLElement, body: HTMLElement) {
  return /auto|scroll|hidden|clip/.test(getStyle(html).overflow) ? html : body;
}

function getStyle(element: HTMLElement) {
  return ownerWindow(element).getComputedStyle(element);
}

function saveStyle(element: HTMLElement, names: string[]) {
  const saved = names.map((name) => [name, element.style.getPropertyValue(name)] as const);
  return () => {
    for (const [name, value] of saved) element.style.setProperty(name, value);
  };
}

function lock(doc: Document) {
  const html = doc.documentElement;
  const body = doc.body;
  const win = ownerWindow(html);
  const scrollbar = win.innerWidth - html.clientWidth;
  // An overlay scrollbar takes no room, so `overflow: hidden` alone stops the scroll.
  if (scrollbar <= 0) {
    const scroller = viewportScroller(html, body);
    const restore = saveStyle(scroller, ['overflow']);
    scroller.style.overflow = 'hidden';
    return restore;
  }
  // `overflow: hidden` on the element that scrolls the view removes a scrollbar that takes room,
  // and the page gets wider (test/measurements/popup.test.ts). So `<html>` keeps its scrollbar, and
  // `<body>` shows the page at its scroll offset.
  const { scrollTop, scrollLeft } = html;
  const htmlStyle = getStyle(html);
  const bodyStyle = getStyle(body);
  const marginY =
    Number.parseFloat(bodyStyle.marginTop) + Number.parseFloat(bodyStyle.marginBottom);
  const marginX =
    Number.parseFloat(bodyStyle.marginLeft) + Number.parseFloat(bodyStyle.marginRight);
  const scrollbarY = win.innerHeight - html.clientHeight;
  const restoreHtml = saveStyle(html, ['overflow-x', 'overflow-y', 'scroll-behavior']);
  const restoreBody = saveStyle(body, ['position', 'width', 'height', 'box-sizing', 'overflow']);
  const scrolls = (axis: 'X' | 'Y') =>
    htmlStyle[`overflow${axis}`] === 'scroll' ||
    (axis === 'Y' ? html.scrollHeight > html.clientHeight : html.scrollWidth > html.clientWidth);
  Object.assign(html.style, {
    overflowY: scrolls('Y') ? 'scroll' : 'hidden',
    overflowX: scrolls('X') ? 'scroll' : 'hidden',
    // A smooth scroll would animate the move back to the offset.
    scrollBehavior: 'auto',
  });
  Object.assign(body.style, {
    position: 'relative',
    width: `calc(100vw - ${marginX + scrollbar}px)`,
    height: `calc(100dvh - ${marginY + Math.max(0, scrollbarY)}px)`,
    boxSizing: 'border-box',
    overflow: 'hidden',
  });
  body.scrollTop = scrollTop;
  body.scrollLeft = scrollLeft;
  return () => {
    restoreBody();
    html.style.scrollBehavior = 'auto';
    html.scrollTop = scrollTop;
    html.scrollLeft = scrollLeft;
    restoreHtml();
  };
}

function acquire(doc: Document) {
  let entry = locks.get(doc);
  if (!entry) {
    entry = { count: 0, restore: lock(doc) };
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
    // A portal of a family of `utils/popups` can move its popup to another document. Its
    // registration then changes, and the document of the lock follows.
    watch(
      [
        () => toValue(enabled),
        () => getPortalLocation(toValue(referenceElement)).document ?? ownerDocument(null),
      ],
      ([locked, doc], _, onCleanup) => {
        if (locked) onCleanup(acquire(doc));
      },
      { immediate: true, flush: 'post' },
    );
  });
}
