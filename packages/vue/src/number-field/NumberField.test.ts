import { afterEach, describe, expect, inject, test, vi } from 'vitest';
import { cdp, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import {
  NumberField,
  type NumberFieldRootChangeEventDetails,
  type NumberFieldRootCommitEventDetails,
} from '@vase-ui/vue/number-field';
import { platform } from '../common/platform';
import { dataAttributes } from '../../test/field';
import NumberFieldInLocaleProvider from '../../test/fixtures/NumberFieldInLocaleProvider.vue';
import NumberFieldInputAlone from '../../test/fixtures/NumberFieldInputAlone.vue';
import NumberFieldParts from '../../test/fixtures/NumberFieldParts.vue';
import NumberFields from '../../test/fixtures/NumberFields.vue';
import { mockRuntimeLocale } from '../../test/mockRuntimeLocale';
import { screen } from '../../test/queries';
import { mount, mountError, settle, typeAtEnd } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { fireTouch } from '../../test/touch';
import { waitFor } from '../../test/waitFor';

type Attrs = Record<string, unknown>;

afterEach(() => {
  vi.useRealTimers();
});

/** Root attributes that write each `valueChange`, `update:modelValue` and `valueCommitted` in `log`. */
function record(log: string[], attrs: Attrs = {}) {
  return reactive<Attrs>({
    onValueChange: (value: number | null, details: NumberFieldRootChangeEventDetails) =>
      log.push(`change ${value} ${details.reason}`),
    'onUpdate:modelValue': (value: number | null) => log.push(`update ${value}`),
    onValueCommitted: (value: number | null, details: NumberFieldRootCommitEventDetails) =>
      log.push(`commit ${value} ${details.reason}`),
    ...attrs,
  });
}

/** `record` with `v-model`: the parent writes each value. */
function bound(log: string[], modelValue: number | null, attrs: Attrs = {}) {
  const root = record(log, { modelValue, ...attrs });
  root['onUpdate:modelValue'] = (value: number | null) => {
    log.push(`update ${value}`);
    root.modelValue = value;
  };
  return root;
}

const commits = (log: string[]) => log.filter((line) => line.startsWith('commit'));

async function mountField(props: Attrs = {}) {
  const { root, exposed, unmount } = mount(NumberFields, props);
  await nextTick();
  const find = <T extends Element>(selector: string) => root.querySelector<T>(selector)!;
  return {
    root,
    exposed,
    unmount,
    form: find<HTMLFormElement>('#form'),
    field: find<HTMLElement>('#form > div'),
    group: find<HTMLElement>('[role=group]'),
    input: find<HTMLInputElement>('#amount'),
    hidden: find<HTMLInputElement>('[type=number]'),
    increment: find<HTMLButtonElement>('[aria-label=Increase]'),
    decrement: find<HTMLButtonElement>('[aria-label=Decrease]'),
    area: find<HTMLElement>('span[role=presentation]'),
  };
}

/** A pointer event that the browser would send, for timing and for pointers Playwright lacks. */
function pointer(target: EventTarget, type: string, init: PointerEventInit = {}) {
  const event = new PointerEvent(type, {
    bubbles: !type.endsWith('enter') && !type.endsWith('leave'),
    cancelable: true,
    composed: true,
    pointerId: 1,
    isPrimary: true,
    button: 0,
    pointerType: 'mouse',
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}

function wheel(target: EventTarget, init: WheelEventInit) {
  const event = new WheelEvent('wheel', { bubbles: true, cancelable: true, ...init });
  target.dispatchEvent(event);
  return event;
}

async function clear(input: HTMLInputElement) {
  input.focus();
  input.select();
  await userEvent.keyboard('{Backspace}');
}

const noSelect = (element: Element) => {
  const style = getComputedStyle(element);
  return (style.userSelect || style.getPropertyValue('-webkit-user-select')) === 'none';
};

test('the project compiles the parts and the fixtures in the modes of its app', () => {
  const app = inject('app');
  // The compiler of Vue marks a Vapor component with `__vapor`.
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(NumberField.Root)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(NumberFields)).toBe(app.startsWith('vapor'));
});

describe('the parts', () => {
  test('a div with a hidden number input as its last child, a group, a text input with the role spinbutton and two buttons; the attributes of the developer win', async () => {
    const { field, group, input, hidden, increment, decrement } = await mountField({
      root: { name: 'amount', min: 0, max: 10, step: 2, defaultValue: 4, class: 'Field' },
      input: { inputmode: 'decimal', class: 'Input' },
    });
    expect(field.tagName).toBe('DIV');
    expect(field).toHaveClass('Field');
    expect(field.lastElementChild).toBe(hidden);
    expect(group).toHaveAttribute('role', 'group');
    for (const [name, value] of Object.entries({
      type: 'text',
      role: 'spinbutton',
      inputmode: 'decimal',
      autocomplete: 'off',
      spellcheck: 'false',
      'aria-valuenow': '4',
      'aria-valuetext': '4',
      'aria-valuemin': '0',
      'aria-valuemax': '10',
      class: 'Input',
    })) {
      expect(input).toHaveAttribute(name, value);
    }
    for (const name of ['name', 'autocorrect', 'aria-roledescription', 'aria-invalid']) {
      expect(input).not.toHaveAttribute(name);
    }
    for (const [name, value] of Object.entries({
      type: 'number',
      'aria-hidden': 'true',
      tabindex: '-1',
      name: 'amount',
      min: '0',
      max: '10',
      step: '2',
      value: '4',
    })) {
      expect(hidden).toHaveAttribute(name, value);
    }
    expect(hidden.getBoundingClientRect().width).toBeLessThanOrEqual(1);
    for (const button of [increment, decrement]) {
      expect(button).toHaveAttribute('type', 'button');
      expect(button).toHaveAttribute('tabindex', '-1');
      expect(button).toHaveAttribute('aria-controls', 'amount');
      expect(noSelect(button)).toBe(true);
    }
    expect(screen.getByRole('spinbutton', { name: 'Amount' })).toBe(input);
  });

  test('with no number in step the hidden input has step any; a template ref reaches the root and the hidden input', async () => {
    const root = reactive<Attrs>({});
    const { exposed, field, hidden } = await mountField({ root });
    expect(hidden).toHaveAttribute('step', 'any');
    root.step = 'any';
    await nextTick();
    expect(hidden).toHaveAttribute('step', 'any');
    expect(exposed.field.element).toBe(field);
    expect(exposed.field.inputElement).toBe(hidden);
  });

  test('the state shows as data attributes on each part, but not where CSS or ARIA has it', async () => {
    const root = reactive<Attrs>({ required: true, readonly: true, disabled: false });
    const { field, group, input, hidden, increment, area } = await mountField({ root, area: {} });
    const readonlyRequired = ['data-readonly', 'data-required'];
    for (const part of [field, group, area, increment]) {
      expect(dataAttributes(part)).toEqual(readonlyRequired);
    }
    expect(dataAttributes(input)).toEqual([]);
    expect(input.readOnly && input.required && hidden.readOnly && hidden.required).toBe(true);
    expect(increment.disabled).toBe(true);
    Object.assign(root, { required: false, readonly: false, disabled: true });
    await nextTick();
    for (const part of [field, group, area]) {
      expect(dataAttributes(part)).toEqual(['data-disabled']);
    }
    expect(dataAttributes(input)).toEqual([]);
    expect(dataAttributes(increment)).toEqual([]);
    expect(input.disabled && hidden.disabled && increment.disabled).toBe(true);
  });

  test('a value out of the range sets aria-invalid on the input', async () => {
    const root = reactive<Attrs>({ modelValue: 5, max: 10 });
    const { input } = await mountField({ root });
    expect(input).not.toHaveAttribute('aria-invalid');
    root.modelValue = 11;
    await nextTick();
    expect(input).toHaveAttribute('aria-invalid', 'true');
  });

  test('the element slot and as render the element of the developer with the state; a template ref reaches it', async () => {
    const { root, exposed } = mount(NumberFieldParts, { root: { defaultValue: 5, max: 5 } });
    await nextTick();
    const input = root.querySelector<HTMLInputElement>('input.StyledInput')!;
    const increment = root.querySelector<HTMLElement>('div[aria-label=Increase]')!;
    expect(root.firstElementChild!.tagName).toBe('SECTION');
    expect(root.firstElementChild!.lastElementChild).toHaveAttribute('type', 'number');
    expect(root.querySelector('output')).toHaveTextContent('5');
    expect(exposed.input.element).toBe(input);
    expect(exposed.increment.element).toBe(increment);
    expect(input).toHaveAttribute('role', 'spinbutton');
    expect(root.querySelector('article')).toHaveAttribute('data-text', '5');
    expect(root.querySelector('article')).toHaveAttribute('role', 'group');
    expect(root.querySelector('label.Area')).toHaveAttribute('role', 'presentation');
    expect(root.querySelector('[aria-label=Decrease]')).toHaveTextContent('−');
    // A button at its bound is disabled. An element that is not a button gets the role.
    expect(increment).toHaveAttribute('role', 'button');
    expect(increment).toHaveAttribute('tabindex', '-1');
    expect(increment).toHaveAttribute('aria-disabled', 'true');
    expect(increment).not.toHaveAttribute('disabled');
    expect(increment).not.toHaveAttribute('type');
    expect(increment).toHaveAttribute('aria-controls', input.id);
    increment.click();
    await nextTick();
    expect(input.value).toBe('5');
  });

  test('a v-if in a Transition that replaces the input gives the root the new input; with no input the buttons have no aria-controls, and an aria-controls of the developer wins', async () => {
    let left = 0;
    const parts = reactive({ input: true, second: false });
    const { increment, decrement } = await mountField({
      parts,
      increment: { 'aria-controls': '' },
      onInputLeft: () => left++,
    });
    expect(decrement).toHaveAttribute('aria-controls', 'amount');
    expect(increment).toHaveAttribute('aria-controls', '');
    Object.assign(parts, { input: false, second: true });
    await waitFor(() => expect(left).toBe(1));
    expect(decrement).toHaveAttribute('aria-controls', 'second');
    parts.second = false;
    await nextTick();
    expect(decrement).not.toHaveAttribute('aria-controls');
  });
});

describe('the value and the text', () => {
  test('the text is the format of the value; a typed number stays as typed while it is the value, and the blur gives it the format', async () => {
    const log: string[] = [];
    const { input, hidden } = await mountField({ root: record(log, { defaultValue: 1234 }) });
    expect(input.value).toBe('1,234');
    expect(hidden.value).toBe('1234');
    await clear(input);
    await userEvent.keyboard('1234.50');
    await settle();
    expect(input.value).toBe('1234.50');
    expect(hidden.value).toBe('1234.5');
    expect(input).toHaveAttribute('aria-valuetext', '1234.50');
    input.blur();
    await settle();
    expect(input.value).toBe('1,234.5');
    expect(log.at(-1)).toBe('commit 1234.5 input-blur');
  });

  test('a controlled field shows its prop; with no listener it shows the prop again after an edit, a key and a press', async () => {
    const { input, increment } = await mountField({ root: { modelValue: 5 } });
    await typeAtEnd(input, '6');
    await settle();
    expect(input.value).toBe('5');
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(input.value).toBe('5');
    increment.click();
    await settle();
    expect(input.value).toBe('5');
  });

  test('the parent can change the value while the user types; the text then takes the format', async () => {
    const log: string[] = [];
    const root = bound(log, 1);
    const { input } = await mountField({ root });
    await typeAtEnd(input, '.50');
    await settle();
    expect(input.value).toBe('1.50');
    root.modelValue = 2000;
    await nextTick();
    expect(input.value).toBe('2,000');
    expect(log).toEqual(['change 1.5 input-change', 'update 1.5']);
  });

  test('a cancel keeps the value, shows its format, and no commit follows', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 5 });
    root.onValueChange = (value: number | null, details: NumberFieldRootChangeEventDetails) => {
      log.push(`change ${value} ${details.reason}`);
      details.cancel();
    };
    const { input, hidden } = await mountField({ root });
    await typeAtEnd(input, '6');
    await settle();
    expect(input.value).toBe('5');
    await userEvent.keyboard('{ArrowUp}');
    input.blur();
    await settle();
    expect(input.value).toBe('5');
    expect(hidden.value).toBe('5');
    expect(log).toEqual(['change 56 input-change', 'change 6 keyboard']);
  });

  test('NaN in the model is an empty field; an undefined model keeps the value', async () => {
    const root = reactive<Attrs>({ modelValue: NaN });
    const { input, hidden } = await mountField({ root });
    expect(input.value).toBe('');
    expect(hidden.value).toBe('');
    expect(input).not.toHaveAttribute('aria-valuenow');
    expect(input).not.toHaveAttribute('aria-valuetext');
    root.modelValue = 3;
    await nextTick();
    root.modelValue = undefined;
    await nextTick();
    expect(input.value).toBe('3');
  });

  test('a new format or locale formats the text again; typed text that is not a number stays', async () => {
    const root = reactive<Attrs>({ defaultValue: 1234.5 });
    const { input } = await mountField({ root });
    root.locale = 'de-DE';
    await nextTick();
    expect(input.value).toBe('1.234,5');
    root.format = { style: 'currency', currency: 'EUR' };
    await nextTick();
    expect(input.value).toBe('1.234,50 €');
    await clear(input);
    await userEvent.keyboard('-');
    root.locale = 'en-US';
    await nextTick();
    expect(input.value).toBe('-');
  });

  test('a new format object with the same content keeps the typed text', async () => {
    const root = reactive<Attrs>({ format: { maximumFractionDigits: 2 } });
    const { input } = await mountField({ root });
    await typeAtEnd(input, '1234');
    root.format = { maximumFractionDigits: 2 };
    await nextTick();
    expect(input.value).toBe('1234');
    root.format = { maximumFractionDigits: 1 };
    await nextTick();
    expect(input.value).toBe('1,234');
  });

  test('with no rounding option the value keeps each typed digit, and the text shows fewer', async () => {
    const log: string[] = [];
    const { input } = await mountField({ root: record(log) });
    await typeAtEnd(input, '1.23456');
    input.blur();
    await settle();
    expect(input.value).toBe('1.235');
    expect(log.at(-1)).toBe('commit 1.23456 input-blur');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(input.value).toBe('2.235');
    expect(log.at(-1)).toBe('commit 2.23456 keyboard');
  });

  test('a focus and a blur with no typed edit change nothing and emit nothing, also when the format rounds the value', async () => {
    const log: string[] = [];
    const compact = await mountField({
      root: record(log, { defaultValue: 1234, format: { notation: 'compact' } }),
    });
    const rounded = await mountField({
      root: record(log, { defaultValue: 1.23456, format: { maximumFractionDigits: 2 } }),
    });
    for (const { input } of [compact, rounded]) {
      input.focus();
      input.blur();
    }
    await settle();
    expect(compact.input.value).toBe('1.2K');
    expect(rounded.input.value).toBe('1.23');
    expect(rounded.hidden.value).toBe('1.23456');
    expect(log).toEqual([]);
  });

  test('allowOutOfRange off: a typed number gives the value in the range, and the typed text stays until the blur', async () => {
    const log: string[] = [];
    const { input, hidden } = await mountField({ root: record(log, { min: 0, max: 100 }) });
    await typeAtEnd(input, '150');
    await settle();
    expect(input.value).toBe('150');
    expect(hidden.value).toBe('100');
    input.blur();
    await settle();
    expect(input.value).toBe('100');
    expect(commits(log)).toEqual(['commit 100 input-blur']);
  });

  test('allowOutOfRange on: a typed number stays out of the range and the form reports it; a step goes into the range', async () => {
    const log: string[] = [];
    const { input, hidden } = await mountField({
      root: record(log, { max: 100, allowOutOfRange: true }),
    });
    await typeAtEnd(input, '150');
    input.blur();
    await settle();
    expect(input.value).toBe('150');
    expect(hidden.validity.rangeOverflow).toBe(true);
    expect(input).toHaveAttribute('aria-invalid', 'true');
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(commits(log)).toEqual(['commit 150 input-blur', 'commit 100 keyboard']);
  });
});

