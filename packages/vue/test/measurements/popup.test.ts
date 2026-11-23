// Measurements for the popup layer, with native elements, plain Vue and Floating UI, and no code of
// the library. Each one states what the browser or Vue does, so that the layer has code only where
// they do not do it. Where the browsers differ, the measurement states each one. Vue does not patch
// an element that leaves in a `<Transition>`: see `tabs.test.ts`.
import { afterEach, describe, expect, inject, onTestFinished, test } from 'vitest';
import { page, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureFirstFrame from '../fixtures/MeasureFirstFrame.vue';
import MeasureFirstPlace from '../fixtures/MeasureFirstPlace.vue';
import MeasurePortalOrder from '../fixtures/MeasurePortalOrder.vue';
import MeasureTransitionMount from '../fixtures/MeasureTransitionMount.vue';
import MeasureTransitionReopen from '../fixtures/MeasureTransitionReopen.vue';
import MeasureTransitionShow from '../fixtures/MeasureTransitionShow.vue';
import { createScrollDocument } from '../fixtures/scrollDocument';
import { nextEvent } from '../animation';
import { holdPress, stopFling, touchDrag } from '../pointer';
import { mount } from '../render';
import { waitFor } from '../waitFor';
import { tabbables } from '../../src/popup/focus';

let root: HTMLElement | undefined;

afterEach(() => {
  root?.remove();
  root = undefined;
});

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

function element<T extends HTMLElement = HTMLElement>(id: string) {
  return document.getElementById(id) as T;
}

const activeId = () => document.activeElement?.id || document.activeElement?.localName;

function record(target: EventTarget, types: string[]) {
  const log: string[] = [];
  for (const type of types) {
    target.addEventListener(
      type,
      (event) =>
        log.push(`${type} ${(event.target as Element).id || (event.target as Element).localName}`),
      true,
    );
  }
  return log;
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function centerOf(target: Element) {
  const rect = target.getBoundingClientRect();
  return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
}

describe('Tab after a key listener moved the focus', () => {
  test('goes on from the element that has the focus: a listener on Tab that moves the focus and lets the key go on sends the focus past that element', async () => {
    html(`<input id="trigger" aria-label="Trigger"><input id="after" aria-label="After">
      <div id="popup"><input id="first" aria-label="First"><input id="last" aria-label="Last"></div>`);
    element('popup').addEventListener('keydown', (event) => {
      if (event.key === 'Tab' && !event.shiftKey) element('trigger').focus();
    });
    element('last').focus();
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('after');
  });
});

describe('inert', () => {
  test('a press on inert content has the element under it that is not inert as its target, and no listener of the content runs', async () => {
    html(
      `<div id="page" inert style="height: 200px"><button id="covered" style="width: 100px; height: 40px">Covered</button></div>`,
    );
    root!.id = 'under';
    const log = record(document, ['pointerdown', 'pointerup', 'click']);
    const covered: string[] = [];
    element('covered').addEventListener('click', () => covered.push('click'));
    await userEvent.pointer({ coords: centerOf(element('covered')), keys: '[MouseLeft]' });
    expect(log).toEqual(['pointerdown under', 'pointerup under', 'click under']);
    expect(covered).toEqual([]);
  });

  test('Tab from the last control of the content that stays in use goes to <body>, then to the first control in Chromium and WebKit, and to the last in Firefox', async () => {
    html(`<div inert><input id="outside" aria-label="Outside"></div>
      <div id="popup"><input id="first" aria-label="First"><input id="last" aria-label="Last"></div>`);
    element('last').focus();
    const order: (string | undefined)[] = [];
    for (let index = 0; index < 2; index += 1) {
      await userEvent.keyboard('{Tab}');
      order.push(activeId());
    }
    expect(order).toEqual(['body', server.browser === 'firefox' ? 'last' : 'first']);
  });
});

describe('a press in a same-origin frame', () => {
  test('sends `focusout` with no related target to a focused control of the page, and the frame is the active element one task later; no pointer event reaches the page', async () => {
    html(`<input id="control" aria-label="Control">
      <iframe id="frame" style="width: 200px; height: 100px" srcdoc="<button style='width: 150px; height: 60px'>In</button>"></iframe>`);
    const frame = element<HTMLIFrameElement>('frame');
    await new Promise((resolve) => {
      if (
        frame.contentDocument?.readyState === 'complete' &&
        frame.contentDocument.body?.firstChild
      )
        resolve(null);
      else frame.addEventListener('load', resolve, { once: true });
    });
    const log: string[] = [];
    element('control').focus();
    document.addEventListener(
      'focusout',
      (event) => log.push(`focusout ${event.relatedTarget === null ? 'null' : 'element'}`),
      true,
    );
    document.addEventListener('pointerdown', () => log.push('pointerdown'), true);
    await userEvent.pointer({ coords: centerOf(frame), keys: '[MouseLeft]' });
    await new Promise((resolve) => setTimeout(resolve));
    expect(log).toEqual(['focusout null']);
    expect(document.activeElement).toBe(frame);
  });
});

describe('a focused element that leaves', () => {
  test('leaves the focus on <body>; only Chromium sends `focusout` at the removal; the next Tab goes on after its place', async () => {
    html(
      `<input id="first" aria-label="First"><div id="list"><input id="a" aria-label="A"><input id="b" aria-label="B"><input id="c" aria-label="C"></div><input id="last" aria-label="Last">`,
    );
    const log: string[] = [];
    element('list').addEventListener('focusout', () => log.push('focusout'));
    element('b').focus();
    element('b').remove();
    expect(activeId()).toBe('body');
    expect(log).toEqual(server.browser === 'chromium' ? ['focusout'] : []);
    await userEvent.keyboard('{Tab}');
    expect(activeId()).toBe('c');
  });
});

describe('the scroll of the page', () => {
  test('`overflow: hidden` on the element that scrolls the view stops the wheel', async () => {
    const { win, html: page } = await createScrollDocument();
    page.style.overflow = 'hidden';
    await userEvent.wheel(win.frameElement!, { delta: { y: 300 } });
    await nextFrame();
    expect(win.scrollY).toBe(0);
  });

  test('`overflow: hidden` removes a scrollbar that takes room, and the content gets wider by its width', async () => {
    const {
      win,
      html: page,
      body,
    } = await createScrollDocument({
      css: '::-webkit-scrollbar { width: 12px; height: 12px }',
    });
    const scrollbar = win.innerWidth - page.clientWidth;
    const before = body.getBoundingClientRect().width;
    page.style.overflow = 'hidden';
    expect(body.getBoundingClientRect().width - before).toBe(scrollbar);
  });

  test('a smooth `scroll-behavior` animates a write of `scrollTop`: the offset is not there at once', async () => {
    const { html: page } = await createScrollDocument({ css: 'html { scroll-behavior: smooth }' });
    page.scrollTop = 300;
    expect(page.scrollTop).toBeLessThan(300);
  });

  test('a sticky element in a fixed element that starts above the view sticks in Chromium and WebKit, and stays at its place in Firefox', async () => {
    const { doc, html: page } = await createScrollDocument();
    page.insertAdjacentHTML(
      'beforeend',
      `<div style="position: fixed; top: -2px; height: 4px">
        <div id="sticky" style="position: sticky; top: 0"></div>
      </div>`,
    );
    const { top } = doc.getElementById('sticky')!.getBoundingClientRect();
    expect(top).toBe(server.browser === 'firefox' ? -2 : 0);
  });

  test('a fixed `<html>` with the scroll offset as its insets keeps the size of the view and the place of each element, and has no range to scroll; in Firefox a stuck sticky element moves', async () => {
    const {
      win,
      doc,
      html: page,
    } = await createScrollDocument({
      css: '::-webkit-scrollbar { width: 12px; height: 12px } html { padding: 7px }',
    });
    const box = 'width: 10px; height: 10px';
    doc.body.insertAdjacentHTML(
      'afterbegin',
      `<div id="static" style="height: 10px; margin-top: 300px"></div>
      <div id="absolute" style="position: absolute; top: 700px; left: 60px; ${box}"></div>
      <div id="absolute-end" style="position: absolute; right: 10px; bottom: 10px; ${box}"></div>
      <div id="fixed" style="position: fixed; right: 10px; bottom: 10px; ${box}"></div>
      <div style="height: 1400px"><div id="sticky" style="position: sticky; top: 20px; ${box}"></div></div>`,
    );
    const ids = ['static', 'absolute', 'absolute-end', 'fixed', 'sticky'];
    const places = () =>
      ids.map((id) => [id, doc.getElementById(id)!.getBoundingClientRect().toJSON()]);
    win.scrollTo({ left: 30, top: 600, behavior: 'instant' });
    const size = [page.clientWidth, page.clientHeight];
    const before = places();
    Object.assign(page.style, {
      position: 'fixed',
      top: '-600px',
      right: '30px',
      bottom: '600px',
      left: '-30px',
      overflowY: 'scroll',
      overflowX: 'scroll',
    });
    expect([page.clientWidth, page.clientHeight]).toEqual(size);
    expect([page.scrollWidth - page.clientWidth, page.scrollHeight - page.clientHeight]).toEqual([
      0, 0,
    ]);
    const moved = places()
      .filter(([, place], index) => JSON.stringify(place) !== JSON.stringify(before[index]![1]))
      .map(([id]) => id);
    expect(moved).toEqual(server.browser === 'firefox' ? ['sticky'] : []);
  });

  test('where `<body>` gives the view its overflow, an overflow on a fixed `<html>` makes `<body>` scroll by itself, and a stuck sticky element moves; with the overflow on `<body>`, the element stays in Chromium and WebKit', async () => {
    const tops: number[] = [];
    for (const element of ['html', 'body'] as const) {
      const page = await createScrollDocument({
        css: '::-webkit-scrollbar { width: 12px; height: 12px } body { margin: 0; overflow-x: hidden }',
      });
      page.body.insertAdjacentHTML(
        'afterbegin',
        '<div id="sticky" style="position: sticky; top: 0; height: 10px"></div>',
      );
      page.win.scrollTo({ top: 600, behavior: 'instant' });
      page[element].style.overflowY = 'scroll';
      Object.assign(page.html.style, {
        position: 'fixed',
        top: '-600px',
        right: '0px',
        bottom: '600px',
        left: '0px',
      });
      tops.push(page.doc.getElementById('sticky')!.getBoundingClientRect().top);
    }
    expect(tops).toEqual([-600, server.browser === 'firefox' ? -600 : 0]);
  });
});

describe('a visually hidden element among the children of a box', () => {
  test.each(['block', 'flex', 'grid', 'inline'])(
    'with `position: fixed` and a size of 1 px changes no box of its siblings: display %s',
    (display) => {
      const box = html(
        `<div style="display: ${display}; gap: 8px"><span>A</span><button>B</button><span>C</span></div>`,
      ).firstElementChild!;
      const boxes = () =>
        [...box.children]
          .filter((child) => child.localName !== 'i')
          .map((child) => JSON.stringify(child.getBoundingClientRect()));
      const before = boxes();
      const hidden = document.createElement('i');
      hidden.style.cssText =
        'position: fixed; top: -1px; left: 0; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; border: 0; padding: 0; margin: 0';
      box.querySelector('button')!.before(hidden);
      expect(boxes()).toEqual(before);
    },
  );
});

describe('focus()', () => {
  test('with `preventScroll` scrolls nothing', () => {
    html(`<div style="height: 3000px"></div><input id="far" aria-label="Far">`);
    element('far').focus({ preventScroll: true });
    expect(window.scrollY).toBe(0);
  });

  test('from a key listener after a press gives :focus-visible in Chromium and WebKit, and in Firefox only with `focusVisible: true`', async () => {
    html(`<button id="target">Target</button><button id="start">Start</button>`);
    const visible: boolean[] = [];
    for (const options of [undefined, { focusVisible: true } as FocusOptions]) {
      // WebKit gives a pressed button no focus.
      await userEvent.click(element('start'));
      element('start').focus();
      element('start').addEventListener('keydown', () => element('target').focus(options), {
        once: true,
      });
      await userEvent.keyboard('{Escape}');
      visible.push(element('target').matches(':focus-visible'));
    }
    expect(visible).toEqual([server.browser !== 'firefox', true]);
  });
});

describe('a press', () => {
  test('that drags across the edge of a box gives `pointerdown` and `pointerup` the element under the pointer, and `click` the common ancestor', async () => {
    html(`<div id="outside" style="position: fixed; left: 0; top: 0; width: 100px; height: 100px"></div>
      <div id="popup" style="position: fixed; left: 200px; top: 0; width: 100px; height: 100px"></div>`);
    const log = record(document, ['pointerdown', 'pointerup', 'click']);
    const { release } = await holdPress(element('popup'));
    await release(centerOf(element('outside')));
    expect(log).toEqual(['pointerdown popup', 'pointerup outside', 'click div']);
  });

  test('released outside the view gives the document `pointerup` in Chromium and WebKit; Firefox gives it a move with no button and no `pointerup`', async () => {
    html(`<div id="box" style="width: 100px; height: 100px"></div>`);
    const { release } = await holdPress(element('box'));
    const log: string[] = [];
    const listening = new AbortController();
    onTestFinished(() => listening.abort());
    for (const type of ['pointermove', 'pointerup']) {
      document.addEventListener(
        type,
        (event) => {
          if (type === 'pointerup' || (event as PointerEvent).buttons === 0) log.push(type);
        },
        { capture: true, signal: listening.signal },
      );
    }
    const away = { x: innerWidth + 50, y: innerHeight / 2 };
    await userEvent.pointer({ coords: away });
    await release(away);
    await nextFrame();
    // Firefox gives one or two such moves.
    expect([...new Set(log)]).toEqual([server.browser === 'firefox' ? 'pointermove' : 'pointerup']);
  });

  test('of the mouse runs each microtask that a `pointerdown` listener queues before `mousedown`, also a microtask of a microtask', async () => {
    html('<button id="trigger">Trigger</button><div id="popup" tabindex="-1">Popup</div>');
    element('trigger').addEventListener('pointerdown', () => {
      void Promise.resolve()
        .then(() => Promise.resolve())
        .then(() => element('popup').focus());
    });
    let atMousedown: string | undefined;
    element('trigger').addEventListener('mousedown', (event) => {
      atMousedown = activeId();
      event.preventDefault();
    });
    await userEvent.click(element('trigger'));
    expect(atMousedown).toBe('popup');
  });

  test('of the right button gives no `click`', async () => {
    html(`<div id="box" style="width: 100px; height: 100px"></div>`);
    element('box').addEventListener('contextmenu', (event) => event.preventDefault());
    const log = record(document, ['click']);
    await userEvent.click(element('box'), { button: 'right' });
    expect(log).toEqual([]);
  });
});

describe('two nested teleports to <body> that render in one update', () => {
  test.each([
    { afterMount: false, defer: false },
    { afterMount: false, defer: true },
    { afterMount: true, defer: false },
  ])('put the parent before the child: %o', async ({ afterMount, defer }) => {
    const scene = reactive({ open: false });
    mount(MeasurePortalOrder, { scene, afterMount, defer });
    scene.open = true;
    await nextTick();
    await nextTick();
    await nextTick();
    const order = [...document.body.children].map((child) => child.id).filter(Boolean);
    expect(order.filter((id) => id === 'parent' || id === 'child')).toEqual(['parent', 'child']);
  });
});

describe('a <Transition> that mounts in the update of the open', () => {
  test.each([
    { appear: false, classes: '' },
    { appear: true, classes: 'm-enter-from m-enter-active' },
  ])(
    'with appear=$appear gives its element the classes "$classes"',
    async ({ appear, classes }) => {
      const scene = reactive({ open: false });
      mount(MeasureTransitionMount, { scene, appear });
      scene.open = true;
      await nextTick();
      const popup = document.querySelector('.popup')!;
      expect([...popup.classList].filter((name) => name.startsWith('m-')).join(' ')).toBe(classes);
    },
  );
});

describe('the first frame after an open', () => {
  test('shows the floating element at the place of Floating UI: it places in microtasks', async () => {
    const scene = reactive({ open: false });
    mount(MeasureFirstFrame, { scene });
    scene.open = true;
    await nextTick();
    const floating = page.getByTestId('floating').element();
    const first = await new Promise<DOMRect>((resolve) =>
      requestAnimationFrame(() => resolve(floating.getBoundingClientRect())),
    );
    await nextFrame();
    await nextFrame();
    expect(first.toJSON()).toEqual(floating.getBoundingClientRect().toJSON());
    expect(first.top).toBeGreaterThan(100);
  });
});

describe('the first place of an open', () => {
  const translateY = (target: Element) =>
    Math.round(new DOMMatrix(getComputedStyle(target).transform).f);
  const transitions = (target: Element) =>
    target
      .getAnimations({ subtree: true })
      .map((animation) => (animation as CSSTransition).transitionProperty);

  test('a change of the place and the side after the layout read of Floating UI starts transitions from the read; `cancel()` shows the new style, and the enter starts from it', async () => {
    const scene = reactive({ open: false });
    mount(MeasureFirstPlace, { scene });
    await nextTick();
    scene.open = true;
    const floating = () => page.getByTestId('floating').element() as HTMLElement;
    const popup = () => page.getByTestId('popup').element();
    const firstFrame = await new Promise((resolve) =>
      requestAnimationFrame(() => {
        const before = {
          side: popup().getAttribute('data-side'),
          // A loaded engine can show a transition some milliseconds after its start.
          top: Number.parseFloat(getComputedStyle(floating()).top) < 10,
          translateY: translateY(popup()) < -40,
          transitions: transitions(floating()),
        };
        for (const animation of floating().getAnimations({ subtree: true })) animation.cancel();
        resolve({
          before,
          after: {
            top: getComputedStyle(floating()).top === floating().style.top,
            translateY: translateY(popup()),
            transitions: transitions(floating()),
          },
        });
      }),
    );
    expect(firstFrame).toEqual({
      before: { side: 'top', top: true, translateY: true, transitions: ['top', 'transform'] },
      after: { top: true, translateY: 50, transitions: [] },
    });
    await nextEvent(popup(), 'transitionrun');
    expect(translateY(popup())).toBeGreaterThan(0);
  });
});

describe('a change of an inherited property', () => {
  test('to `visible` keeps the elements hidden and unfocusable while a transition of 0.01 ms starts; in Chromium and WebKit, the end of the transition starts one in each child', () => {
    html(
      '<div id="box" style="visibility: hidden; transition: all 0.01ms"><button id="child" style="transition: all 0.01ms">Child</button></div>',
    );
    // The browser computes the style before the change.
    expect(getComputedStyle(element('child')).visibility).toBe('hidden');
    element('box').style.visibility = '';
    const read = () => ({
      transitions: element('box')
        .getAnimations({ subtree: true })
        .map((animation) => (animation.effect as KeyframeEffect).target?.id),
      child: getComputedStyle(element('child')).visibility,
    });
    const started = read();
    element('child').focus();
    const focused = activeId();
    for (const animation of element('box').getAnimations({ subtree: true })) animation.cancel();
    const afterCancel = read();
    expect({ started, focused, afterCancel }).toEqual({
      started: {
        transitions: server.browser === 'firefox' ? ['box', 'child'] : ['box'],
        child: 'hidden',
      },
      focused: 'body',
      afterCancel:
        server.browser === 'firefox'
          ? { transitions: [], child: 'visible' }
          : { transitions: ['child'], child: 'hidden' },
    });
  });
});

describe('the tab stops of a container', () => {
  // WebKit on macOS gives Tab a link only by a setting of the system, as it does for a button.
  test('are the stops of the Tab key of the browser; the Tab of WebKit on macOS skips the link', async () => {
    html(`<input id="start" aria-label="Start"><div id="box">
      <input id="radio-a" type="radio" name="group" aria-label="A"><input id="radio-b" type="radio" name="group" aria-label="B" checked>
      <details><summary id="summary">More</summary><input id="in-details" aria-label="In details"></details>
      <div style="display: none"><input id="hidden" aria-label="Hidden"></div>
      <fieldset disabled><input id="in-fieldset" aria-label="In fieldset"></fieldset>
      <input id="minus-one" tabindex="-1" aria-label="Minus one">
      <div id="host"></div>
      <div id="editable" contenteditable="true">Edit</div>
      <a id="link" href="#x">Link</a></div><input id="end" aria-label="End">`);
    const shadow = element('host').attachShadow({ mode: 'open' });
    const inShadow = document.createElement('input');
    inShadow.id = 'in-shadow';
    inShadow.ariaLabel = 'In shadow';
    shadow.append(inShadow);
    element('start').focus();
    const order: string[] = [];
    for (let index = 0; index < 6; index += 1) {
      await userEvent.keyboard('{Tab}');
      const active = document.activeElement?.shadowRoot?.activeElement ?? document.activeElement;
      order.push(active?.id ?? '');
    }
    const stops = tabbables(element('box')).map((stop) => stop.id);
    expect(stops).toEqual(['radio-b', 'summary', 'in-shadow', 'editable', 'link']);
    expect(order).toEqual(
      server.browser === 'webkit' && server.platform === 'darwin'
        ? ['radio-b', 'summary', 'in-shadow', 'editable', 'end', '']
        : [...stops, 'end'],
    );
  });
});

describe('an open while the popup leaves', () => {
  test('mounts a second popup element beside the leaving one; the `<Transition>` of Vapor removes the leaving one', async () => {
    const scene = reactive({ open: true });
    const { root: app } = mount(MeasureTransitionReopen, { scene });
    await nextTick();
    scene.open = false;
    await nextTick();
    const leaving = app.querySelector('.popup');
    scene.open = true;
    await nextTick();
    const popups = [...app.querySelectorAll('.popup')].map((popup) => popup === leaving);
    expect(popups).toEqual(inject('app').startsWith('vapor') ? [false] : [true, false]);
  });
});

// The opacity of the element in each frame until `stop` gives `true`, at most for 2 s.
async function opacityFrames(target: Element, stop: () => boolean) {
  const frames: { opacity: number; visible: boolean }[] = [];
  const end = performance.now() + 2000;
  while (!stop() && performance.now() < end) {
    await nextFrame();
    frames.push({
      opacity: Number(getComputedStyle(target).opacity),
      visible: target.checkVisibility(),
    });
  }
  return frames;
}

// The scene of `MeasureTransitionShow`: a `<Transition>` of 500 ms with linear opacity.
function mountShow(
  scene: { open: boolean; rendered: boolean },
  options: { appear?: boolean; css?: boolean; readsLayout?: boolean } = {},
) {
  const state = reactive(scene);
  const log: string[] = [];
  mount(MeasureTransitionShow, {
    scene: state,
    log: { add: (entry: string) => log.push(entry) },
    ...options,
  });
  return { scene: state, log, popup: () => document.querySelector<HTMLElement>('.popup') };
}

async function openThenLeaveToHalf(options: { readsLayout?: boolean } = {}) {
  const shown = mountShow({ open: false, rendered: true }, options);
  shown.scene.open = true;
  await waitFor(() => expect(shown.log).toContain('after-enter'));
  const element = shown.popup()!;
  shown.log.length = 0;
  shown.scene.open = false;
  await opacityFrames(element, () => Number(getComputedStyle(element).opacity) < 0.6);
  return { ...shown, element, atOpen: Number(getComputedStyle(element).opacity) };
}

describe('a show during the leave of an element with `v-show` in a <Transition>', () => {
  test('keeps the element and goes back from where it is: `leave-cancelled`, `before-enter` and `after-enter` come once, and the opacity goes on down by less than 0.15', async () => {
    const { scene, log, element, atOpen } = await openThenLeaveToHalf();
    scene.open = true;
    const frames = await opacityFrames(element, () => log.includes('after-enter'));
    expect(document.querySelectorAll('.popup')).toHaveLength(1);
    expect(element.isConnected).toBe(true);
    expect(log).toEqual([
      'before-leave',
      'leave',
      'leave-cancelled',
      'before-enter',
      'enter',
      'after-enter',
    ]);
    expect(frames.every((frame) => frame.visible)).toBe(true);
    const lowest = Math.min(...frames.map((frame) => frame.opacity));
    expect(atOpen - lowest).toBeLessThan(0.15);
    expect(frames.at(-1)?.opacity).toBe(1);
  });

  test('a read of the layout in `leave-cancelled` and `before-enter` reads the element with `display: none`, and the enter starts from its `enter-from` class', async () => {
    const { scene, log, element, atOpen } = await openThenLeaveToHalf({ readsLayout: true });
    expect(atOpen).toBeGreaterThan(0.2);
    scene.open = true;
    const frames = await opacityFrames(element, () => log.includes('after-enter'));
    expect(log.slice(2, 6)).toEqual(['leave-cancelled', 'width 0', 'before-enter', 'width 0']);
    expect(Math.min(...frames.map((frame) => frame.opacity))).toBeLessThan(0.1);
  });

  test('a `v-if` on the <Teleport> after the leave removes the hidden element with no second leave', async () => {
    const { scene, log, popup } = mountShow({ open: true, rendered: true });
    await waitFor(() => expect(log).toContain('after-enter'));
    const element = popup()!;
    scene.open = false;
    await waitFor(() => expect(log).toContain('after-leave'));
    expect(element.style.display).toBe('none');
    scene.rendered = false;
    await nextTick();
    expect(element.isConnected).toBe(false);
    expect(log.filter((entry) => entry === 'before-leave')).toHaveLength(1);
    expect(log.filter((entry) => entry === 'after-leave')).toHaveLength(1);
  });

  // The `<Transition>` of Vapor calls the enter hooks once.
  test.each([
    { appear: false, css: true, twice: [] },
    { appear: true, css: true, twice: ['before-enter', 'enter'] },
    { appear: true, css: false, twice: ['before-enter', 'enter', 'after-enter'] },
  ])(
    'that shows one update after its mount in an open, with appear=$appear and css=$css, calls $twice twice in a virtual DOM app; the first frame that shows it is hidden by `enter-from`',
    async ({ appear, css, twice }) => {
      const { log, popup } = mountShow({ open: true, rendered: true }, { appear, css });
      await waitFor(() => expect(popup()).not.toBe(null));
      const element = popup()!;
      const frames = await opacityFrames(element, () => log.includes('after-enter'));
      await new Promise((resolve) => setTimeout(resolve, 100));
      const counts = Object.fromEntries(
        ['before-enter', 'enter', 'after-enter'].map((hook) => [
          hook,
          log.filter((entry) => entry === hook).length,
        ]),
      );
      const calls = (hook: string) =>
        twice.includes(hook) && !inject('app').startsWith('vapor') ? 2 : 1;
      expect(counts).toEqual({
        'before-enter': calls('before-enter'),
        enter: calls('enter'),
        'after-enter': calls('after-enter'),
      });
      if (css) expect(frames.find((frame) => frame.visible)?.opacity).toBeLessThan(0.2);
    },
  );
});

describe('a swap of the leave class for the enter class during a CSS animation', () => {
  test('with one keyframes name and `reverse`, keeps the animation and its time, and the opacity jumps to the mirrored point; with two names, the enter starts from its first keyframe', async () => {
    html(`<style>
      @keyframes fade { from { opacity: 0 } to { opacity: 1 } }
      @keyframes fade-out { from { opacity: 1 } to { opacity: 0 } }
      .enter { animation: fade 1000ms linear }
      .leave-same { animation: fade 1000ms linear reverse }
      .leave { animation: fade-out 1000ms linear }
      </style><div id="same" class="leave-same"></div><div id="two" class="leave"></div>`);
    const opacity = (id: string) => Number(getComputedStyle(element(id)).opacity);
    for (const id of ['same', 'two']) {
      const [animation] = element(id).getAnimations();
      animation!.pause();
      animation!.currentTime = 200;
    }
    const before = { same: opacity('same'), two: opacity('two') };
    const [same] = element('same').getAnimations();
    element('same').className = 'enter';
    element('two').className = 'enter';
    await nextFrame();
    expect(before).toEqual({ same: 0.8, two: 0.8 });
    expect(element('same').getAnimations()).toEqual([same]);
    expect(same!.currentTime).toBe(200);
    expect(opacity('same')).toBeCloseTo(0.2, 1);
    expect(opacity('two')).toBeLessThan(0.1);
  });
});

describe('a double click on a fixed element over text', () => {
  test('selects a word of the page in Firefox and WebKit, and nothing in Chromium; `user-select: none` on the element selects nothing', async () => {
    html(`<p style="font-size: 40px; margin: 0">Some text of the page</p>
      <div id="cover" style="position: fixed; inset: 0"></div>`);
    const selected: string[] = [];
    for (const style of ['', 'none']) {
      element('cover').style.userSelect = style;
      element('cover').style.setProperty('-webkit-user-select', style);
      document.getSelection()?.removeAllRanges();
      await userEvent.dblClick(element('cover'), { position: { x: 60, y: 20 } });
      selected.push(document.getSelection()?.toString().trim() ?? '');
    }
    expect(selected[0] !== '').toBe(server.browser !== 'chromium');
    expect(selected[1]).toBe('');
  });
});

describe('a mouse press on a scrollbar that takes room', () => {
  test('sends `pointerdown`, `mousedown`, `pointerup`, in WebKit also `mouseup`, with a point outside the client box of the element that scrolls, and no `click`', async ({
    skip,
  }) => {
    html(`<style>#scroller::-webkit-scrollbar { width: 12px }</style>
      <div id="scroller" style="width: 200px; height: 100px; overflow: auto"><div style="height: 400px"></div></div>`);
    const scroller = element('scroller');
    const width = scroller.offsetWidth - scroller.clientWidth;
    skip(width === 0, 'The scrollbar of this browser takes no room.');
    const log: string[] = [];
    for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
      document.addEventListener(
        type,
        (event) => log.push(`${type} ${(event as MouseEvent).offsetX > scroller.clientWidth}`),
        true,
      );
    }
    const box = scroller.getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: box.right - width / 2, y: box.top + 50 },
      keys: '[MouseLeft]',
    });
    expect(log).toEqual([
      'pointerdown true',
      'mousedown true',
      'pointerup true',
      ...(server.browser === 'chromium' ? [] : ['mouseup true']),
    ]);
  });
});

