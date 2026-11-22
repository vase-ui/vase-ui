import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { fireEvent } from '../../test/fireEvent';
import { touchDrag } from '../../test/pointer';
import ScrollAreaInSlots from '../../test/fixtures/ScrollAreaInSlots.vue';
import ScrollAreaParts from '../../test/fixtures/ScrollAreaParts.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

interface Point {
  x: number;
  y: number;
}

/** Mounts `ScrollAreaParts`, and waits for the first measurement and for the task after it. */
async function mountArea(props: Record<string, unknown> = {}) {
  const mounted = mount(ScrollAreaParts, props);
  const get = (name: string) => mounted.root.querySelector<HTMLElement>(`.${name}`);
  await waitFor(() =>
    expect(get('viewport')!.style.getPropertyValue('--scroll-area-overflow-y-end')).not.toBe(''),
  );
  await settle();
  return { ...mounted, get, viewport: get('viewport')!, area: get('root')! };
}

/** The client point at `x` and `y` from the top left corner of `element`. */
function at(element: Element, x: number, y: number): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + x, y: box.top + y };
}

function centre(element: Element): Point {
  const box = element.getBoundingClientRect();
  return { x: box.left + box.width / 2, y: box.top + box.height / 2 };
}

/** The id of the mouse: Chromium and WebKit give `1`, and Firefox can give `0`. */
let mouse = 1;

/**
 * Presses the main button of the real pointer at `point` and holds it. The case gets the release
 * when it ends, with coordinates: with none, the pointer moves to the element of the press.
 */
async function hold(point: Point) {
  document.addEventListener('pointerdown', (event) => (mouse = event.pointerId), {
    capture: true,
    once: true,
  });
  let held = true;
  const release = async (to: Point = point) => {
    held = false;
    await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
  };
  onTestFinished(async () => {
    if (held) await release();
  });
  await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
  return release;
}

async function moveTo(point: Point) {
  await userEvent.pointer({ coords: point });
}

function snap(viewport: HTMLElement) {
  return [
    viewport.style.getPropertyValue('scroll-snap-type'),
    viewport.style.getPropertyPriority('scroll-snap-type'),
  ];
}