describe('the locale', () => {
  test('the text has the locale prop, else the locale of the nearest LocaleProvider, and never the locale of the visitor', async () => {
    mockRuntimeLocale('de-CH');
    const provider = reactive({ locale: 'de-DE' });
    const { root } = mount(NumberFieldInLocaleProvider, { provider });
    await nextTick();
    const text = (name: string) =>
      root.querySelector<HTMLInputElement>(`[aria-label=${name}]`)!.value;
    expect(text('Provider')).toBe('1.234,5');
    expect(text('Own')).toBe(new Intl.NumberFormat('fr-FR').format(1234.5));
    provider.locale = 'en-US';
    await nextTick();
    expect(text('Provider')).toBe('1,234.5');
  });
});

describe('the characters that the input takes', () => {
  test('a key with a character that the input does not take is stopped, and nothing is emitted', async () => {
    const log: string[] = [];
    const { input } = await mountField({ root: record(log) });
    const inputs: string[] = [];
    input.addEventListener('input', () => inputs.push(input.value));
    await typeAtEnd(input, 'a$%e');
    expect(input.value).toBe('');
    expect(inputs).toEqual([]);
    expect(log).toEqual([]);
  });

  test('a minus sign only where the range holds a negative number; the minus of an exponent for each range', async () => {
    const root = reactive<Attrs>({ min: 0 });
    const { input } = await mountField({ root });
    await typeAtEnd(input, '-5');
    expect(input.value).toBe('5');
    root.allowOutOfRange = true;
    await nextTick();
    await clear(input);
    await typeAtEnd(input, '-5');
    expect(input.value).toBe('-5');
    Object.assign(root, { allowOutOfRange: false, format: { notation: 'scientific' } });
    await nextTick();
    await clear(input);
    await typeAtEnd(input, '5E-1');
    expect(input.value).toBe('5E-1');
  });

  test('a second decimal separator or sign is stopped, unless the selection covers the first one', async () => {
    const { input } = await mountField();
    await typeAtEnd(input, '-1.5.-');
    expect(input.value).toBe('-1.5');
    input.setSelectionRange(2, 3);
    await userEvent.keyboard('.');
    expect(input.value).toBe('-1.5');
    input.select();
    await userEvent.keyboard('.');
    expect(input.value).toBe('.');
  });

  test('an edit that gives text with a character that the input does not take is refused, also a removal', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { defaultValue: 1234, format: { notation: 'compact' } }),
    });
    expect(input.value).toBe('1.2K');
    input.focus();
    input.setSelectionRange(3, 3);
    await userEvent.keyboard('5');
    expect(input.value).toBe('1.2K');
    input.setSelectionRange(2, 2);
    await userEvent.keyboard('{Backspace}');
    expect(input.value).toBe('1.2K');
    input.blur();
    await settle();
    expect(log).toEqual([]);
  });

  test('digits of other scripts give their number; Backspace and the arrows to the left and right keep their action', async () => {
    const log: string[] = [];
    const { input } = await mountField({ root: record(log) });
    await typeAtEnd(input, '١٢');
    await settle();
    expect(log).toEqual([
      'change 1 input-change',
      'update 1',
      'change 12 input-change',
      'update 12',
    ]);
    await userEvent.keyboard('{ArrowLeft}{Backspace}');
    expect(input.value).toBe('٢');
    expect(input.selectionStart).toBe(0);
  });

  test('the text is read in the locale: 1,5 is 1.5 in de-DE and 15 in en-US, in each browser', async () => {
    const root = reactive<Attrs>({ locale: 'de-DE' });
    const { input, hidden } = await mountField({ root });
    await typeAtEnd(input, '1,5');
    expect(hidden.value).toBe('1.5');
    root.locale = 'en-US';
    await nextTick();
    await clear(input);
    await typeAtEnd(input, '1,5');
    expect(hidden.value).toBe('15');
  });
});