describe('a real touch outside', () => {
  // The protocol injects a touch with no long press, so a rest is a tap
  // (https://chromium.googlesource.com/chromium/src/+/main/content/browser/renderer_host/input/touch_emulator_impl.cc).
  // On Linux, Windows and ChromeOS, a touch that stops a fling sends no `click`
  // (https://chromium.googlesource.com/chromium/src/+/main/ui/events/gesture_detection/gesture_configuration_aura.cc).
  // The drag ends with a fling, so the rest comes before the drag.
  test.skipIf(server.browser !== 'chromium')(
    'sends `pointerdown`, `pointerup` and `click` for a tap and for a rest of 1.5 s, and `pointercancel` for a drag on a page that scrolls',
    async () => {
      html(`<div id="page" style="height: 3000px"></div>`);
      const log: string[] = [];
      for (const type of ['pointerdown', 'pointerup', 'pointercancel', 'click']) {
        document.addEventListener(type, () => log.push(type), true);
      }
      const start = { x: 100, y: 200 };
      await touchDrag(start, start, 1);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const tap = log.splice(0);
      await touchDrag(start, start, 0, 1500);
      await new Promise((resolve) => setTimeout(resolve, 50));
      const rest = log.splice(0);
      await touchDrag(start, { x: 100, y: 100 }, 6);
      await new Promise((resolve) => setTimeout(resolve, 50));
      expect({ tap, rest, drag: log }).toEqual({
        tap: ['pointerdown', 'pointerup', 'click'],
        rest: ['pointerdown', 'pointerup', 'click'],
        drag: ['pointerdown', 'pointercancel'],
      });
    },
  );
});

