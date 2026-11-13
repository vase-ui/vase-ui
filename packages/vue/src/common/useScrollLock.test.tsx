import { afterEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent, KeepAlive, nextTick, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, flushMicrotasks, wait, waitFor } from '#test-utils';
import {
  createScrollDocument,
  CUSTOM_SCROLLBARS_CSS,
  getScrollLockRegistry,
  HIDDEN_SCROLLBARS_CSS,
  isPageLocked,
  probeStrategy,
  recordLockCounts,
} from '../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../test/fixtures/scrollDocument';
import { platform } from './platform';
import { useScrollLock } from './useScrollLock';

// A module namespace is read-only. The mock gives `engine` and `os` as plain objects, so a case can
// set a flag.
vi.mock('./platform', async () => {
  const actual = await vi.importActual<typeof import('./platform')>('./platform');
  return {
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine },
      os: { ...actual.platform.os },
    },
  };
});

function setWebKit(webkit: boolean) {
  const actual = platform.engine.webkit;
  Object.defineProperty(platform.engine, 'webkit', { value: webkit, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.engine, 'webkit', { value: actual, configurable: true });
  });
}

function setIos(ios: boolean) {
  const actual = platform.os.ios;
  Object.defineProperty(platform.os, 'ios', { value: ios, configurable: true });
  onTestFinished(() => {
    Object.defineProperty(platform.os, 'ios', { value: actual, configurable: true });
  });
}

// The way that a lock holds a document depends on its scrollbars. A page with scrollbars that take
// layout space is held with the body, or with the gutter when the engine keeps the width of the
// page for a hidden scrollbar. A page with overlay scrollbars needs neither. Each engine runs the
// cases for the ways that it can show.
const hasBodyStrategy = (await probeStrategy(CUSTOM_SCROLLBARS_CSS)) === 'body';
const hasGutterStrategy = (await probeStrategy()) === 'gutter';
const hasInsetScrollbars = hasBodyStrategy || hasGutterStrategy;
// The style sheet of a document that has scrollbars that take layout space.
const INSET_CSS = hasBodyStrategy ? CUSTOM_SCROLLBARS_CSS : '';

const LOCK_MARKER = 'data-vase-ui-scroll-locked';

function createLocker(use: typeof useScrollLock) {
  return defineComponent({
    props: {
      enabled: { type: Boolean, default: true },
      reference: { type: Object as PropType<Element | null>, default: null },
    },
    setup(props) {
      use(
        () => props.enabled,
        () => props.reference,
      );
      return () => null;
    },
  });
}

const Locker = createLocker(useScrollLock);

// The observers of `waitFor` do not see a document in a frame, so it polls.
const POLL = { interval: 5, timeout: 3000 };

// A lock and an unlock each wait for a timer of 0 ms, and a page that has scrollbars that take
// space can send `resize` events that put the lock again in a later frame. Thus a case waits for the
// state that stays. For a state that must not come, a case waits one timer first.
function waitForLock(page: ScrollDocument) {
  return waitFor(() => expect(isPageLocked(page)).toBe(true), POLL);
}

function waitForUnlock(page: ScrollDocument) {
  return waitFor(() => expect(isPageLocked(page)).toBe(false), POLL);
}

function inline(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.style, (name) => [name, element.style.getPropertyValue(name)]),
  );
}

// What a lock changes in a document: the inline style of <html> and <body>, and the marker.
function snapshot({ html, body }: ScrollDocument) {
  return { html: inline(html), body: inline(body), marker: html.hasAttribute(LOCK_MARKER) };
}

// The inline styles, the marker and the scroll position of a document.
function state(page: ScrollDocument) {
  return { ...snapshot(page), scroll: [page.win.scrollX, page.win.scrollY] };
}

// A browser rewrites the value of a style, so the expected value goes through the same rewrite.
function normalize({ doc }: ScrollDocument, properties: Record<string, string>) {
  const scratch = doc.createElement('div');
  for (const [name, value] of Object.entries(properties)) {
    scratch.style.setProperty(name, value);
  }
  return inline(scratch);
}