describe('paste and composition', () => {
  test('a paste goes in at the selection with the caret behind it, and gives input-paste; a paste of other text changes nothing', async () => {
    const log: string[] = [];
    const { root, input } = await mountField({ root: record(log, { defaultValue: 12 }) });
    const source = root.appendChild(document.createElement('input'));
    source.value = '34';
    source.focus();
    source.select();
    await userEvent.copy();
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.paste();
    await settle();
    expect(input.value).toBe('1342');
    expect(input.selectionStart).toBe(3);
    source.value = '-';
    source.focus();
    source.select();
    await userEvent.copy();
    input.focus();
    input.select();
    await userEvent.paste();
    await settle();
    // The blur gave the typed number its format.
    expect(input.value).toBe('1,342');
    expect(log).toEqual(['change 1342 input-paste', 'update 1342', 'commit 1342 input-blur']);
  });

  /** Made events of a composition, with the last `input` before or after `compositionend`. */
  async function compose(input: HTMLInputElement, texts: string[], inputAfterEnd = false) {
    input.dispatchEvent(new CompositionEvent('compositionstart'));
    const sendInput = (isComposing: boolean) =>
      input.dispatchEvent(
        new InputEvent('input', { inputType: 'insertCompositionText', isComposing }),
      );
    for (const [index, text] of texts.entries()) {
      input.value = text;
      if (!inputAfterEnd || index < texts.length - 1) sendInput(true);
      await settle();
    }
    input.dispatchEvent(new CompositionEvent('compositionend'));
    if (inputAfterEnd) sendInput(false);
    await settle();
  }

  test.each([
    { order: 'the last input before compositionend', inputAfterEnd: false },
    { order: 'the last input after compositionend', inputAfterEnd: true },
  ])(
    'composition text stays while the composition is open and gives valueChange at its end; text that the input does not take goes at the end ($order)',
    async ({ inputAfterEnd }) => {
      const log: string[] = [];
      const { input } = await mountField({ root: record(log, { defaultValue: 5 }) });
      input.focus();
      await compose(input, ['5ｋ'], inputAfterEnd);
      expect(input.value).toBe('5');
      expect(log).toEqual([]);
      await compose(input, ['5か', '5１'], inputAfterEnd);
      expect(input.value).toBe('5１');
      expect(log).toEqual(['change 51 input-change', 'update 51']);
    },
  );

  // Only Chromium has `Input.imeSetComposition` of the Chrome DevTools Protocol.
  test.runIf(platform.engine.blink)(
    'in Chromium, the text of an open composition stays when the part renders again for another cause',
    async () => {
      const root = reactive<Attrs>({ defaultValue: 5 });
      const { input } = await mountField({ root });
      input.focus();
      input.setSelectionRange(1, 1);
      const session = cdp();
      await session.send('Input.imeSetComposition', {
        text: 'ｋ',
        selectionStart: 1,
        selectionEnd: 1,
      });
      root.max = 100;
      await settle();
      expect(input.value).toBe('5ｋ');
      await session.send('Input.insertText', { text: '１' });
      await settle();
      expect(input.value).toBe('5１');
      expect(input).toHaveAttribute('aria-valuenow', '51');
    },
  );

  test('a key of a composition is not stopped and does not step, also with key code 229 and no isComposing', async () => {
    const { input } = await mountField({ root: { defaultValue: 5 } });
    input.focus();
    const composing = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      isComposing: true,
      cancelable: true,
    });
    const process = new KeyboardEvent('keydown', {
      key: 'ArrowUp',
      keyCode: 229,
      cancelable: true,
    });
    input.dispatchEvent(composing);
    input.dispatchEvent(process);
    await settle();
    expect(composing.defaultPrevented || process.defaultPrevented).toBe(false);
    expect(input.value).toBe('5');
  });
});

