import { onTestFinished } from 'vitest';

export type ScrollWindow = Window & typeof globalThis;

const REGISTRY_KEY = Symbol.for('vase-ui.scroll-lock');

export interface ScrollLockRegistry {
  version: number;
  lockCount: number;
  restore: (() => void) | null;
  stableGutter: WeakMap<Document, boolean>;
}

/**
 * The registry that all copies of the library share. It is `undefined` until the first lock. It
 * lives for the whole test file, so each lock test file checks in `afterEach` that no lock is left.
 */
export function getScrollLockRegistry() {
  return (globalThis as { [REGISTRY_KEY]?: ScrollLockRegistry })[REGISTRY_KEY];
}

/**
 * Records each value that the shared count of the locks gets, until the test ends. It makes the
 * registry when no lock has made it yet, in the form that `CONTRIBUTING.md` gives.
 */
export function recordLockCounts() {
  const holder = globalThis as { [REGISTRY_KEY]?: ScrollLockRegistry };
  holder[REGISTRY_KEY] ??= {
    version: 1,
    lockCount: 0,
    restore: null,
    stableGutter: new WeakMap(),
  };
  const registry = holder[REGISTRY_KEY];
  let current = registry.lockCount;
  const values: number[] = [];
  Object.defineProperty(registry, 'lockCount', {
    configurable: true,
    get: () => current,
    set(value: number) {
      current = value;
      values.push(value);
    },
  });
  onTestFinished(() => {
    Object.defineProperty(registry, 'lockCount', {
      configurable: true,
      enumerable: true,
      writable: true,
      value: current,
    });
  });
  return () => values;
}

export interface ScrollDocument {
  win: ScrollWindow;
  doc: Document;
  html: HTMLElement;
  body: HTMLElement;
  /** An empty element of the document, for the `referenceElement` of a lock. */
  reference: HTMLElement;
}

/** The three ways in which the scroll lock holds a page. */
export type ScrollLockStrategy = 'overlay' | 'gutter' | 'body';

/** A style sheet that takes the scrollbars out of the layout in each engine. */
export const HIDDEN_SCROLLBARS_CSS =
  'html { scrollbar-width: none } ::-webkit-scrollbar { display: none }';

/** A style sheet that asks for scrollbars that take 12 px of the layout, where an engine has them. */
export const CUSTOM_SCROLLBARS_CSS = '::-webkit-scrollbar { width: 12px; height: 12px }';

async function mountFrame(css: string) {
  const frame = document.createElement('iframe');
  frame.style.cssText =
    'position: fixed; top: 0; left: 0; width: 400px; height: 300px; border: 0; background: white;';
  // The content is taller and wider than the frame. The style sheet of the caller comes after the
  // size of the content, so it can change the size.
  frame.srcdoc = `<!doctype html><html><head><style>#content { width: 1000px; height: 2000px }</style><style>${css}</style></head><body><div id="reference"></div><div id="content"></div></body></html>`;
  const loaded = new Promise<void>((resolve) => {
    frame.addEventListener('load', () => resolve(), { once: true });
  });
  document.body.append(frame);
  await loaded;

  const win = frame.contentWindow as ScrollWindow;
  const doc = win.document;
  const scrollDocument: ScrollDocument = {
    win,
    doc,
    html: doc.documentElement,
    body: doc.body,
    reference: doc.getElementById('reference')!,
  };
  return { frame, scrollDocument };
}

/**
 * Appends a same-origin `<iframe>` whose document has content taller and wider than the frame, and
 * the style sheet `css`. A case locks this document, so it changes no style of the test page. The
 * frame goes away when the test ends.
 *
 * With `mockedScrollbarWidth`, the window reports an `innerWidth` that is that many pixels above
 * `clientWidth` of `<html>`. A window with a real scrollbar of that width does the same. The layout
 * does not change.
 */
export async function createScrollDocument({
  css = '',
  mockedScrollbarWidth,
}: { css?: string; mockedScrollbarWidth?: number } = {}) {
  const { frame, scrollDocument } = await mountFrame(css);
  onTestFinished(() => frame.remove());
  if (mockedScrollbarWidth !== undefined) {
    const { win, html } = scrollDocument;
    Object.defineProperty(win, 'innerWidth', {
      value: html.clientWidth + mockedScrollbarWidth,
      configurable: true,
    });
  }
  return scrollDocument;
}

/**
 * Says which way the scroll lock takes in a new document that has the style sheet `css`. It reads
 * the scrollbar as the lock does. A case that needs scrollbars that take layout space asks this
 * function. It runs only in an engine that has them.
 */
export async function probeStrategy(css = ''): Promise<ScrollLockStrategy> {
  const { frame, scrollDocument } = await mountFrame(css);
  try {
    const { win, html } = scrollDocument;
    if (win.innerWidth - html.clientWidth <= 0) {
      return 'overlay';
    }
    if (!win.CSS.supports('scrollbar-gutter', 'stable')) {
      return 'body';
    }

    html.style.scrollbarGutter = 'stable';
    const scroller = getViewportScroller(scrollDocument);
    scroller.style.overflowY = 'scroll';
    const before = scroller.offsetWidth;
    scroller.style.overflowY = 'hidden';
    const after = scroller.offsetWidth;
    return before === after ? 'gutter' : 'body';
  } finally {
    frame.remove();
  }
}

// The viewport takes its overflow from <html> when it has one, and from <body> otherwise.
function getViewportScroller({ win, html, body }: ScrollDocument) {
  const { overflow, overflowX, overflowY } = win.getComputedStyle(html);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) ? html : body;
}

/**
 * Whether the scroll lock holds the document. It is the `isScrollLocked` helper of the Base UI
 * tests, for a case that locks the page of the test.
 */
export function isScrollLocked(doc: Document = document) {
  return (
    doc.documentElement.style.overflow === 'hidden' ||
    doc.documentElement.hasAttribute('data-vase-ui-scroll-locked') ||
    doc.body.style.overflow === 'hidden'
  );
}

/**
 * Says if the scroll lock holds the page. With overlay scrollbars and with a gutter, the element
 * that the viewport follows is hidden. With scrollbars that take space, the lock sets its marker
 * and gives the body a fixed size.
 */
export function isPageLocked(scrollDocument: ScrollDocument) {
  const scroller = getViewportScroller(scrollDocument);
  return (
    /hidden|clip/.test(scrollDocument.win.getComputedStyle(scroller).overflowY) ||
    scrollDocument.html.hasAttribute('data-vase-ui-scroll-locked')
  );
}