describe('drag of the thumb', () => {
  test('a drag of the vertical thumb scrolls the viewport, and the release ends the press at once', async () => {
    const { get, viewport, area } = await mountArea();
    const thumb = get('thumb-y')!;
    const start = centre(thumb);
    const release = await hold(start);
    expect(thumb.hasPointerCapture(mouse)).toBe(true);
    expect(snap(viewport)).toEqual(['none', 'important']);
    // The free length is 200 and the thumb is 40, so 1px moves 800 / 160 = 5px.
    await moveTo({ x: start.x, y: start.y + 40 });
    expect(viewport.scrollTop).toBe(200);
    expect(get('vertical')).toHaveAttribute('data-scrolling');
    expect(thumb).toHaveAttribute('data-scrolling');
    expect(area).toHaveAttribute('data-scrolling');
    expect(get('horizontal')).not.toHaveAttribute('data-scrolling');
    // The pointer leaves the scroll area, and the thumb keeps the capture.
    const outside = { x: start.x + 100, y: start.y + 300 };
    await moveTo(outside);
    expect(viewport.scrollTop).toBe(800);
    await release(outside);
    expect(thumb.hasPointerCapture(mouse)).toBe(false);
    expect(get('vertical')).not.toHaveAttribute('data-scrolling');
    expect(area).not.toHaveAttribute('data-scrolling');
    expect(snap(viewport)).toEqual(['', '']);
  });

  test.each(['ltr', 'rtl'])(
    'a drag of the horizontal thumb scrolls from the inline start (%s)',
    async (dir) => {
      const { get, viewport } = await mountArea({ root: { dir } });
      const start = centre(get('thumb-x')!);
      await hold(start);
      await moveTo({ x: start.x + (dir === 'ltr' ? 40 : -40), y: start.y });
      expect(viewport.scrollLeft).toBe(dir === 'ltr' ? 200 : -200);
      expect(get('horizontal')).toHaveAttribute('data-scrolling');
      expect(get('vertical')).not.toHaveAttribute('data-scrolling');
    },
  );

  // The automation of Firefox and WebKit makes no touch drag.
  test.runIf(server.browser === 'chromium')(
    'a touch drag of the thumb scrolls the viewport, and its end ends the press',
    async () => {
      const { get, viewport, area } = await mountArea();
      const start = centre(get('thumb-y')!);
      await touchDrag(start, { x: start.x, y: start.y + 40 });
      expect(viewport.scrollTop).toBe(200);
      expect(area).not.toHaveAttribute('data-scrolling');
      expect(snap(viewport)).toEqual(['', '']);
    },
  );

  test('a lost capture ends the press', async () => {
    const { get, viewport } = await mountArea();
    const thumb = get('thumb-y')!;
    const start = centre(thumb);
    await hold(start);
    await moveTo({ x: start.x, y: start.y + 10 });
    expect(viewport.scrollTop).toBe(50);
    thumb.releasePointerCapture(mouse);
    // The browser sends `lostpointercapture` before the next pointer event.
    await moveTo({ x: start.x, y: start.y + 20 });
    expect(snap(viewport)).toEqual(['', '']);
    expect(viewport.scrollTop).toBe(50);
  });

  test('a second pointer and another button start nothing', async () => {
    const { get, viewport } = await mountArea();
    const thumb = get('thumb-y')!;
    await fireEvent.pointerDown(thumb, { pointerId: mouse, button: 1 });
    expect(snap(viewport)).toEqual(['', '']);
    const start = centre(thumb);
    await hold(start);
    // The second pointer is not active, so a capture for it would throw.
    await fireEvent.pointerDown(thumb, { pointerId: mouse + 1, button: 0 });
    await fireEvent.pointerMove(thumb, { pointerId: mouse + 1, clientY: start.y + 100 });
    expect(viewport.scrollTop).toBe(0);
    // A second touch on the thumb gets an implicit capture. The loss of that capture ends nothing.
    await fireEvent.lostPointerCapture(thumb, { pointerId: mouse + 1 });
    await moveTo({ x: start.x, y: start.y + 20 });
    expect(viewport.scrollTop).toBe(100);
    expect(thumb.hasPointerCapture(mouse)).toBe(true);
  });

  test('a press with no viewport or no thumb does nothing', async () => {
    const scene = reactive({ viewport: false, thumb: true });
    const mounted = mount(ScrollAreaParts, { scene, vertical: { keepMounted: true } });
    const track = mounted.root.querySelector<HTMLElement>('.vertical')!;
    await settle();
    let release = await hold(at(track, 5, 10));
    await moveTo(at(track, 5, 100));
    await release();
    release = await hold(at(track, 5, 150));
    await release();
    scene.viewport = true;
    scene.thumb = false;
    await waitFor(() =>
      expect(mounted.root.querySelector<HTMLElement>('.viewport')!.tabIndex).toBe(0),
    );
    release = await hold(at(track, 5, 150));
    expect(mounted.root.querySelector<HTMLElement>('.viewport')!.scrollTop).toBe(0);
    await release();
    // The thumb keeps its length and its place when the viewport leaves.
    scene.thumb = true;
    await settle();
    scene.viewport = false;
    await settle();
    release = await hold(centre(mounted.root.querySelector('.thumb-y')!));
    await release();
  });

  test('a press and a drag on a scrollbar whose element slot binds no elementRef scroll nothing', async () => {
    // The thumb gets no length from a scrollbar with no element.
    const style = document.head.appendChild(document.createElement('style'));
    style.textContent = '.thumb-y { height: 20px !important }';
    onTestFinished(() => style.remove());
    const { root } = mount(ScrollAreaInSlots, { unbound: true });
    await waitFor(() => expect(root.querySelector('aside')).not.toBeNull());
    await settle();
    const viewport = root.querySelector<HTMLElement>('.viewport')!;
    let release = await hold(at(root.querySelector('aside')!, 5, 150));
    await release();
    const start = centre(root.querySelector('.thumb-y')!);
    release = await hold(start);
    await moveTo({ x: start.x, y: start.y + 20 });
    await release({ x: start.x, y: start.y + 20 });
    expect(viewport.scrollTop).toBe(0);
  });

  test('a drag goes on when the thumb of the other axis unmounts', async () => {
    const scene = reactive({ horizontal: true });
    const { get, viewport } = await mountArea({ scene });
    const start = centre(get('thumb-y')!);
    await hold(start);
    scene.horizontal = false;
    await nextTick();
    await moveTo({ x: start.x, y: start.y + 20 });
    expect(viewport.scrollTop).toBe(100);
  });

  test('the press ends when the thumb or the viewport unmounts during the press', async () => {
    const scene = reactive({ viewport: true, thumb: true });
    const { get, viewport } = await mountArea({ scene });
    const release = await hold(centre(get('thumb-y')!));
    scene.thumb = false;
    await nextTick();
    expect(snap(viewport)).toEqual(['', '']);
    expect(get('vertical')).not.toHaveAttribute('data-scrolling');
    await release();

    scene.thumb = true;
    await settle();
    const thumb = get('thumb-y')!;
    await hold(centre(thumb));
    expect(thumb.hasPointerCapture(mouse)).toBe(true);
    scene.viewport = false;
    await nextTick();
    expect(thumb.hasPointerCapture(mouse)).toBe(false);
  });
});

