import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { DrawerSnapPoint } from '@vase-ui/vue/drawer';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { finishAnimations } from '../../test/animation';
import { touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { readWhen, wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
type Point = { x: number; y: number };

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const get = (id: string) => byTestId(id)!;
const chromium = server.browser === 'chromium';

function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    defaultOpen: true,
    ...props,
    onOpenChange: (open: boolean, details: { reason: string; trigger?: Element }) =>
      log.push(`openChange ${open} ${details.reason}`),
    onSnapPointChange: (point: DrawerSnapPoint | null, details: { reason: string }) =>
      log.push(`snapPointChange ${point} ${details.reason}`),
  });
}

async function mountDrawer(setup: Props = {}) {
  const result = mount(DrawerParts, { ...setup, root: setup.root ?? { defaultOpen: true } });
  if ((setup.root as Props | undefined)?.defaultOpen !== false) {
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
  } else {
    await nextTick();
  }
  return result;
}

async function closed() {
  await waitFor(() => expect(byTestId('popup')).toBe(null));
}

/** Gives each transition of `kind` in the fixture 100 s, so that it lasts until the case ends it. */
function holdTransition(kind: 'enter' | 'leave') {
  const style = document.head.appendChild(document.createElement('style'));
  style.textContent = `.drawer-test-${kind}-active { transition-duration: 100s; }`;
  onTestFinished(() => style.remove());
}

/** Ends the held leave of each element, and waits until Vue removes it. */
async function endLeave(...elements: HTMLElement[]) {
  for (const element of elements) {
    await finishAnimations(element);
    await waitFor(() => expect(element.isConnected).toBe(false));
  }
}

/** A point at the text near the top of an element. */
function textOf(id = 'popup'): Point {
  const rect = get(id).getBoundingClientRect();
  return { x: rect.left + 100, y: rect.top + 8 };
}

