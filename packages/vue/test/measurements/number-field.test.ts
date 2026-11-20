// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that `NumberField` has code only where they do not do it.
import type { CDPSession } from '@vitest/browser-playwright';
import { afterEach, describe, expect, test } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureNumberInputs from '../fixtures/MeasureNumberInputs.vue';
import { mount, settle } from '../render';

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

const timer = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));
// `visuallyHiddenInput` of `common/visuallyHidden.ts`.
const visuallyHidden =
  'position:absolute;width:1px;height:1px;margin:-1px;border:0;padding:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

describe('a native <input type="number">', () => {
  test('keeps as its value only the text of a valid number: a locale format, a group separator, a currency, a space or a last dot gives an empty value', () => {
    const input = html('<input type="number">').querySelector('input')!;
    const values: Record<string, string> = {};
    for (const text of ['1,234.5', '1.234,5', '12 €', '1,5', ' 12', '12.', '1234.50', '1e3']) {
      input.value = text;
      values[text] = input.value;
    }
    expect(values).toEqual({
      '1,234.5': '',
      '1.234,5': '',
      '12 €': '',
      '1,5': '',
      ' 12': '',
      '12.': '',
      '1234.50': '1234.50',
      '1e3': '1e3',
    });
  });

  test('reads no typed number in the format of a locale: Chromium and WebKit drop the comma of 1,5, Firefox keeps it and gives an empty value', async () => {
    const input = html('<input type="number">').querySelector('input')!;
    const typed: Record<string, [string, boolean]> = {};
    for (const text of ['1,5', '1.2.3', 'abc']) {
      input.value = '';
      input.focus();
      await userEvent.keyboard(text);
      typed[text] = [input.value, input.validity.badInput];
    }
    expect(typed).toEqual(
      server.browser === 'firefox'
        ? { '1,5': ['', true], '1.2.3': ['', true], abc: ['', true] }
        : { '1,5': ['15', false], '1.2.3': ['1.23', false], abc: ['', false] },
    );
  });

  test('with no step attribute, a fraction fails the step; step="any" has no step, and stepUp then throws', () => {
    const [none, any] = html(
      '<input type="number"><input type="number" step="any">',
    ).querySelectorAll('input');
    none!.value = '1.5';
    any!.value = '1.5';
    expect(none!.validity.stepMismatch).toBe(true);
    expect(any!.validity.stepMismatch).toBe(false);
    expect(() => any!.stepUp()).toThrow();
  });

  test('takes the step base from min, else from the value attribute; stepUp goes to the grid, and not against its direction', () => {
    const [base, max, min] = html(`<input type="number" step="2" value="1">
      <input type="number" step="4" max="10" value="9"><input type="number" step="2" min="0" value="5">`).querySelectorAll(
      'input',
    );
    base!.value = '4';
    expect(base!.validity.stepMismatch).toBe(true);
    base!.stepUp();
    expect(base!.value).toBe('5');
    // From 9 the grid gives 13, and max gives 9: not above 9, so nothing changes.
    max!.stepUp();
    expect(max!.value).toBe('9');
    min!.stepUp();
    expect(min!.value).toBe('6');
    min!.value = '5';
    min!.stepDown();
    expect(min!.value).toBe('4');
  });

  test('steps by its step at ArrowUp, also with Shift, and not at PageUp; each step fires input and then change', async () => {
    const input = html('<input type="number" value="5">').querySelector('input')!;
    const events: string[] = [];
    for (const type of ['input', 'change']) input.addEventListener(type, () => events.push(type));
    input.focus();
    await userEvent.keyboard('{ArrowUp}{Shift>}{ArrowUp}{/Shift}{PageUp}');
    expect(input.value).toBe('7');
    expect(events).toEqual(['input', 'change', 'input', 'change']);
  });

  test('a script fill: valueAsNumber gives the number, and text that is not a number becomes empty', () => {
    const input = html('<input type="number">').querySelector('input')!;
    const filled: Record<string, [string, number]> = {};
    for (const text of ['1e3', '12.50', 'abc']) {
      input.value = text;
      filled[text] = [input.value, input.valueAsNumber];
    }
    expect(filled).toEqual({ '1e3': ['1e3', 1000], '12.50': ['12.50', 12.5], abc: ['', NaN] });
  });
});