describe('press on the track', () => {
  test.each([
    { name: 'vertical', dir: 'ltr', key: 'scrollTop', position: 650 },
    { name: 'horizontal', dir: 'ltr', key: 'scrollLeft', position: 650 },
    { name: 'horizontal, right-to-left', dir: 'rtl', key: 'scrollLeft', position: -650 },
  ] as const)(
    'a press puts the centre of the thumb at the point, and the moves drag it: $name',
    async ({ name, dir, key, position }) => {
      const { get, viewport } = await mountArea({ root: { dir } });
      const vertical = name === 'vertical';
      const track = get(vertical ? 'vertical' : 'horizontal')!;
      const thumb = get(vertical ? 'thumb-y' : 'thumb-x')!;
      // 150px from the inline start, or from the top.
      const point = vertical
        ? at(track, 5, 150)
        : dir === 'ltr'
          ? at(track, 150, 5)
          : at(track, 50, 5);
      // The axis is scrolling for 500 ms after the jump. A busy page can move the thumb later, so
      // the case reads the attribute when it changes.
      const scrolling: boolean[] = [];
      const observer = new MutationObserver(() =>
        scrolling.push(track.hasAttribute('data-scrolling')),
      );
      observer.observe(track, { attributeFilter: ['data-scrolling'] });
      onTestFinished(() => observer.disconnect());
      await hold(point);
      expect(viewport[key]).toBe(position);
      expect(scrolling[0]).toBe(true);
      // The thumb moves at the `scroll` event, which can come in the next frame.
      await waitFor(() => {
        const box = thumb.getBoundingClientRect();
        expect(vertical ? box.top + box.height / 2 : box.left + box.width / 2).toBeCloseTo(
          vertical ? point.y : point.x,
          0,
        );
      });
      await moveTo(
        vertical
          ? { x: point.x, y: point.y - 20 }
          : { x: point.x + (dir === 'ltr' ? -20 : 20), y: point.y },
      );
      expect(viewport[key]).toBe(position + (position > 0 ? -100 : 100));
    },
  );

  test('a press of another button on the track scrolls nothing and keeps scroll snap', async () => {
    const { get, viewport } = await mountArea({
      viewport: { style: 'scroll-snap-type: y mandatory' },
    });
    const track = get('vertical')!;
    const point = at(track, 5, 150);
    for (const button of [1, 2]) {
      await fireEvent.pointerDown(track, {
        pointerId: mouse,
        button,
        clientX: point.x,
        clientY: point.y,
      });
      expect(viewport.scrollTop).toBe(0);
      expect(snap(viewport)).toEqual(['y mandatory', '']);
      expect(track).not.toHaveAttribute('data-scrolling');
    }
  });

  test('a press on an element in the thumb does not move the thumb', async () => {
    const { get, viewport } = await mountArea();
    await reportScroll(viewport, 400);
    await hold(centre(get('grip')!));
    expect(viewport.scrollTop).toBe(400);
  });

  test('a press on the scrollbar keeps the focus and selects no text, for each button', async () => {
    const { get } = await mountArea();
    const input = document.body.appendChild(document.createElement('input'));
    onTestFinished(() => input.remove());
    input.focus();
    const release = await hold(at(get('vertical')!, 5, 150));
    await release();
    expect(document.activeElement).toBe(input);
    for (const target of [get('vertical')!, get('thumb-y')!]) {
      for (const button of [0, 1, 2]) {
        expect(await fireEvent.mouseDown(target, { button })).toBe(false);
      }
    }
  });

  test.each([
    { name: 'that fills the track', height: 16 },
    { name: 'that is longer than the track', height: 10 },
  ])('a thumb $name scrolls nothing at a drag and at a press', async ({ height }) => {
    const { get, viewport } = await mountArea({
      vertical: { style: `height: ${height}px; bottom: auto; width: 12px`, keepMounted: true },
    });
    await reportScroll(viewport, 400);
    const thumb = get('thumb-y')!;
    const start = centre(thumb);
    const release = await hold(start);
    await moveTo({ x: start.x, y: start.y + 5 });
    // A move that scrolls nothing does not make the axis scrolling.
    expect(get('vertical')).not.toHaveAttribute('data-scrolling');
    await release({ x: start.x, y: start.y + 5 });
    expect(viewport.scrollTop).toBe(400);
    // A press on the track starts nothing, so scroll snap stays on.
    await fireEvent.pointerDown(get('vertical')!, { pointerId: mouse, button: 0, clientY: 5 });
    expect(snap(viewport)).toEqual(['', '']);
    await settle();
    expect(viewport.scrollTop).toBe(400);
  });
});