describe('the blur and the commit', () => {
  test('the blur after a typed edit commits once; a blur after a key does not commit again; an emptied field commits null', async () => {
    const log: string[] = [];
    const { input } = await mountField({ root: record(log, { defaultValue: 1 }) });
    await typeAtEnd(input, '2');
    input.blur();
    await settle();
    expect(log).toEqual(['change 12 input-change', 'update 12', 'commit 12 input-blur']);
    log.length = 0;
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    input.blur();
    await settle();
    expect(log).toEqual(['change 13 keyboard', 'update 13', 'commit 13 keyboard']);
    log.length = 0;
    await clear(input);
    input.blur();
    await settle();
    expect(log).toEqual(['change null input-clear', 'update null', 'commit null input-clear']);
  });

  test('typed text that is not a number stays after the blur, and goes at the next blur with no event', async () => {
    const log: string[] = [];
    const { input, hidden } = await mountField({ root: record(log, { defaultValue: 7 }) });
    await clear(input);
    await userEvent.keyboard('-');
    input.blur();
    await settle();
    expect(input.value).toBe('-');
    expect(hidden.value).toBe('');
    expect(log).toEqual(['change null input-clear', 'update null', 'commit null input-clear']);
    input.focus();
    input.blur();
    await settle();
    expect(input.value).toBe('');
    expect(log).toHaveLength(3);
  });

  test('a rounding option of the format rounds the typed number at the blur, before the commit', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { format: { maximumFractionDigits: 2, roundingMode: 'floor' } }),
    });
    await typeAtEnd(input, '1.239');
    input.blur();
    await settle();
    expect(input.value).toBe('1.23');
    expect(log.slice(-3)).toEqual([
      'change 1.23 input-blur',
      'update 1.23',
      'commit 1.23 input-blur',
    ]);
  });

  test('the blur rounds only a number that the user typed: with a parent that keeps its value, or with typed text that is not a number, the blur emits nothing', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { modelValue: 1.23456, format: { maximumFractionDigits: 2 } }),
    });
    await typeAtEnd(input, '7');
    input.blur();
    await settle();
    expect(input.value).toBe('1.23');
    expect(log).toEqual(['change 1.237 input-change', 'update 1.237']);
    log.length = 0;
    input.focus();
    input.select();
    await userEvent.keyboard('-');
    input.blur();
    await settle();
    expect(input.value).toBe('-');
    expect(log).toEqual([]);
  });

  test('a blur after typed edits that give back the value of the focus commits nothing', async () => {
    const log: string[] = [];
    const root = bound(log, 1);
    const { input } = await mountField({ root });
    root.modelValue = 2;
    await nextTick();
    await typeAtEnd(input, '3');
    await userEvent.keyboard('{Backspace}');
    input.blur();
    await settle();
    expect(commits(log)).toEqual([]);
  });

  test('the native change of the text input gives no valueChange', async () => {
    const log: string[] = [];
    const { input } = await mountField({ root: record(log, { defaultValue: 1 }) });
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    expect(log).toEqual([]);
  });
});

