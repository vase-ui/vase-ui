import axe from 'axe-core';
import { afterEach, describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { nextEvent } from '../../test/animation';
import { dataAttributes } from '../../test/field';
import { fireEvent } from '../../test/fireEvent';
import ScrollAreaInSlots from '../../test/fixtures/ScrollAreaInSlots.vue';
import ScrollAreaControls from '../../test/fixtures/ScrollAreaControls.vue';
import ScrollAreaInTransition from '../../test/fixtures/ScrollAreaInTransition.vue';
import ScrollAreaParts from '../../test/fixtures/ScrollAreaParts.vue';
import ScrollAreaPartsAlone from '../../test/fixtures/ScrollAreaPartsAlone.vue';
import { mount, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

const OVERFLOW = [
  'data-has-overflow-x',
  'data-has-overflow-y',
  'data-overflow-x-end',
  'data-overflow-x-start',
  'data-overflow-y-end',
  'data-overflow-y-start',
];

/**
 * Mounts `ScrollAreaParts`, and waits for the first measurement. A change of a size in the same
 * task as the report of the observer gives the loop error of the browser, so the wait ends in a
 * later task.
 */
async function mountArea(props: Record<string, unknown> = {}) {
  const mounted = mount(ScrollAreaParts, props);
  const get = (name: string) => mounted.root.querySelector<HTMLElement>(`.${name}`);
  const viewport = get('viewport')!;
  await waitFor(() => expect(distance(viewport, 'y-end')).not.toBe(''));
  await settle();
  return { ...mounted, get, viewport, area: get('root')! };
}

function distance(viewport: HTMLElement, edge: string) {
  return viewport.style.getPropertyValue(`--scroll-area-overflow-${edge}`);
}

/** Scrolls the viewport, and waits for the `scroll` event of the browser and the render. */
async function scrollViewport(viewport: HTMLElement, left: number, top: number) {
  const scrolled = nextEvent(viewport, 'scroll');
  viewport.scrollLeft = left;
  viewport.scrollTop = top;
  await scrolled;
  await nextTick();
}

/** Gives the viewport a position that the browser does not give, as WebKit in its rubber band. */
async function reportPosition(
  viewport: HTMLElement,
  key: 'scrollTop' | 'scrollLeft',
  value: number,
) {
  Object.defineProperty(viewport, key, { configurable: true, get: () => value });
  await fireEvent.scroll(viewport);
}

function thumbBox(thumb: HTMLElement, track: HTMLElement) {
  const box = thumb.getBoundingClientRect();
  const trackBox = track.getBoundingClientRect();
  return {
    top: box.top - trackBox.top,
    left: box.left - trackBox.left,
    right: trackBox.right - box.right,
    bottom: trackBox.bottom - box.bottom,
    width: box.width,
    height: box.height,
  };
}

describe('the parts', () => {
  test('each part renders a div with its attributes, and the attributes of the developer reach it', async () => {
    const onScroll = vi.fn();
    const mine = (more: Record<string, unknown> = {}) => ({
      class: 'mine',
      'data-kind': 'mine',
      ...more,
    });
    const { get, viewport, area, exposed } = await mountArea({
      scene: { corner: true },
      root: mine(),
      viewport: mine({ tabindex: -1, onScroll }),
      content: mine(),
      vertical: mine(),
      thumbY: mine(),
      corner: mine(),
    });
    const elements = {
      root: area,
      viewport,
      content: get('content')!,
      vertical: get('vertical')!,
      thumbY: get('thumb-y')!,
      corner: get('corner')!,
    };
    for (const [name, element] of Object.entries(elements)) {
      expect(element.localName).toBe('div');
      expect(element).toHaveClass(name === 'thumbY' ? 'thumb-y' : name, 'mine');
      expect(element).toHaveAttribute('data-kind', 'mine');
      expect(exposed[name].element).toBe(element);
    }
    expect(area.style.position).toBe('relative');
    expect(area.style.getPropertyValue('--scroll-area-corner-width')).toBe('10px');
    expect(viewport).toHaveClass('vase-ui-disable-scrollbar');
    expect(viewport.style.overflow).toBe('scroll');
    // The `tabindex` of the developer wins over the tab stop of a viewport that can scroll.
    expect(viewport.tabIndex).toBe(-1);
    expect(elements.content.style.minWidth).toBe('fit-content');
    expect(elements.vertical).toHaveAttribute('aria-hidden', 'true');
    expect(elements.vertical).toHaveAttribute('data-orientation', 'vertical');
    expect(elements.vertical.style.position).toBe('absolute');
    expect(elements.vertical.style.touchAction).toBe('none');
    expect(elements.thumbY).toHaveAttribute('data-orientation', 'vertical');
    expect(elements.corner).toHaveAttribute('aria-hidden', 'true');
    for (const element of [area, viewport, elements.content, elements.thumbY]) {
      expect(element).not.toHaveAttribute('role');
    }

    await scrollViewport(viewport, 0, 400);
    expect(onScroll).toHaveBeenCalled();
    expect(distance(viewport, 'y-start')).toBe('400px');
  });

  test('a scrollbar and a corner have aria-hidden, and the value of the developer wins', async () => {
    const vertical = reactive<Record<string, unknown>>({ 'aria-hidden': 'false' });
    const corner = reactive<Record<string, unknown>>({ 'aria-hidden': undefined });
    const { get } = await mountArea({ scene: { corner: true }, vertical, corner });
    const bar = get('vertical')!;
    expect(bar).toHaveAttribute('aria-hidden', 'false');
    expect(get('corner')).not.toHaveAttribute('aria-hidden');
    vertical['aria-hidden'] = null;
    await nextTick();
    expect(bar).not.toHaveAttribute('aria-hidden');
  });

  test('the element slot of each part renders the element of the developer, with the state', async () => {
    const { root } = mount(ScrollAreaInSlots);
    const area = root.querySelector('section')!;
    await waitFor(() => expect(root.querySelector('.corner')).not.toBeNull());
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    const thumb = root.querySelector<HTMLElement>('.thumb-y')!;
    expect(area).toHaveClass('root');
    expect(area).toHaveAttribute('data-has-overflow-y');
    expect(viewport.localName).toBe('article');
    expect(viewport.tabIndex).toBe(0);
    expect(root.querySelector('ul')).toHaveAttribute('data-has-overflow-x');
    expect(root.querySelector('aside')).toHaveAttribute('aria-hidden', 'true');
    expect(root.querySelector('i')).toHaveStyle({ width: '10px' });
    expect(thumb.localName).toBe('span');
    expect(thumb.offsetHeight).toBe(38);
    for (const part of [area, viewport, root.querySelector('ul')!]) {
      expect(JSON.parse(part.dataset.state!)).toMatchObject({
        hasOverflowX: true,
        hasOverflowY: true,
        cornerHidden: false,
      });
    }
    expect(JSON.parse(root.querySelector<HTMLElement>('aside')!.dataset.state!)).toMatchObject({
      orientation: 'vertical',
      scrolling: false,
    });
    expect(JSON.parse(thumb.dataset.state!)).toEqual({ orientation: 'vertical', scrolling: false });
    await scrollViewport(viewport, 0, 400);
    expect(thumbBox(thumb, root.querySelector('aside')!).top).toBe(76);
  });

  test('a scrollbar and a content whose element slot binds no elementRef give no error', async () => {
    const { root } = mount(ScrollAreaInSlots, { unbound: true });
    await waitFor(() => expect(root.querySelector('aside')).not.toBeNull());
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    await scrollViewport(viewport, 0, 400);
    expect(root.querySelector('.thumb-y')!.getAttribute('style')).not.toContain('translate');
    expect(root.querySelector('i')).toHaveStyle({ width: '0px' });
  });

  test('a scroll area with a named viewport has no accessibility violation', async () => {
    const { area } = await mountArea({
      scene: { corner: true },
      viewport: { role: 'region', 'aria-label': 'Notes' },
    });
    const results = await axe.run(area);
    expect(results.violations).toEqual([]);
  });

  test('a scrollbar and a corner in Transition get the enter classes when the overflow starts', async () => {
    const scene = reactive({ height: 100 });
    const { root } = mount(ScrollAreaInTransition, { scene });
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    await waitFor(() => expect(distance(viewport, 'y-end')).toBe('0px'));
    await settle();
    scene.height = 1000;
    await waitFor(() => expect(root.querySelector('.corner')).not.toBeNull());
    expect(root.querySelector('.vertical')).toHaveClass('v-enter-active');
    expect(root.querySelector('.corner')).toHaveClass('v-enter-active');
  });

  test('in a <Transition>, an overflow that comes back during the leave renders one scrollbar and one corner at each moment; each new element enters after the old one goes', async () => {
    const scene = reactive({ height: 1000 });
    const { root } = mount(ScrollAreaInTransition, { scene });
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    const parts = () => [...root.querySelectorAll('.vertical, .corner')];
    await waitFor(() =>
      expect(parts().map((part) => part.className)).toEqual(['vertical', 'corner']),
    );
    await settle();
    const old = parts();
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, parts().length)));
    observer.observe(root, { childList: true, subtree: true });
    scene.height = 100;
    await waitFor(() => expect(old[0]).toHaveClass('v-leave-active'));
    await settle();
    scene.height = 1000;
    await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-y'));
    expect(parts()).toEqual(old);
    await waitFor(() => {
      expect(parts().map((part) => part.className)).toEqual(['vertical', 'corner']);
      expect(parts().filter((part) => old.includes(part))).toEqual([]);
    });
    observer.disconnect();
    expect(most).toBe(2);
  });
});

