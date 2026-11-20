// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import MeasureCaptureListener from '../fixtures/MeasureCaptureListener.vue';
import { mount } from '../render';

let root: HTMLElement | undefined;

function html(markup: string) {
  root = document.body.appendChild(document.createElement('div'));
  root.innerHTML = markup;
  return root;
}

afterEach(() => {
  root?.remove();
  root = undefined;
});

const focused = () => (document.activeElement as HTMLElement).id || 'none';
const find = <T extends HTMLElement = HTMLElement>(id: string) => root!.querySelector<T>(`#${id}`)!;

describe('a capture listener in an object of v-bind', () => {
  test('runs before the listeners of the element in the target, and its stopPropagation() stops them', async () => {
    const entries: string[] = [];
    const log = { add: (entry: string) => entries.push(entry) };
    const { root: app, unmount } = mount(MeasureCaptureListener, { log });
    app.querySelector<HTMLElement>('#inner')!.focus();
    await userEvent.keyboard('a');
    unmount();
    mount(MeasureCaptureListener, { log, stop: true })
      .root.querySelector<HTMLElement>('#inner')!
      .focus();
    await userEvent.keyboard('a');
    expect(entries).toEqual(['outer capture', 'inner', 'outer bubble', 'outer capture']);
  });
});

describe('focus() from script on a text input', () => {
  test('WebKit selects the text, and Chromium and Firefox put the caret at the start; Tab selects the text in each browser', async () => {
    html('<button id="before">Before</button><input id="input" value="Some text">');
    const input = find<HTMLInputElement>('input');
    input.focus();
    const afterFocus = [input.selectionStart, input.selectionEnd];
    find('before').focus();
    await userEvent.keyboard('{Tab}');
    expect({ afterFocus, afterTab: [input.selectionStart, input.selectionEnd] }).toEqual({
      afterFocus: server.browser === 'webkit' ? [0, 9] : [0, 0],
      afterTab: [0, 9],
    });
  });

  test('after select(), ArrowRight removes the selection, and the press after it moves the caret', async () => {
    html('<input id="input" value="Some text">');
    const input = find<HTMLInputElement>('input');
    input.focus();
    input.select();
    await userEvent.keyboard('{ArrowRight}');
    const afterFirst = [input.selectionStart, input.selectionEnd];
    await userEvent.keyboard('{ArrowLeft}');
    expect({ afterFirst, afterSecond: [input.selectionStart, input.selectionEnd] }).toEqual({
      afterFirst: [9, 9],
      afterSecond: [8, 8],
    });
  });
});

// Playwright starts a composition only in Chromium.
describe.runIf(server.browser === 'chromium')(
  'an arrow key while a text input method composes',
  () => {
    test('Chromium sends the keydown of the key with isComposing true and the key code 229', async () => {
      html('<input id="input">');
      const input = find<HTMLInputElement>('input');
      const keys: string[] = [];
      input.addEventListener('keydown', (event) =>
        // eslint-disable-next-line @typescript-eslint/no-deprecated -- The measurement reads the key code of a key of a text input method.
        keys.push(`${event.key} ${event.isComposing} ${event.keyCode}`),
      );
      input.focus();
      await cdp().send('Input.imeSetComposition', {
        text: 'か',
        selectionStart: 1,
        selectionEnd: 1,
      });
      await cdp().send('Input.dispatchKeyEvent', {
        type: 'rawKeyDown',
        key: 'ArrowRight',
        code: 'ArrowRight',
        windowsVirtualKeyCode: 229,
      });
      await cdp().send('Input.insertText', { text: 'か' });
      expect(keys).toEqual(['ArrowRight true 229']);
    });
  },
);

describe('focus() on an element that CSS hides', () => {
  test('does not move the focus', () => {
    html('<button id="a">A</button><button id="b" style="display: none">B</button>');
    find('a').focus();
    find('b').focus();
    expect(focused()).toBe('a');
  });
});

describe('a press on a button with aria-disabled', () => {
  test.each([
    { name: 'gives the button the focus', prevent: [] },
    { name: 'keeps the focus with mousedown prevented', prevent: ['mousedown'] },
    { name: 'keeps the focus with pointerdown prevented', prevent: ['pointerdown'] },
  ])('$name', async ({ prevent }) => {
    html(
      '<input id="before" aria-label="Before"><button id="button" tabindex="-1" aria-disabled="true">B</button>',
    );
    for (const type of prevent) find('button').addEventListener(type, (e) => e.preventDefault());
    find('before').focus();
    await userEvent.click(find('button'), { force: true });
    expect(focused()).toBe(prevent.length > 0 ? 'before' : 'button');
  });
});

