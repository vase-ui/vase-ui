// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one. The blur of a focused element that Vue removes
// is in `field.test.ts`.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureLeaveAttribute from '../fixtures/MeasureLeaveAttribute.vue';
import { mount } from '../render';

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
  return root!.querySelector<T>(`#${id}`)!;
}

async function nextFrame() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

describe('an element that leaves in a <Transition>', () => {
  test('keeps the attribute that it had: Vue does not patch it in the render that removes it', async () => {
    const scene = reactive({ shown: true, direction: 'left' });
    const log: (string | null)[] = [];
    mount(MeasureLeaveAttribute, {
      scene,
      log: { add: (entry: string | null) => log.push(entry) },
    });
    await nextTick();
    Object.assign(scene, { shown: false, direction: 'right' });
    await nextTick();
    expect(log).toEqual(['left']);
  });
});

describe('focus()', () => {
  test('gives no focus to a disabled button, a button in a disabled fieldset, a hidden button or a button with display: none', () => {
    html(`<input id="start" aria-label="Start">
      <button id="disabled" disabled>A</button>
      <fieldset disabled><button id="in-fieldset">B</button></fieldset>
      <button id="hidden" hidden>C</button>
      <button id="none" style="display: none">D</button>`);
    element('start').focus();
    const focused = ['disabled', 'in-fieldset', 'hidden', 'none'].map((id) => {
      element(id).focus();
      return (document.activeElement as HTMLElement).id;
    });
    expect(focused).toEqual(['start', 'start', 'start', 'start']);
  });
});

describe('a button in a disabled fieldset', () => {
  test('gets no click and no focus from a press, and :disabled matches it', async () => {
    html(`<fieldset disabled><button id="tab">A</button></fieldset>`);
    const clicks: string[] = [];
    root!.addEventListener('click', (event) => clicks.push((event.target as Element).id));
    await userEvent.click(element('tab'), { force: true });
    expect(clicks).toEqual([]);
    expect(document.activeElement).not.toBe(element('tab'));
    expect(element('tab').matches(':disabled')).toBe(true);
  });
});

describe('a press of a button', () => {
  test('of the right or the middle button sends no click', async () => {
    html(`<button id="tab">A</button>`);
    const clicks: number[] = [];
    element('tab').addEventListener('click', (event) => clicks.push(event.button));
    element('tab').addEventListener('contextmenu', (event) => event.preventDefault());
    await userEvent.click(element('tab'), { button: 'right' });
    await userEvent.click(element('tab'), { button: 'middle' });
    await userEvent.click(element('tab'));
    expect(clicks).toEqual([0]);
  });

  // MDN, `<button>`, "Clicking and focus": Safari on macOS gives no focus to a pressed button or
  // link. WebKit on Linux gives the focus. With a `tabindex`, each browser gives the focus.
  test('gives the focus to the button or the link at its click in Chromium and Firefox, and in WebKit on macOS only with a tabindex', async () => {
    html(`<button id="button">A</button><a id="link" href="#link">B</a>
      <button id="stop" tabindex="0">C</button><button id="other" tabindex="-1">D</button>`);
    const focusedAtClick: string[] = [];
    root!.addEventListener('click', (event) => {
      event.preventDefault();
      focusedAtClick.push((document.activeElement as HTMLElement).id || 'body');
    });
    for (const id of ['button', 'link', 'stop', 'other']) await userEvent.click(element(id));
    const focuses = server.browser !== 'webkit' || server.platform !== 'darwin';
    expect(focusedAtClick).toEqual(
      focuses ? ['button', 'link', 'stop', 'other'] : ['body', 'body', 'stop', 'other'],
    );
  });

  test('of a script gives no focus', () => {
    html(`<button id="tab" tabindex="-1">A</button>`);
    element('tab').click();
    expect(document.activeElement).not.toBe(element('tab'));
  });
});