describe('overflow', () => {
  test('the root, the viewport, the content and the scrollbars show the overflow of each edge', async () => {
    const { get, viewport, area } = await mountArea();
    const parts = [area, viewport, get('content')!, get('vertical')!, get('horizontal')!];
    const read = () =>
      parts.map((part) => dataAttributes(part).filter((name) => OVERFLOW.includes(name)));
    const atStart = [
      'data-has-overflow-x',
      'data-has-overflow-y',
      'data-overflow-x-end',
      'data-overflow-y-end',
    ];
    expect(read()).toEqual(parts.map(() => atStart));
    expect(viewport.tabIndex).toBe(0);
    expect(
      ['x-start', 'x-end', 'y-start', 'y-end'].map((edge) => distance(viewport, edge)),
    ).toEqual(['0px', '800px', '0px', '800px']);

    await scrollViewport(viewport, 400, 300);
    expect(read()).toEqual(parts.map(() => OVERFLOW));
    expect(
      ['x-start', 'x-end', 'y-start', 'y-end'].map((edge) => distance(viewport, edge)),
    ).toEqual(['400px', '400px', '300px', '500px']);

    await scrollViewport(viewport, 800, 800);
    const atEnd = [
      'data-has-overflow-x',
      'data-has-overflow-y',
      'data-overflow-x-start',
      'data-overflow-y-start',
    ];
    expect(read()).toEqual(parts.map(() => atEnd));
  });

  test('a scroll that changes no state renders no part: only the variables and the thumbs change', async () => {
    const { viewport, area } = await mountArea({ scene: { corner: true } });
    await scrollViewport(viewport, 100, 100);
    const changes: string[] = [];
    const observer = new MutationObserver((records) => {
      for (const { target, attributeName } of records) {
        changes.push(`${(target as Element).classList[0]} ${attributeName}`);
      }
    });
    observer.observe(area, { attributes: true, subtree: true });
    onTestFinished(() => observer.disconnect());
    await scrollViewport(viewport, 200, 300);
    await settle();
    expect([...new Set(changes)].sort()).toEqual([
      'thumb-x style',
      'thumb-y style',
      'vase-ui-disable-scrollbar style',
    ]);
  });

  test('a distance of 1px or less counts as the edge, also at a position that is not a whole number', async () => {
    const { viewport, area } = await mountArea();
    await reportPosition(viewport, 'scrollTop', 799.5);
    expect(area).toHaveAttribute('data-overflow-y-start');
    expect(area).not.toHaveAttribute('data-overflow-y-end');
    expect(distance(viewport, 'y-end')).toBe('0px');
    await reportPosition(viewport, 'scrollTop', 0.6);
    expect(area).not.toHaveAttribute('data-overflow-y-start');
    expect(distance(viewport, 'y-start')).toBe('0px');
  });

  test('overflowEdgeThreshold keeps an edge without overflow until its distance passes the threshold', async () => {
    const root = reactive<Record<string, unknown>>({
      overflowEdgeThreshold: { xStart: 20, yStart: 5, yEnd: -10 },
    });
    const { viewport, area } = await mountArea({ root });
    await scrollViewport(viewport, 15, 7);
    expect(area).not.toHaveAttribute('data-overflow-x-start');
    expect(area).toHaveAttribute('data-overflow-y-start');
    expect(distance(viewport, 'x-start')).toBe('15px');
    await scrollViewport(viewport, 35, 790);
    expect(area).toHaveAttribute('data-overflow-x-start');
    // A negative threshold counts as `0`.
    expect(area).toHaveAttribute('data-overflow-y-end');
    await scrollViewport(viewport, 35, 800);
    expect(area).not.toHaveAttribute('data-overflow-y-end');

    // The edges follow a new threshold with no scroll.
    root.overflowEdgeThreshold = 40;
    await settle();
    expect(area).not.toHaveAttribute('data-overflow-x-start');
    expect(area).not.toHaveAttribute('data-overflow-y-end');
    expect(area).toHaveAttribute('data-overflow-x-end');
  });

  test('with no overflow, no part has an overflow attribute, the variables are 0px and the viewport is not a tab stop', async () => {
    const { get, viewport, area } = await mountArea({
      scene: { width: 100, height: 100, corner: true },
      vertical: { keepMounted: true },
    });
    for (const part of [area, viewport, get('content')!, get('vertical')!]) {
      expect(dataAttributes(part).filter((name) => OVERFLOW.includes(name))).toEqual([]);
    }
    expect(
      ['x-start', 'x-end', 'y-start', 'y-end'].map((edge) => distance(viewport, edge)),
    ).toEqual(['0px', '0px', '0px', '0px']);
    expect(viewport.tabIndex).toBe(-1);
    expect(get('horizontal')).toBeNull();
    expect(get('corner')).toBeNull();
    // A kept scrollbar has no `hidden` attribute, and its thumb fills the track.
    expect(get('vertical')).not.toHaveAttribute('hidden');
    expect(get('thumb-y')!.offsetHeight).toBe(200);
  });

  test('a content that mounts after the first measurement, and a content that resizes, give a measurement', async () => {
    const scene = reactive({ content: false, width: 1000, height: 1000 });
    const { viewport, area } = await mountArea({ scene });
    expect(area).not.toHaveAttribute('data-has-overflow-y');
    scene.content = true;
    await waitFor(() => expect(area).toHaveAttribute('data-has-overflow-y'));
    expect(viewport.tabIndex).toBe(0);
    await settle();
    scene.width = 100;
    scene.height = 100;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
  });

  test('VUE-169: a viewport whose height falls to 0 with its content loses its overflow', async () => {
    const scene = reactive({ width: 100, height: 1000 });
    const { viewport, area } = await mountArea({
      scene,
      root: { style: 'height: auto' },
      viewport: { style: 'height: auto; max-height: 200px' },
    });
    expect(area).toHaveAttribute('data-has-overflow-y');
    scene.height = 0;
    await waitFor(() => expect(distance(viewport, 'y-end')).toBe('0px'));
    expect(area).not.toHaveAttribute('data-has-overflow-y');
    expect(viewport.tabIndex).toBe(-1);
  });

  test('a viewport that changes its height, with no change of its content, gives a measurement', async () => {
    const root = reactive<Record<string, unknown>>({});
    const { viewport, area } = await mountArea({ root });
    root.style = 'height: 2000px';
    await waitFor(() => expect(distance(viewport, 'y-end')).toBe('0px'));
    expect(area).not.toHaveAttribute('data-has-overflow-y');
  });

  test('a hidden scroll area measures when it shows, and a measurement while it is hidden changes nothing', async () => {
    const root = reactive<Record<string, unknown>>({ style: 'display: none' });
    const mounted = mount(ScrollAreaParts, { root, vertical: { keepMounted: true } });
    const area = mounted.root.querySelector<HTMLElement>('.root')!;
    const viewport = mounted.root.querySelector<HTMLElement>('.viewport')!;
    const thumb = mounted.root.querySelector<HTMLElement>('.thumb-y')!;
    await settle();
    viewport.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(distance(viewport, 'y-end')).toBe('');
    expect(thumb.style.visibility).toBe('hidden');
    root.style = undefined;
    await waitFor(() => expect(thumb.style.visibility).toBe(''));
    expect(area).toHaveAttribute('data-has-overflow-y');
    expect(thumb.offsetHeight).toBe(40);
    await settle();

    root.style = 'display: none';
    await settle();
    viewport.dispatchEvent(new Event('scroll'));
    await nextTick();
    expect(area).toHaveAttribute('data-has-overflow-y');
  });
});

