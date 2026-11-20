// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it. Where the
// browsers differ, the measurement states each one.
import { afterEach, describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureCountAfterChange from '../fixtures/MeasureCountAfterChange.vue';
import MeasureSetupOrder from '../fixtures/MeasureSetupOrder.vue';
import { hydrate, mount, renderOnServer } from '../render';

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

const hidden =
  'position:absolute;width:1px;height:1px;margin:-1px;padding:0;border:0;overflow:hidden;clip-path:inset(50%);white-space:nowrap';

describe('M1: the order of setup', () => {
  const numbers = (container: Element) =>
    [...container.querySelectorAll('output')].map((output) => output.textContent);
  const inOrder = ['0', '1', '2', '3', '4', '5'];

  test('six children, one in a wrapper and one before a v-if, take numbers in the order of the document', async () => {
    const container = await renderOnServer('MeasureSetupOrder');
    expect(numbers(container)).toEqual(inOrder);
    hydrate(MeasureSetupOrder, {}, container);
    await nextTick();
    expect(numbers(container)).toEqual(inOrder);
    expect(numbers(mount(MeasureSetupOrder).root)).toEqual(inOrder);
  });
});

describe('M2: the key of the selected character', () => {
  test('sends one input event with the inputType insertText', async () => {
    const input = html('<input value="1" aria-label="Slot">').querySelector('input')!;
    const types: string[] = [];
    input.addEventListener('input', (event) => types.push((event as InputEvent).inputType));
    input.focus();
    input.select();
    await userEvent.keyboard('1');
    expect(types).toEqual(['insertText']);
    expect(input.value).toBe('1');
  });
});

describe('M3: a form that finds a hidden input invalid', () => {
  test('gives the hidden input the focus', () => {
    const form = html(
      `<form><input tabindex="-1" aria-hidden="true" required style="${hidden}"></form>`,
    ).querySelector('form')!;
    form.reportValidity();
    expect(document.activeElement).toBe(form.querySelector('input'));
  });
});

describe('M4: a list that children fill after a change of the parent', () => {
  test('has the old count in the post-flush watcher of the parent, and the new count a tick later', async () => {
    const scene = reactive({ count: 2 });
    const log: string[] = [];
    mount(MeasureCountAfterChange, { scene, log: { add: (entry: string) => log.push(entry) } });
    await nextTick();
    scene.count = 3;
    await nextTick();
    await nextTick();
    expect(log).toEqual(['watcher 2', 'tick 3']);
  });
});

describe('M5: Enter in a form with six text inputs and one hidden text input', () => {
  const buttons = {
    submit: '<button>Submit</button>',
    image: '<input type="image" alt="Submit">',
    none: '',
  };

  function form(button: keyof typeof buttons) {
    const inputs = Array.from({ length: 6 }, (_, index) => `<input aria-label="${index}">`);
    return html(
      `<form>${inputs.join('')}<input tabindex="-1" style="${hidden}">${buttons[button]}</form>`,
    ).querySelector('form')!;
  }

  test.each(['submit', 'image', 'none'] as const)('with the button: %s', async (button) => {
    const element = form(button);
    const log: string[] = [];
    element.addEventListener('click', () => log.push('click'));
    element.addEventListener('submit', () => log.push('submit'));
    element.querySelector('input')!.focus();
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(button === 'none' ? [] : ['click', 'submit']);
    // `form.elements` has no image button.
    expect([...element.elements].map((control) => control.localName)).toEqual([
      ...Array.from({ length: 7 }, () => 'input'),
      ...(button === 'submit' ? ['button'] : []),
    ]);
  });

  test('a listener of an ancestor that prevents Enter stops the submit of a form with one text input', async () => {
    const element = html('<form><input aria-label="Code"></form>').querySelector('form')!;
    const log: string[] = [];
    element.addEventListener('submit', () => log.push('submit'));
    element.querySelector('input')!.focus();
    await userEvent.keyboard('{Enter}');
    element.addEventListener('keydown', (event) => event.preventDefault());
    await userEvent.keyboard('{Enter}');
    expect(log).toEqual(['submit']);
  });
});

describe('a focus listener that selects the text of an input', () => {
  test('a second click on the focused input puts a caret; in WebKit the first click does too', async () => {
    const input = html('<input value="1" aria-label="Slot">').querySelector('input')!;
    input.addEventListener('focus', () => input.select());
    const selection = () => [input.selectionStart, input.selectionEnd];
    await userEvent.click(input);
    const first = selection();
    await userEvent.click(input);
    expect({ first, second: selection() }).toEqual({
      first: server.browser === 'webkit' ? [1, 1] : [0, 1],
      second: [1, 1],
    });
  });
});