function centerOf(id: string): Point {
  const rect = get(id).getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

/**
 * Presses the main button at `from` and moves it by `by` in `steps` moves of the same length. A
 * first move of 1 px starts the drag, as a mouse does, so the drag moves the popup by `by`.
 */
async function press(from: Point, by: Point, steps = 6) {
  const length = Math.hypot(by.x, by.y) || 1;
  const start = { x: from.x + by.x / length, y: from.y + by.y / length };
  await userEvent.pointer({ coords: from });
  await userEvent.pointer({ keys: '[MouseLeft>]' });
  await userEvent.pointer({ coords: start });
  for (let step = 1; step <= steps; step += 1) {
    await userEvent.pointer({
      coords: { x: start.x + (by.x * step) / steps, y: start.y + (by.y * step) / steps },
    });
  }
  return () => userEvent.pointer({ keys: '[/MouseLeft]' });
}

async function drag(from: Point, by: Point, steps = 6) {
  const release = await press(from, by, steps);
  await release();
}

/** The movement and the progress that the popup and the backdrop show. */
function sample() {
  const popup = get('popup');
  return {
    y: popup.style.getPropertyValue('--drawer-swipe-movement-y'),
    progress: byTestId('backdrop')?.style.getPropertyValue('--drawer-swipe-progress'),
  };
}

/** The id of the mouse of the browser: Firefox gives it 0, Chromium and WebKit 1. */
async function mousePointerId(at: Point) {
  let id = -1;
  const read = (event: PointerEvent) => (id = event.pointerId);
  document.addEventListener('pointermove', read, { once: true });
  await userEvent.pointer({ coords: { x: at.x + 1, y: at.y + 1 } });
  return id;
}

/** Dispatches the events of a mouse drag with a fixed time line, for a case about its speed. */
function flick(
  target: Element,
  from: Point,
  pointerId: number,
  moves: [y: number, time: number][],
  { upEvent = true } = {},
) {
  const init = (y: number, time: number, buttons: number) => {
    const event = new PointerEvent('pointermove', {
      bubbles: true,
      composed: true,
      pointerId,
      pointerType: 'mouse',
      clientX: from.x,
      clientY: from.y + y,
      buttons,
    });
    Object.defineProperty(event, 'timeStamp', { value: time });
    return event;
  };
  const down = new PointerEvent('pointerdown', {
    bubbles: true,
    composed: true,
    pointerId,
    pointerType: 'mouse',
    clientX: from.x,
    clientY: from.y,
    buttons: 1,
  });
  Object.defineProperty(down, 'timeStamp', { value: 1000 });
  target.dispatchEvent(down);
  for (const [y, time] of moves) target.dispatchEvent(init(y, time, 1));
  const [lastY, lastTime] = moves.at(-1)!;
  if (!upEvent) {
    // A fast flick on a trackpad sends a move with no button, and no `pointerup` before it.
    target.dispatchEvent(init(lastY, lastTime + 4, 0));
    return;
  }
  const up = new PointerEvent('pointerup', {
    bubbles: true,
    composed: true,
    pointerId,
    pointerType: 'mouse',
    clientX: from.x,
    clientY: from.y + lastY,
  });
  Object.defineProperty(up, 'timeStamp', { value: lastTime + 4 });
  target.dispatchEvent(up);
}

/**
 * Sends a real touch through `points` (Chromium only), and runs `during` before the touch lifts. A
 * point with `second` also has a second finger at that point.
 */
async function touchPath(
  points: (Point & { second?: Point })[],
  during: () => void | Promise<void> = () => {},
) {
  const { cdp } = await import('vitest/browser');
  const session = cdp();
  const frame = window.frameElement!.getBoundingClientRect();
  const scale = frame.width / window.innerWidth || 1;
  const toPage = (point: Point) => ({
    x: frame.left + point.x * scale,
    y: frame.top + point.y * scale,
  });
  const send = (
    type: 'touchStart' | 'touchMove' | 'touchEnd',
    point?: Point & { second?: Point },
  ) =>
    session.send('Input.dispatchTouchEvent', {
      type,
      touchPoints: point
        ? [
            { ...toPage(point), id: 1 },
            ...(point.second ? [{ ...toPage(point.second), id: 2 }] : []),
          ]
        : [],
    });
  const [first, ...rest] = points;
  await send('touchStart', first);
  try {
    for (const point of rest) await send('touchMove', point);
    await during();
  } finally {
    await send('touchEnd');
  }
}

describe('the swipe that closes', () => {
  test('closes past half of the popup, with the reason `swipe`', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log) });
    await drag(textOf(), { x: 0, y: 160 });
    await closed();
    expect(log).toEqual(['openChange false swipe']);
  });

  test('moves the popup back below half of it, and the CSS of the popup animates it', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log), backdrop: {} });
    const release = await press(textOf(), { x: 0, y: 120 });
    await nextTick();
    const popup = get('popup');
    expect(sample()).toEqual({ y: '120px', progress: '0.4' });
    expect(popup.hasAttribute('data-swiping')).toBe(true);
    expect(get('backdrop').hasAttribute('data-swiping')).toBe(true);
    expect(popup.style.transition).toBe('none');
    // A release after a rest is slow.
    await wait(300);
    await release();
    await nextTick();
    expect(sample()).toEqual({ y: '0px', progress: '0' });
    expect(popup.hasAttribute('data-swiping')).toBe(false);
    expect(popup.style.transition).toBe('');
    expect(log).toEqual([]);
  });

  test('moves against its direction as a square root', async () => {
    await mountDrawer();
    const release = await press(textOf(), { x: 0, y: -100 });
    await nextTick();
    expect(sample().y).toBe('-10px');
    await release();
  });

  test('closes at a fast flick of 40 px, and keeps a slow drag of 40 px open', async () => {
    await mountDrawer();
    const target = get('text');
    const id = await mousePointerId(textOf());
    flick(target, textOf(), id, [
      [10, 1010],
      [40, 1200],
    ]);
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    flick(target, textOf(), id, [
      [10, 2010],
      [25, 2020],
      [40, 2030],
    ]);
    await closed();
  });

  test('closes at a flick of a script that names a pointer that is not active', async () => {
    await mountDrawer();
    // No pointer has the id 99, so the swipe has no pointer capture.
    flick(get('text'), textOf(), 99, [
      [10, 1010],
      [25, 1020],
      [40, 1030],
    ]);
    await closed();
  });

  test('leaves from the place of the drag with `data-swipe-dismiss` and the strength of the release', async () => {
    await mountDrawer({ transition: true, backdrop: {} });
    const popup = get('popup');
    const backdrop = get('backdrop');
    await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
    // By the speed of the release, the leave lasts from 20 ms to 200 ms. It can end before the
    // command of the release ends, so the case reads the popup and the backdrop when it starts.
    const atLeave = readWhen(
      () => popup.classList.contains('drawer-test-leave-active') || !popup.isConnected,
      () => ({
        leaving: popup.classList.contains('drawer-test-leave-active'),
        dismiss: [popup, backdrop].map((element) => element.hasAttribute('data-swipe-dismiss')),
        swiping: popup.hasAttribute('data-swiping'),
        movement: popup.style.getPropertyValue('--drawer-swipe-movement-y'),
        strength: Number(popup.style.getPropertyValue('--drawer-swipe-strength')),
        transition: popup.style.transition,
      }),
    );
    await drag(textOf(), { x: 0, y: 200 });
    const { strength, ...marks } = await atLeave;
    expect(marks).toEqual({
      leaving: true,
      dismiss: [true, true],
      swiping: false,
      movement: '200px',
      transition: '',
    });
    expect(strength).toBeLessThanOrEqual(1);
    await waitFor(() => expect(popup.isConnected).toBe(false));
  });

  test('VUE-139: gives the backdrop the strength of the popup at the release', async () => {
    await mountDrawer({ transition: true, backdrop: {} });
    const popup = get('popup');
    const backdrop = get('backdrop');
    await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
    // The last sample moves 100 px in 20 ms, and the 100 px that are left take the least time.
    flick(get('text'), textOf(), await mousePointerId(textOf()), [
      [10, 1010],
      [100, 1030],
      [200, 1050],
    ]);
    await nextTick();
    expect(popup.style.getPropertyValue('--drawer-swipe-strength')).toBe('0.1');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-strength')).toBe('0.1');
    await waitFor(() => expect(popup.isConnected).toBe(false));
  });

  test.each([false, true])(
    'opens again with the strength 1 and no mark of the swipe close, with keepMounted=%s',
    async (keepMounted) => {
      await mountDrawer({ backdrop: {}, portal: { keepMounted } });
      flick(get('text'), textOf(), await mousePointerId(textOf()), [
        [10, 1010],
        [100, 1030],
        [200, 1050],
      ]);
      await waitFor(() => expect(byTestId('popup')?.hidden ?? true).toBe(true));
      await userEvent.click(get('trigger'));
      await waitFor(() => expect(byTestId('popup')?.hidden).toBe(false));
      for (const element of [get('popup'), get('backdrop')]) {
        expect(element.style.getPropertyValue('--drawer-swipe-strength')).toBe('1');
        expect(element.hasAttribute('data-swipe-dismiss')).toBe(false);
      }
    },
  );

  test.each([
    { drawer: 'a drawer', prefix: '', when: 'after' },
    { drawer: 'a drawer', prefix: '', when: 'during' },
    { drawer: 'a nested drawer', prefix: 'nested-', when: 'after' },
  ])(
    'opens $drawer at its open place again after a swipe close, with the open $when the leave',
    async ({ prefix, when }) => {
      // The old popup stays in the DOM while the trigger opens the drawer again, until the case
      // ends its leave.
      holdTransition('leave');
      await mountDrawer(
        prefix
          ? { nested: { root: { defaultOpen: true }, transition: true } }
          : { transition: true },
      );
      await waitFor(() => expect(byTestId(`${prefix}popup`)).not.toBe(null));
      const popup = get(`${prefix}popup`);
      await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
      await drag(textOf(`${prefix}popup`), { x: 0, y: 200 });
      await waitFor(() => expect(popup.classList.contains('drawer-test-leave-active')).toBe(true));
      if (when === 'after') await endLeave(popup);
      else expect(popup.isConnected).toBe(true);
      await userEvent.click(get(`${prefix}trigger`));
      if (when === 'during') await endLeave(popup);
      await waitFor(() => expect([null, popup]).not.toContain(byTestId(`${prefix}popup`)));
      const next = get(`${prefix}popup`);
      await waitFor(() => expect(next.className).toBe('drawer-test-popup'));
      expect(next.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
      // The popup of the fixture is 300 px high at the bottom of the view.
      await waitFor(() => expect(next.getBoundingClientRect().top).toBe(window.innerHeight - 300));
    },
  );

  test('goes back after a cancelled close, and after a close that the parent refused', async () => {
    const root = reactive<Props>({
      defaultOpen: true,
      onOpenChange: (_: boolean, details: { cancel(): void }) => details.cancel(),
    });
    await mountDrawer({ root, backdrop: {} });
    await drag(textOf(), { x: 0, y: 200 });
    await nextTick();
    const popup = get('popup');
    expect(popup.hasAttribute('data-swipe-dismiss')).toBe(false);
    expect(sample()).toEqual({ y: '0px', progress: '0' });

    root.onOpenChange = undefined;
    root.open = true;
    await nextTick();
    await drag(textOf(), { x: 0, y: 200 });
    await nextTick();
    await nextTick();
    expect(byTestId('popup')).toBe(popup);
    expect(popup.hasAttribute('data-swipe-dismiss')).toBe(false);
    expect(get('backdrop').hasAttribute('data-swipe-dismiss')).toBe(false);
    expect(sample().y).toBe('0px');
  });

  test('starts no swipe from a mouse on an element of its own drag, in the content, or outside the popup', async () => {
    await mountDrawer({ content: {}, popup: { 'data-vase-ui-swipe-ignore': undefined } });
    const popup = get('popup');
    const ignored = popup.appendChild(document.createElement('div'));
    ignored.setAttribute('data-vase-ui-swipe-ignore', '');
    ignored.textContent = 'Ignored';
    onTestFinished(() => ignored.remove());
    for (const id of ['button', 'field', 'content', 'scroller']) {
      const release = await press(centerOf(id), { x: 0, y: 160 });
      await nextTick();
      expect([id, sample().y]).toEqual([id, '0px']);
      await release();
    }
    const release = await press(
      { x: ignored.getBoundingClientRect().left + 5, y: ignored.getBoundingClientRect().top + 5 },
      { x: 0, y: 60 },
    );
    await nextTick();
    expect(sample().y).toBe('0px');
    await release();
    const outside = await press({ x: 100, y: 100 }, { x: 0, y: 200 });
    await nextTick();
    expect(sample().y).toBe('0px');
    await outside();
  });

  test('selects no text in a mouse swipe', async () => {
    await mountDrawer();
    const release = await press(textOf('text'), { x: 60, y: 60 }, 8);
    expect(String(getSelection())).toBe('');
    expect(get('viewport').style.userSelect).toBe('none');
    await wait(300);
    await release();
    expect(String(getSelection())).toBe('');
    expect(get('viewport').style.userSelect).toBe('');
  });

  test.each([
    { place: 'in the popup', cleared: true },
    { place: 'outside the popup', cleared: false },
  ])(
    'the start of a mouse swipe clears a selection $place: $cleared',
    async ({ place, cleared }) => {
      const outside = document.body.appendChild(document.createElement('p'));
      outside.textContent = 'Outside text';
      const selection = getSelection()!;
      onTestFinished(() => {
        selection.removeAllRanges();
        outside.remove();
      });
      await mountDrawer({ root: { defaultOpen: true, modal: false } });
      selection.selectAllChildren(place === 'in the popup' ? get('text') : outside);
      const release = await press(textOf('text'), { x: 0, y: 60 });
      await nextTick();
      expect(selection.isCollapsed).toBe(cleared);
      await release();
    },
  );

  test('ends at a press of the other button with no close, and the later release closes nothing', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log) });
    get('viewport').addEventListener('contextmenu', (event) => event.preventDefault());
    await press(textOf(), { x: 0, y: 200 });
    await userEvent.pointer({ keys: '[MouseRight]' });
    await nextTick();
    expect(sample().y).toBe('0px');
    await userEvent.pointer({ coords: { ...textOf(), y: textOf().y + 220 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('keeps the drag through a render of the popup', async () => {
    const popupProps = reactive<Props>({ 'data-mark': 'a' });
    await mountDrawer({ popup: popupProps });
    const release = await press(textOf(), { x: 0, y: 90 });
    popupProps['data-mark'] = 'b';
    await nextTick();
    expect(get('popup').dataset.mark).toBe('b');
    expect(sample().y).toBe('90px');
    expect(get('popup').style.transition).toBe('none');
    await release();
  });

  test('ends when its popup goes, also when the portal keeps the closed popup', async () => {
    const shown = reactive({ open: true });
    await mountDrawer({ root: shown, portal: { keepMounted: true } });
    const release = await press(textOf(), { x: 0, y: 90 });
    shown.open = false;
    await waitFor(() => expect(get('popup').hidden).toBe(true));
    shown.open = true;
    await waitFor(() => expect(get('popup').hidden).toBe(false));
    await nextTick();
    expect(sample().y).toBe('0px');
    expect(get('popup').hasAttribute('data-swiping')).toBe(false);
    await release();
  });

  test('takes no swipe while a drawer in it is open, and gives the drawer above the progress of a nested swipe', async () => {
    await mountDrawer({ nested: { root: { defaultOpen: true } } });
    await waitFor(() => expect(byTestId('nested-popup')).not.toBe(null));
    const popup = get('popup');
    const nested = get('nested-popup');
    const release = await press(textOf('nested-popup'), { x: 0, y: 150 });
    await nextTick();
    expect(nested.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('150px');
    expect(popup.hasAttribute('data-nested-drawer-swiping')).toBe(true);
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    await release();
    await nextTick();
    expect(popup.hasAttribute('data-nested-drawer-swiping')).toBe(false);
    expect(popup.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  test('closes at a flick that ends with a move of no button', async () => {
    await mountDrawer();
    flick(
      get('text'),
      textOf(),
      await mousePointerId(textOf()),
      [
        [10, 1010],
        [25, 1020],
        [40, 1030],
      ],
      { upEvent: false },
    );
    await closed();
  });

  test('ends with no release when another element takes the pointer', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log) });
    let pointerId = -1;
    get('viewport').addEventListener('pointerdown', (event) => (pointerId = event.pointerId));
    const from = textOf();
    const release = await press(from, { x: 0, y: 100 });
    const other = document.body.appendChild(document.createElement('div'));
    onTestFinished(() => other.remove());
    other.setPointerCapture(pointerId);
    // The browser moves the capture at the next pointer event.
    await userEvent.pointer({ coords: { ...from, y: from.y + 150 } });
    await nextTick();
    expect(sample().y).toBe('0px');
    expect(get('popup').hasAttribute('data-swiping')).toBe(false);
    await release();
    expect(log).toEqual([]);
  });

  test('ends with no release when the main button goes up while another button is down', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log) });
    await press(textOf(), { x: 0, y: 60 });
    await userEvent.pointer({ keys: '[MouseMiddle>]' });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await userEvent.pointer({ coords: { ...textOf(), y: textOf().y + 200 } });
    await nextTick();
    expect(sample().y).toBe('0px');
    await userEvent.pointer({ keys: '[/MouseMiddle]' });
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual([]);
  });

  test('starts at the place of a popup whose enter runs', async () => {
    holdTransition('enter');
    await mountDrawer({ root: { defaultOpen: false }, transition: true });
    await userEvent.click(get('trigger'));
    await waitFor(() => expect(byTestId('popup')?.getAnimations()).toHaveLength(1));
    const popup = get('popup');
    // The enter goes to its middle, so the popup is about 150 px below its open place at the press.
    for (const animation of popup.getAnimations()) animation.currentTime = 50_000;
    const release = await press(textOf(), { x: 0, y: 1 }, 1);
    await nextTick();
    expect(Number.parseFloat(sample().y)).toBeGreaterThan(100);
    await release();
    for (const animation of popup.getAnimations()) animation.finish();
  });

  test('takes no swipe while a drawer in it is open, also for a nested drawer that is not modal', async () => {
    // The viewport of the nested drawer lets a press through to the popup under it.
    await mountDrawer({
      nested: {
        root: { defaultOpen: true, modal: false },
        viewport: { style: 'pointer-events: none' },
        popup: { style: 'height: 100px; pointer-events: auto' },
      },
    });
    await waitFor(() => expect(byTestId('nested-popup')).not.toBe(null));
    const release = await press(textOf(), { x: 0, y: 120 });
    await nextTick();
    expect(sample().y).toBe('0px');
    await release();
    expect(byTestId('popup')).not.toBe(null);
  });

  test('stops for a `pointerdown` listener of the developer that stops the event', async () => {
    await mountDrawer();
    get('text').addEventListener('pointerdown', (event) => event.stopPropagation());
    const release = await press(textOf('text'), { x: 0, y: 160 });
    await nextTick();
    expect(sample().y).toBe('0px');
    await release();
  });

  test('measures the popup at the start of a drag, so a change of its size in the drag changes no release', async () => {
    const popup = reactive<Props>({});
    // A drawer at the left edge keeps each point of the drags far from the bottom of the view.
    await mountDrawer({ root: { defaultOpen: true, swipeDirection: 'left' }, popup });
    const at = (x: number) => ({ x: get('popup').getBoundingClientRect().left + x, y: 100 });
    const release = await press(at(250), { x: -80, y: 0 });
    // 80 px is less than half of the 300 px at the start, and more than half of 100 px.
    popup.style = 'width: 100px';
    await nextTick();
    // A release after a rest is slow.
    await wait(300);
    await release();
    await nextTick();
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-x')).toBe('0px');
    // The CSS of the popup moves it back to its place.
    await waitFor(() => expect(get('popup').getBoundingClientRect().left).toBe(0));
    await drag(at(90), { x: -60, y: 0 });
    await closed();
  });

  test('gives the progress 0 to a move back past the start, and follows each move there', async () => {
    await mountDrawer({ backdrop: {} });
    const from = textOf();
    const release = await press(from, { x: 0, y: 60 });
    await nextTick();
    expect(sample().progress).toBe('0.2');
    await userEvent.pointer({ coords: { x: from.x, y: from.y - 10 } });
    await nextTick();
    const back = sample();
    expect(back.progress).toBe('0');
    expect(Number.parseFloat(back.y)).toBeLessThan(0);
    await userEvent.pointer({ coords: { x: from.x, y: from.y - 30 } });
    await nextTick();
    expect(sample().progress).toBe('0');
    expect(Number.parseFloat(sample().y)).toBeLessThan(Number.parseFloat(back.y));
    await release();
  });

  test('VUE-228: a `pointerdown` listener of the developer that calls `preventDefault()` does not stop a mouse swipe', async () => {
    await mountDrawer();
    get('text').addEventListener('pointerdown', (event) => event.preventDefault());
    const release = await press(textOf('text'), { x: 0, y: 90 });
    await nextTick();
    expect(sample().y).toBe('90px');
    await release();
  });
});