function pick(element: HTMLElement, names: string[]) {
  const style = inline(element);
  return Object.fromEntries(names.map((name) => [name, style[name]]));
}

// Gives the two elements inline styles that a lock changes, and a scroll position that it moves.
function setOriginalState({ win, html, body }: ScrollDocument) {
  html.style.cssText = 'scroll-behavior: smooth; scrollbar-gutter: auto;';
  body.style.cssText =
    'position: static; box-sizing: content-box; scroll-behavior: auto; overflow: visible;';
  win.scrollTo({ left: 30, top: 200, behavior: 'instant' });
  expect([win.scrollX, win.scrollY]).toEqual([30, 200]);
}

// Counts the writes to the attributes of <html> and <body>.
function observeWrites({ win, html, body }: ScrollDocument) {
  let writes = 0;
  const observer = new win.MutationObserver((records) => {
    writes += records.length;
  });
  observer.observe(html, { attributes: true });
  observer.observe(body, { attributes: true });
  onTestFinished(() => observer.disconnect());
  return () => {
    writes += observer.takeRecords().length;
    return writes;
  };
}

function createExternalLocks() {
  return [
    {
      name: 'an attribute and a style sheet',
      lock({ doc, body }: ScrollDocument) {
        const style = doc.createElement('style');
        style.textContent = 'body[data-scroll-locked]{overflow:hidden!important;}';
        doc.head.append(style);
        body.setAttribute('data-scroll-locked', '1');
        return () => {
          style.remove();
          body.removeAttribute('data-scroll-locked');
        };
      },
    },
    {
      name: 'the overflow shorthand of the body',
      lock({ body }: ScrollDocument) {
        body.style.setProperty('overflow', 'hidden');
        return () => body.style.removeProperty('overflow');
      },
    },
    {
      name: 'the overflow longhands of html',
      lock({ html }: ScrollDocument) {
        html.style.setProperty('scrollbar-gutter', 'stable');
        html.style.setProperty('overflow-x', 'hidden');
        html.style.setProperty('overflow-y', 'hidden');
        return () => {
          html.style.removeProperty('scrollbar-gutter');
          html.style.removeProperty('overflow-x');
          html.style.removeProperty('overflow-y');
        };
      },
    },
  ];
}