describe('animations in the viewport', () => {
  // A transform adds to the scroll size, and the end of the animation takes it away. No observer
  // report and no `scroll` event come at that end. The classes keep the styles out of the render.
  function addStyles() {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = `
      @keyframes scroll-area-slide { from { transform: translateX(600px) } to { transform: none } }
      .moved { transform: translateX(600px) }
      .moved.animated { animation: scroll-area-slide 200ms; transform: none }
      .moved.transition { transition: transform 200ms; transform: none }`;
    onTestFinished(() => style.remove());
  }

  test.each([
    { name: 'a CSS animation', type: 'animationend', added: 'animated' },
    { name: 'a CSS transition', type: 'transitionend', added: 'transition' },
  ])(
    'the end of $name that starts after the mount measures the viewport',
    async ({ type, added }) => {
      addStyles();
      const { get, viewport, area } = await mountArea({
        scene: { width: 100, height: 100 },
        content: { class: 'moved' },
      });
      expect(area).toHaveAttribute('data-has-overflow-x');
      await nextEvent(viewport, type, { action: () => get('content')!.classList.add(added) });
      await nextTick();
      expect(area).not.toHaveAttribute('data-has-overflow-x');
    },
  );

  test('a script animation that runs at the mount measures at its end, beside one with no end', async () => {
    const mounted = mount(ScrollAreaParts, { scene: { width: 100, height: 100 } });
    const content = mounted.root.querySelector<HTMLElement>('.content')!;
    const finite = content.animate(
      [{ transform: 'translateX(600px)' }, { transform: 'none' }],
      300,
    );
    content.firstElementChild!.animate([{ opacity: 1 }, { opacity: 0.5 }], {
      duration: 100,
      iterations: Infinity,
    });
    const area = mounted.root.querySelector('.root')!;
    await waitFor(() => expect(area).toHaveAttribute('data-has-overflow-x'));
    await finite.finished;
    // The first frame can come before the task in which the viewport reads the animations. The
    // test then waits for `finished` before the viewport does, and its reaction runs first.
    await waitFor(() => expect(area).not.toHaveAttribute('data-has-overflow-x'));
  });

  test('a script animation that ends after the unmount gives no error', async () => {
    const mounted = mount(ScrollAreaParts, { scene: { width: 100, height: 100 } });
    const content = mounted.root.querySelector<HTMLElement>('.content')!;
    const finite = content.animate(
      [{ transform: 'translateX(600px)' }, { transform: 'none' }],
      100,
    );
    await waitFor(() =>
      expect(mounted.root.querySelector('.root')).toHaveAttribute('data-has-overflow-x'),
    );
    mounted.unmount();
    await finite.finished;
    await settle();
  });
});