describe('Vue and the value of an input', () => {
  test('writes the value attribute at each value, so the step base of a number input moves with the value', async () => {
    const model = reactive({ value: '1', other: 0 });
    const number = mount(MeasureNumberInputs, { model }).root.querySelector('input')!;
    model.value = '4';
    await nextTick();
    expect(number.getAttribute('value')).toBe('4');
    // With the base 1 and the step 2, 4 is not on the grid.
    expect(number.validity.stepMismatch).toBe(false);
  });

  test('a render for another cause writes the bound value over text that the element has, as the text of an open composition', async () => {
    const model = reactive({ value: '4', other: 0 });
    const text = mount(MeasureNumberInputs, { model }).root.querySelectorAll('input')[1]!;
    text.value = '4１';
    model.other = 1;
    await nextTick();
    expect(text.value).toBe('4');
  });
});

describe('a scrub area', () => {
  test('a press and a release with no move give a label in the area one click, which focuses its input', async () => {
    const container = html(
      '<span style="display:inline-block;width:120px;height:30px"><label for="amount">Amount</label></span><input id="amount">',
    );
    const label = container.querySelector('label')!;
    const clicks: string[] = [];
    container.querySelector('span')!.addEventListener('click', (event) => {
      clicks.push((event.target as Element).tagName);
    });
    await userEvent.click(label);
    expect(clicks).toEqual(['LABEL']);
    expect(document.activeElement).toBe(container.querySelector('input'));
  });
});

describe('focus and selection', () => {
  test('a caret that a script sets before focus() stays, and a focusin listener that selects wins; focus() alone gives Chromium and Firefox the caret at 0 and WebKit the whole text; Tab selects the whole text', async () => {
    const [plain, set, selecting, last] = html(
      '<input value="abcdef"><input value="abcdef"><input value="abcdef"><input value="abcdef">',
    ).querySelectorAll('input');
    const selection = (input: HTMLInputElement) => [input.selectionStart, input.selectionEnd];
    plain!.focus();
    expect(selection(plain!)).toEqual(server.browser === 'webkit' ? [0, 6] : [0, 0]);
    set!.setSelectionRange(6, 6);
    expect(document.activeElement).not.toBe(set);
    set!.focus();
    expect(selection(set!)).toEqual([6, 6]);
    selecting!.addEventListener('focusin', () => selecting!.select());
    selecting!.setSelectionRange(6, 6);
    selecting!.focus();
    expect(selection(selecting!)).toEqual([0, 6]);
    await userEvent.tab();
    expect(document.activeElement).toBe(last);
    expect(selection(last!)).toEqual([0, 6]);
  });

  test('a press on a button with tabindex -1, or on a span, takes the focus from the input; preventDefault on pointerdown keeps it, and the click still comes', async () => {
    const container = html(`<input value="12"><button type="button" tabindex="-1">+</button>
      <button type="button" tabindex="-1">+</button><span>s</span><span>t</span>`);
    const input = container.querySelector('input')!;
    const [plain, prevented] = container.querySelectorAll('button');
    const [span, preventedSpan] = container.querySelectorAll('span');
    const clicks: string[] = [];
    for (const element of [prevented!, preventedSpan!]) {
      element.addEventListener('pointerdown', (event) => event.preventDefault());
      element.addEventListener('click', () => clicks.push(element.tagName));
    }
    const focusAfterClick = async (element: Element) => {
      input.focus();
      await userEvent.click(element);
      return document.activeElement?.tagName;
    };
    expect(await focusAfterClick(plain!)).toBe('BUTTON');
    expect(await focusAfterClick(span!)).toBe('BODY');
    expect(await focusAfterClick(prevented!)).toBe('INPUT');
    expect(await focusAfterClick(preventedSpan!)).toBe('INPUT');
    expect(clicks).toEqual(['BUTTON', 'SPAN']);
  });

  test('at a submit, the browser fires invalid and focuses a visually hidden number input; with display: none it cannot focus it and does not submit', async () => {
    const container =
      html(`<form><input><input type="number" required tabindex="-1" style="${visuallyHidden}"></form>
      <form><input><input type="number" required tabindex="-1" style="display: none"></form>`);
    const results = [];
    for (const form of container.querySelectorAll('form')) {
      const number = form.querySelector('[type=number]')!;
      const events: string[] = [];
      number.addEventListener('invalid', () => events.push('invalid'));
      number.addEventListener('focus', () => events.push('focus'));
      form.addEventListener('submit', () => events.push('submit'));
      form.requestSubmit();
      await timer();
      results.push(events);
    }
    expect(results).toEqual([['invalid', 'focus'], ['invalid']]);
  });
});