describe('steps', () => {
  test('an empty field steps to 0 with no direction; the text is the format at once; Alt gives smallStep and wins over Shift, which gives largeStep; a step from a number has its direction', async () => {
    const log: string[] = [];
    const directions: (number | undefined)[] = [];
    const root = record(log);
    const onValueChange = root.onValueChange as (...args: unknown[]) => void;
    root.onValueChange = (value: number | null, details: NumberFieldRootChangeEventDetails) => {
      directions.push(details.direction);
      onValueChange(value, details);
    };
    const { input } = await mountField({ root });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('0');
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}{Shift>}{ArrowUp}{/Shift}');
    await userEvent.keyboard('{Alt>}{Shift>}{ArrowUp}{/Shift}{/Alt}{ArrowDown}');
    await settle();
    expect(input.value).toBe('9.2');
    expect(commits(log)).toEqual([
      'commit 0 keyboard',
      'commit 0.1 keyboard',
      'commit 10.1 keyboard',
      'commit 10.2 keyboard',
      'commit 9.2 keyboard',
    ]);
    expect(directions).toEqual([undefined, 1, 1, 1, -1]);
  });

  test('an empty field steps to 0 in the range', async () => {
    const { input } = await mountField({ root: { min: 5 } });
    input.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(input.value).toBe('5');
  });

  test('with min, the form accepts the multiples of step from min, and snapOnStep steps to them; with no min the step base follows the value; a format with rounding rounds a step', async () => {
    const root = reactive<Attrs>({ step: 2, min: 1 });
    const { input, hidden } = await mountField({ root });
    await typeAtEnd(input, '4');
    expect(hidden.validity.stepMismatch).toBe(true);
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(input.value).toBe('6');
    expect(hidden.validity.stepMismatch).toBe(true);
    root.snapOnStep = true;
    await nextTick();
    await userEvent.keyboard('{ArrowUp}');
    await settle();
    expect(input.value).toBe('7');
    expect(hidden.validity.stepMismatch).toBe(false);
    root.min = undefined;
    await clear(input);
    await userEvent.keyboard('4.5');
    await settle();
    expect(hidden.validity.stepMismatch).toBe(false);
    const rounded = await mountField({
      root: { defaultValue: 1, smallStep: 0.25, format: { maximumFractionDigits: 1 } },
    });
    rounded.input.focus();
    await userEvent.keyboard('{Alt>}{ArrowUp}{/Alt}');
    await settle();
    expect(rounded.hidden.value).toBe('1.3');
  });

  test.each([
    { name: 'up with no snap', value: 1.5, key: '{ArrowUp}', attrs: {}, expected: '2.5' },
    { name: 'down with no snap', value: 1.5, key: '{ArrowDown}', attrs: {}, expected: '0.5' },
    {
      name: 'up with a snap',
      value: 1.5,
      key: '{ArrowUp}',
      attrs: { snapOnStep: true },
      expected: '2',
    },
    {
      name: 'down with a snap',
      value: 1.5,
      key: '{ArrowDown}',
      attrs: { snapOnStep: true },
      expected: '1',
    },
    {
      name: 'down from min',
      value: 7,
      key: '{ArrowDown}',
      attrs: { snapOnStep: true, step: 5, min: 2 },
      expected: '2',
    },
    {
      name: 'up to max',
      value: 7,
      key: '{ArrowUp}',
      attrs: { snapOnStep: true, step: 5, max: 10 },
      expected: '10',
    },
    {
      name: 'small with a snap',
      value: 1.04,
      key: '{Alt>}{ArrowUp}{/Alt}',
      attrs: { snapOnStep: true },
      expected: '1.1',
    },
  ])('snapOnStep: $name', async ({ value, key, attrs, expected }) => {
    const { input } = await mountField({ root: { defaultValue: value, ...attrs } });
    input.focus();
    await userEvent.keyboard(key);
    await settle();
    expect(input.value).toBe(expected);
  });

  test('ArrowDown steps, Home and End go to min and max; PageUp and PageDown keep their action; with no bound Home keeps its action', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 50, min: 0, max: 100 });
    const { input } = await mountField({ root });
    const prevented: boolean[] = [];
    input.focus();
    await userEvent.keyboard('{ArrowDown}{End}{Home}');
    await settle();
    expect(commits(log)).toEqual([
      'commit 49 keyboard',
      'commit 100 keyboard',
      'commit 0 keyboard',
    ]);
    input.addEventListener('keydown', (event) => {
      if (event.key !== 'Alt') prevented.push(event.defaultPrevented);
    });
    await userEvent.keyboard('{PageUp}{PageDown}{Alt>}{End}{/Alt}');
    root.min = undefined;
    await nextTick();
    await userEvent.keyboard('{Home}');
    await Promise.resolve();
    expect(prevented).toEqual([false, false, false, false]);
    expect(input.value).toBe('0');
  });

  test('a step at a bound does nothing and emits nothing, and the caret does not move; Ctrl keeps the native action; a read-only field does not step', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 10, max: 10 });
    const { input } = await mountField({ root });
    input.focus();
    input.setSelectionRange(1, 1);
    await userEvent.keyboard('{ArrowUp}');
    expect(input.selectionStart).toBe(1);
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}');
    expect(log).toEqual([]);
    root.readonly = true;
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    expect(log).toEqual([]);
  });

  test('a keydown that a listener of the developer prevented does not step', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { defaultValue: 1 }),
      input: { onKeydown: (event: KeyboardEvent) => event.preventDefault() },
    });
    input.focus();
    await userEvent.keyboard('{ArrowUp}');
    expect(log).toEqual([]);
  });

  test('a step after a typed edit starts from the typed number', async () => {
    const { input } = await mountField({ root: { defaultValue: 1 } });
    await typeAtEnd(input, '5');
    await userEvent.keyboard('{ArrowUp}');
    expect(input.value).toBe('16');
  });
});