describe('scrolling', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a scroll of the user makes its axis scrolling until 500 ms pass with no scroll of that axis', async () => {
    const { get, viewport, area } = await mountArea();
    vi.useFakeTimers();
    const all = [area, viewport, get('content')!];
    const scrolling = () =>
      [...all, get('vertical')!, get('thumb-y')!, get('horizontal')!, get('thumb-x')!].map((part) =>
        part.hasAttribute('data-scrolling'),
      );
    expect(scrolling()).toEqual([false, false, false, false, false, false, false]);
    await fireEvent.pointerEnter(viewport);
    await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
    expect(scrolling()).toEqual([true, true, true, true, true, false, false]);
    await vi.advanceTimersByTimeAsync(400);
    await fireEvent.wheel(viewport);
    await fireEvent.scroll(viewport, { target: { scrollLeft: 10 } });
    expect(scrolling()).toEqual([true, true, true, true, true, true, true]);
    await vi.advanceTimersByTimeAsync(100);
    expect(scrolling()).toEqual([true, true, true, false, false, true, true]);
    await vi.advanceTimersByTimeAsync(400);
    expect(scrolling()).toEqual([false, false, false, false, false, false, false]);
  });

  test('a scroll of a script does not set scrolling', async () => {
    const { viewport, area } = await mountArea();
    await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
    expect(area).not.toHaveAttribute('data-scrolling');
  });

  test('the scrolls that follow an event of the user count until 100 ms pass with no scroll', async () => {
    const { viewport, area } = await mountArea();
    vi.useFakeTimers();
    await fireEvent.keyDown(viewport, { key: 'ArrowDown' });
    for (const [time, top] of [
      [0, 1],
      [99, 2],
      [99, 3],
      // 100 ms with no scroll end the mark of the user.
      [100, 4],
    ] as const) {
      await vi.advanceTimersByTimeAsync(time);
      await fireEvent.scroll(viewport, { target: { scrollTop: top } });
    }
    // The last scroll of the user came 100 ms ago.
    await vi.advanceTimersByTimeAsync(399);
    expect(area).toHaveAttribute('data-scrolling');
    await vi.advanceTimersByTimeAsync(1);
    expect(area).not.toHaveAttribute('data-scrolling');
  });

  test('a pointer that moves in the viewport marks the scrolls that follow, as a drag that selects text', async () => {
    const { viewport, area } = await mountArea();
    vi.useFakeTimers();
    await fireEvent.pointerMove(viewport, { pointerType: 'mouse' });
    await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
    expect(area).toHaveAttribute('data-scrolling');
  });

  test('while the last pointer of the root is a touch, each scroll is a scroll of the user', async () => {
    const { viewport, area } = await mountArea();
    vi.useFakeTimers();
    // A touch that catches a momentum scroll in WebKit sends no event before the scroll.
    await fireEvent.pointerDown(viewport, { pointerType: 'touch' });
    await vi.advanceTimersByTimeAsync(200);
    await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
    expect(area).toHaveAttribute('data-scrolling');
    await vi.advanceTimersByTimeAsync(500);
    expect(area).not.toHaveAttribute('data-scrolling');
    await fireEvent.pointerMove(area, { pointerType: 'mouse' });
    await fireEvent.scroll(viewport, { target: { scrollTop: 20 } });
    expect(area).not.toHaveAttribute('data-scrolling');
  });
});