/** Scrolls the viewport as a script does, and waits for the `scroll` event of the browser. */
async function reportScroll(viewport: HTMLElement, top: number) {
  const scrolled = new Promise((resolve) =>
    viewport.addEventListener('scroll', resolve, { once: true }),
  );
  viewport.scrollTop = top;
  await scrolled;
  await nextTick();
}

describe('wheel over a scrollbar', () => {
  function wheel(target: Element, init: WheelEventInit) {
    return fireEvent.wheel(target, { cancelable: true, ...init });
  }

  test('a wheel over the vertical scrollbar scrolls the viewport in its range, and the browser keeps it at an edge', async () => {
    const { get, viewport, area } = await mountArea();
    const bar = get('vertical')!;
    expect(await wheel(bar, { deltaY: -100 })).toBe(true);
    expect(await wheel(bar, { deltaY: 0 })).toBe(true);
    expect(area).not.toHaveAttribute('data-scrolling');
    expect(await wheel(bar, { deltaY: 100 })).toBe(false);
    expect(viewport.scrollTop).toBe(100);
    expect(bar).toHaveAttribute('data-scrolling');
    expect(get('horizontal')).not.toHaveAttribute('data-scrolling');
    // Ctrl with the wheel is the zoom of the browser.
    expect(await wheel(bar, { deltaY: 100, ctrlKey: true })).toBe(true);
    expect(await wheel(bar, { deltaY: 1000 })).toBe(false);
    expect(viewport.scrollTop).toBe(800);
    expect(await wheel(bar, { deltaY: 100 })).toBe(true);
  });

  test.each(['ltr', 'rtl'])(
    'a wheel over the horizontal scrollbar stays in its range (%s)',
    async (dir) => {
      const { get, viewport } = await mountArea({ root: { dir } });
      const bar = get('horizontal')!;
      const toEnd = dir === 'ltr' ? 1 : -1;
      expect(await wheel(bar, { deltaX: -toEnd * 100 })).toBe(true);
      expect(bar).not.toHaveAttribute('data-scrolling');
      expect(await wheel(bar, { deltaX: toEnd * 100 })).toBe(false);
      expect(viewport.scrollLeft).toBe(toEnd * 100);
      expect(bar).toHaveAttribute('data-scrolling');
      expect(get('vertical')).not.toHaveAttribute('data-scrolling');
      expect(await wheel(bar, { deltaX: toEnd * 1000 })).toBe(false);
      expect(viewport.scrollLeft).toBe(toEnd * 800);
      expect(await wheel(bar, { deltaX: toEnd * 100 })).toBe(true);
      expect(await wheel(bar, { deltaX: -toEnd * 1000 })).toBe(false);
      expect(viewport.scrollLeft).toBe(0);
    },
  );

  test('a wheel over a scrollbar with no viewport does nothing', async () => {
    const mounted = mount(ScrollAreaParts, {
      scene: { viewport: false },
      vertical: { keepMounted: true },
    });
    await settle();
    expect(await wheel(mounted.root.querySelector('.vertical')!, { deltaY: 100 })).toBe(true);
  });

  test('a wheel of the real pointer over the scrollbar scrolls the viewport by its delta', async () => {
    const { get, viewport } = await mountArea();
    const scrolled = new Promise((resolve) =>
      viewport.addEventListener('scroll', resolve, { once: true }),
    );
    await userEvent.wheel(get('vertical')!, { delta: { y: 100 } });
    await scrolled;
    expect(viewport.scrollTop).toBe(100);
  });
});