describe('the buttons', () => {
  test('a mouse press steps once and commits at the release, and its click does not step again; the focus goes to the input with the caret at the end', async () => {
    const log: string[] = [];
    const { input, increment, decrement } = await mountField({
      root: record(log, { defaultValue: 10 }),
    });
    await userEvent.click(increment);
    await settle();
    expect(log).toEqual(['change 11 increment-press', 'update 11', 'commit 11 increment-press']);
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([2, 2]);
    await userEvent.click(decrement);
    await settle();
    expect(log.at(-1)).toBe('commit 10 decrement-press');
  });

  test('a click with no press, from a key or an assistive technology, steps and commits', async () => {
    const log: string[] = [];
    const { increment } = await mountField({ root: record(log, { defaultValue: 1 }) });
    increment.click();
    expect(log).toEqual(['change 2 increment-press', 'update 2', 'commit 2 increment-press']);
  });

  test('a mouse release out of the button leaves the next click to step', async () => {
    const log: string[] = [];
    const { increment } = await mountField({ root: record(log, { defaultValue: 1 }) });
    pointer(increment, 'pointerdown');
    pointer(window, 'pointerup');
    await settle();
    increment.click();
    expect(commits(log)).toEqual(['commit 2 increment-press', 'commit 3 increment-press']);
  });

  test('a held press repeats 460 ms after the press and then each 60 ms, pauses while the pointer is out, and commits once at the release', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const log: string[] = [];
    const { increment, input } = await mountField({ root: record(log, { defaultValue: 0 }) });
    pointer(increment, 'pointerdown');
    expect(input.value).toBe('0');
    await nextTick();
    expect(input.value).toBe('1');
    vi.advanceTimersByTime(459);
    await nextTick();
    expect(input.value).toBe('1');
    vi.advanceTimersByTime(1 + 60 + 60);
    await nextTick();
    expect(input.value).toBe('4');
    pointer(increment, 'pointerleave');
    vi.advanceTimersByTime(120);
    pointer(increment, 'pointerenter');
    vi.advanceTimersByTime(60);
    await nextTick();
    expect(input.value).toBe('5');
    pointer(increment, 'pointerup');
    vi.advanceTimersByTime(600);
    await nextTick();
    expect(input.value).toBe('5');
    expect(commits(log)).toEqual(['commit 5 increment-press']);
  });

  test('Shift and Alt on the press choose the amount; another mouse button does nothing; an ancestor that stops pointerup does not stop the end of the hold', async () => {
    const log: string[] = [];
    const { root, increment } = await mountField({ root: record(log, { defaultValue: 0 }) });
    root.addEventListener('pointerup', (event) => event.stopPropagation(), { capture: true });
    await userEvent.keyboard('{Shift>}');
    await userEvent.click(increment);
    await userEvent.keyboard('{/Shift}');
    pointer(increment, 'pointerdown', { button: 2 });
    pointer(increment, 'pointerup', { button: 2 });
    await userEvent.keyboard('{Alt>}');
    await userEvent.click(increment);
    await userEvent.keyboard('{/Alt}');
    await settle();
    expect(commits(log)).toEqual(['commit 10 increment-press', 'commit 10.1 increment-press']);
  });

  test('a touch press steps at the click of a tap, repeats after 460 ms when held, and does not step after a pointercancel', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const log: string[] = [];
    const { input, increment } = await mountField({ root: record(log, { defaultValue: 0 }) });
    const touch = { pointerType: 'touch' };
    expect(pointer(increment, 'pointerdown', touch).defaultPrevented).toBe(false);
    pointer(increment, 'pointerup', touch);
    vi.advanceTimersByTime(0);
    increment.click();
    await nextTick();
    expect(log).toEqual(['change 1 increment-press', 'update 1', 'commit 1 increment-press']);
    expect(document.activeElement).not.toBe(input);
    log.length = 0;
    pointer(increment, 'pointerdown', touch);
    vi.advanceTimersByTime(459);
    expect(log).toEqual([]);
    vi.advanceTimersByTime(1);
    pointer(increment, 'pointerup', touch);
    increment.click();
    vi.advanceTimersByTime(0);
    await nextTick();
    expect(log).toEqual(['change 2 increment-press', 'update 2', 'commit 2 increment-press']);
    log.length = 0;
    pointer(increment, 'pointerdown', touch);
    pointer(increment, 'pointercancel', touch);
    vi.advanceTimersByTime(1000);
    expect(log).toEqual([]);
  });

  test('a press on a disabled button that is not a native button steps nothing', async () => {
    const { root } = mount(NumberFieldParts, { root: { defaultValue: 1, disabled: true } });
    await nextTick();
    const increment = root.querySelector('div[aria-label=Increase]')!;
    expect(increment).toHaveAttribute('aria-disabled', 'true');
    pointer(increment, 'pointerdown');
    pointer(increment, 'pointerup');
    await settle();
    expect(root.querySelector('output')).toHaveTextContent('1');
  });

  test('a button is disabled at its bound and by its prop; at the bound the repeat stops, and the release commits', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const log: string[] = [];
    const { increment, decrement } = await mountField({
      root: record(log, { defaultValue: 8, max: 10 }),
      decrement: { disabled: true },
    });
    expect(decrement.disabled).toBe(true);
    expect(increment.disabled).toBe(false);
    pointer(increment, 'pointerdown');
    await nextTick();
    vi.advanceTimersByTime(460);
    await nextTick();
    expect(increment.disabled).toBe(true);
    vi.advanceTimersByTime(600);
    pointer(increment, 'pointerup');
    expect(log).toEqual([
      'change 9 increment-press',
      'update 9',
      'change 10 increment-press',
      'update 10',
      'commit 10 increment-press',
    ]);
  });

  test('a hold ends with no commit when the field becomes disabled or read-only, and when the button unmounts', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
    const log: string[] = [];
    const root = record(log, { defaultValue: 0 });
    const parts = reactive({ buttons: true });
    const { root: container } = mount(NumberFields, { root, parts });
    await nextTick();
    const holdUntil = async (end: () => void, restore: () => void) => {
      pointer(container.querySelector('[aria-label=Increase]')!, 'pointerdown');
      end();
      await nextTick();
      vi.advanceTimersByTime(1000);
      pointer(window, 'pointerup');
      restore();
      await nextTick();
    };
    await holdUntil(
      () => (root.readonly = true),
      () => (root.readonly = false),
    );
    await holdUntil(
      () => (root.disabled = true),
      () => (root.disabled = false),
    );
    await holdUntil(
      () => (parts.buttons = false),
      () => (parts.buttons = true),
    );
    expect(log).toEqual([
      'change 1 increment-press',
      'update 1',
      'change 2 increment-press',
      'update 2',
      'change 3 increment-press',
      'update 3',
    ]);
  });
});