describe('corner and tracks', () => {
  test('the corner has the thickness of the scrollbars, and it leaves when an axis loses its overflow', async () => {
    const scene = reactive({ corner: true, height: 1000 });
    const { get, area } = await mountArea({ scene, horizontal: { style: 'height: 14px' } });
    const corner = get('corner')!;
    expect(corner.getBoundingClientRect()).toMatchObject({ width: 10, height: 14 });
    expect(area.style.getPropertyValue('--scroll-area-corner-width')).toBe('10px');
    expect(area.style.getPropertyValue('--scroll-area-corner-height')).toBe('14px');
    expect(get('vertical')!.offsetHeight).toBe(186);
    expect(get('horizontal')!.offsetWidth).toBe(190);
    expect(get('thumb-x')!.offsetWidth).toBe(38);
    const thumbWidth = () => get('horizontal')!.style.getPropertyValue('--scroll-area-thumb-width');
    expect(thumbWidth()).toBe('38px');

    scene.height = 100;
    await waitFor(() => expect(get('corner')).toBeNull());
    expect(area.style.getPropertyValue('--scroll-area-corner-width')).toBe('0px');
    expect(get('horizontal')!.offsetWidth).toBe(200);
    expect(get('thumb-x')!.offsetWidth).toBe(40);
    expect(thumbWidth()).toBe('40px');
  });

  test('VUE-146: the tracks get their whole edges when ScrollArea.Corner leaves', async () => {
    const scene = reactive({ corner: true });
    const { get, area } = await mountArea({ scene });
    expect(get('vertical')!.offsetHeight).toBe(190);
    scene.corner = false;
    await settle();
    expect(area.style.getPropertyValue('--scroll-area-corner-height')).toBe('0px');
    expect(get('vertical')!.offsetHeight).toBe(200);
    expect(get('thumb-y')!.offsetHeight).toBe(40);
  });

  test('VUE-146: the last scrollbar of an axis serves, and the one before serves again when it leaves', async () => {
    const scene = reactive({ corner: true, vertical: true, second: false });
    const { get, viewport } = await mountArea({ scene });
    expect(get('corner')!.offsetWidth).toBe(10);
    scene.second = true;
    await settle();
    expect(get('corner')!.offsetWidth).toBe(20);
    await scrollViewport(viewport, 0, 400);
    expect(thumbBox(get('second-thumb')!, get('second')!).top).toBe(76);
    expect(thumbBox(get('thumb-y')!, get('vertical')!).top).toBe(0);
    scene.vertical = false;
    await settle();
    expect(get('corner')!.offsetWidth).toBe(20);
    scene.vertical = true;
    await settle();
    expect(get('corner')!.offsetWidth).toBe(10);
    scene.vertical = false;
    scene.second = false;
    await settle();
    expect(get('corner')!.offsetWidth).toBe(0);
  });

  test.each([
    { name: 'a thumb', scene: { thumb: false, corner: true }, show: { thumb: true } },
    {
      name: 'a scrollbar',
      scene: { vertical: false, thumb: false, corner: true },
      show: { vertical: true },
    },
  ])(
    '$name that mounts after the first measurement gives a measurement',
    async ({ name, scene, show }) => {
      const parts = reactive<Record<string, boolean | undefined>>({ ...scene });
      const { get } = await mountArea({ scene: parts });
      Object.assign(parts, show);
      // The measurement comes in the flush of the render, before the next frame.
      await nextTick();
      if (name === 'a thumb') expect(get('thumb-y')!.offsetHeight).toBe(38);
      else expect(get('corner')!.offsetWidth).toBe(10);
    },
  );

  test('a scrollbar and its thumb serve the new axis when the orientation changes', async () => {
    const vertical = reactive<Record<string, unknown>>({ orientation: 'vertical' });
    const { get, viewport } = await mountArea({ scene: { horizontal: false }, vertical });
    const bar = get('vertical')!;
    vertical.orientation = 'horizontal';
    vertical.style = 'height: 10px; width: auto';
    await settle();
    expect(bar).toHaveAttribute('data-orientation', 'horizontal');
    expect(get('thumb-y')).toHaveAttribute('data-orientation', 'horizontal');
    expect(get('thumb-y')!.offsetWidth).toBe(40);
    await scrollViewport(viewport, 400, 0);
    expect(thumbBox(get('thumb-y')!, bar).left).toBe(80);
  });

  test('a kept track that shows with its overflow attribute gets the length of its thumb', async () => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '.vertical:not([data-has-overflow-y]) { display: none }';
    onTestFinished(() => style.remove());
    const scene = reactive({ height: 100 });
    const { get, area } = await mountArea({ scene, vertical: { keepMounted: true } });
    scene.height = 400;
    await waitFor(() => expect(area).toHaveAttribute('data-has-overflow-y'));
    expect(get('thumb-y')!.offsetHeight).toBe(100);
  });
});