describe('snap points', () => {
  const sizes = { viewport: { style: 'height: 800px' }, popup: { style: 'height: 400px' } };

  async function mountSheet(log: string[], props: Props = {}) {
    const root = rootEvents(log, { snapPoints: ['100px', '300px', 1] });
    Object.assign(root, props);
    await mountDrawer({ root, ...sizes });
    await waitFor(() =>
      expect(get('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px'),
    );
    // The transition of the popup moves it to the point.
    await wait(250);
  }

  test('moves the sheet to the nearest point at the release', async () => {
    const log: string[] = [];
    await mountSheet(log);
    const release = await press(textOf(), { x: 0, y: -190 }, 10);
    // With no speed, the place of the release decides.
    await wait(120);
    await release();
    await waitFor(() =>
      expect(get('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe('100px'),
    );
    expect(log).toEqual(['snapPointChange 300px swipe']);
  });

  test('moves past the open place as a square root', async () => {
    const log: string[] = [];
    await mountSheet(log);
    const release = await press(textOf(), { x: 0, y: -316 }, 8);
    await nextTick();
    expect(sample().y).toBe('-304px');
    await release();
  });

  test('closes from the lowest point after a request for no point', async () => {
    const log: string[] = [];
    await mountSheet(log);
    await drag(textOf(), { x: 0, y: 80 });
    await closed();
    expect(log).toEqual([
      'snapPointChange null swipe',
      'openChange false swipe',
      'snapPointChange 100px swipe',
    ]);
  });

  test('keeps the drawer open when a listener cancels the request for no point', async () => {
    const log: string[] = [];
    await mountSheet(log, {
      onSnapPointChange: (point: unknown, details: { cancel(): void }) => {
        log.push(`snapPointChange ${String(point)}`);
        details.cancel();
      },
    });
    await drag(textOf(), { x: 0, y: 80 });
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual(['snapPointChange null']);
  });

  test.each([true, false])(
    'with `snapToSequentialPoints`, a short flick moves to the next point, with a still sample at its end=%s',
    async (still) => {
      const log: string[] = [];
      await mountSheet(log, { snapToSequentialPoints: true });
      flick(get('text'), textOf(), await mousePointerId(textOf()), [
        [0, 1008],
        [-12, 1024],
        [-24, 1040],
        [-36, 1056],
        ...(still ? ([[-36.5, 1072]] as [number, number][]) : []),
      ]);
      await waitFor(() => expect(log).toEqual(['snapPointChange 300px swipe']));
    },
  );

  test('with `snapToSequentialPoints`, a drag that rests with still samples before the release stays at its point', async () => {
    const log: string[] = [];
    await mountSheet(log, { snapToSequentialPoints: true });
    flick(get('text'), textOf(), await mousePointerId(textOf()), [
      [0, 1008],
      [-40, 1024],
      [-40, 1040],
      [-40, 1056],
      [-40, 1072],
    ]);
    await wait(50);
    // As in Base UI, the release asks for its point also when it is the active one.
    expect(log.filter((entry) => entry !== 'snapPointChange 100px swipe')).toEqual([]);
    expect(get('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px');
  });

  test('a close that a listener cancels keeps the point and emits no change of it', async () => {
    const log: string[] = [];
    await mountSheet(log, {
      onOpenChange: (_: boolean, details: { cancel(): void }) => details.cancel(),
    });
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(get('popup').style.getPropertyValue('--drawer-snap-point-offset')).toBe('300px');
    expect(log).toEqual([]);
  });
});

describe('the swipe area', () => {
  async function mountArea(setup: Props = {}) {
    const log: string[] = [];
    const root = reactive<Props>({
      defaultOpen: false,
      onOpenChange: (open: boolean, details: { reason: string; trigger?: Element }) =>
        log.push(
          `openChange ${open} ${details.reason} ${details.trigger?.getAttribute('data-testid')}`,
        ),
      ...(setup.root as Props),
    });
    await mountDrawer({
      trigger: null,
      swipeArea: {},
      backdrop: {},
      provider: true,
      ...setup,
      root,
    });
    return { log, root };
  }

  test('an opening drawer with no height gives the backdrop and the indent no --drawer-height', async () => {
    await mountArea({
      root: { swipeDirection: 'right' },
      popup: { style: 'height: 0; overflow: hidden' },
    });
    const release = await press(centerOf('swipe-area'), { x: -100, y: 0 }, 10);
    try {
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      await waitFor(() =>
        expect(
          Number(get('backdrop').style.getPropertyValue('--drawer-swipe-progress')),
        ).toBeGreaterThan(0),
      );
      expect(get('popup').offsetHeight).toBe(0);
      expect(get('backdrop').style.getPropertyValue('--drawer-height')).toBe('');
      expect(get('indent').style.getPropertyValue('--drawer-height')).toBe('');
    } finally {
      await release();
    }
  });

  test('opens the drawer at 1 px and moves the popup from its closed place with the finger', async () => {
    const { log } = await mountArea();
    const area = get('swipe-area');
    expect(area.getAttribute('role')).toBe('presentation');
    expect(area.getAttribute('aria-hidden')).toBe('true');
    expect(area.style.touchAction).toBe('pan-x');
    expect(area.dataset.swipeDirection).toBe('up');
    const start = centerOf('swipe-area');
    const release = await press(start, { x: 0, y: -100 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await nextTick();
    expect(log).toEqual(['openChange true swipe swipe-area']);
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('200px');
    expect(get('backdrop').style.getPropertyValue('--drawer-swipe-progress')).toBe(
      String(1 - 100 / 300),
    );
    expect(get('indent').style.getPropertyValue('--drawer-swipe-progress')).toBe(
      String(1 - 100 / 300),
    );
    expect(get('backdrop').style.getPropertyValue('--drawer-height')).toBe('300px');
    expect(get('indent').style.getPropertyValue('--drawer-height')).toBe('300px');
    expect(area.hasAttribute('data-swiping')).toBe(true);
    expect(get('popup').hasAttribute('data-swiping')).toBe(true);
    // A drag of more than half of the popup keeps it open at a release of any speed.
    await userEvent.pointer({ coords: { x: start.x, y: start.y - 160 } });
    await release();
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(sample().y).toBe('0px');
    expect(area.hasAttribute('data-open')).toBe(true);
    expect(area.style.pointerEvents).toBe('none');
  });

  test('closes the drawer at a short release, and the release closes nothing else', async () => {
    const { log } = await mountArea();
    const release = await press(centerOf('swipe-area'), { x: 0, y: -30 }, 10);
    // A release after a rest has no speed.
    await wait(120);
    await release();
    await closed();
    expect(log).toEqual(['openChange true swipe swipe-area', 'openChange false swipe swipe-area']);
  });

  test('keeps the drawer open at a release outside the popup, and the click of the release closes nothing', async () => {
    const { log } = await mountArea({ root: { modal: false } });
    await drag(centerOf('swipe-area'), { x: 0, y: -500 }, 10);
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual(['openChange true swipe swipe-area']);
  });

  test.each(['a press', 'a click with no press'])(
    'lets %s outside the popup close the drawer after a swipe opened it',
    async (outside) => {
      const { log } = await mountArea();
      await drag(centerOf('swipe-area'), { x: 0, y: -250 }, 10);
      await waitFor(() => expect(byTestId('popup')).not.toBe(null));
      await wait(50);
      if (outside === 'a press') {
        await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
      } else {
        document.body.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      }
      await closed();
      expect(log).toEqual([
        'openChange true swipe swipe-area',
        'openChange false outside-press swipe-area',
      ]);
    },
  );

  test('lets a press outside the popup close the drawer after a context menu ended the swipe that opened it', async () => {
    const { log } = await mountArea();
    get('swipe-area').addEventListener('contextmenu', (event) => event.preventDefault());
    const release = await press(centerOf('swipe-area'), { x: 0, y: -250 }, 10);
    onTestFinished(release);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    // The menu of the context takes the release, so the page gets no `pointerup`.
    get('swipe-area').dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true, button: 2 }),
    );
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      document.body.dispatchEvent(
        type.startsWith('pointer')
          ? new PointerEvent(type, { bubbles: true, pointerType: 'mouse', isPrimary: true })
          : new MouseEvent(type, { bubbles: true, detail: 1 }),
      );
    }
    await closed();
    expect(log).toEqual([
      'openChange true swipe swipe-area',
      'openChange false outside-press swipe-area',
    ]);
  });

  test('keeps no swipe state and asks for no close when a parent refuses the open', async () => {
    const log: string[] = [];
    await mountArea({
      root: {
        open: false,
        onOpenChange: (open: boolean) => log.push(`openChange ${open}`),
      },
      portal: { keepMounted: true },
    });
    const release = await press(centerOf('swipe-area'), { x: 0, y: -120 }, 6);
    await nextTick();
    expect(get('popup').hidden).toBe(true);
    await release();
    await nextTick();
    expect(get('popup').hasAttribute('data-swiping')).toBe(false);
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(get('swipe-area').hasAttribute('data-swiping')).toBe(false);
    expect(log).toEqual(['openChange true']);
  });

  test('ends a swipe when the area becomes disabled; the drawer stays open, and an outside press closes it', async () => {
    const area = reactive<Props>({ disabled: false });
    await mountArea({ swipeArea: area });
    const release = await press(centerOf('swipe-area'), { x: 0, y: -60 }, 4);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    expect(get('popup').hasAttribute('data-swiping')).toBe(true);
    area.disabled = true;
    await nextTick();
    expect(get('popup').hasAttribute('data-swiping')).toBe(false);
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(get('swipe-area').hasAttribute('data-disabled')).toBe(true);
    await release();
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    await userEvent.pointer({ coords: { x: 5, y: 5 }, keys: '[MouseLeft]' });
    await closed();
  });

  test('goes on after the open makes the area inert', async () => {
    const { log } = await mountArea();
    const release = await press(centerOf('swipe-area'), { x: 0, y: -60 }, 4);
    await waitFor(() => expect(get('swipe-area').closest('[inert]')).not.toBe(null));
    const { x, y } = centerOf('swipe-area');
    for (let step = 1; step <= 4; step += 1) {
      await userEvent.pointer({ coords: { x, y: y - 1 - 60 - step * 30 } });
    }
    await nextTick();
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('120px');
    await release();
    expect(log).toEqual(['openChange true swipe swipe-area']);
  });

  test('keeps the focus where it was, and selects no text of the page', async () => {
    await mountArea();
    const button = document.body.appendChild(document.createElement('button'));
    button.textContent = 'Before';
    onTestFinished(() => button.remove());
    button.focus();
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    expect(String(getSelection())).toBe('');
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  test('gives Shift+Tab out of a drawer that is not modal to the element that had the focus before the open', async () => {
    await mountArea({ root: { modal: false } });
    const button = document.body.appendChild(document.createElement('button'));
    button.textContent = 'Before';
    onTestFinished(() => button.remove());
    button.focus();
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    await waitFor(() => expect(document.activeElement).toBe(get('popup')));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await waitFor(() => expect(document.activeElement).toBe(button));
  });

  test('VUE-57: ends the swipe when the area unmounts, and the popup goes to its open place', async () => {
    const area = reactive<Props>({});
    const log: string[] = [];
    mount(DrawerParts, {
      swipeArea: area,
      trigger: null,
      backdrop: {},
      provider: true,
      root: reactive({ defaultOpen: false, onOpenChange: (open: boolean) => log.push(`${open}`) }),
    });
    await nextTick();
    await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await nextTick();
    expect(get('popup').hasAttribute('data-swiping')).toBe(true);
    area.removed = true;
    await waitFor(() => expect(byTestId('swipe-area')).toBe(null));
    await nextTick();
    const popup = get('popup');
    expect(popup.hasAttribute('data-swiping')).toBe(false);
    expect(popup.style.transition).toBe('');
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('0px');
    expect(get('backdrop').style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(get('indent').style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toEqual(['true']);
  });

  test('follows a first move of a mouse that leaves the area', async () => {
    const { log } = await mountArea();
    const { x, y } = centerOf('swipe-area');
    await userEvent.pointer({ coords: { x, y } });
    await userEvent.pointer({ keys: '[MouseLeft>]' });
    // The drag from the first move is more than half of the popup, so the release keeps it open.
    for (const step of [150, 250, 330]) await userEvent.pointer({ coords: { x, y: y - step } });
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toEqual(['openChange true swipe swipe-area']);
  });

  test('moves the popup from the place of its enter class', async () => {
    await mountArea({ transition: true, enterFromClass: 'drawer-test-peek' });
    const release = await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await nextTick();
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('150px');
    await release();
  });

  test('opens nothing while disabled', async () => {
    const { log } = await mountArea({ swipeArea: { disabled: true } });
    expect(get('swipe-area').hasAttribute('data-disabled')).toBe(true);
    expect(get('swipe-area').style.pointerEvents).toBe('none');
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    expect(log).toEqual([]);
  });

  test('gives one popup to a swipe while the popup of the last close leaves, at the place of the finger after the leave', async () => {
    // The popup and the backdrop of the close leave until the case ends their leave.
    holdTransition('leave');
    await mountArea({ transition: true });
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    const popup = get('popup');
    const backdrop = get('backdrop');
    await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
    await userEvent.keyboard('{Escape}');
    const release = await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
    expect([...document.querySelectorAll('[data-testid="popup"]')]).toEqual([popup]);
    await endLeave(popup, backdrop);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    expect(document.querySelectorAll('[data-testid="popup"]')).toHaveLength(1);
    await nextTick();
    expect(get('popup').style.getPropertyValue('--drawer-swipe-movement-y')).toBe('200px');
    await release();
  });
});

describe.skipIf(!chromium)('a touch (Chromium)', () => {
  test('closes from the text of the popup', async () => {
    const log: string[] = [];
    await mountDrawer({ root: rootEvents(log) });
    const from = textOf();
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await closed();
    expect(log).toEqual(['openChange false swipe']);
  });

  test('closes from a scroller at its top, and scrolls a scroller in its middle', async () => {
    await mountDrawer();
    const scroller = get('scroller');
    const from = centerOf('scroller');
    scroller.scrollTop = 100;
    await touchDrag(from, { x: from.x, y: from.y + 60 }, 10);
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    expect(scroller.scrollTop).toBeLessThan(100);
    // The scroll of the browser ends.
    await wait(500);
    scroller.scrollTop = 0;
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await closed();
  });

  test('scrolls nothing and moves no sheet for a finger up in a scroller at its end', async () => {
    const log: string[] = [];
    await mountDrawer({
      root: rootEvents(log, { snapPoints: ['100px', 1], defaultSnapPoint: 1 }),
      viewport: { style: 'height: 800px' },
      popup: { style: 'height: 400px' },
    });
    const scroller = get('scroller');
    scroller.scrollTop = scroller.scrollHeight;
    const end = scroller.scrollTop;
    const from = centerOf('scroller');
    await touchDrag(from, { x: from.x, y: from.y - 120 }, 10);
    await wait(50);
    expect(scroller.scrollTop).toBe(end);
    expect(sample().y).toBe('0px');
    expect(log).toEqual([]);
  });

  test('moves the popup and closes it while `body` scrolls the page', async () => {
    const { body, documentElement: html } = document;
    const styles = [html.style.cssText, body.style.cssText];
    // `body` is a scroller of its own, and the overflow does not go to the view.
    html.style.cssText = 'height: 100%; overflow-y: auto';
    body.style.cssText = 'height: 100%; overflow-y: auto';
    const tall = body.appendChild(document.createElement('div'));
    tall.style.height = '5000px';
    onTestFinished(() => {
      tall.remove();
      [html.style.cssText, body.style.cssText] = styles;
    });
    // A modal drawer locks the scroll of the page.
    await mountDrawer({ root: { defaultOpen: true, modal: false } });
    expect(body.scrollHeight).toBeGreaterThan(body.clientHeight);
    const from = textOf();
    await touchPath(
      [from, { x: from.x, y: from.y - 20 }, { x: from.x, y: from.y - 40 }],
      async () => {
        await nextTick();
        expect(Number.parseFloat(sample().y)).toBeLessThan(0);
      },
    );
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await closed();
  });

  test('gives the browser a drag across the axis', async () => {
    await mountDrawer();
    const from = textOf();
    await touchDrag(from, { x: from.x + 120, y: from.y + 30 }, 10);
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
  });

  test('moves the popup from the point where a touch that started outside it comes in', async () => {
    await mountDrawer();
    const top = get('popup').getBoundingClientRect().top;
    await touchDrag({ x: 100, y: top - 60 }, { x: 100, y: top + 200 }, 13);
    await closed();
  });

  test('gives no move of a swipe to a `touchmove` listener in the popup', async () => {
    await mountDrawer();
    const moves: number[] = [];
    get('text').addEventListener('touchmove', () => moves.push(1));
    const from = textOf('text');
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await closed();
    expect(moves).toEqual([]);
  });

  test('starts a swipe on a button, and none on a range input or while the popup has a selection', async () => {
    await mountDrawer();
    const range = get('popup').appendChild(document.createElement('input'));
    range.type = 'range';
    range.style.cssText = 'position: absolute; right: 0; top: 0; width: 120px';
    let from = {
      x: range.getBoundingClientRect().left + 10,
      y: range.getBoundingClientRect().top + 5,
    };
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    getSelection()!.selectAllChildren(get('text'));
    from = textOf('text');
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    getSelection()!.removeAllRanges();
    from = centerOf('button');
    await touchDrag(from, { x: from.x, y: from.y + 200 }, 10);
    await closed();
  });

  test('decides at 6 px, so a drag that turns to the other axis stays with the browser', async () => {
    await mountDrawer();
    const { x, y } = textOf();
    await touchPath(
      [
        { x, y },
        { x, y: y + 2 },
        { x, y: y + 3 },
        { x: x + 10, y: y + 4 },
        { x: x + 30, y: y + 5 },
        { x: x + 60, y: y + 6 },
      ],
      async () => {
        await nextTick();
        expect(sample().y).toBe('0px');
      },
    );
  });

  test('gives a move of two fingers to the browser in a swipe', async () => {
    await mountDrawer();
    const moves: number[] = [];
    const listener = (event: TouchEvent) => moves.push(event.touches.length);
    document.addEventListener('touchmove', listener);
    onTestFinished(() => document.removeEventListener('touchmove', listener));
    const { x, y } = textOf();
    await touchPath([
      { x, y },
      { x, y: y + 10 },
      { x, y: y + 20 },
      { x, y: y + 30, second: { x: x + 100, y: y + 30 } },
      { x, y: y + 40, second: { x: x + 120, y: y + 40 } },
    ]);
    expect(moves).toContain(2);
    expect(moves).not.toContain(1);
  });

  test('moves the popup from the point where the touch comes in', async () => {
    await mountDrawer();
    const top = get('popup').getBoundingClientRect().top;
    const points = Array.from({ length: 17 }, (_, index) => ({ x: 100, y: top - 60 + index * 10 }));
    await touchPath(points, async () => {
      await nextTick();
      expect(Number.parseFloat(sample().y)).toBeGreaterThan(80);
      expect(Number.parseFloat(sample().y)).toBeLessThan(120);
    });
  });

  test('opens the drawer from the swipe area', async () => {
    const log: string[] = [];
    await mountDrawer({
      root: reactive({
        defaultOpen: false,
        onOpenChange: (open: boolean) => log.push(`openChange ${open}`),
      }),
      trigger: null,
      swipeArea: {},
    });
    const from = centerOf('swipe-area');
    await touchDrag(from, { x: from.x, y: from.y - 250 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await wait(50);
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual(['openChange true']);
  });
});