describe('the wheel', () => {
  test('with allowWheelScrub, a wheel steps while the input has the focus, and the page does not scroll, also at a bound', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { defaultValue: 9, max: 10, allowWheelScrub: true }),
    });
    expect(wheel(input, { deltaY: -100 }).defaultPrevented).toBe(false);
    input.focus();
    expect(wheel(input, { deltaY: -100 }).defaultPrevented).toBe(true);
    expect(wheel(input, { deltaY: -100 }).defaultPrevented).toBe(true);
    expect(wheel(input, { deltaY: 100, shiftKey: true }).defaultPrevented).toBe(true);
    expect(commits(log)).toEqual(['commit 10 wheel', 'commit 0 wheel']);
  });

  test('a wheel with Ctrl, a horizontal wheel and a wheel with no distance do not step and are not cancelled; with Shift the larger axis gives the direction', async () => {
    const log: string[] = [];
    const { input } = await mountField({
      root: record(log, { defaultValue: 5, allowWheelScrub: true }),
    });
    input.focus();
    const ignored = [
      wheel(input, { deltaY: -100, ctrlKey: true }),
      wheel(input, { deltaX: -100 }),
      wheel(input, {}),
    ];
    expect(ignored.map((event) => event.defaultPrevented)).toEqual([false, false, false]);
    expect(wheel(input, { deltaX: -100, shiftKey: true }).defaultPrevented).toBe(true);
    expect(commits(log)).toEqual(['commit 15 wheel']);
  });

  test('without allowWheelScrub, or in a read-only field, the wheel scrolls the page', async () => {
    const root = reactive<Attrs>({ defaultValue: 5 });
    const { input } = await mountField({ root });
    input.focus();
    expect(wheel(input, { deltaY: -100 }).defaultPrevented).toBe(false);
    Object.assign(root, { allowWheelScrub: true, readonly: true });
    await nextTick();
    expect(wheel(input, { deltaY: -100 }).defaultPrevented).toBe(false);
    expect(input.value).toBe('5');
  });
});