describe('a held button', () => {
  test('an ancestor that stops pointerup in the capture phase hides it from the button; a capture listener on window still gets it', async () => {
    const container = html('<div><button type="button">+</button></div>');
    const button = container.querySelector('button')!;
    const heard: string[] = [];
    container.firstElementChild!.addEventListener('pointerup', (event) => event.stopPropagation(), {
      capture: true,
    });
    button.addEventListener('pointerup', () => heard.push('button'));
    const onWindow = () => heard.push('window');
    window.addEventListener('pointerup', onWindow, { capture: true });
    await userEvent.click(button);
    window.removeEventListener('pointerup', onWindow, { capture: true });
    expect(heard).toEqual(['window']);
  });

  test('the click of a press comes after pointerup and its microtasks, and before a timer that pointerup starts; click() gives detail 0', async () => {
    const button = html('<button type="button">+</button>').querySelector('button')!;
    const order: string[] = [];
    button.addEventListener('pointerup', () => {
      order.push('pointerup');
      queueMicrotask(() => order.push('microtask'));
      setTimeout(() => order.push('timer'));
    });
    button.addEventListener('click', (event) => order.push(`click ${event.detail}`));
    await userEvent.click(button);
    await timer(20);
    button.click();
    expect(order).toEqual(['pointerup', 'microtask', 'click 1', 'timer', 'click 0']);
  });

  test('a button that becomes disabled during a press gets no click at the release; pointerup still comes', async () => {
    const button = html('<button type="button">+</button>').querySelector('button')!;
    const heard: string[] = [];
    button.addEventListener('pointerdown', () => setTimeout(() => (button.disabled = true)));
    for (const type of ['pointerup', 'click'])
      button.addEventListener(type, () => heard.push(type));
    await userEvent.pointer([{ target: button, keys: '[MouseLeft>]' }]);
    await timer(20);
    await userEvent.pointer([{ keys: '[/MouseLeft]' }]);
    await timer(20);
    expect(heard).toEqual(['pointerup']);
  });

  test('pointerleave and pointerenter come while the mouse button is down', async () => {
    const button = html(
      '<button type="button" style="width:40px;height:40px">+</button>',
    ).querySelector('button')!;
    const heard: string[] = [];
    for (const type of ['pointerdown', 'pointerleave', 'pointerenter', 'pointerup', 'click']) {
      button.addEventListener(type, () => heard.push(type));
    }
    await userEvent.pointer([{ target: button, keys: '[MouseLeft>]' }]);
    await userEvent.pointer([{ coords: { x: 500, y: 500 } }]);
    await userEvent.pointer([{ target: button, coords: { x: 10, y: 10 } }]);
    await userEvent.pointer([{ keys: '[/MouseLeft]' }]);
    // The pointer enters the button before the press, one time or more.
    expect(heard.slice(heard.indexOf('pointerdown'))).toEqual([
      'pointerdown',
      'pointerleave',
      'pointerenter',
      'pointerup',
      'click',
    ]);
  });
});