describe('thumb', () => {
  test.each([
    { name: 'the content', vertical: {}, thumbY: {}, height: 1000, length: 40 },
    {
      name: 'the padding of the track',
      vertical: { style: 'padding-block: 8px' },
      thumbY: {},
      height: 1000,
      length: 36.8,
    },
    {
      name: 'the margin of the track',
      vertical: { style: 'margin-block: 11px' },
      thumbY: {},
      height: 1000,
      length: 35.6,
    },
    {
      name: 'the margin of the thumb',
      vertical: {},
      thumbY: { style: 'margin-block: 8px' },
      height: 1000,
      length: 36.8,
    },
    { name: 'a short thumb', vertical: {}, thumbY: {}, height: 100000, length: 16 },
  ])('the length of the thumb counts $name', async ({ vertical, thumbY, height, length }) => {
    const { get } = await mountArea({ scene: { height }, vertical, thumbY });
    expect(get('thumb-y')!.getBoundingClientRect().height).toBeCloseTo(length, 1);
    const variable = get('vertical')!.style.getPropertyValue('--scroll-area-thumb-height');
    expect(parseFloat(variable)).toBeCloseTo(length, 1);
  });

  test('the thumb moves with translate: down, and from the inline start', async () => {
    const { get, viewport } = await mountArea();
    await scrollViewport(viewport, 200, 400);
    expect(thumbBox(get('thumb-y')!, get('vertical')!).top).toBe(80);
    expect(thumbBox(get('thumb-x')!, get('horizontal')!).left).toBe(40);
    expect(get('thumb-y')!.style.transform).toBe('');
  });

  test.each([
    { name: 'before the top', key: 'scrollTop', at: -50, edge: 'top' },
    { name: 'after the bottom', key: 'scrollTop', at: 850, edge: 'bottom' },
    { name: 'before the inline start', key: 'scrollLeft', at: -50, edge: 'left' },
    { name: 'after the inline end', key: 'scrollLeft', at: 850, edge: 'right' },
  ] as const)(
    'a position $name keeps the thumb at that edge and makes it shorter',
    async ({ key, at, edge }) => {
      const { get, viewport } = await mountArea();
      const vertical = key === 'scrollTop';
      const [thumb, track] = vertical
        ? [get('thumb-y')!, get('vertical')!]
        : [get('thumb-x')!, get('horizontal')!];
      await reportPosition(viewport, key, at);
      const box = thumbBox(thumb, track);
      expect(box[edge]).toBeCloseTo(0, 1);
      expect(vertical ? box.height : box.width).toBeCloseTo((40 * 1000) / 1050, 1);
      await reportPosition(viewport, key, 400);
      expect(thumbBox(thumb, track)).toMatchObject(
        vertical ? { top: 80, height: 40 } : { left: 80, width: 40 },
      );
    },
  );
});