describe('Enter and Space on a focused element', () => {
  test('send a click only for Enter on a link', async () => {
    html(`<a id="link" href="#link">A</a><span id="span" tabindex="0">B</span>`);
    const clicks: string[] = [];
    root!.addEventListener('click', (event) => {
      event.preventDefault();
      clicks.push((event.target as Element).id);
    });
    for (const id of ['link', 'span']) {
      element(id).focus();
      await userEvent.keyboard('{Enter}');
      element(id).focus();
      await userEvent.keyboard(' ');
    }
    expect(clicks).toEqual(['link']);
  });

  test('give the click of Enter on a link the modifier keys of the key', async () => {
    html(`<a id="link" href="#link">A</a>`);
    const shiftKeys: boolean[] = [];
    root!.addEventListener('click', (event) => {
      event.preventDefault();
      shiftKeys.push(event.shiftKey);
    });
    element('link').focus();
    await userEvent.keyboard('{Shift>}{Enter}{/Shift}');
    expect(shiftKeys).toEqual([true]);
  });
});

describe('a ResizeObserver', () => {
  test('calls back for no element that moves with no change of size', async () => {
    html(
      `<div id="list" style="display: flex"><button id="a">A</button><button id="b">B</button></div>`,
    );
    const calls: number[] = [];
    const observer = new ResizeObserver((entries) => calls.push(entries.length));
    observer.observe(element('a'));
    observer.observe(element('b'));
    await nextFrame();
    await nextFrame();
    expect(calls).toEqual([2]);
    // A keyed `v-for` moves an element with `insertBefore`.
    element('list').insertBefore(element('b'), element('a'));
    await nextFrame();
    await nextFrame();
    observer.disconnect();
    expect(calls).toEqual([2]);
    expect(element('a').getBoundingClientRect().left).toBeGreaterThan(
      element('b').getBoundingClientRect().left,
    );
  });
});

describe('the layout offset', () => {
  test('is whole pixels, and it differs from the rectangles by less than one pixel for each offset parent', () => {
    html(`<div id="list" style="position: relative; padding-left: 0.4px">
      <div style="position: relative; margin-left: 0.3px">
        <div style="position: relative; margin-left: 0.3px"><button id="tab" style="margin-left: 0.3px">A</button></div>
      </div>
    </div>`);
    const list = element('list');
    let offset = 0;
    for (let node: HTMLElement | null = element('tab'); node && node !== list;) {
      expect(Number.isInteger(node.offsetLeft)).toBe(true);
      offset += node.offsetLeft;
      node = node.offsetParent as HTMLElement | null;
    }
    const rect = element('tab').getBoundingClientRect().left - list.getBoundingClientRect().left;
    expect(rect).toBeCloseTo(1.3, 1);
    expect(Math.abs(rect - offset)).toBeLessThan(2);
  });
});

describe('the computed translate', () => {
  test('keeps a percentage in each browser', () => {
    html(`<button id="tab" style="translate: 50% 10%">A</button>`);
    expect(getComputedStyle(element('tab')).translate).toBe('50% 10%');
  });
});