describe('a real touch that starts outside a native popover', () => {
  /** The pointer events with `click`, and the touch events, each with no repeat. */
  function recordTouch() {
    const log = { pointer: [] as string[], touch: [] as string[] };
    let start = { x: 0, y: 0 };
    const controller = new AbortController();
    onTestFinished(() => controller.abort());
    const add = (list: string[], entry: string) => list.at(-1) !== entry && list.push(entry);
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'click']) {
      document.addEventListener(
        type,
        (event) => {
          const { clientX, clientY } = event as PointerEvent;
          if (type === 'pointerdown') start = { x: clientX, y: clientY };
          const far = Math.hypot(clientX - start.x, clientY - start.y) > 15;
          add(log.pointer, type === 'pointermove' && far ? 'pointermove past 15 px' : type);
        },
        { capture: true, signal: controller.signal },
      );
    }
    for (const type of ['touchstart', 'touchmove', 'touchend', 'touchcancel']) {
      document.addEventListener(type, () => add(log.touch, type), {
        capture: true,
        passive: true,
        signal: controller.signal,
      });
    }
    return log;
  }

  // Playwright can only tap in WebKit, so the case runs in Chromium. A measurement by hand in Safari
  // on iOS 26.5, in the iPhone 17 Simulator, gives these results:
  // - A swipe of 150 px that scrolls the page sends `pointermove` past 15 px, then `pointercancel`,
  //   and no `click`. The popover stays open.
  // - On `touch-action: none`, a move of 44 px sends `pointerup` and `click`, and a move of 46 px
  //   sends `pointerup` and no `click`. A drag of 60 px closes the popover at its `pointerup`.
  // - A tap sends `click` only to an element with a listener of `click` or `mousedown` of its own. A
  //   listener of the window gets no `click` of a tap on another element.
  // A measurement by hand in Chrome 124 on Android 15, in the Android Emulator at 420 dpi, gives a
  // smaller limit: on `touch-action: none`, a move of 8 px sends `click`, and a move of 8.1 px sends
  // `pointerup` and no `click`.
  test.skipIf(server.browser !== 'chromium')(
    'closes at a tap and at a move of 15 px, which send `click`; a move of 16 px and a drag of 40 px on `touch-action: none` send `pointerup` and no `click`, and a touch that scrolls the page sends `pointercancel` after moves past 15 px; none of them closes it',
    async () => {
      html(`<div style="height: 3000px"></div>
        <div id="surface" style="position: fixed; left: 0; bottom: 0; width: 200px; height: 100px; touch-action: none"></div>
        <div id="popup" popover style="inset: 0 auto auto 0; margin: 0">Popup</div>`);
      onTestFinished(() => scrollTo(0, 0));
      const popover = element('popup');
      const log = recordTouch();
      const surface = centerOf(element('surface'));
      const results: unknown[] = [];
      for (const [from, to, steps] of [
        [surface, surface, 0],
        [surface, { x: surface.x + 15, y: surface.y }, 3],
        [surface, { x: surface.x + 16, y: surface.y }, 4],
        [surface, { x: surface.x + 40, y: surface.y }, 4],
        [{ x: 100, y: 300 }, { x: 100, y: 150 }, 25],
      ] as const) {
        popover.showPopover();
        await touchDrag(from, to, steps);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const open = popover.matches(':popover-open');
        results.push({ ...log, open, scrolled: scrollY > 0 });
        log.pointer = [];
        log.touch = [];
        if (open) popover.hidePopover();
      }
      await stopFling();
      const touch = ['touchstart', 'touchmove', 'touchend'];
      expect(results).toEqual([
        {
          pointer: ['pointerdown', 'pointerup', 'click'],
          touch: ['touchstart', 'touchend'],
          open: false,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointerup', 'click'],
          touch: ['touchstart', 'touchend'],
          open: false,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointermove past 15 px', 'pointerup'],
          touch,
          open: true,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointermove past 15 px', 'pointerup'],
          touch,
          open: true,
          scrolled: false,
        },
        {
          pointer: ['pointerdown', 'pointermove', 'pointermove past 15 px', 'pointercancel'],
          touch,
          open: true,
          scrolled: true,
        },
      ]);
    },
  );
});

