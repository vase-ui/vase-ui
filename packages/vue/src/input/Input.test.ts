import { describe, expect, inject, test, vi } from 'vitest';
import { cdp, server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { Input, type InputChangeEventDetails } from '@vase-ui/vue/input';
import { emitsFor, recordEmits, vModel } from '../../test/attrs';
import { dataAttributes, recordValidate } from '../../test/field';
import Inputs from '../../test/fixtures/Inputs.vue';
import InputsInForm from '../../test/fixtures/InputsInForm.vue';
import KeptAliveField from '../../test/fixtures/KeptAliveField.vue';
import LabelledInputs from '../../test/fixtures/LabelledInputs.vue';
import StyledInputInSlot from '../../test/fixtures/StyledInputInSlot.vue';
import TeleportedInput from '../../test/fixtures/TeleportedInput.vue';
import TextareaInSlot from '../../test/fixtures/TextareaInSlot.vue';
import TransitionInput from '../../test/fixtures/TransitionInput.vue';
import { mount, settle, typeAtEnd } from '../../test/render';
import { screen } from '../../test/queries';

function mountInputs(...inputs: Record<string, unknown>[]) {
  const { root, exposed } = mount(Inputs, { inputs });
  return { root, exposed, inputs: [...root.querySelectorAll('input')] };
}

test('the project compiles Input and the fixtures in the modes of its app', () => {
  const app = inject('app');
  // The compiler of Vue marks a Vapor component with `__vapor`.
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(Input)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(Inputs)).toBe(app.startsWith('vapor'));
});

describe('attributes and listeners', () => {
  test('renders one input with the attributes of the developer', () => {
    const { root, inputs } = mountInputs({
      id: 'email',
      name: 'email',
      type: 'email',
      placeholder: 'you@example.com',
      required: true,
      autocomplete: 'email',
      'aria-label': 'Email',
      'data-test': 'email',
      class: 'Input',
      style: 'color: red',
    });
    const [input] = inputs;
    expect(root.children).toHaveLength(1);
    expect(root.firstElementChild).toBe(input);
    expect(input).toHaveAttribute('id', 'email');
    expect(input).toHaveAttribute('name', 'email');
    expect(input).toHaveAttribute('type', 'email');
    expect(input).toHaveAttribute('placeholder', 'you@example.com');
    expect(input).toHaveAttribute('required');
    expect(input).toHaveAttribute('autocomplete', 'email');
    expect(input).toHaveAttribute('aria-label', 'Email');
    expect(input).toHaveAttribute('data-test', 'email');
    expect(input).toHaveAttribute('class', 'Input');
    expect(input).toHaveStyle({ color: 'rgb(255, 0, 0)' });
  });

  test('runs a listener of the developer one time for each native event', async () => {
    const listeners = { onInput: vi.fn(), onFocus: vi.fn(), onBlur: vi.fn(), onKeydown: vi.fn() };
    const log: string[] = [];
    const [input] = mountInputs(recordEmits(log, listeners)).inputs;
    await typeAtEnd(input!, 'ab');
    input!.blur();
    expect(listeners.onInput).toHaveBeenCalledTimes(2);
    expect(listeners.onKeydown).toHaveBeenCalledTimes(2);
    expect(listeners.onFocus).toHaveBeenCalledTimes(1);
    expect(listeners.onBlur).toHaveBeenCalledTimes(1);
    expect(log).toEqual(emitsFor('a', 'ab'));
  });

  test('outside a field, has no state attribute, and :disabled matches a disabled input', () => {
    const [enabled, disabled] = mountInputs({}, { disabled: true }).inputs;
    const stateAttributes = (input: HTMLInputElement) =>
      input.getAttributeNames().filter((name) => /^(data|aria)-/.test(name));
    expect(stateAttributes(enabled!)).toEqual([]);
    expect(stateAttributes(disabled!)).toEqual([]);
    expect(disabled).toHaveAttribute('disabled');
    expect(disabled!.matches(':disabled')).toBe(true);
  });

  test('a template ref on Input reaches the input element', () => {
    const { exposed, inputs } = mountInputs({});
    expect(exposed.inputRefs[0].element).toBe(inputs[0]);
  });
});

