import { expect, onTestFinished } from 'vitest';

export type ScrollWindow = Window & typeof globalThis;

/** Expects that no lock holds the page or the document of a frame of the page. */
export function expectScrollLocksReleased() {
  const documents = [
    document,
    ...Array.from(document.querySelectorAll('iframe'), (frame) => frame.contentDocument),
  ];
  for (const doc of documents) {
    if (doc?.body) expect(isScrollLocked(doc)).toBe(false);
  }
}

export interface ScrollDocument {
  win: ScrollWindow;
  doc: Document;
  html: HTMLElement;
  body: HTMLElement;
  /** An empty element of the document, for the `referenceElement` of a lock. */
  reference: HTMLElement;
}

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

// The viewport takes its overflow from <html> when it has one, and from <body> otherwise.
function getViewportScroller({ win, html, body }: Pick<ScrollDocument, 'win' | 'html' | 'body'>) {
  const { overflow, overflowX, overflowY } = win.getComputedStyle(html);
  return /auto|scroll|overlay|hidden|clip/.test(overflow + overflowY + overflowX) ? html : body;
}

/**
 * Says if the scroll lock holds the page of `doc`. With overlay scrollbars, the element that the
 * viewport follows is hidden. With scrollbars that take space, `<html>` keeps its scrollbar, and the
 * lock hides the overflow of `<body>`. A ported case calls it in place of `isScrollLocked` of
 * Base UI.
 */
export function isScrollLocked(doc: Document = document) {
  const page = {
    win: doc.defaultView as ScrollWindow,
    html: doc.documentElement,
    body: doc.body,
  };
  const hidden = (element: HTMLElement) =>
    /hidden|clip/.test(page.win.getComputedStyle(element).overflowY);
  return hidden(getViewportScroller(page)) || (hidden(page.body) && !!page.body.style.height);
}

/**
 * Says if the scroll lock holds the document of a frame from `createScrollDocument`.
 */
export function isPageLocked(scrollDocument: ScrollDocument) {
  return isScrollLocked(scrollDocument.doc);
}
