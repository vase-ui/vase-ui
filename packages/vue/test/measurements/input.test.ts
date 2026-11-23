// Measurements with native elements and plain Vue, with no code of the library. Each one states
// what the browser or Vue does, so that a part has code only where they do not do it.
import { afterEach, describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import MeasureControlledInput from '../fixtures/MeasureControlledInput.vue';
import MeasureInputListeners from '../fixtures/MeasureInputListeners.vue';
import { mount, settle, typeAtEnd } from '../render';

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

const timer = () => new Promise((resolve) => setTimeout(resolve));

/** Mounts the input. Its parent keeps the text that the input gives only with `accept`. */
function mountInput(state: { value: string; accept: boolean }) {
  const model = reactive({
    ...state,
    write(value: string) {
      if (model.accept) model.value = value;
    },
  });
  return { model, root: mount(MeasureControlledInput, { model }).root };
}

describe('a native input with :value', () => {
  test('keeps the typed text when its listener does not write the model', async () => {
    const { model, root } = mountInput({ value: 'a', accept: false });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'x');
    await settle();
    expect(model.value).toBe('a');
    expect(input.value).toBe('ax');
  });

  test('has the last bound value as its value attribute, so a reset gives that value', async () => {
    const { model, root: mounted } = mountInput({ value: 'first', accept: true });
    const input = mounted.querySelector('input')!;
    model.value = 'second';
    await nextTick();
    expect(input.getAttribute('value')).toBe('second');
    mounted.querySelector('form')!.reset();
    expect(input.value).toBe('second');
  });

  test('keeps the caret when the same value is written again', () => {
    const input = html('<input value="abcdef">').querySelector('input')!;
    input.focus();
    input.setSelectionRange(2, 2);
    input.value = 'abcdef';
    expect(input.selectionStart).toBe(2);
  });

  test('loses the text that its value does not hold when the same value is written again', async () => {
    const [number, email, kept] = html(
      '<input type="number"><input type="email"><input type="email">',
    ).querySelectorAll('input');
    number!.focus();
    await userEvent.keyboard('e');
    expect([number!.value, number!.validity.badInput]).toEqual(['', true]);
    number!.value = '';
    expect(number!.validity.badInput).toBe(false);
    for (const input of [email!, kept!]) {
      input.focus();
      await userEvent.keyboard('a ');
    }
    expect([email!.value, kept!.value]).toEqual(['a', 'a']);
    email!.value = 'a';
    for (const input of [email!, kept!]) {
      input.focus();
      await userEvent.keyboard('b');
    }
    expect([email!.value, kept!.value]).toEqual(['ab', 'a b']);
  });
});

describe('an `input` listener that changes a model', () => {
  test('`nextTick` that it called before the change runs before the render, and a post watcher that it started runs after it', async () => {
    const entries: string[] = [];
    const log = { add: (entry: string) => entries.push(entry) };
    const { root } = mount(MeasureInputListeners, { log });
    await typeAtEnd(root.querySelector('input')!, 'a');
    await nextTick();
    expect(entries).toEqual(['nextTick: a', 'post watcher: A']);
  });
});

describe('a native reset', () => {
  test('from a reset button: a microtask of a reset listener runs before the browser resets the controls, a timer after it', async () => {
    html('<form><input value="first"><button type="reset">Reset</button></form>');
    const input = root!.querySelector('input')!;
    input.value = 'typed';
    const log: string[] = [];
    root!.querySelector('form')!.addEventListener('reset', () => {
      queueMicrotask(() => log.push(`microtask ${input.value}`));
      setTimeout(() => log.push(`timer ${input.value}`));
    });
    await userEvent.click(root!.querySelector('button')!);
    await timer();
    expect(log).toEqual(['microtask typed', 'timer first']);
  });

  test('a later listener can prevent it: a microtask of an earlier listener does not see that, a timer does', async () => {
    html('<form><input value="first"><button type="reset">Reset</button></form>');
    const form = root!.querySelector('form')!;
    const log: string[] = [];
    form.addEventListener('reset', (event) => {
      queueMicrotask(() => log.push(`microtask ${event.defaultPrevented}`));
      setTimeout(() => log.push(`timer ${event.defaultPrevented}`));
    });
    form.addEventListener('reset', (event) => event.preventDefault());
    await userEvent.click(root!.querySelector('button')!);
    await timer();
    expect(log).toEqual(['microtask false', 'timer true']);
  });

  test('does not change an input that is out of the document, as an input that KeepAlive holds', () => {
    const form = html('<form><input value="first"></form>').querySelector('form')!;
    const input = form.querySelector('input')!;
    input.value = 'typed';
    input.remove();
    form.reset();
    expect(input.form).toBeNull();
    expect(input.value).toBe('typed');
  });
});