describe('a capture listener on the target that a capture listener of an ancestor adds', () => {
  test.each(['button', 'child'])(
    'runs in the dispatch; its stopPropagation() stops each bubble listener, and the capture listeners of the path run (target: %s)',
    async (target) => {
      html(
        '<div id="toolbar"><button id="button" style="padding: 20px">A <span id="child">child</span></button></div>',
      );
      const log: string[] = [];
      const add = (element: EventTarget, name: string, capture = false) =>
        element.addEventListener('pointerdown', () => log.push(name), capture);
      document.addEventListener(
        'pointerdown',
        (event) => {
          log.push('document capture');
          event.target!.addEventListener('pointerdown', () => log.push('target from document'), {
            capture: true,
            once: true,
          });
        },
        { capture: true, once: true },
      );
      find('toolbar').addEventListener(
        'pointerdown',
        (event) => {
          log.push('toolbar capture');
          event.target!.addEventListener('pointerdown', (stopped) => stopped.stopPropagation(), {
            capture: true,
            once: true,
          });
        },
        true,
      );
      add(find('button'), 'button');
      add(find('child'), 'child');
      add(find('toolbar'), 'toolbar');
      add(document, 'document');
      await userEvent.click(find(target), { position: { x: 4, y: 4 } });
      expect(log).toEqual(['document capture', 'toolbar capture', 'target from document']);
    },
  );
});

describe('native radios with one name as the items of a row with one tab stop', () => {
  /** Radios a, b and c between two inputs, each with its `tabindex`. */
  function radios(tabindexes: string[], checked = 'a') {
    const radio = (id: string, index: number) =>
      `<input type="radio" name="g" id="${id}" aria-label="${id}" tabindex="${tabindexes[index]}"${checked === id ? ' checked' : ''}>`;
    html(
      `<input id="before" aria-label="Before">${['a', 'b', 'c'].map(radio).join('')}<input id="after" aria-label="After">`,
    );
  }

  async function tabs() {
    find('before').focus();
    await userEvent.keyboard('{Tab}');
    const tab = focused();
    find('after').focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    return { tab, shiftTab: focused() };
  }

  test('Tab and Shift+Tab pass an unchecked radio with tabindex 0 and a checked one with -1 in Firefox and WebKit, and stop at it in Chromium', async () => {
    radios(['-1', '0', '-1']);
    const stops = server.browser === 'chromium';
    expect(await tabs()).toEqual({
      tab: stops ? 'b' : 'after',
      shiftTab: stops ? 'b' : 'before',
    });
  });

  test('with tabindex 0 on each radio, Tab and Shift+Tab stop at the checked radio in each browser', async () => {
    radios(['0', '0', '0'], 'b');
    expect(await tabs()).toEqual({ tab: 'b', shiftTab: 'b' });
  });

  test('with no radio checked, after an arrow key of a toolbar gave b the focus: Firefox passes the group unless a has tabindex 0, and Chromium unless b has it; with tabindex 0 on each radio, each browser stops in the group', async () => {
    const results: Record<string, { tab: string; shiftTab: string }> = {};
    for (const tabindexes of [
      ['-1', '0', '-1'],
      ['0', '-1', '-1'],
      ['0', '0', '0'],
    ]) {
      radios(tabindexes, '');
      find('b').focus();
      results[tabindexes.join(' ')] = await tabs();
      root!.remove();
    }
    const stop = (tab: string, shiftTab = tab) => ({ tab, shiftTab });
    const passes = stop('after', 'before');
    const expected: Record<string, typeof results> = {
      chromium: { '-1 0 -1': stop('b'), '0 -1 -1': passes, '0 0 0': stop('b') },
      firefox: { '-1 0 -1': passes, '0 -1 -1': stop('a'), '0 0 0': stop('a') },
      webkit: { '-1 0 -1': stop('b'), '0 -1 -1': stop('a'), '0 0 0': stop('a', 'c') },
    };
    expect(results).toEqual(expected[server.browser]);
  });
});

describe('Tab after a script removes the focused button of a row with one tab stop', () => {
  test('goes to the element after the place of the removed button', async () => {
    html(`<input id="before" aria-label="Before">
      <div id="row"><button id="a" tabindex="0">A</button><button id="b" tabindex="-1">B</button><button id="c" tabindex="-1">C</button></div>
      <input id="after" aria-label="After">`);
    find('b').focus();
    find('b').remove();
    const afterRemove = focused();
    await userEvent.keyboard('{Tab}');
    const afterTab = focused();
    find('after').focus();
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect({ afterRemove, afterTab, shiftTab: focused() }).toEqual({
      afterRemove: 'none',
      afterTab: 'after',
      shiftTab: 'a',
    });
  });
});