describe('a mouse press on an element that leaves at `pointerdown`', () => {
  test.each([false, true])(
    'with preventDefault() at pointerdown=%s: the button that the listener focuses keeps the focus only with the call; without it, the `mousedown` goes to the parent in Chromium and Firefox, WebKit sends none, and the focus goes to <body>',
    async (prevent) => {
      html(`<button id="trigger" style="position: fixed; left: 100px; top: 100px">Trigger</button>
        <div id="cover" style="position: fixed; inset: 0"></div>`);
      const log = record(document, ['mousedown']);
      const cover = element('cover');
      // Vue removes the element of a closed popup in a microtask.
      cover.addEventListener('pointerdown', (event) => {
        queueMicrotask(() => cover.remove());
        element('trigger').focus();
        if (prevent) event.preventDefault();
      });
      await userEvent.pointer({ coords: { x: 50, y: 50 }, keys: '[MouseLeft]' });
      expect(activeId()).toBe(prevent ? 'trigger' : 'body');
      const sent = !prevent && server.browser !== 'webkit';
      expect(log).toEqual(sent ? [`mousedown ${root!.localName}`] : []);
    },
  );
});

describe('a real tap on an element that leaves at its `pointerup`', () => {
  // A measurement by hand in Safari on iOS 26.5, in the iPhone 17 Simulator, and in Chrome 124 on
  // Android 15, in the Android Emulator, gives the same results for a button under the element.
  test.skipIf(server.browser !== 'chromium')(
    'sends `click` and the mouse events to the element under it, which takes the focus; a `touchend` listener of the element that left gets the event, and its `preventDefault()` cancels the mouse events and the `click`',
    async () => {
      const results: Record<string, string[]> = {};
      for (const cancel of [false, true]) {
        html(`<input id="under" aria-label="Under" style="position: fixed; left: 0; top: 0; width: 200px; height: 100px">
          <div id="cover" style="position: fixed; inset: 0"></div>`);
        const log = record(document, ['mousedown', 'focusin', 'mouseup', 'click']);
        const cover = element('cover');
        cover.addEventListener('pointerup', () => queueMicrotask(() => cover.remove()));
        cover.addEventListener('touchend', (event) => {
          log.push(`touchend ${cover.isConnected ? 'in' : 'out of'} the document`);
          if (cancel) event.preventDefault();
        });
        await touchDrag({ x: 100, y: 50 }, { x: 100, y: 50 }, 0);
        await new Promise((resolve) => setTimeout(resolve, 50));
        results[cancel ? 'canceled' : 'not canceled'] = [...log];
        root!.remove();
      }
      expect(results).toEqual({
        'not canceled': [
          'touchend out of the document',
          'mousedown under',
          'focusin under',
          'mouseup under',
          'click under',
        ],
        canceled: ['touchend out of the document'],
      });
    },
  );
});

