import { afterEach, describe, expect, it } from 'vitest';
import { userEvent } from 'vitest/browser';
import { defineComponent, nextTick, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { createRenderer, wait } from '#test-utils';
import {
  createScrollDocument,
  CUSTOM_SCROLLBARS_CSS,
  expectScrollLocksReleased,
  HIDDEN_SCROLLBARS_CSS,
  isPageLocked,
} from '../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../test/fixtures/scrollDocument';
import { fixRoot, moveScrollToBody, useScrollLock } from './useScrollLock';

const Locker = defineComponent({
  props: {
    enabled: { type: Boolean, default: true },
    reference: { type: Object as PropType<Element | null>, default: null },
  },
  setup(props) {
    useScrollLock(
      () => props.enabled,
      () => props.reference,
    );
    return () => null;
  },
});

function inline(element: HTMLElement) {
  return Object.fromEntries(
    Array.from(element.style, (name) => [name, element.style.getPropertyValue(name)]),
  );
}

const POSITIONED = ['static', 'absolute', 'absolute-end', 'absolute-in-ancestor', 'fixed'];

// An element of each position, before the content of the page.
function addPositionedElements({ body }: ScrollDocument) {
  const box = 'width: 10px; height: 10px';
  body.insertAdjacentHTML(
    'afterbegin',
    `<div id="static" style="height: 10px; margin-top: 300px"></div>
    <div id="absolute" style="position: absolute; top: 700px; left: 60px; ${box}"></div>
    <div id="absolute-end" style="position: absolute; right: 10px; bottom: 10px; ${box}"></div>
    <div style="position: relative; height: 50px">
      <div id="absolute-in-ancestor" style="position: absolute; top: 5px; left: 5px; ${box}"></div>
    </div>
    <div id="fixed" style="position: fixed; right: 10px; bottom: 10px; ${box}"></div>`,
  );
}

function places({ doc }: ScrollDocument, ids: string[]) {
  return ids.map((id) => [id, doc.getElementById(id)!.getBoundingClientRect().toJSON()]);
}

describe('useScrollLock', () => {
  const { render } = createRenderer();

  afterEach(async () => {
    await wait(0);
    expectScrollLocksReleased();
  });

  async function lock(page: ScrollDocument, enabled = shallowRef(true)) {
    await render(() => <Locker enabled={enabled.value} reference={page.reference} />);
    await nextTick();
    return enabled;
  }

  it.each([
    { name: 'the body, when html has no overflow', css: '', locked: 'body', other: 'html' },
    {
      name: 'html, when it has an overflow',
      css: 'html { overflow: auto }',
      locked: 'html',
      other: 'body',
    },
  ] as const)(
    'hides the overflow of $name with overlay scrollbars, and restores it',
    async ({ css, locked, other }) => {
      const page = await createScrollDocument({ css: `${HIDDEN_SCROLLBARS_CSS} ${css}` });
      const enabled = await lock(page);
      expect(isPageLocked(page)).toBe(true);
      expect(inline(page[locked])).toEqual({ 'overflow-x': 'hidden', 'overflow-y': 'hidden' });
      expect(inline(page[other])).toEqual({});
      enabled.value = false;
      await nextTick();
      expect(inline(page[locked])).toEqual({});
    },
  );

  // Firefox has overlay scrollbars here. The mocked width takes its lock to the path of scrollbars
  // that take room.
  it.each([
    { name: '', css: '' },
    { name: ' and `<body>` gives the view its overflow', css: 'body { overflow-x: hidden }' },
  ])(
    'keeps a stuck sticky element in place when the scrollbars take room$name',
    async ({ css }) => {
      const page = await createScrollDocument({
        css: `${CUSTOM_SCROLLBARS_CSS} body { margin: 0 } ${css}`,
        mockedScrollbarWidth: 12,
      });
      page.body.insertAdjacentHTML(
        'afterbegin',
        '<div style="height: 1400px"><div id="sticky" style="position: sticky; top: 0; height: 10px"></div></div>',
      );
      const sticky = page.doc.getElementById('sticky')!;
      page.win.scrollTo({ top: 600, behavior: 'instant' });
      expect(sticky.getBoundingClientRect().top).toBe(0);
      await lock(page);
      expect(isPageLocked(page)).toBe(true);
      expect(sticky.getBoundingClientRect().top).toBe(0);
    },
  );

  it('adds no element to the page when the scrollbars take room', async () => {
    const page = await createScrollDocument({
      css: CUSTOM_SCROLLBARS_CSS,
      mockedScrollbarWidth: 12,
    });
    const children = [...page.html.children];
    await lock(page);
    expect(isPageLocked(page)).toBe(true);
    expect([...page.html.children]).toEqual(children);
  });

  it('unlocks the page after the last of two locks', async () => {
    const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
    const first = await lock(page);
    const second = await lock(page);
    first.value = false;
    await nextTick();
    expect(isPageLocked(page)).toBe(true);
    second.value = false;
    await nextTick();
    expect(isPageLocked(page)).toBe(false);
  });

  it('locks only while enabled, and unlocks when the part unmounts', async () => {
    const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
    const enabled = shallowRef(false);
    const shown = shallowRef(true);
    await render(() => (
      <div>{shown.value && <Locker enabled={enabled.value} reference={page.reference} />}</div>
    ));
    await nextTick();
    expect(isPageLocked(page)).toBe(false);
    enabled.value = true;
    await nextTick();
    expect(isPageLocked(page)).toBe(true);
    shown.value = false;
    await nextTick();
    expect(isPageLocked(page)).toBe(false);
  });

  it('VUE-37: locks the document of the reference element and reads its scrollbars', async () => {
    const page = await createScrollDocument({ css: HIDDEN_SCROLLBARS_CSS });
    const enabled = await lock(page);
    expect(isPageLocked(page)).toBe(true);
    expect(document.documentElement.style.overflow).toBe('');
    expect(document.body.style.overflow).toBe('');
    enabled.value = false;
    await nextTick();
  });

  // A sticky element is in the case above: Firefox does not stick it in a fixed `<html>`.
  describe.each([
    {
      name: 'fixRoot',
      lockPage: fixRoot,
      css: 'html { padding: 5px } body { border: 2px solid; padding: 3px }',
    },
    { name: 'moveScrollToBody', lockPage: moveScrollToBody, css: 'body { margin: 0 }' },
  ])('$name', ({ lockPage, css }) => {
    async function createPage(pageCss = '') {
      const page = await createScrollDocument({
        css: `${CUSTOM_SCROLLBARS_CSS} ${css} ${pageCss}`,
      });
      addPositionedElements(page);
      page.win.scrollTo({ left: 30, top: 200, behavior: 'instant' });
      return page;
    }

    it.each([
      { name: '', pageCss: '' },
      { name: ' whose `<html>` hides its wide content', pageCss: 'html { overflow-x: hidden }' },
      { name: ' whose `<body>` hides its wide content', pageCss: 'body { overflow-x: hidden }' },
      {
        name: ' whose `<body>` gives the view its scrollbar',
        pageCss: 'body { overflow-y: scroll }',
      },
    ])(
      'keeps the size of the view and the place of each element of a page$name, stops the wheel, and restores the page',
      async ({ pageCss }) => {
        const page = await createPage(pageCss);
        const size = [page.html.clientWidth, page.html.clientHeight];
        const before = places(page, POSITIONED);
        const unlock = lockPage(page.doc);
        expect([page.html.clientWidth, page.html.clientHeight]).toEqual(size);
        expect(places(page, POSITIONED)).toEqual(before);
        await userEvent.wheel(page.win.frameElement!, { delta: { x: 300, y: 300 } });
        await new Promise((resolve) => page.win.requestAnimationFrame(resolve));
        expect(places(page, POSITIONED)).toEqual(before);
        unlock();
        expect([page.win.scrollX, page.win.scrollY]).toEqual([30, 200]);
        expect(inline(page.html)).toEqual({});
        expect(inline(page.body)).toEqual({});
      },
    );

    it('adds no horizontal scrollbar to a page with no horizontal overflow', async () => {
      const page = await createPage('#content { width: 10px }');
      const height = page.html.clientHeight;
      const unlock = lockPage(page.doc);
      expect(page.html.clientHeight).toBe(height);
      unlock();
    });

    it('keeps the place of each element, and puts the scroll offset back at once, on a page with a smooth `scroll-behavior`', async () => {
      const page = await createPage('html, body { scroll-behavior: smooth }');
      const before = places(page, POSITIONED);
      const unlock = lockPage(page.doc);
      await new Promise((resolve) => page.win.requestAnimationFrame(resolve));
      expect(places(page, POSITIONED)).toEqual(before);
      unlock();
      expect([page.win.scrollX, page.win.scrollY]).toEqual([30, 200]);
    });
  });
});