describe('right-to-left', () => {
  test.each([
    { name: 'before the inline start', at: 50, edge: 'right' },
    { name: 'after the inline end', at: -850, edge: 'left' },
  ] as const)(
    'a position $name keeps the horizontal thumb at that edge and makes it shorter',
    async ({ at, edge }) => {
      const { get, viewport } = await mountArea({ root: { dir: 'rtl' } });
      const [thumb, track] = [get('thumb-x')!, get('horizontal')!];
      await reportPosition(viewport, 'scrollLeft', at);
      const box = thumbBox(thumb, track);
      expect(box[edge]).toBeCloseTo(0, 1);
      expect(box.width).toBeCloseTo((40 * 1000) / 1050, 1);
      await reportPosition(viewport, 'scrollLeft', -400);
      expect(thumbBox(thumb, track)).toMatchObject({ right: 80, width: 40 });
    },
  );

  test('the edges, the scrollbars, the corner and the horizontal thumb follow the direction', async () => {
    const { get, viewport, area } = await mountArea({
      scene: { corner: true },
      root: { dir: 'rtl' },
    });
    const box = (element: HTMLElement) => element.getBoundingClientRect();
    expect(box(get('vertical')!).left).toBe(box(area).left);
    expect(box(get('corner')!).left).toBe(box(area).left);
    expect(area).not.toHaveAttribute('data-overflow-x-start');
    expect(area).toHaveAttribute('data-overflow-x-end');
    expect(thumbBox(get('thumb-x')!, get('horizontal')!).right).toBe(0);
    await scrollViewport(viewport, -400, 0);
    expect(area).toHaveAttribute('data-overflow-x-start');
    expect(distance(viewport, 'x-start')).toBe('400px');
    expect(thumbBox(get('thumb-x')!, get('horizontal')!).right).toBe(76);
    await scrollViewport(viewport, -800, 0);
    expect(area).not.toHaveAttribute('data-overflow-x-end');
  });

  test.each(['ltr', 'rtl'])(
    'a horizontal thumb with equal inline margins has the same free length in each browser (%s)',
    async (dir) => {
      const { get, viewport } = await mountArea({
        root: { dir },
        horizontal: { style: 'padding-inline: 4px; height: 10px' },
        thumbX: { style: 'margin-inline: 8px' },
      });
      const thumb = get('thumb-x')!;
      const track = get('horizontal')!;
      // The free length is 200 - 2 × 4 - 2 × 8 = 176.
      expect(thumb.getBoundingClientRect().width).toBeCloseTo(35.2, 1);
      const start = dir === 'ltr' ? 'left' : 'right';
      const end = dir === 'ltr' ? 'right' : 'left';
      expect(thumbBox(thumb, track)[start]).toBeCloseTo(12, 1);
      await scrollViewport(viewport, dir === 'ltr' ? 800 : -800, 0);
      expect(thumbBox(thumb, track)[end]).toBeCloseTo(12, 1);
    },
  );
});

describe('the platform', () => {
  test('the viewport shows no native scrollbar', async () => {
    const { viewport } = await mountArea();
    expect(viewport.offsetWidth - viewport.clientWidth).toBe(0);
    expect(viewport.offsetHeight - viewport.clientHeight).toBe(0);
  });

  test('Tab reaches the viewport only while it can scroll', async () => {
    const before = document.body.appendChild(document.createElement('button'));
    onTestFinished(() => before.remove());
    const scene = reactive({ width: 1000, height: 1000 });
    const { viewport } = await mountArea({ scene });
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(viewport);
    scene.width = 100;
    scene.height = 100;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).not.toBe(viewport);
  });
});