describe('a mouse that moves from a trigger across a gap to a popup', () => {
  test('sends `pointerleave` of the trigger and `pointermove` of the element under the gap before the `pointerenter` of the popup, with the pointer type `mouse`', async () => {
    html(`<button id="trigger" style="position: fixed; left: 0; top: 0; width: 100px; height: 40px">Trigger</button>
      <div id="popup" style="position: fixed; left: 0; top: 80px; width: 200px; height: 100px"></div>`);
    root!.id = 'gap';
    const log: string[] = [];
    element('trigger').addEventListener('pointerleave', (event) =>
      log.push(`leave trigger ${event.pointerType}`),
    );
    element('popup').addEventListener('pointerenter', (event) =>
      log.push(`enter popup ${event.pointerType}`),
    );
    document.addEventListener('pointermove', (event) => {
      const id = (event.target as Element).id || (event.target as Element).localName;
      if (log.at(-1) !== `move ${id}`) log.push(`move ${id}`);
    });
    await userEvent.pointer([
      { coords: { x: 50, y: 20 } },
      { coords: { x: 50, y: 60 } },
      { coords: { x: 50, y: 120 } },
    ]);
    expect(log).toEqual([
      'move trigger',
      'leave trigger mouse',
      expect.stringMatching(/^move (?:gap|body|html)$/),
      'enter popup mouse',
      'move popup',
    ]);
  });
});