describe('events', () => {
  test('emits valueChange and then update:modelValue, with the text and the details', async () => {
    const log: string[] = [];
    let details: InputChangeEventDetails | undefined;
    const [input] = mountInputs({
      modelValue: 4,
      onValueChange: (value: string, valueDetails: InputChangeEventDetails) => {
        log.push(`valueChange ${typeof value} ${value}`);
        details = valueDetails;
      },
      'onUpdate:modelValue': (value: string) => log.push(`update ${typeof value} ${value}`),
    }).inputs;
    await typeAtEnd(input!, '2');
    expect(log).toEqual(['valueChange string 42', 'update string 42']);
    expect(Object.keys(details!)).toEqual(['reason', 'event', 'cancel', 'isCanceled']);
    expect(details).toMatchObject({ reason: 'none', isCanceled: false });
    expect(details!.event).toBeInstanceOf(InputEvent);
    expect(details!.event.target).toBe(input);
  });
});

describe('value', () => {
  test('a controlled input with no listener keeps the value of its prop', async () => {
    const [input] = mountInputs({ modelValue: 'first' }).inputs;
    await typeAtEnd(input!, 'x');
    await nextTick();
    expect(input).toHaveValue('first');
  });

  test('v-model takes the text that the user types, and the input shows a new model', async () => {
    const attrs = vModel('');
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'Colm');
    expect(attrs.modelValue).toBe('Colm');
    attrs.modelValue = 'Tuite';
    await nextTick();
    expect(input).toHaveValue('Tuite');
  });

  test('the parent can change the value in the valueChange listener', async () => {
    const attrs: Record<string, unknown> = reactive({ modelValue: '' });
    attrs.onValueChange = (value: string) => (attrs.modelValue = value.toUpperCase());
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'ab');
    await nextTick();
    expect(input).toHaveValue('AB');
    expect(attrs.modelValue).toBe('AB');
  });

  test('the same text typed after the parent refused it is a new edit', async () => {
    const log: string[] = [];
    const [input] = mountInputs(recordEmits(log, { modelValue: 'a' })).inputs;
    await typeAtEnd(input!, 'b');
    await nextTick();
    expect(input).toHaveValue('a');
    await typeAtEnd(input!, 'b');
    expect(log).toEqual(emitsFor('ab', 'ab'));
  });

  test('the same text typed after the parent cleared the value is a new edit', async () => {
    const log: string[] = [];
    const attrs = vModel('', log);
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'a');
    attrs.modelValue = '';
    await nextTick();
    expect(input).toHaveValue('');
    await typeAtEnd(input!, 'a');
    expect(log).toEqual(emitsFor('a', 'a'));
  });

  test('an uncontrolled input starts at defaultValue, or empty, and keeps the text', async () => {
    const [withDefault, empty] = mountInputs({ defaultValue: 'first' }, {}).inputs;
    expect(withDefault).toHaveValue('first');
    expect(empty).toHaveValue('');
    await typeAtEnd(withDefault!, 'x');
    await nextTick();
    expect(withDefault).toHaveValue('firstx');
  });

  test('a modelValue of undefined is an absent prop, and the input keeps its value', async () => {
    const attrs = vModel(undefined);
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'a');
    expect(attrs.modelValue).toBe('a');
    attrs.modelValue = 'b';
    await nextTick();
    attrs.modelValue = undefined;
    await nextTick();
    expect(input).toHaveValue('b');
    await typeAtEnd(input!, 'c');
    expect(input).toHaveValue('bc');
  });

  test('a new defaultValue gives no warning and keeps the text that the user typed', async () => {
    const attrs = reactive({ defaultValue: 'first' });
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'x');
    attrs.defaultValue = 'second';
    await nextTick();
    expect(input).toHaveValue('firstx');
  });
});

