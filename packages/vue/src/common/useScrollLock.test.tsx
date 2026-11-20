import { afterEach, describe, expect, it } from 'vitest';
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
import { useScrollLock } from './useScrollLock';

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

// A document whose scrollbars take room in Chromium and WebKit. Firefox on macOS has overlay
// scrollbars, so its cases of such scrollbars do not run there.
async function createInsetDocument(css = '') {
  const page = await createScrollDocument({ css: `${CUSTOM_SCROLLBARS_CSS} ${css}` });
  return { page, inset: page.win.innerWidth - page.html.clientWidth > 0 };
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
    { name: 'html, when it has an overflow', css: 'html { overflow: auto }', locked: 'html', other: 'body' },
  ] as const)('hides the overflow of $name with overlay scrollbars, and restores it', async ({ css, locked, other }) => {
    const page = await createScrollDocument({ css: `${HIDDEN_SCROLLBARS_CSS} ${css}` });
    const enabled = await lock(page);
    expect(isPageLocked(page)).toBe(true);
    expect(inline(page[locked])).toEqual({ 'overflow-x': 'hidden', 'overflow-y': 'hidden' });
    expect(inline(page[other])).toEqual({});
    enabled.value = false;
    await nextTick();
    expect(inline(page[locked])).toEqual({});
  });

  it('keeps the scrollbar of html and the place of the content when the scrollbars take room', async ({ skip }) => {
    const { page, inset } = await createInsetDocument();
    skip(!inset, 'The scrollbars of this browser take no room.');
    page.win.scrollTo({ left: 30, top: 200, behavior: 'instant' });
    const place = page.reference.getBoundingClientRect().toJSON();
    const width = page.html.clientWidth;
    const enabled = await lock(page);
    expect(isPageLocked(page)).toBe(true);
    expect(page.html.style.overflowY).toBe('scroll');
    expect(page.html.clientWidth).toBe(width);
    expect(page.reference.getBoundingClientRect().toJSON()).toEqual(place);
    enabled.value = false;
    await nextTick();
    expect([page.win.scrollX, page.win.scrollY]).toEqual([30, 200]);
    expect(inline(page.html)).toEqual({});
    expect(inline(page.body)).toEqual({});
  });

  it('puts the scroll position back at once on a page with a smooth `scroll-behavior`', async ({ skip }) => {
    const { page, inset } = await createInsetDocument('html { scroll-behavior: smooth }');
    skip(!inset, 'The scrollbars of this browser take no room.');
    page.win.scrollTo({ top: 200, behavior: 'instant' });
    const enabled = await lock(page);
    enabled.value = false;
    await nextTick();
    expect(page.win.scrollY).toBe(200);
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
});