describe('the tab stop of the viewport', () => {
  /** Mounts `ScrollAreaControls`, and waits for the first measurement. */
  async function mountControls(scene: Record<string, unknown>) {
    const { root } = mount(ScrollAreaControls, { scene });
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    await waitFor(() => expect(viewport).toHaveAttribute('data-has-overflow-y'));
    await settle();
    return { root, viewport, before: root.querySelector<HTMLElement>('.before')! };
  }

  test('VUE-236: a viewport that scrolls is a tab stop only while its content holds no tab stop: Tab goes from the element before to the control; a control with tabindex -1 does not count', async () => {
    const scene = reactive({ control: true });
    const { root, viewport, before } = await mountControls(scene);
    expect(viewport.tabIndex).toBe(-1);
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(root.querySelector('.control'));

    scene.control = false;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
    before.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(viewport);
  });

  test('the viewport leaves the Tab order when a control mounts in its content, and comes back when the control unmounts or becomes disabled; a focused viewport keeps the focus', async () => {
    const scene = reactive({ control: false, disabled: false });
    const { viewport } = await mountControls(scene);
    expect(viewport.tabIndex).toBe(0);
    viewport.focus();
    scene.control = true;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
    await settle();
    expect(viewport).toHaveFocus();

    scene.control = false;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
    scene.control = true;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
    scene.disabled = true;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
  });

  test('the viewport comes back to the Tab order when v-show or a class hides the last control of its content, and leaves it when the control shows again', async () => {
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '.gone { display: none }';
    onTestFinished(() => style.remove());
    const scene = reactive({ control: true, shown: true, gone: false });
    const { viewport } = await mountControls(scene);
    expect(viewport.tabIndex).toBe(-1);
    scene.shown = false;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
    scene.shown = true;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
    scene.gone = true;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
    scene.gone = false;
    await waitFor(() => expect(viewport.tabIndex).toBe(-1));
  });

  test.each([
    { attribute: 'tabindex', markup: '<div tabindex="-1">T</div>', set: '0' },
    { attribute: 'disabled', markup: '<button disabled>T</button>', set: null },
    { attribute: 'inert', markup: '<div inert><button>T</button></div>', set: null },
    { attribute: 'hidden', markup: '<button hidden>T</button>', set: null },
    { attribute: 'contenteditable', markup: '<div>T</div>', set: 'true' },
    { attribute: 'href', markup: '<a>T</a>', set: '#t' },
    { attribute: 'style', markup: '<button style="display: none">T</button>', set: null },
    {
      attribute: 'class',
      markup: '<style>.gone { display: none }</style><button class="gone">T</button>',
      set: null,
    },
    { attribute: 'open', markup: '<dialog><button>T</button></dialog>', set: '' },
    { attribute: 'type', markup: '<input type="hidden" aria-label="T">', set: 'text' },
    { attribute: 'controls', markup: '<video></video>', set: '' },
  ])(
    'the viewport leaves the Tab order when $attribute makes an element of its content a tab stop',
    async ({ attribute, markup, set }) => {
      const { root, viewport } = await mountControls({ markup });
      expect(viewport.tabIndex).toBe(0);
      const element = root.querySelector('.markup > :last-child')!;
      if (set === null) element.removeAttribute(attribute);
      else element.setAttribute(attribute, set);
      await waitFor(() => expect(viewport.tabIndex).toBe(-1));
    },
  );
});

describe('lifetime', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  test('a listener of the developer that unmounts the scroll area in a scroll event gives no error', async () => {
    let unmount = () => {};
    // The listener of the developer runs before the listener of the viewport.
    const scrollListener = vi.fn(() => unmount());
    const mounted = mount(ScrollAreaInSlots, { listeners: { scroll: scrollListener } });
    unmount = mounted.unmount;
    const viewport = mounted.root.querySelector<HTMLElement>('.viewport')!;
    await waitFor(() => expect(viewport.tabIndex).toBe(0));
    await fireEvent.scroll(viewport, { target: { scrollTop: 10 } });
    expect(scrollListener).toHaveBeenCalledTimes(1);
    expect(mounted.root.querySelector('.viewport')).toBeNull();
  });

  test('a scroll area that unmounts leaves no observer and no timer', async () => {
    const unobserve = vi.spyOn(ResizeObserver.prototype, 'unobserve');
    const disconnect = vi.spyOn(ResizeObserver.prototype, 'disconnect');
    const scene = reactive({ content: true });
    const mounted = await mountArea({ scene });
    scene.content = false;
    await nextTick();
    expect(unobserve).toHaveBeenCalledWith(
      expect.objectContaining({ className: expect.stringContaining('content') }),
    );
    vi.useFakeTimers();
    await fireEvent.pointerEnter(mounted.viewport);
    await fireEvent.scroll(mounted.viewport, { target: { scrollTop: 10 } });
    expect(vi.getTimerCount()).toBeGreaterThan(0);
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(0);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  test('a viewport that unmounts before it reads its animations leaves no timer', () => {
    vi.useFakeTimers();
    const mounted = mount(ScrollAreaParts);
    // A Vapor app also starts a timer of the devtools.
    const timers = vi.getTimerCount();
    mounted.unmount();
    expect(vi.getTimerCount()).toBe(timers - 1);
  });
});

// A case that throws in `setup` is the last of its file.
test('a part outside its parent throws', () => {
  const { exposed } = mount(ScrollAreaPartsAlone);
  // A part that throws in `setup` also fails its render.
  expect((exposed.errors as string[]).filter((message) => message.startsWith('Vase UI'))).toEqual([
    'Vase UI: <ScrollArea.Viewport> must be inside <ScrollArea.Root>. Without a root the part has no scroll position to read. Put the part inside <ScrollArea.Root>.',
    'Vase UI: <ScrollArea.Scrollbar> must be inside <ScrollArea.Root>. Without a root the part has no scroll position to read. Put the part inside <ScrollArea.Root>.',
    'Vase UI: <ScrollArea.Corner> must be inside <ScrollArea.Root>. Without a root the part has no scroll position to read. Put the part inside <ScrollArea.Root>.',
    'Vase UI: <ScrollArea.Thumb> must be inside <ScrollArea.Scrollbar>. Without a scrollbar the thumb has no axis to move on. Put the thumb inside <ScrollArea.Scrollbar>.',
    'Vase UI: <ScrollArea.Content> must be inside <ScrollArea.Viewport>. Without a viewport the content has no area to scroll in. Put the content inside <ScrollArea.Viewport>.',
  ]);
  // After the error, Vapor renders the part with no setup, and warns about each binding.
  takeReportedMessages();
});