describe('cancel', () => {
  const cancel = (_value: string, details: InputChangeEventDetails) => details.cancel();

  test('a cancelled edit emits no update:modelValue, keeps the value, and tells the field nothing', async () => {
    const validated: unknown[] = [];
    const field = recordValidate(validated, { validationMode: 'change' });
    const log: string[] = [];
    const attrs = recordEmits(log, { defaultValue: 'a' });
    attrs.onValueChange = (value: string, details: InputChangeEventDetails) => {
      log.push(`valueChange ${value}`);
      details.cancel();
    };
    const { root } = mount(Inputs, { inputs: [attrs], field });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'b');
    await nextTick();
    expect(log).toEqual(['valueChange ab']);
    expect(input).toHaveValue('a');
    expect(validated).toEqual([]);
    expect(dataAttributes(root.firstElementChild!)).toEqual(['data-filled']);
  });

  test('a cancelled edit keeps the value of v-model', async () => {
    const attrs = vModel('a');
    attrs.onValueChange = cancel;
    const [input] = mountInputs(attrs).inputs;
    await typeAtEnd(input!, 'b');
    await nextTick();
    expect(input).toHaveValue('a');
    expect(attrs.modelValue).toBe('a');
  });
});

/** Composes `steps` with a text input method, and commits the last step. */
async function compose(input: HTMLInputElement | HTMLTextAreaElement, steps: string[]) {
  const committed = steps.at(-1)!;
  if (server.browser === 'chromium') {
    for (const text of steps) {
      await cdp().send('Input.imeSetComposition', {
        text,
        selectionStart: text.length,
        selectionEnd: text.length,
      });
    }
    await cdp().send('Input.insertText', { text: committed });
    return;
  }
  // Playwright starts a composition only in Chromium. These are the events of a real one.
  input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
  for (const text of steps) {
    input.value = text;
    input.dispatchEvent(
      new InputEvent('input', {
        bubbles: true,
        composed: true,
        isComposing: true,
        inputType: 'insertCompositionText',
        data: text,
      }),
    );
    await nextTick();
  }
  input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: committed }));
}

describe('text input methods', () => {
  test('each input event of a composition emits, and v-model does not disturb the composition', async () => {
    const log: string[] = [];
    const attrs = vModel('', log);
    const [input] = mountInputs(attrs).inputs;
    const inputValues: string[] = [];
    const compositionEvents: string[] = [];
    const carets: (number | null)[] = [];
    input!.addEventListener('input', () => {
      inputValues.push(input!.value);
      carets.push(input!.selectionStart);
    });
    input!.addEventListener('compositionstart', () => compositionEvents.push('compositionstart'));
    input!.addEventListener('compositionend', () => compositionEvents.push('compositionend'));
    input!.focus();
    await compose(input!, ['k', 'か', 'かn', 'かな']);
    await nextTick();
    expect(inputValues).toEqual(expect.arrayContaining(['k', 'か', 'かn', 'かな']));
    expect(log).toEqual(emitsFor(...inputValues));
    expect(compositionEvents).toEqual(['compositionstart', 'compositionend']);
    expect(input).toHaveFocus();
    expect(input).toHaveValue('かな');
    expect(attrs.modelValue).toBe('かな');
    expect(carets).toEqual(inputValues.map((value) => value.length));
  });
});

describe('text input methods in a replaced element', () => {
  test('each input event of a composition in a textarea of the slot emits', async () => {
    const log: string[] = [];
    const attrs = vModel('', log);
    const { root } = mount(TextareaInSlot, { field: {}, attrs });
    const textarea = root.querySelector('textarea')!;
    const inputValues: string[] = [];
    textarea.addEventListener('input', () => inputValues.push(textarea.value));
    textarea.focus();
    await compose(textarea, ['k', 'か']);
    await nextTick();
    expect(inputValues).toEqual(expect.arrayContaining(['k', 'か']));
    expect(log).toEqual(emitsFor(...inputValues));
    expect(textarea).toHaveFocus();
    expect(attrs.modelValue).toBe('か');
  });
});

describe('the change event', () => {
  test('gives no valueChange and changes nothing in the field', async () => {
    const validated: unknown[] = [];
    const field = recordValidate(validated, { validationMode: 'change' });
    const log: string[] = [];
    const attrs = vModel('a');
    attrs.onValueChange = (value: string) => log.push(`valueChange ${value}`);
    const { root } = mount(Inputs, { inputs: [attrs], field });
    const input = root.querySelector('input')!;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(log).toEqual([]);
    expect(validated).toEqual([]);
    expect(dataAttributes(root.firstElementChild!)).toEqual(['data-filled']);

    await typeAtEnd(input, 'b');
    input.blur();
    attrs.modelValue = 'c';
    await nextTick();
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await nextTick();
    expect(log).toEqual(['valueChange ab']);
    expect(validated).toEqual(['ab', 'c']);
  });
});