describe('useScrollLock', () => {
  const { render } = createRenderer();

  // The hook runs after the unmount of `createRenderer`. The registry lives for the whole file, so
  // a case that leaves a lock would break each later case.
  afterEach(async () => {
    await wait(0);
    const registry = getScrollLockRegistry();
    expect({ lockCount: registry?.lockCount, restore: registry?.restore }).toEqual({
      lockCount: 0,
      restore: null,
    });
  });

  async function lock(page: ScrollDocument, enabled = shallowRef(true)) {
    const result = await render(() => (
      <Locker enabled={enabled.value} reference={page.reference} />
    ));
    return { ...result, enabled };
  }

  async function release(enabled: { value: boolean }) {
    enabled.value = false;
    await nextTick();
  }

  describe('overlay scrollbars', () => {
    it.each([
      { name: 'the body, when html has no overflow', css: '', locked: 'body', other: 'html' },
      {
        name: 'html, when it has an overflow',
        css: 'html { overflow: auto }',
        locked: 'html',
        other: 'body',
      },
    ] as const)('hides the overflow of $name', async ({ css, locked, other }) => {
      const page = await createScrollDocument({ css: `${HIDDEN_SCROLLBARS_CSS} ${css}` });
      expect(page.win.innerWidth - page.html.clientWidth).toBe(0);
      expect(isPageLocked(page)).toBe(false);

      const { enabled } = await lock(page);
      await waitForLock(page);

      expect(pick(page[locked], ['overflow-x', 'overflow-y'])).toEqual({
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
      });
      expect(inline(page[other])).toEqual({});
      expect(page.html.hasAttribute(LOCK_MARKER)).toBe(false);

      await release(enabled);
      await waitForUnlock(page);
      expect(inline(page[locked])).toEqual({});
    });
  });

  describe.runIf(hasGutterStrategy)('gutter strategy', () => {
    it.each([
      { name: 'html', css: 'html { overflow: auto }', locked: 'html' },
      { name: 'the body', css: '', locked: 'body' },
    ] as const)(
      'hides the overflow of $name and sets the gutter of html',
      async ({ css, locked }) => {
        const page = await createScrollDocument({ css });
        await lock(page);
        await waitForLock(page);

        expect(pick(page.html, ['scrollbar-gutter'])).toEqual(
          normalize(page, { 'scrollbar-gutter': 'stable' }),
        );
        expect(pick(page[locked], ['overflow-x', 'overflow-y'])).toEqual({
          'overflow-x': 'hidden',
          'overflow-y': 'hidden',
        });
        expect(page.html.hasAttribute(LOCK_MARKER)).toBe(false);
        if (locked === 'html') {
          expect(page.body.hasAttribute('style')).toBe(false);
        }
      },
    );

    it('keeps both edges of a page that has them', async () => {
      const page = await createScrollDocument({
        css: 'html { scrollbar-gutter: stable both-edges }',
      });
      await lock(page);
      await waitForLock(page);

      expect(pick(page.html, ['scrollbar-gutter'])).toEqual(
        normalize(page, { 'scrollbar-gutter': 'stable both-edges' }),
      );
    });
  });

  describe.runIf(hasBodyStrategy)('body strategy', () => {
    it.each([
      {
        name: 'with no body margin',
        css: 'body { margin: 0 }',
        height: '100dvh',
        width: 'calc(100vw - 12px)',
      },
      {
        name: 'with a body margin',
        css: 'body { margin: 8px }',
        height: 'calc(100dvh - 16px)',
        width: 'calc(100vw - 44px)',
      },
    ])('fixes the size of the body and scrolls html, $name', async ({ css, height, width }) => {
      const page = await createScrollDocument({ css: `${CUSTOM_SCROLLBARS_CSS} ${css}` });
      expect(page.win.innerWidth - page.html.clientWidth).toBe(12);
      await lock(page);

      await waitFor(
        () =>
          expect(snapshot(page)).toEqual({
            html: normalize(page, {
              'scrollbar-gutter': 'stable',
              'overflow-x': 'scroll',
              'overflow-y': 'scroll',
              'scroll-behavior': 'unset',
            }),
            body: normalize(page, {
              position: 'relative',
              height,
              width,
              'box-sizing': 'border-box',
              'overflow-x': 'hidden',
              'overflow-y': 'hidden',
              'scroll-behavior': 'unset',
            }),
            marker: true,
          }),
        POLL,
      );
    });

    it('takes no negative scrollbar width from a body that is wider than the viewport', async () => {
      // The negative margins make the body wider than the viewport, and its width still changes
      // with the scrollbar, so the probe takes the body way.
      const page = await createScrollDocument({
        css: `${CUSTOM_SCROLLBARS_CSS} body { margin: 0 -50px }`,
      });
      expect(page.body.clientWidth).toBeGreaterThan(page.win.innerWidth);
      await lock(page);

      await waitFor(
        () =>
          expect(pick(page.body, ['width'])).toEqual(
            normalize(page, { width: 'calc(100vw - -100px)' }),
          ),
        POLL,
      );
    });

    it('keeps both edges of a page that has them', async () => {
      const page = await createScrollDocument({
        css: `${CUSTOM_SCROLLBARS_CSS} html { scrollbar-gutter: stable both-edges }`,
      });
      await lock(page);

      await waitFor(
        () =>
          expect(pick(page.html, ['scrollbar-gutter'])).toEqual(
            normalize(page, { 'scrollbar-gutter': 'stable both-edges' }),
          ),
        POLL,
      );
    });
  });

  describe('layout', () => {
    // The content has no margin and no width of its own, so the lock can keep the scrollbar track,
    // and the content stays where it is.
    const LAYOUT_CSS = 'body { margin: 0 } #content { width: auto; height: 2000px }';

    function addBlocks({ doc, body, win }: ScrollDocument) {
      body.insertAdjacentHTML(
        'afterbegin',
        '<div id="block" style="height: 20px"></div><div id="fixed" style="position: fixed; top: 0; right: 0; width: 20px; height: 20px"></div>',
      );
      win.scrollTo({ left: 0, top: 200, behavior: 'instant' });
      const rectOf = (id: string) => {
        const { left, top, right, bottom } = doc.getElementById(id)!.getBoundingClientRect();
        return { left, top, right, bottom };
      };
      return () => ({ block: rectOf('block'), fixed: rectOf('fixed') });
    }

    async function expectNoShift(css: string) {
      const page = await createScrollDocument({ css: `${css} ${LAYOUT_CSS}` });
      const measure = addBlocks(page);
      const before = measure();
      expect(page.win.scrollY).toBe(200);

      const { enabled } = await lock(page);
      await waitForLock(page);
      await waitFor(() => expect(measure()).toEqual(before), POLL);

      await release(enabled);
      await waitForUnlock(page);
      await waitFor(() => expect(measure()).toEqual(before), POLL);
    }

    it('keeps the content of a page that has overlay scrollbars in place', async () => {
      await expectNoShift(HIDDEN_SCROLLBARS_CSS);
    });

    it.runIf(hasInsetScrollbars)(
      'keeps the content of a page that has scrollbars that take space in place',
      async () => {
        await expectNoShift(INSET_CSS);
      },
    );
  });

  describe('restore', () => {
    it('gives the styles, the scroll position and the marker of an overlay page back', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      setOriginalState(page);
      const original = state(page);

      const { enabled } = await lock(page);
      await waitForLock(page);

      await release(enabled);
      await waitFor(() => expect(state(page)).toEqual(original), POLL);
    });

    it.runIf(hasGutterStrategy)(
      'gives the styles, the scroll position and the marker of a gutter page back',
      async () => {
        const page = await createScrollDocument();
        setOriginalState(page);
        const original = state(page);

        const { enabled } = await lock(page);
        await waitForLock(page);

        await release(enabled);
        await waitFor(() => expect(state(page)).toEqual(original), POLL);
      },
    );

    it.runIf(hasBodyStrategy)(
      'gives the styles, the scroll position and the marker of a body page back',
      async () => {
        const page = await createScrollDocument({ css: CUSTOM_SCROLLBARS_CSS });
        setOriginalState(page);
        const original = state(page);

        const { enabled } = await lock(page);
        await waitForLock(page);
        expect(page.html.hasAttribute(LOCK_MARKER)).toBe(true);

        await release(enabled);
        await waitFor(() => expect(state(page)).toEqual(original), POLL);
      },
    );
  });

  describe('scrollbar track and scroll containers', () => {
    it.runIf(hasInsetScrollbars)(
      'keeps the scrollbar track of a page that has short content and a scrollbar that never goes',
      async () => {
        const page = await createScrollDocument({
          css: `${INSET_CSS} html { overflow-y: scroll } #content { width: 10px; height: 10px }`,
        });
        const width = page.html.clientWidth;
        expect(page.win.innerWidth - width).toBeGreaterThan(0);

        await lock(page);
        await waitForLock(page);

        await waitFor(() => expect(page.html.clientWidth).toBe(width), POLL);
      },
    );

    it('keeps a scroll container inside the locked page scrollable', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const container = page.doc.createElement('div');
      container.style.cssText = 'width: 100px; height: 100px; overflow: auto';
      container.innerHTML = '<div style="height: 500px"></div>';
      page.body.append(container);

      await lock(page);
      await waitForLock(page);

      container.scrollTop = 80;
      expect(container.scrollTop).toBe(80);
    });
  });

  describe('two locks', () => {
    it.each([{ first: 'a' }, { first: 'b' }] as const)(
      'unlocks the page after the last release, in a timer of 0 ms, when $first releases first',
      async ({ first }) => {
        const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
        const enabled = { a: shallowRef(true), b: shallowRef(true) };
        await render(() => (
          <>
            <Locker enabled={enabled.a.value} reference={page.reference} />
            <Locker enabled={enabled.b.value} reference={page.reference} />
          </>
        ));
        await waitForLock(page);
        const second = first === 'a' ? 'b' : 'a';

        await release(enabled[first]);
        await wait(0);
        expect(isPageLocked(page)).toBe(true);

        await release(enabled[second]);
        expect(isPageLocked(page)).toBe(true);
        await waitForUnlock(page);
      },
    );
  });

  describe('an acquire while the unlock waits', () => {
    it('keeps the lock and writes no style', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const { enabled } = await lock(page);
      await waitForLock(page);
      const countWrites = observeWrites(page);

      await release(enabled);
      enabled.value = true;
      await nextTick();
      await wait(0);

      expect(isPageLocked(page)).toBe(true);
      expect(countWrites()).toBe(0);
    });

    it('keeps the lock and writes no style when the reference element changes', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const other = page.doc.createElement('div');
      page.body.append(other);
      const reference = shallowRef<Element>(page.reference);
      await render(() => <Locker reference={reference.value} />);
      await waitForLock(page);
      const countWrites = observeWrites(page);

      reference.value = other;
      await nextTick();
      await wait(0);

      expect(isPageLocked(page)).toBe(true);
      expect(countWrites()).toBe(0);
    });
  });

  describe('a lock of the page by another script', () => {
    describe.each(createExternalLocks())('$name', ({ lock: lockExternally }) => {
      async function waitForExternalLock(page: ScrollDocument) {
        const unlockExternally = lockExternally(page);
        expect(isPageLocked(page)).toBe(true);
        const result = await lock(page);
        await wait(0);
        // The lock waits, and the page stays locked.
        expect(isPageLocked(page)).toBe(true);
        return { ...result, unlockExternally };
      }

      it('leaves the page alone, takes over with no gap, and unlocks at the release', async () => {
        const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
        const { enabled, unlockExternally } = await waitForExternalLock(page);
        // The observer of the lock is older than this one, so it runs first at a change.
        const samples: boolean[] = [];
        const recorder = new page.win.MutationObserver(() => samples.push(isPageLocked(page)));
        recorder.observe(page.html, { attributes: true });
        recorder.observe(page.body, { attributes: true });
        onTestFinished(() => recorder.disconnect());

        unlockExternally();
        await flushMicrotasks();

        expect(samples.length).toBeGreaterThan(0);
        expect(samples.every(Boolean)).toBe(true);
        expect(isPageLocked(page)).toBe(true);

        await release(enabled);
        await waitForUnlock(page);
        expect(inline(page.html)).toEqual({});
        expect(inline(page.body)).toEqual({});
      });

      it('leaves the styles of the other script when the release comes first', async () => {
        const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
        const { enabled, unlockExternally } = await waitForExternalLock(page);

        await release(enabled);
        await wait(0);
        expect(isPageLocked(page)).toBe(true);

        unlockExternally();
        await wait(0);
        expect(isPageLocked(page)).toBe(false);
        expect(inline(page.html)).toEqual({});
        expect(inline(page.body)).toEqual({});
      });
    });

    it('locks at once when html owns the scroll and a script hides only the body', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      page.html.style.overflowY = 'scroll';
      page.body.style.overflowY = 'hidden';
      expect(isPageLocked(page)).toBe(false);

      const { enabled } = await lock(page);
      await waitForLock(page);

      expect(pick(page.html, ['overflow-x', 'overflow-y'])).toEqual({
        'overflow-x': 'hidden',
        'overflow-y': 'hidden',
      });

      await release(enabled);
      await waitForUnlock(page);
      expect(pick(page.html, ['overflow-x', 'overflow-y'])).toEqual({
        'overflow-x': undefined,
        'overflow-y': 'scroll',
      });
      expect(page.body.style.overflowY).toBe('hidden');
    });
  });

  describe('a resize while the page is locked', () => {
    it.runIf(hasBodyStrategy)(
      'puts the page back, locks it again in the next frame, and restores the first values',
      async () => {
        const page = await createScrollDocument({
          css: `${CUSTOM_SCROLLBARS_CSS} body { margin: 0 }`,
        });
        setOriginalState(page);
        const original = snapshot(page);
        const { enabled } = await lock(page);
        await waitForLock(page);
        const locked = snapshot(page);
        expect(locked.marker).toBe(true);

        page.win.dispatchEvent(new page.win.Event('resize'));
        expect(snapshot(page)).toEqual(original);

        await waitFor(() => expect(snapshot(page)).toEqual(locked), POLL);

        await release(enabled);
        await waitFor(() => expect(snapshot(page)).toEqual(original), POLL);
      },
    );

    it.runIf(hasBodyStrategy)(
      'leaves the page unlocked when the release comes before the frame',
      async () => {
        const page = await createScrollDocument({
          css: `${CUSTOM_SCROLLBARS_CSS} body { margin: 0 }`,
        });
        setOriginalState(page);
        const original = snapshot(page);
        const { enabled } = await lock(page);
        await waitForLock(page);

        page.win.dispatchEvent(new page.win.Event('resize'));
        await release(enabled);
        await wait(50);

        expect(snapshot(page)).toEqual(original);
      },
    );

    it.runIf(hasBodyStrategy)(
      'does not lock the page again for a resize after the release',
      async () => {
        const page = await createScrollDocument({
          css: `${CUSTOM_SCROLLBARS_CSS} body { margin: 0 }`,
        });
        setOriginalState(page);
        const original = snapshot(page);
        const { enabled } = await lock(page);
        await waitForLock(page);
        await release(enabled);
        await waitFor(() => expect(snapshot(page)).toEqual(original), POLL);

        page.win.dispatchEvent(new page.win.Event('resize'));
        await wait(50);

        expect(snapshot(page)).toEqual(original);
      },
    );

    it('changes nothing of an overlay lock', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      await lock(page);
      await waitForLock(page);
      const locked = snapshot(page);

      page.win.dispatchEvent(new page.win.Event('resize'));
      await wait(50);

      expect(snapshot(page)).toEqual(locked);
    });
  });

  describe('a pinch zoom in WebKit', () => {
    function zoom(page: ScrollDocument, scale: number) {
      Object.defineProperty(page.win, 'visualViewport', { value: { scale }, configurable: true });
    }

    it.runIf(hasInsetScrollbars)(
      'writes no style to a page that has scrollbars that take space',
      async () => {
        setWebKit(true);
        const page = await createScrollDocument({ css: INSET_CSS });
        zoom(page, 2);
        const original = snapshot(page);

        await lock(page);
        await wait(50);

        expect(snapshot(page)).toEqual(original);
      },
    );

    it.runIf(hasInsetScrollbars)('locks a page that is not in WebKit', async () => {
      setWebKit(false);
      const page = await createScrollDocument({ css: INSET_CSS });
      zoom(page, 2);

      await lock(page);

      await waitForLock(page);
    });

    it('does not matter for a page that has overlay scrollbars', async () => {
      setWebKit(true);
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      zoom(page, 2);

      await lock(page);

      await waitForLock(page);
    });
  });

  describe('iOS', () => {
    it.runIf(hasInsetScrollbars)(
      'takes the overlay strategy for a page that has scrollbars that take space',
      async () => {
        setIos(true);
        const page = await createScrollDocument({ css: INSET_CSS });

        await lock(page);
        await waitForLock(page);

        expect(page.html.hasAttribute(LOCK_MARKER)).toBe(false);
        expect(page.html.style.scrollbarGutter).toBe('');
        expect(pick(page.body, ['overflow-x', 'overflow-y'])).toEqual({
          'overflow-x': 'hidden',
          'overflow-y': 'hidden',
        });
      },
    );
  });

  describe('the parameters', () => {
    it('locks only while enabled', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const { enabled } = await lock(page, shallowRef(false));
      await wait(0);
      expect(isPageLocked(page)).toBe(false);

      enabled.value = true;
      await nextTick();
      await waitForLock(page);

      await release(enabled);
      await waitForUnlock(page);
    });

    it('is enabled when the first argument is left out', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const Default = defineComponent({
        setup() {
          useScrollLock(undefined, page.reference);
          return () => null;
        },
      });

      await render(<Default />);

      await waitForLock(page);
    });

    it('does not lock for a getter that gives undefined', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const Undefined = defineComponent({
        setup() {
          useScrollLock(() => undefined as unknown as boolean, page.reference);
          return () => null;
        },
      });

      await render(<Undefined />);
      await wait(0);

      expect(isPageLocked(page)).toBe(false);
    });

    it('unlocks when the part unmounts while the page is locked', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const { unmount } = await lock(page);
      await waitForLock(page);

      unmount();

      await waitForUnlock(page);
    });

    it('locks the document of the reference element', async () => {
      const first = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const second = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const topStyles = { html: inline(document.documentElement), body: inline(document.body) };

      await lock(second);
      await waitForLock(second);

      expect(isPageLocked(first)).toBe(false);
      expect({ html: inline(document.documentElement), body: inline(document.body) }).toEqual(
        topStyles,
      );
    });

    it('takes one lock when the reference element appears in the flush that enables the lock', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const enabled = shallowRef(false);
      const reference = shallowRef<Element | null>(null);
      const Part = defineComponent({
        setup() {
          useScrollLock(enabled, reference);
          // A function ref runs in the flush that renders its element, as a ref to a popup element
          // does.
          return () =>
            enabled.value ? (
              <span
                ref={() => {
                  reference.value = page.reference;
                }}
              />
            ) : null;
        },
      });
      await render(<Part />);
      const lockCounts = recordLockCounts();

      enabled.value = true;
      await nextTick();
      await waitForLock(page);

      expect(lockCounts()).toEqual([1]);
    });

    it('locks the document of the reference element that it has when the lock runs', async () => {
      const first = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const second = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const reference = shallowRef<Element>(first.reference);
      await render(() => <Locker reference={reference.value} />);

      reference.value = second.reference;
      await nextTick();
      await waitForLock(second);

      expect(isPageLocked(first)).toBe(false);
    });
  });

  describe('VUE-37: the window of the locked document', () => {
    it('VUE-37: reads the scrollbars of the document that it locks, not those of the page', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      // The frame is not as wide as the page that holds it.
      (page.win.frameElement as HTMLElement).style.width = `${window.innerWidth - 100}px`;
      expect(page.win.innerWidth).not.toBe(window.innerWidth);
      expect(page.win.innerWidth - page.html.clientWidth).toBe(0);

      await lock(page);
      await waitForLock(page);

      expect(page.html.style.scrollbarGutter).toBe('');
    });
  });

  describe('KeepAlive', () => {
    it('VUE-5: unlocks the page at the deactivation and locks it again at the activation', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const visible = shallowRef(true);
      const lockCounts = recordLockCounts();
      await render(() => (
        <KeepAlive>
          {visible.value ? (
            <Locker key="locker" reference={page.reference} />
          ) : (
            <span key="other" />
          )}
        </KeepAlive>
      ));
      expect(lockCounts()).toEqual([1]);
      await waitForLock(page);

      visible.value = false;
      await nextTick();
      expect(getScrollLockRegistry()?.lockCount).toBe(0);
      await waitForUnlock(page);

      visible.value = true;
      await nextTick();
      expect(getScrollLockRegistry()?.lockCount).toBe(1);
      await waitForLock(page);
    });
  });

  describe('two copies of the module', () => {
    async function createCopies() {
      const copy: typeof import('./useScrollLock') = await import('./useScrollLock?copy' as string);
      expect(copy.useScrollLock).not.toBe(useScrollLock);
      return { A: Locker, B: createLocker(copy.useScrollLock) };
    }

    async function expectLockedUntilEachCopyHasReleased(css: string) {
      const page = await createScrollDocument({ css });
      setOriginalState(page);
      const original = state(page);
      const { A, B } = await createCopies();
      const enabled = { a: shallowRef(true), b: shallowRef(true) };
      await render(() => (
        <>
          <A enabled={enabled.a.value} reference={page.reference} />
          <B enabled={enabled.b.value} reference={page.reference} />
        </>
      ));
      await waitForLock(page);
      expect(getScrollLockRegistry()?.lockCount).toBe(2);
      const locked = snapshot(page);

      await release(enabled.a);
      await wait(0);
      expect(snapshot(page)).toEqual(locked);

      await release(enabled.b);
      await waitFor(() => expect(state(page)).toEqual(original), POLL);
    }

    it('VUE-6: keeps a page that has overlay scrollbars locked until each copy has released its lock', async () => {
      await expectLockedUntilEachCopyHasReleased(HIDDEN_SCROLLBARS_CSS);
    });

    it.runIf(hasBodyStrategy)(
      'VUE-6: keeps a page that has scrollbars that take space locked until each copy has released its lock',
      async () => {
        await expectLockedUntilEachCopyHasReleased(CUSTOM_SCROLLBARS_CSS);
      },
    );

    it('VUE-6: takes one lock and one restore when a copy acquires and releases in one task', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      setOriginalState(page);
      const original = state(page);
      const { A, B } = await createCopies();
      const enabled = { a: shallowRef(true), b: shallowRef(false) };
      await render(() => (
        <>
          <A enabled={enabled.a.value} reference={page.reference} />
          <B enabled={enabled.b.value} reference={page.reference} />
        </>
      ));
      const countWrites = observeWrites(page);

      // The lock timer of copy A still waits when copy B acquires.
      await release(enabled.a);
      enabled.b.value = true;
      await nextTick();
      await waitForLock(page);
      await wait(0);
      expect(getScrollLockRegistry()?.lockCount).toBe(1);
      const lockWrites = countWrites();

      await release(enabled.b);
      await waitFor(() => expect(state(page)).toEqual(original), POLL);
      expect(lockWrites).toBe(2);
      expect(countWrites()).toBe(4);
    });
  });

  describe('BUG-6119: the probe of the scrollbar gutter', () => {
    function countOffsetWidthReads({ win }: ScrollDocument) {
      const spy = vi.spyOn(win.HTMLElement.prototype, 'offsetWidth', 'get');
      onTestFinished(() => spy.mockRestore());
      return spy;
    }

    it.runIf(hasInsetScrollbars)(
      'BUG-6119: reads the layout two times for the first lock of a document and none for later locks',
      async () => {
        const page = await createScrollDocument({ css: INSET_CSS });
        const reads = countOffsetWidthReads(page);
        const { enabled } = await lock(page);
        await waitForLock(page);
        expect(reads).toHaveBeenCalledTimes(2);

        await release(enabled);
        await waitForUnlock(page);
        reads.mockClear();
        enabled.value = true;
        await nextTick();
        await waitForLock(page);
        expect(reads).not.toHaveBeenCalled();

        page.win.dispatchEvent(new page.win.Event('resize'));
        await wait(50);
        await waitForLock(page);
        expect(reads).not.toHaveBeenCalled();
      },
    );

    it.runIf(hasInsetScrollbars)('BUG-6119: probes each document one time', async () => {
      const first = await createScrollDocument({ css: INSET_CSS });
      const second = await createScrollDocument({ css: INSET_CSS });
      const firstReads = countOffsetWidthReads(first);
      const secondReads = countOffsetWidthReads(second);
      const { enabled } = await lock(first);
      await waitForLock(first);
      await release(enabled);
      await waitForUnlock(first);

      await lock(second);
      await waitForLock(second);

      expect(firstReads).toHaveBeenCalledTimes(2);
      expect(secondReads).toHaveBeenCalledTimes(2);
    });

    it('BUG-6119: reads no layout for a lock of a page that has overlay scrollbars', async () => {
      const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
      const reads = countOffsetWidthReads(page);

      await lock(page);
      await waitForLock(page);

      expect(reads).not.toHaveBeenCalled();
    });
  });
});