describe('the scroll of a focus in a list that scrolls', () => {
  // The end of the list cuts tab 3 and hides tab 5. A scroll of 120 px cuts tab 1 at the start.
  function tabList({ list = '', tab = '', vertical = false, rtl = false } = {}) {
    root?.remove();
    const size = vertical ? 'height: 90px' : 'width: 90px; height: 32px';
    const tabs = Array.from(
      { length: 10 },
      (_, index) =>
        `<button id="tab-${index}" style="flex: none; margin: 0; border: 0; padding: 0; ${size}; ${tab}">Tab ${index}</button>`,
    ).join('');
    // Each length is a whole number of pixels, so that a scroll of the page is one too.
    html(`<button id="before" style="display: block; height: 20px">Before</button>
      <div id="list" role="tablist" ${rtl ? 'dir="rtl"' : ''}
        style="display: flex; flex-direction: ${vertical ? 'column; width: 120px; height' : 'row; width'}: 300px; overflow: auto; ${list}">${tabs}</div>`);
    return async (index: number, start: number, move: (tab: HTMLElement) => void) => {
      const listElement = element('list');
      if (vertical) listElement.scrollTop = start;
      else listElement.scrollLeft = start;
      element('before').focus({ preventScroll: true });
      move(element(`tab-${index}`));
      await nextFrame();
      return Math.round(vertical ? listElement.scrollTop : listElement.scrollLeft);
    };
  }

  const focus = (tab: HTMLElement) => tab.focus();
  const showNearest = (tab: HTMLElement) => {
    tab.focus({ preventScroll: true });
    tab.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  };
  const padding = { list: 'scroll-padding-inline: 24px; scroll-padding-block: 24px' };
  const margin = { tab: 'scroll-margin-inline: 24px; scroll-margin-block: 24px' };

  test('focus() in a horizontal list: Chromium leaves a tab that the end cuts cut; Firefox centers it with a scroll-padding or a scroll-margin, else leaves it cut; WebKit scrolls it to the scroll-padding, or to the edge with neither, and leaves it cut with a scroll-margin; each centers a hidden tab and leaves a tab that the start cuts cut', async () => {
    const outcomes: Record<string, number[]> = {};
    for (const [name, style] of Object.entries({ padding, margin, neither: {} })) {
      const move = tabList(style);
      outcomes[name] = [
        await move(3, 0, focus),
        await move(5, 0, focus),
        await move(1, 120, focus),
      ];
    }
    const cutAtTheEnd = {
      chromium: { padding: 0, margin: 0, neither: 0 },
      firefox: { padding: 165, margin: 165, neither: 0 },
      webkit: { padding: 84, margin: 0, neither: 60 },
    }[server.browser as 'chromium' | 'firefox' | 'webkit'];
    expect(outcomes).toEqual({
      padding: [cutAtTheEnd.padding, 345, 120],
      margin: [cutAtTheEnd.margin, 345, 120],
      neither: [cutAtTheEnd.neither, 345, 120],
    });
  });

  test("focus({ preventScroll: true }) and then scrollIntoView() with 'nearest' scroll the list by the least distance that shows the whole tab inside the scroll-padding or the scroll-margin, in each browser; also in a vertical and a right-to-left list", async () => {
    const outcomes: Record<string, number[]> = {};
    const layouts = {
      padding,
      margin,
      neither: {},
      vertical: { ...padding, vertical: true },
      'right to left': { ...padding, rtl: true },
    };
    for (const [name, layout] of Object.entries(layouts)) {
      const move = tabList(layout);
      const sign = 'rtl' in layout ? -1 : 1;
      outcomes[name] = [
        await move(3, 0, showNearest),
        await move(5, 0, showNearest),
        await move(1, 120 * sign, showNearest),
      ];
    }
    expect(outcomes).toEqual({
      padding: [84, 264, 66],
      margin: [84, 264, 66],
      neither: [60, 240, 90],
      vertical: [84, 264, 66],
      'right to left': [-84, -264, -66],
    });
  });

  test("scrollIntoView() with 'nearest' scrolls the page by the least distance that shows a tab out of the view, and does not scroll the page for a tab in the view", async () => {
    const move = tabList({ list: `margin-top: 200vh; ${padding.list}` });
    const below = window.scrollY;
    await move(5, 0, showNearest);
    const rect = element('tab-5').getBoundingClientRect();
    expect(window.scrollY).toBeGreaterThan(below);
    // WebKit scrolls the page by whole pixels.
    expect(Math.abs(rect.bottom - window.innerHeight)).toBeLessThanOrEqual(1);
    const inView = window.scrollY;
    await move(3, 0, showNearest);
    expect(window.scrollY).toBe(inView);
  });
});