describe('implicit submission', () => {
  test('Enter in a text input submits a form with no submit button, but not when a visually hidden number input is beside it; with a submit button it submits one time', async () => {
    const container = html(`<form><input></form>
      <form><input><input type="number" tabindex="-1" style="${visuallyHidden}"></form>
      <form><input><input type="number" tabindex="-1" style="${visuallyHidden}"><button>Go</button></form>`);
    const submits: number[] = [];
    for (const form of container.querySelectorAll('form')) {
      let count = 0;
      form.addEventListener('submit', () => count++);
      form.querySelector('input')!.focus();
      await userEvent.keyboard('{Enter}');
      await timer();
      submits.push(count);
    }
    expect(submits).toEqual([1, 0, 1]);
  });
});

describe('text input events', () => {
  test('beforeinput can cancel a typed key, a paste and a drop, and has their text in data', async () => {
    const container = html('<input value="12"><input value="ab"><span draggable="true">34</span>');
    const [source, target] = container.querySelectorAll('input');
    const drag = container.querySelector('span')!;
    drag.addEventListener('dragstart', (event) => event.dataTransfer!.setData('text/plain', '34'));
    const heard: [string, string | null, boolean][] = [];
    target!.addEventListener('beforeinput', (event) =>
      heard.push([event.inputType, event.data, event.cancelable]),
    );
    target!.focus();
    target!.setSelectionRange(2, 2);
    await userEvent.keyboard('x');
    source!.focus();
    source!.select();
    await userEvent.copy();
    target!.focus();
    await userEvent.paste();
    await userEvent.dragAndDrop(drag, target!);
    await timer();
    expect(heard).toEqual([
      ['insertText', 'x', true],
      ['insertFromPaste', '12', true],
      ['insertFromDrop', '34', true],
    ]);
  });

  test.runIf(server.browser === 'chromium')(
    'a composition in Chromium: input has isComposing and the text of the composition, beforeinput cannot cancel it, and compositionend comes after the last input',
    async () => {
      const input = html('<input value="5">').querySelector('input')!;
      const heard: string[] = [];
      input.addEventListener('beforeinput', (event) =>
        heard.push(`beforeinput ${event.cancelable}`),
      );
      input.addEventListener('input', (event) =>
        heard.push(`input ${(event as InputEvent).isComposing} ${input.value}`),
      );
      input.addEventListener('compositionend', () => heard.push('compositionend'));
      input.focus();
      input.setSelectionRange(1, 1);
      const session = cdp();
      await session.send('Input.imeSetComposition', {
        text: 'ｋ',
        selectionStart: 1,
        selectionEnd: 1,
      });
      await session.send('Input.insertText', { text: '１' });
      await settle();
      expect(heard).toEqual([
        'beforeinput false',
        'input true 5ｋ',
        'beforeinput false',
        'input true 5１',
        'compositionend',
      ]);
    },
  );
});

// The protocol takes the coordinates of the top-level page, and the tester renders inside a scaled
// iframe.
function protocolPoint(element: Element) {
  const rect = element.getBoundingClientRect();
  const frame = window.frameElement?.getBoundingClientRect() ?? new DOMRect();
  const scale = frame.width / window.innerWidth || 1;
  return {
    x: frame.left + (rect.left + rect.width / 2) * scale,
    y: frame.top + (rect.top + rect.height / 2) * scale,
  };
}

/** Records the pointer events of `element` and the scroll of the page. */
function recordTouch(element: Element) {
  const events: string[] = [];
  for (const type of ['pointerdown', 'pointermove', 'pointercancel', 'pointerup', 'contextmenu']) {
    element.addEventListener(type, () => {
      if (events.at(-1) !== type) events.push(type);
    });
  }
  const scroller = document.scrollingElement!;
  scroller.scrollTop = 0;
  // A fling goes on after the touch ends, so the next touch waits for its end.
  const ended = new Promise((resolve) => document.addEventListener('scrollend', resolve, { once: true }));
  return {
    events,
    async scrolled() {
      if (scroller.scrollTop === 0) return false;
      await ended;
      return true;
    },
  };
}