describe('scroll snap during a press', () => {
  test.each([
    { name: 'from style', viewport: { style: 'scroll-snap-type: y mandatory' } },
    { name: 'from a style sheet', viewport: { class: 'snapped' } },
  ])(
    'a press turns scroll snap off, and the end gives the value $name back',
    async ({ viewport: attrs }) => {
      const style = document.head.appendChild(document.createElement('style'));
      style.textContent = '.snapped { scroll-snap-type: y mandatory }';
      onTestFinished(() => style.remove());
      const viewportAttrs = reactive<Record<string, unknown>>({ ...attrs });
      const { get, viewport } = await mountArea({ viewport: viewportAttrs });
      const inline = viewport.style.getPropertyValue('scroll-snap-type');
      for (const end of ['release', 'lost capture']) {
        const start = centre(get('thumb-y')!);
        const release = await hold(start);
        expect(getComputedStyle(viewport).scrollSnapType).toBe('none');
        // A render of the viewport during the press keeps scroll snap off.
        viewportAttrs['data-render'] = end;
        await nextTick();
        expect(getComputedStyle(viewport).scrollSnapType).toBe('none');
        if (end === 'lost capture') {
          // The capture starts at the first move.
          await moveTo({ x: start.x, y: start.y + 1 });
          get('thumb-y')!.releasePointerCapture(mouse);
          await moveTo({ x: start.x, y: start.y + 2 });
          expect(getComputedStyle(viewport).scrollSnapType).toBe('y mandatory');
        }
        await release();
        expect(viewport.style.getPropertyValue('scroll-snap-type')).toBe(inline);
        expect(getComputedStyle(viewport).scrollSnapType).toBe('y mandatory');
      }
    },
  );

  test('the jump of a press on the track is not snapped', async () => {
    const { get, viewport } = await mountArea({
      root: { style: 'width: 400px; height: 200px' },
      scene: { items: 10 },
      viewport: { style: 'scroll-snap-type: x mandatory' },
      content: { style: 'display: flex' },
    });
    const track = get('horizontal')!;
    const thumb = get('thumb-x')!;
    // Between the snap points 800 and 1000.
    const target = 900;
    const free = track.offsetWidth - thumb.offsetWidth;
    const release = await hold(at(track, (target / 1600) * free + thumb.offsetWidth / 2, 5));
    expect(Math.abs(viewport.scrollLeft - target)).toBeLessThanOrEqual(1);
    await release();
    await waitFor(() => expect(viewport.scrollLeft % 200).toBe(0));
  });
});

describe('a listener of the developer that unmounts the scroll area', () => {
  test.each(['pointermove', 'pointerup'])('in %s gives no error', async (type) => {
    let unmount = () => {};
    const pointerListener = vi.fn((event: PointerEvent) => {
      if (event.type === type) unmount();
    });
    const mounted = mount(ScrollAreaInSlots, { listeners: { pointer: pointerListener } });
    unmount = mounted.unmount;
    await waitFor(() =>
      expect(mounted.root.querySelector<HTMLElement>('.thumb-y')!.offsetHeight).toBe(38),
    );
    await settle();
    const thumb = mounted.root.querySelector<HTMLElement>('.thumb-y')!;
    const start = centre(thumb);
    const release = await hold(start);
    await moveTo({ x: start.x, y: start.y + 10 });
    await release({ x: start.x, y: start.y + 10 });
    expect(pointerListener).toHaveBeenCalled();
    expect(mounted.root.querySelector('.thumb-y')).toBeNull();
  });
});