describe('native forms', () => {
  test('puts its name and value in the form data, and a disabled input does not', async () => {
    const { root } = mount(InputsInForm, {
      inputs: [
        { name: 'first', defaultValue: 'Colm' },
        { name: 'last', defaultValue: 'Tuite', disabled: true },
      ],
    });
    const form = root.querySelector('form')!;
    const [first, last] = form.querySelectorAll('input');
    await typeAtEnd(first!, '!');
    expect([...new FormData(form)]).toEqual([['first', 'Colm!']]);
    expect(last).toBeDisabled();
    expect(last!.matches(':disabled')).toBe(true);
  });

  test('an empty required input fails the validity of its form', async () => {
    const { root } = mount(InputsInForm, { inputs: [{ name: 'name', required: true }] });
    const form = root.querySelector('form')!;
    expect(form.checkValidity()).toBe(false);
    await typeAtEnd(form.querySelector('input')!, 'Colm');
    expect(form.checkValidity()).toBe(true);
  });

  test('a reset button gives the first value back, and the same text typed after it is a new edit', async () => {
    const log: string[] = [];
    const { root } = mount(InputsInForm, { inputs: [recordEmits(log)], field: {} });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'x');
    expect(input).toHaveAttribute('data-dirty');
    expect(input).toHaveAttribute('data-filled');
    await userEvent.click(root.querySelector('button')!);
    await settle();
    expect(input).toHaveValue('');
    expect(input).not.toHaveAttribute('data-dirty');
    expect(input).not.toHaveAttribute('data-filled');
    await typeAtEnd(input, 'x');
    expect(log).toEqual([...emitsFor('x'), 'update ', ...emitsFor('x')]);
  });

  test('a reset that changes no value emits nothing', async () => {
    const log: string[] = [];
    const { root } = mount(InputsInForm, { inputs: [recordEmits(log, { defaultValue: 'a' })] });
    root.querySelector('form')!.reset();
    await settle();
    expect(log).toEqual([]);
  });

  test('form.reset() gives the first value back to v-model', async () => {
    const attrs = vModel('first');
    const { root } = mount(InputsInForm, { inputs: [attrs] });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'x');
    attrs.modelValue = 'second';
    await nextTick();
    root.querySelector('form')!.reset();
    await settle();
    expect(input).toHaveValue('first');
    expect(attrs.modelValue).toBe('first');
  });

  test('a prevented reset and a reset of another form change nothing', async () => {
    const log: string[] = [];
    const { root } = mount(InputsInForm, {
      inputs: [recordEmits(log, { defaultValue: 'a' })],
      formAttrs: { onReset: (event: Event) => event.preventDefault() },
    });
    const [form, otherForm] = root.querySelectorAll('form');
    const input = form!.querySelector('input')!;
    await typeAtEnd(input, 'b');
    form!.reset();
    otherForm!.reset();
    await settle();
    expect(input).toHaveValue('ab');
    expect(log).toEqual(emitsFor('ab'));
  });

  test('a listener after the one of Input can prevent the reset', async () => {
    const attrs = vModel('a');
    const { root } = mount(InputsInForm, { inputs: [attrs] });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'b');
    const preventReset = (event: Event) => event.preventDefault();
    document.addEventListener('reset', preventReset);
    try {
      await userEvent.click(root.querySelector('button')!);
      await settle();
    } finally {
      document.removeEventListener('reset', preventReset);
    }
    expect(input).toHaveValue('ab');
    expect(attrs.modelValue).toBe('ab');
  });

  test('a reset works for a form in a shadow root', async () => {
    const host = document.body.appendChild(document.createElement('div'));
    const shadowRoot = host.attachShadow({ mode: 'open' });
    const attrs = vModel('first');
    try {
      mount(InputsInForm, { inputs: [attrs] }, shadowRoot);
      const input = shadowRoot.querySelector('input')!;
      await typeAtEnd(input, 'x');
      expect(attrs.modelValue).toBe('firstx');
      shadowRoot.querySelector('form')!.reset();
      await settle();
      expect(input).toHaveValue('first');
      expect(attrs.modelValue).toBe('first');
    } finally {
      host.remove();
    }
  });
});