/** A real touch from the Chrome DevTools Protocol that moves `distance` px up, in 8 moves. */
async function touchUp(element: Element, distance: number) {
  const session = cdp() as CDPSession;
  const { x, y } = protocolPoint(element);
  await session.send('Input.dispatchTouchEvent', {
    type: 'touchStart',
    touchPoints: [{ x, y }],
  });
  for (let move = 1; move <= 8; move++) {
    await session.send('Input.dispatchTouchEvent', {
      type: 'touchMove',
      touchPoints: [{ x, y: y - (distance * move) / 8 }],
    });
  }
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await timer(50);
}

describe.runIf(server.browser === 'chromium')('a touch in Chromium', () => {
  test('M1: a drag of one finger scrolls the page from an inline span with touch-action pinch-zoom, and not from a flex item with it or from a span that cancels touchstart', async () => {
    const container = html(`<div style="height: 4000px">
      <p><span id="inline" style="touch-action: pinch-zoom">inline</span></p>
      <p style="display: flex"><span id="item" style="touch-action: pinch-zoom">item</span></p>
      <p><span id="cancel">cancel</span></p></div>`);
    container
      .querySelector('#cancel')!
      .addEventListener('touchstart', (event) => {
        if ((event as TouchEvent).touches.length === 1) event.preventDefault();
      });
    const results: Record<string, { events: string[]; scrolled: boolean }> = {};
    for (const id of ['inline', 'item', 'cancel']) {
      const span = container.querySelector(`#${id}`)!;
      const { events, scrolled } = recordTouch(span);
      await touchUp(span, 200);
      results[id] = { events, scrolled: await scrolled() };
    }
    expect(results).toEqual({
      inline: { events: ['pointerdown', 'pointermove', 'pointercancel'], scrolled: true },
      item: { events: ['pointerdown', 'pointermove', 'pointerup'], scrolled: false },
      cancel: { events: ['pointerdown', 'pointermove', 'pointerup'], scrolled: false },
    });
  });

  test('M2: a touch that scrolls the page from a button sends pointercancel before 460 ms; a touch that stays 700 ms on a button with user-select none gets no contextmenu and no pointercancel', async () => {
    const container = html(`<div style="height: 4000px">
      <button type="button" style="user-select: none; -webkit-user-select: none">+</button></div>`);
    const button = container.querySelector('button')!;
    const times: Record<string, number> = {};
    for (const type of ['pointerdown', 'pointercancel']) {
      button.addEventListener(type, (event) => (times[type] = event.timeStamp));
    }
    const scroll = recordTouch(button);
    await touchUp(button, 200);
    expect(await scroll.scrolled()).toBe(true);
    expect(times.pointercancel! - times.pointerdown!).toBeLessThan(460);

    const held = recordTouch(button);
    const session = cdp() as CDPSession;
    const point = protocolPoint(button);
    await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point] });
    await timer(700);
    await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await timer(50);
    expect(held.events).toEqual(['pointerdown', 'pointerup']);
  });
});

describe('a form reset', () => {
  test('M3: a capture listener on the root node of a control gets the reset of its form, with the form as its target, also for a control that the form attribute gives to it, in a document and in a shadow root', () => {
    const container = html('<div id="host"></div>');
    const host = container.querySelector('#host')!;
    const shadow = host.attachShadow({ mode: 'open' });
    const markup =
      '<form id="owner"><input id="inside"></form><input id="outside" form="owner">';
    container.insertAdjacentHTML('beforeend', markup);
    shadow.innerHTML = markup;
    const heard: string[] = [];
    for (const rootNode of [document, shadow]) {
      for (const id of ['inside', 'outside']) {
        const control = (rootNode as ParentNode).querySelector<HTMLInputElement>(`#${id}`)!;
        control.getRootNode().addEventListener(
          'reset',
          (event) => {
            if (event.target === control.form) heard.push(`${rootNode === document ? 'document' : 'shadow'} ${id}`);
          },
          true,
        );
      }
      (rootNode as ParentNode).querySelector('form')!.reset();
    }
    expect(heard).toEqual(['document inside', 'document outside', 'shadow inside', 'shadow outside']);
  });
});
