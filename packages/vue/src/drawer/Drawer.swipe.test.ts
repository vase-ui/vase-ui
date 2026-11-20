import { describe, expect, onTestFinished, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { defineComponent, h, nextTick, reactive } from 'vue';
import type { DrawerSnapPoint } from '@vase-ui/vue/drawer';
import DrawerParts from '../../test/fixtures/DrawerParts.vue';
import { touchDrag } from '../../test/pointer';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
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

  test('leaves from the place of the drag with `data-swipe-dismiss` and the strength of the release', async () => {
    await mountDrawer({ transition: true, backdrop: {} });
    const popup = get('popup');
    const backdrop = get('backdrop');
    await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
    await drag(textOf(), { x: 0, y: 200 });
    await nextTick();
    expect(popup.isConnected).toBe(true);
    expect(popup.classList.contains('drawer-test-leave-active')).toBe(true);
    expect(popup.hasAttribute('data-swipe-dismiss')).toBe(true);
    expect(backdrop.hasAttribute('data-swipe-dismiss')).toBe(true);
    expect(popup.hasAttribute('data-swiping')).toBe(false);
    expect(popup.style.getPropertyValue('--drawer-swipe-movement-y')).toBe('200px');
    expect(Number(popup.style.getPropertyValue('--drawer-swipe-strength'))).toBeLessThanOrEqual(1);
    expect(popup.style.transition).toBe('');
    await waitFor(() => expect(popup.isConnected).toBe(false));
  });

  test('VUE-139: gives the backdrop the strength of the popup at the release', async () => {
    await mountDrawer({ transition: true, backdrop: {} });
    const popup = get('popup');
    const backdrop = get('backdrop');
    await waitFor(() => expect(popup.className).toBe('drawer-test-popup'));
    await drag(textOf(), { x: 0, y: 200 }, 4);
    await nextTick();
    const strength = popup.style.getPropertyValue('--drawer-swipe-strength');
    expect(Number(strength)).toBeLessThan(1);
    expect(backdrop.style.getPropertyValue('--drawer-swipe-strength')).toBe(strength);
    await waitFor(() => expect(popup.isConnected).toBe(false));
  });

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

  test('ends when its popup goes', async () => {
    const shown = reactive({ open: true });
    await mountDrawer({ root: shown });
    const release = await press(textOf(), { x: 0, y: 90 });
    shown.open = false;
    await closed();
    shown.open = true;
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
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

  test('stops for a `pointerdown` listener of the developer that stops the event', async () => {
    await mountDrawer();
    get('text').addEventListener('pointerdown', (event) => event.stopPropagation());
    const release = await press(textOf('text'), { x: 0, y: 160 });
    await nextTick();
    expect(sample().y).toBe('0px');
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
        log.push(`snapPointChange ${point}`);
        details.cancel();
      },
    });
    await drag(textOf(), { x: 0, y: 80 });
    await nextTick();
    expect(byTestId('popup')).not.toBe(null);
    expect(log).toEqual(['snapPointChange null']);
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

  test('opens the drawer at 1 px and moves the popup from its closed place with the finger', async () => {
    const { log } = await mountArea();
    const area = get('swipe-area');
    expect(area.getAttribute('role')).toBe('presentation');
    expect(area.getAttribute('aria-hidden')).toBe('true');
    expect(area.style.touchAction).toBe('pan-x');
    expect(area.dataset.swipeDirection).toBe('up');
    const release = await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
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
    expect(area.hasAttribute('data-swiping')).toBe(true);
    expect(get('popup').hasAttribute('data-swiping')).toBe(true);
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

  test('VUE-57: ends the swipe when the area unmounts, and the popup goes to its open place', async () => {
    const shown = reactive({ area: true });
    const log: string[] = [];
    const root = reactive({
      defaultOpen: false,
      onOpenChange: (open: boolean) => log.push(`${open}`),
    });
    mount(
      defineComponent(
        () => () =>
          h(DrawerParts, {
            swipeArea: shown.area ? {} : undefined,
            trigger: null,
            backdrop: {},
            provider: true,
            root,
          }),
      ),
    );
    await nextTick();
    await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await nextTick();
    expect(get('popup').hasAttribute('data-swiping')).toBe(true);
    shown.area = false;
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

  test('opens nothing while disabled', async () => {
    const { log } = await mountArea({ swipeArea: { disabled: true } });
    expect(get('swipe-area').hasAttribute('data-disabled')).toBe(true);
    expect(get('swipe-area').style.pointerEvents).toBe('none');
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    expect(log).toEqual([]);
  });

  test('gives one popup to a swipe while the popup of the last close leaves, at the place of the finger after the leave', async () => {
    await mountArea({ transition: true });
    await drag(centerOf('swipe-area'), { x: 0, y: -200 }, 10);
    await waitFor(() => expect(byTestId('popup')).not.toBe(null));
    await wait(250);
    await userEvent.keyboard('{Escape}');
    const leaving = get('popup');
    const release = await press(centerOf('swipe-area'), { x: 0, y: -100 }, 10);
    await waitFor(() => expect(leaving.isConnected).toBe(false));
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