describe('the scrub area', () => {
  test('a mouse press scrubs: one step for each pixelSensitivity px, one valueChange for each move, a move back counts back, and the release commits', async () => {
    const log: string[] = [];
    const { field, input, area } = await mountField({
      root: record(log, { defaultValue: 0 }),
      area: { pixelSensitivity: 4 },
    });
    expect(noSelect(area)).toBe(true);
    input.setSelectionRange(0, 0);
    expect(pointer(area, 'pointerdown', { clientX: 100, clientY: 10 }).defaultPrevented).toBe(true);
    // In each browser, the caret is at the end of the text.
    expect(document.activeElement).toBe(input);
    expect([input.selectionStart, input.selectionEnd]).toEqual([1, 1]);
    await nextTick();
    expect(field).toHaveAttribute('data-scrubbing');
    expect(area).toHaveAttribute('data-scrubbing');
    for (const [clientX, clientY] of [
      [110, 10],
      [106, 10],
      [101, 10],
      [101, 0],
    ]) {
      pointer(window, 'pointermove', { clientX, clientY });
      await nextTick();
    }
    pointer(window, 'pointerup');
    await nextTick();
    expect(field).not.toHaveAttribute('data-scrubbing');
    expect(log).toEqual([
      'change 2 scrub',
      'update 2',
      'change 1 scrub',
      'update 1',
      'commit 1 scrub',
    ]);
    log.length = 0;
    pointer(area, 'pointerdown', { clientX: 0, clientY: 0 });
    pointer(window, 'pointermove', { clientX: 8, clientY: 0 });
    await nextTick();
    pointer(window, 'pointerup');
    expect(log).toEqual(['change 3 scrub', 'update 3', 'commit 3 scrub']);
  });

  test('vertical: a move up steps up; right-to-left: a move to the left steps up; Shift and Alt choose the amount; a pixelSensitivity of 0 counts as 1', async () => {
    const area = reactive<Attrs>({ orientation: 'vertical', pixelSensitivity: 0 });
    const { input, area: element } = await mountField({ root: { defaultValue: 0 }, area });
    const scrub = async (moves: PointerEventInit[]) => {
      pointer(element, 'pointerdown', { clientX: 50, clientY: 50 });
      for (const move of moves) {
        pointer(window, 'pointermove', move);
        await nextTick();
      }
      pointer(window, 'pointerup');
    };
    await scrub([{ clientX: 50, clientY: 47 }]);
    expect(input.value).toBe('3');
    Object.assign(area, { orientation: 'horizontal', dir: 'rtl' });
    await nextTick();
    await scrub([{ clientX: 48, clientY: 50, shiftKey: true }]);
    expect(input.value).toBe('23');
    await scrub([{ clientX: 51, clientY: 50, altKey: true }]);
    expect(input.value).toBe('22.9');
  });

  test('a pointercancel ends the scrub with no commit, and so does an unmount, a disabled and a read-only field; a disabled field starts none', async () => {
    const log: string[] = [];
    const root = record(log, { defaultValue: 0 });
    const parts = reactive({ area: true });
    const { root: container } = mount(NumberFields, { root, area: {}, parts });
    await nextTick();
    const scrubUntil = async (end: () => void, restore: () => void) => {
      const area = container.querySelector('span[role=presentation]')!;
      pointer(area, 'pointerdown', { clientX: 0, clientY: 0 });
      pointer(window, 'pointermove', { clientX: 2, clientY: 0 });
      end();
      await nextTick();
      pointer(window, 'pointermove', { clientX: 10, clientY: 0 });
      pointer(window, 'pointerup');
      restore();
      await nextTick();
    };
    await scrubUntil(
      () => pointer(window, 'pointercancel'),
      () => undefined,
    );
    await scrubUntil(
      () => (parts.area = false),
      () => (parts.area = true),
    );
    await scrubUntil(
      () => (root.readonly = true),
      () => (root.readonly = false),
    );
    expect(commits(log)).toEqual([]);
    expect(log).toHaveLength(6);
    expect(container.querySelector('[data-scrubbing]')).toBeNull();
    root.disabled = true;
    await nextTick();
    const area = container.querySelector('span[role=presentation]')!;
    expect(pointer(area, 'pointerdown').defaultPrevented).toBe(false);
    expect(container.querySelector('[data-scrubbing]')).toBeNull();
  });

  test('a press and a release with no move give a label in the area its click, which focuses the input, and commit nothing', async () => {
    const log: string[] = [];
    const { root } = mount(NumberFieldParts, { root: record(log, { defaultValue: 0 }) });
    await nextTick();
    const label = root.querySelector('label.Area')!;
    let clicks = 0;
    label.addEventListener('click', () => clicks++);
    await userEvent.click(label);
    await settle();
    expect(clicks).toBe(1);
    expect(document.activeElement).toBe(root.querySelector('input.StyledInput'));
    expect(log).toEqual([]);
  });

  test('the area cancels a touchstart of one finger, so the page does not scroll, and not of two fingers or in a read-only field', async () => {
    const root = reactive<Attrs>({ defaultValue: 0 });
    const { area } = await mountField({ root, area: {} });
    const point = { clientX: 1, clientY: 1 };
    const start = async (touches: number) => {
      let prevented = false;
      area.addEventListener('touchstart', (event) => (prevented = event.defaultPrevented), {
        once: true,
      });
      await fireTouch.start(area, { touches: Array.from({ length: touches }, () => point) });
      return prevented;
    };
    expect(await start(1)).toBe(true);
    expect(await start(2)).toBe(false);
    root.readonly = true;
    await nextTick();
    expect(await start(1)).toBe(false);
  });
});

// The case throws in `setup`, so it is the last of the file.
test('a part outside the root throws an error that names the root', () => {
  expect(String(mountError(NumberFieldInputAlone))).toBe(
    'Error: Vase UI NumberField: <NumberField.Input> must be inside <NumberField.Root>.',
  );
  // After the error, Vapor renders the part with no setup, and warns about each binding.
  takeReportedMessages();
});
