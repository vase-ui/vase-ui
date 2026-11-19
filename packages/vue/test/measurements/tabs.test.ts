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