/** The first and the last column of dark pixels in a row of a picture of the element. */
async function darkColumns(target: Element, y: number) {
  const picture = (await page.screenshot({
    element: target,
    base64: true,
    save: false,
  } as never)) as unknown as string;
  const image = new Image();
  image.src = `data:image/png;base64,${picture}`;
  await image.decode();
  const canvas = document.createElement('canvas');
  canvas.width = image.width;
  canvas.height = image.height;
  const context = canvas.getContext('2d')!;
  context.drawImage(image, 0, 0);
  const row = context.getImageData(0, y, image.width, 1).data;
  const columns: number[] = [];
  for (let x = 0; x < image.width; x += 1) if (row[x * 4]! < 128) columns.push(x);
  return [columns[0], columns.at(-1)];
}

describe('the variables of a positioner', () => {
  test('a box at a fractional place covers more pixels than a box of the same width at the place that Floating UI rounds to pixels; the width in pixels covers the same ones', async () => {
    html(`<div id="scene" style="position: fixed; left: 0; top: 0; width: 300px; height: 90px; background: white">
      <div style="position: absolute; left: 10.4px; top: 0; width: 100.3px; height: 20px; background: black"></div>
      <div style="position: absolute; left: 0; top: 30px; transform: translate(10px, 0); width: 100.3px; height: 20px; background: black"></div>
      <div style="position: absolute; left: 0; top: 60px; transform: translate(10px, 0); width: 101px; height: 20px; background: black"></div></div>`);
    const scene = element('scene');
    expect([
      await darkColumns(scene, 10),
      await darkColumns(scene, 40),
      await darkColumns(scene, 70),
    ]).toEqual([
      [10, 110],
      [10, 109],
      [10, 110],
    ]);
  });

  test('an unset variable makes a rule with `var()` invalid: the popup has no `max-height`', () => {
    html(`<div id="popup" style="max-height: min(200px, var(--available-height))">Popup</div>`);
    expect(getComputedStyle(element('popup')).maxHeight).toBe('none');
  });
});