describe('lifetime', () => {
  test('a held input does not follow a reset of its form, as the native input does not', async () => {
    const scene = reactive({ shown: true });
    const attrs = vModel('first');
    const { root } = mount(KeptAliveField, { scene, attrs });
    const input = root.querySelector('input')!;
    await typeAtEnd(input, 'x');
    scene.shown = false;
    await nextTick();
    root.querySelector('form')!.reset();
    await settle();
    expect(attrs.modelValue).toBe('firstx');
    scene.shown = true;
    await nextTick();
    expect(input).toHaveValue('firstx');
    expect(root.querySelector('form > div')).toHaveAttribute('data-dirty');
  });

  test('renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(TransitionInput, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('input')).toHaveClass('v-enter-from', 'v-enter-active');
  });

  test('works in Teleport', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    try {
      const { root } = mount(TeleportedInput, { field: {}, target });
      const input = target.querySelector('input')!;
      await nextTick();
      expect(root.querySelector('label')).toHaveAttribute('for', input.id);
      await typeAtEnd(input, 'a');
      expect(root.firstElementChild).toHaveAttribute('data-dirty');
    } finally {
      target.remove();
    }
  });

  test('a removed input leaves no listener', async () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener');
    const removed = vi.spyOn(EventTarget.prototype, 'removeEventListener');
    const resetListeners = (spy: typeof added) =>
      spy.mock.calls
        .map(([type, listener], index) => ({ target: spy.mock.contexts[index], type, listener }))
        .filter(({ type }) => type === 'reset');
    const inputs = reactive([{}]);
    const { root } = mount(InputsInForm, { inputs });
    inputs.pop();
    await nextTick();
    // `reset` bubbles, so the listener is on the root node of the input.
    expect(resetListeners(added)).toEqual([
      { target: root.getRootNode(), type: 'reset', listener: expect.any(Function) },
    ]);
    expect(resetListeners(removed)).toEqual(resetListeners(added));
  });
});

describe('accessibility', () => {
  test('has the native role, and the name from a label, aria-label or aria-labelledby', () => {
    mount(LabelledInputs);
    expect(screen.getByRole('textbox', { name: 'Name' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Email' })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Phone' })).toBeInTheDocument();
  });
});

describe('a replaced element', () => {
  test('a textarea in the slot gets the attributes, the value and the listeners, and the state', async () => {
    const log: string[] = [];
    const onInput = vi.fn();
    const { root, exposed } = mount(TextareaInSlot, {
      field: { validationMode: 'change' },
      attrs: recordEmits(log, { name: 'bio', defaultValue: 'first', rows: 3, onInput }),
    });
    await nextTick();
    const textarea = root.querySelector('textarea')!;
    const state = () => JSON.parse(root.querySelector('output')!.textContent!);
    expect(exposed.input.element).toBe(textarea);
    expect(textarea).toHaveValue('first');
    expect(textarea).toHaveAttribute('name', 'bio');
    expect(textarea).toHaveAttribute('rows', '3');
    expect(textarea).toHaveAttribute('aria-describedby', 'description');
    expect(textarea).toHaveAttribute('data-filled', '');
    expect(state()).toEqual({
      disabled: false,
      touched: false,
      dirty: false,
      valid: null,
      filled: true,
    });

    await typeAtEnd(textarea, '!');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(log).toEqual(emitsFor('first!'));
    expect(state()).toMatchObject({ dirty: true, valid: true });

    root.querySelector('form')!.reset();
    await settle();
    expect(textarea).toHaveValue('first');
  });

  test('a component in the slot gets the props on its element, and exposes the element', async () => {
    const log: string[] = [];
    const onInput = vi.fn();
    const { root, exposed } = mount(StyledInputInSlot, {
      attrs: recordEmits(log, { defaultValue: 'a', onInput }),
    });
    const input = root.querySelector('input')!;
    expect(input).toHaveClass('StyledInput');
    expect(exposed.input.element).toBe(input);
    expect(input).toHaveValue('a');
    await typeAtEnd(input, 'b');
    expect(onInput).toHaveBeenCalledTimes(1);
    expect(log).toEqual(emitsFor('ab'));
  });
});