describe('the containing block of an arrow', () => {
  test('is a static popup while the popup has a transform, which is then also the offset parent; without the transform, the positioned ancestor', () => {
    html(`<div id="positioner" style="position: absolute; left: 100px; top: 100px">
      <div id="popup" style="border: 4px solid; width: 100px; height: 50px; transform: scale(0.5)">
        <div id="arrow" style="position: absolute; left: 10px; top: 0; width: 10px; height: 10px"></div>
      </div></div>`);
    const place = () => ({
      parent: (element('arrow').offsetParent as HTMLElement).id,
      left:
        element('arrow').getBoundingClientRect().left -
        element('popup').getBoundingClientRect().left,
    });
    const scaled = place();
    element('popup').style.transform = 'none';
    expect([scaled, place()]).toEqual([
      { parent: 'popup', left: 7 },
      { parent: 'positioner', left: 10 },
    ]);
  });
});

describe('a CSS zoom in a positioner', () => {
  test('the offsets, the borders and the sizes of a zoomed popup and of its arrow are in their own pixels, and `left`, `zoom` and a variable of the positioner resolve in them', () => {
    html(`<div id="positioner" style="position: absolute; left: 100px; top: 100px; border: 3px solid; padding: 4px; --origin: 30px 7px">
      <div id="popup" style="position: relative; zoom: 200%; margin-left: 10px; border: 4px solid; width: 100px; height: 50px; transform-origin: var(--origin)">
        <div id="arrow" style="position: absolute; left: 10px; top: 0; width: 10px; height: 10px"></div>
      </div></div>`);
    const positioner = element('positioner').getBoundingClientRect();
    const popup = element('popup');
    const box = popup.getBoundingClientRect();
    const arrow = element('arrow');
    popup.style.scale = '0.5';
    const scaled = popup.getBoundingClientRect();
    popup.style.scale = '';
    expect({
      zoom: getComputedStyle(popup).zoom,
      popup: [popup.offsetLeft, popup.clientLeft, popup.clientWidth],
      popupFromPositioner: box.left - positioner.left,
      arrow: [arrow.offsetLeft, arrow.clientWidth],
      arrowFromPopup: arrow.getBoundingClientRect().left - box.left,
      origin: 2 * scaled.left - box.left - box.left,
    }).toEqual({
      zoom: '2',
      // (4 + 2 * 10) / 2
      popup: [12, 4, 100],
      popupFromPositioner: 3 + 4 + 2 * 10,
      arrow: [10, 10],
      arrowFromPopup: 2 * 4 + 2 * 10,
      origin: 2 * 30,
    });
  });

  test('under a zoom of an ancestor too, Chromium and Firefox give the offset of the popup in its own pixels, and WebKit divides it only by the zoom of the popup', () => {
    html(`<div style="zoom: 2"><div id="positioner" style="position: absolute; left: 100px; top: 100px; padding: 4px">
      <div id="popup" style="position: relative; zoom: 1.5; margin-left: 10px; width: 100px; height: 50px"></div>
      </div></div>`);
    const popup = element('popup');
    const fromPositioner =
      popup.getBoundingClientRect().left - element('positioner').getBoundingClientRect().left;
    // (2 * 4 + 3 * 10) px: in pixels of the popup, 38 / 3; WebKit gives 38 / 1.5.
    expect({ fromPositioner, offsetLeft: popup.offsetLeft }).toEqual({
      fromPositioner: 38,
      offsetLeft: server.browser === 'webkit' ? 25 : 13,
    });
  });
});
