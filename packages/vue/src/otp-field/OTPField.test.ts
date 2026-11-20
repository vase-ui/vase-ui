import { describe, expect, inject, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import {
  OTPField,
  type OTPFieldRootChangeEventDetails,
  type OTPFieldRootCompleteEventDetails,
  type OTPFieldRootInvalidEventDetails,
} from '@vase-ui/vue/otp-field';
import { pasteText } from '../../test/clipboard';
import { dataAttributes, leave, recordValidate } from '../../test/field';
import OTPFieldInForm from '../../test/fixtures/OTPFieldInForm.vue';
import OTPFieldInputAlone from '../../test/fixtures/OTPFieldInputAlone.vue';
import OTPFieldInToolbar from '../../test/fixtures/OTPFieldInToolbar.vue';
import OTPFieldLayouts from '../../test/fixtures/OTPFieldLayouts.vue';
import OTPFieldParts from '../../test/fixtures/OTPFieldParts.vue';
import OTPFields from '../../test/fixtures/OTPFields.vue';
import { mount, mountError, settle, submitsPrevented } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';

type Props = {
  root?: Record<string, unknown>;
  inputs?: Record<string, unknown>[];
  field?: Record<string, unknown>;
  labelAfter?: boolean;
  formAttrs?: Record<string, unknown>;
  around?: boolean;
  submit?: boolean;
  fieldsetDisabled?: boolean;
  label?: boolean;
};

async function mountField(props: Props = {}) {
  const { root, exposed } = mount(OTPFields, props);
  await nextTick();
  const group = root.querySelector<HTMLElement>('[role=group]')!;
  const slots = [...group.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')];
  return {
    root,
    exposed,
    group,
    slots,
    formInput: group.querySelector<HTMLInputElement>('input[aria-hidden]')!,
    form: root.querySelector('form')!,
    values: () => slots.map((slot) => slot.value),
    focused: () => slots.indexOf(document.activeElement as HTMLInputElement),
    tabStops: () => slots.flatMap((slot, index) => (slot.tabIndex === 0 ? [index] : [])),
  };
}

/** Root attributes that write each event of the root in `log`. */
function recorded(log: string[], attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onValueChange: (value: string, details: OTPFieldRootChangeEventDetails) =>
      log.push(`change ${value} ${details.reason}`),
    'onUpdate:modelValue': (value: string) => log.push(`update ${value}`),
    onValueInvalid: (value: string, details: OTPFieldRootInvalidEventDetails) =>
      log.push(`invalid ${value} ${details.reason}`),
    onValueComplete: (value: string, details: OTPFieldRootCompleteEventDetails) =>
      log.push(`complete ${value} ${details.reason}`),
    ...attrs,
  });
}

/** `v-model` on the root, with the events in `log`. With `write: false`, the parent keeps its value. */
function model(modelValue: string, log: string[], write = true) {
  const attrs = recorded(log, { modelValue });
  attrs['onUpdate:modelValue'] = (value: string) => {
    log.push(`update ${value}`);
    if (write) attrs.modelValue = value;
  };
  return attrs;
}

/** Gives the slot the focus and the text, and sends `input` as the browser does for a key. */
async function type(slot: HTMLInputElement, text: string, inputType = 'insertText') {
  slot.focus();
  slot.value = text;
  slot.dispatchEvent(new InputEvent('input', { bubbles: true, inputType, data: text }));
  await settle();
}

async function paste(slot: HTMLInputElement, text: string) {
  slot.focus();
  await pasteText(slot, text);
  await settle();
}

async function press(slot: HTMLInputElement, key: string) {
  slot.focus();
  await userEvent.keyboard(key);
  await settle();
}

/** Sends a key with Ctrl or Meta. A real Meta key can start a shortcut of the browser. */
async function pressWith(modifier: 'ctrlKey' | 'metaKey', slot: HTMLInputElement, key: string) {
  slot.focus();
  slot.dispatchEvent(
    new KeyboardEvent('keydown', { key, [modifier]: true, bubbles: true, cancelable: true }),
  );
  await settle();
}

const selection = (slot: HTMLInputElement) => [slot.selectionStart, slot.selectionEnd];

test('the project compiles OTP Field and the fixtures in the modes of its app', () => {
  const app = inject('app');
  // The compiler of Vue marks a Vapor component with `__vapor`.
  const isVapor = (component: object) => '__vapor' in component;
  expect(isVapor(OTPField.Root)).toBe(app === 'vapor' || app === 'vdom-interop');
  expect(isVapor(OTPFields)).toBe(app.startsWith('vapor'));
});

describe('the elements', () => {
  test('the root is a div with role group, and its last child is the form input; a template ref has the group', async () => {
    const { root, exposed, group, slots, formInput } = await mountField({
      root: { id: 'code' },
    });
    expect(root.querySelector('fieldset')!.children[0]).toBe(group);
    expect(group.tagName).toBe('DIV');
    expect(group.lastElementChild).toBe(formInput);
    expect(exposed.root.element).toBe(group);
    expect(dataAttributes(group)).toEqual([]);
    expect(slots).toHaveLength(6);
    expect(formInput).toHaveAttribute('type', 'text');
    expect(formInput).toHaveAttribute('id', 'code-hidden-input');
    expect(formInput).toHaveAttribute('aria-hidden', 'true');
    expect(formInput).toHaveAttribute('tabindex', '-1');
    expect(formInput).toHaveAttribute('autocomplete', 'one-time-code');
    expect(formInput).toHaveAttribute('inputmode', 'numeric');
    expect(formInput).toHaveAttribute('maxlength', '6');
    expect(formInput).toHaveAttribute('pattern', '\\d{6}');
    expect(formInput).not.toHaveAttribute('name');
    // The browser shows its message of a constraint at the input, so it keeps a size.
    expect(formInput.getBoundingClientRect()).toMatchObject({ width: 1, height: 1 });
  });

  test('each slot is a text input with the attributes of its place; the first slot has the id, autocomplete and maxlength', async () => {
    const { slots, exposed } = await mountField({ root: { id: 'code' } });
    expect(slots.map((slot) => slot.id)).toEqual([
      'code',
      'code-2',
      'code-3',
      'code-4',
      'code-5',
      'code-6',
    ]);
    expect(slots.map((slot) => slot.getAttribute('autocomplete'))).toEqual([
      'one-time-code',
      'off',
      'off',
      'off',
      'off',
      'off',
    ]);
    expect(slots.map((slot) => slot.getAttribute('maxlength'))).toEqual([
      '6',
      null,
      null,
      null,
      null,
      null,
    ]);
    for (const slot of slots) {
      expect(slot).toHaveAttribute('type', 'text');
      expect(slot).toHaveAttribute('inputmode', 'numeric');
      expect(slot).toHaveAttribute('autocorrect', 'off');
      expect(slot).toHaveAttribute('spellcheck', 'false');
      expect(slot).not.toHaveAttribute('name');
      expect(slot).not.toHaveAttribute('pattern');
      expect(dataAttributes(slot)).toEqual([]);
    }
    expect(exposed.inputs.map((part: { element: Element }) => part.element)).toEqual(slots);
  });

  test('the attributes and the listeners of the developer reach the group and each slot, and win', async () => {
    const onKeydown = vi.fn();
    const { group, slots } = await mountField({
      root: {
        class: 'Code',
        'data-test': 'code',
        'aria-describedby': 'help',
        onKeydown,
        autocomplete: 'off',
        inputmode: 'text',
      },
      inputs: [
        { type: 'password', autocomplete: 'one-time-code', 'aria-label': 'First' },
        { autocorrect: 'on', 'aria-label': 'Second' },
      ],
    });
    expect(group).toHaveAttribute('class', 'Code');
    expect(group).toHaveAttribute('data-test', 'code');
    expect(group).toHaveAttribute('aria-describedby', 'help');
    expect(slots[0]).toHaveAttribute('type', 'password');
    expect(slots[0]).toHaveAttribute('autocomplete', 'one-time-code');
    expect(slots[0]).toHaveAttribute('aria-label', 'First');
    expect(slots[1]).toHaveAttribute('autocorrect', 'on');
    expect(slots[1]!.getAttributeNames().filter((name) => name === 'autocorrect')).toHaveLength(1);
    expect(slots[1]).toHaveAttribute('inputmode', 'text');
    await press(slots[0]!, '1');
    expect(onKeydown).toHaveBeenCalledTimes(1);
  });

  test('the element slots render the elements of the developer; the form input follows the element of the root', async () => {
    const { root, exposed } = mount(OTPFieldParts, { root: { defaultValue: '12' } });
    await nextTick();
    const section = root.querySelector('section')!;
    const [first, second] = section.querySelectorAll('input');
    expect(section).toHaveAttribute('role', 'group');
    expect(section).toHaveAttribute('data-code', '12');
    expect(section.nextElementSibling).toHaveAttribute('aria-hidden', 'true');
    expect(exposed.root.element).toBe(section);
    expect(exposed.first.element).toBe(first);
    expect(exposed.second.element).toBe(second);
    expect(first).toHaveAttribute('data-index', '0');
    expect(second).toHaveClass('StyledInput');
    expect([first!.value, second!.value]).toEqual(['1', '2']);
    expect(second).toHaveAttribute('tabindex', '0');
  });

  test('`as` renders another element with the parts in it', async () => {
    const { group } = await mountField({ root: { as: 'fieldset' } });
    expect(group.tagName).toBe('FIELDSET');
    expect(group.querySelectorAll('input')).toHaveLength(7);
  });

  test('OTPField.Separator is a separator', async () => {
    const { root } = mount(OTPFieldLayouts, { root: { length: 6 }, scene: { count: 6 } });
    await nextTick();
    expect(root.querySelector('[role=separator]')).toHaveAttribute(
      'aria-orientation',
      'horizontal',
    );
  });
});

describe('the code and v-model', () => {
  test.each([
    { name: 'the default value', root: { defaultValue: '12a34b56c7' } },
    { name: 'the model', root: { modelValue: '12a34b56c7' } },
  ])('$name takes the type and the length, with no event', async ({ root }) => {
    const log: string[] = [];
    const { values, formInput, group } = await mountField({ root: recorded(log, root) });
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(formInput.value).toBe('123456');
    expect(group).toHaveAttribute('data-complete');
    expect(group).toHaveAttribute('data-filled');
    expect(log).toEqual([]);
  });

  test('the normalizer runs after the filter of the type, and the filter runs again on its result', async () => {
    const { formInput } = await mountField({
      root: {
        validationType: 'alphanumeric',
        normalizeValue: (value: string) => `${value.toUpperCase()}-!`,
        defaultValue: 'a1-b2',
      },
    });
    expect(formInput.value).toBe('A1B2');
  });

  test('v-model follows in both directions; update:modelValue comes after valueChange, and not after a cancel', async () => {
    const log: string[] = [];
    const root = model('1', log);
    const { slots, values } = await mountField({ root });
    await type(slots[1]!, '2');
    expect(log).toEqual(['change 12 input-change', 'update 12']);
    expect(root.modelValue).toBe('12');
    root.modelValue = '45';
    await nextTick();
    expect(values()).toEqual(['4', '5', '', '', '', '']);
    root.onValueChange = (_: string, details: OTPFieldRootChangeEventDetails) => details.cancel();
    await nextTick();
    await type(slots[2]!, '6');
    expect(values()).toEqual(['4', '5', '', '', '', '']);
    expect(slots[2]).toHaveFocus();
  });

  test('a controlled root shows its code again when the parent keeps its value; undefined keeps the code', async () => {
    const log: string[] = [];
    const root = model('1', log, false);
    const { slots, values, formInput } = await mountField({ root });
    await type(slots[1]!, '2');
    expect(log).toEqual(['change 12 input-change', 'update 12']);
    expect(values()).toEqual(['1', '', '', '', '', '']);
    expect(formInput.value).toBe('1');
    expect(slots[1]).toHaveFocus();
    root.modelValue = undefined;
    await nextTick();
    expect(values()).toEqual(['1', '', '', '', '', '']);
    await type(slots[1]!, '2');
    expect(values()).toEqual(['1', '2', '', '', '', '']);
  });

  test('a code that the field has gives no valueChange', async () => {
    const log: string[] = [];
    const { slots } = await mountField({ root: recorded(log, { defaultValue: '12' }) });
    await type(slots[1]!, '2', 'insertReplacementText');
    expect(log).toEqual([]);
  });
});

describe('typed text', () => {
  test('a character moves the focus to the next slot; a text of several characters fills the slots from that slot on', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { defaultValue: '123456' }),
    });
    await type(slots[2]!, '99');
    expect(values()).toEqual(['1', '2', '9', '9', '5', '6']);
    expect(focused()).toBe(4);
    expect(selection(slots[4]!)).toEqual([0, 1]);
    expect(log).toEqual(['change 129956 input-change', 'update 129956']);
    await type(slots[5]!, '7');
    expect(focused()).toBe(5);
  });

  test.each([
    { name: 'alpha', validationType: 'alpha', text: 'aB', refused: '1' },
    { name: 'alphanumeric', validationType: 'alphanumeric', text: 'a1', refused: '-' },
    { name: 'none', validationType: 'none', text: '-!', refused: ' ' },
  ])('the type $name takes its characters', async ({ validationType, text }) => {
    const { slots, values, formInput, group } = await mountField({ root: { validationType } });
    await type(slots[0]!, text);
    expect(values().join('')).toBe(text);
    expect(formInput.inputMode).toBe(validationType === 'none' ? '' : 'text');
    expect(slots[0]!.inputMode).toBe(validationType === 'none' ? '' : 'text');
    expect(group).toHaveAttribute('data-filled');
  });

  test('the key of the character that a slot has moves the focus to the next slot, with no change', async () => {
    const log: string[] = [];
    const { slots, focused } = await mountField({ root: recorded(log, { defaultValue: '12' }) });
    await userEvent.click(slots[0]!);
    await userEvent.keyboard('1');
    await settle();
    expect(focused()).toBe(1);
    expect(log).toEqual([]);
  });

  test('a refused character emits valueInvalid and changes nothing; a filled slot keeps its character, selected', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { defaultValue: '12' }),
    });
    await type(slots[1]!, 'x');
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(focused()).toBe(1);
    expect(selection(slots[1]!)).toEqual([0, 1]);
    expect(log).toEqual(['invalid x input-change']);
  });

  test('valueInvalid comes one time before valueChange, with the text of the user', async () => {
    const log: string[] = [];
    const { slots } = await mountField({
      root: recorded(log, {
        validationType: 'alphanumeric',
        normalizeValue: (value: string) => value.replaceAll('0', ''),
      }),
    });
    await type(slots[0]!, 'a-0b');
    expect(log).toEqual(['invalid a-0b input-change', 'change ab input-change', 'update ab']);
  });

  test('VUE-144: keeps a supplementary character in one slot during entry, paste and deletion', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { validationType: 'none' }),
      inputs: [{}, {}],
    });
    await type(slots[0]!, '𠮷');
    expect(values()).toEqual(['𠮷', '']);
    expect(slots[0]!.maxLength).toBe(4);
    expect(focused()).toBe(1);
    await paste(slots[1]!, 'A');
    expect(values()).toEqual(['𠮷', 'A']);
    await press(slots[0]!, '{Delete}');
    expect(values()).toEqual(['A', '']);
    expect(log.filter((entry) => entry.startsWith('complete'))).toEqual([
      'complete 𠮷A input-paste',
    ]);
  });

  test('an input event that empties a slot removes its character with input-clear; the later characters move and the focus stays', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { defaultValue: '123' }),
    });
    await type(slots[1]!, '', 'deleteContentBackward');
    expect(values()).toEqual(['1', '3', '', '', '', '']);
    expect(focused()).toBe(1);
    expect(log).toEqual(['change 13 input-clear', 'update 13']);
  });
});

describe('paste', () => {
  test('writes the text from the slot on with one valueChange, and moves the focus after its last character', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { defaultValue: '12' }),
    });
    await paste(slots[2]!, ' 3-4 ');
    expect(values()).toEqual(['1', '2', '3', '4', '', '']);
    expect(focused()).toBe(4);
    expect(log).toEqual(['invalid  3-4  input-paste', 'change 1234 input-paste', 'update 1234']);
  });

  test('a cancelled paste keeps the code and the focus; a paste with no accepted character changes nothing', async () => {
    const log: string[] = [];
    const root = recorded(log, {
      onValueChange: (value: string, details: OTPFieldRootChangeEventDetails) => {
        log.push(`change ${value}`);
        details.cancel();
      },
    });
    const { slots, values, focused } = await mountField({ root });
    await paste(slots[0]!, '123456');
    expect(values()).toEqual(['', '', '', '', '', '']);
    expect(focused()).toBe(0);
    await paste(slots[0]!, 'abc');
    expect(log).toEqual(['change 123456', 'invalid abc input-paste']);
  });
});

describe('Backspace and Delete', () => {
  test('Backspace removes the character of a filled slot, or the one before an empty slot, and moves the focus to the slot before', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({
      root: recorded(log, { defaultValue: '123' }),
    });
    await press(slots[1]!, '{Backspace}');
    expect(values()).toEqual(['1', '3', '', '', '', '']);
    expect(focused()).toBe(0);
    await press(slots[2]!, '{Backspace}');
    expect(values()).toEqual(['1', '', '', '', '', '']);
    expect(focused()).toBe(1);
    expect(log).toEqual(['change 13 keyboard', 'update 13', 'change 1 keyboard', 'update 1']);
  });

  test('Delete removes the character of the slot and keeps the focus', async () => {
    const { slots, values, focused } = await mountField({ root: { defaultValue: '123' } });
    await press(slots[0]!, '{Delete}');
    expect(values()).toEqual(['2', '3', '', '', '', '']);
    expect(focused()).toBe(0);
  });

  test.each(['ctrlKey', 'metaKey'] as const)(
    '%s and Backspace clear the code and focus the first slot',
    async (modifier) => {
      const { slots, values, focused } = await mountField({ root: { defaultValue: '123' } });
      await pressWith(modifier, slots[2]!, 'Backspace');
      expect(values()).toEqual(['', '', '', '', '', '']);
      expect(focused()).toBe(0);
    },
  );

  test('Backspace in the empty first slot and Delete in an empty slot emit nothing; a cancelled deletion keeps the code and the focus', async () => {
    const log: string[] = [];
    const root = recorded(log);
    const { slots, values, focused } = await mountField({ root });
    await press(slots[0]!, '{Backspace}');
    await press(slots[0]!, '{Delete}');
    expect(log).toEqual([]);
    await type(slots[0]!, '1');
    log.length = 0;
    root.onValueChange = (_: string, details: OTPFieldRootChangeEventDetails) => details.cancel();
    await nextTick();
    await press(slots[1]!, '{Backspace}');
    expect(values()).toEqual(['1', '', '', '', '', '']);
    expect(focused()).toBe(1);
  });
});

describe('the keys that move the focus', () => {
  test('the arrows move one slot, not past the end slot; Home, End, ArrowUp and ArrowDown go to the first and the end slot', async () => {
    const { slots, focused } = await mountField({ root: { defaultValue: '12' } });
    const steps: number[] = [];
    slots[0]!.focus();
    for (const key of [
      '{ArrowRight}',
      '{ArrowRight}',
      '{ArrowRight}',
      '{ArrowLeft}',
      '{Home}',
      '{End}',
      '{ArrowUp}',
      '{ArrowDown}',
    ]) {
      await userEvent.keyboard(key);
      steps.push(focused());
    }
    expect(steps).toEqual([1, 2, 2, 1, 0, 2, 0, 2]);
  });

  test.each(['ctrlKey', 'metaKey'] as const)(
    '%s and an arrow go to the first and the end slot',
    async (modifier) => {
      const { slots, focused } = await mountField({ root: { defaultValue: '123' } });
      await pressWith(modifier, slots[1]!, 'ArrowRight');
      expect(focused()).toBe(3);
      await pressWith(modifier, slots[3]!, 'ArrowLeft');
      expect(focused()).toBe(0);
    },
  );

  test('in right-to-left, ArrowLeft goes to the next slot; the slot reads the direction of its element', async () => {
    const { slots, focused } = await mountField({ root: { defaultValue: '12', dir: 'rtl' } });
    await press(slots[0]!, '{ArrowLeft}');
    expect(focused()).toBe(1);
    await press(slots[1]!, '{ArrowRight}');
    expect(focused()).toBe(0);
  });

  test('a handled key is prevented and reaches an ancestor', async () => {
    const { slots, root } = await mountField({ root: { defaultValue: '12' } });
    const keys: string[] = [];
    root.addEventListener('keydown', (event) =>
      keys.push(`${event.key} ${event.defaultPrevented}`),
    );
    await press(slots[0]!, '{ArrowDown}');
    await press(slots[2]!, '{Tab}');
    expect(keys).toEqual(['ArrowDown true', 'Tab false']);
  });

  test('a read-only field keeps the keys that move the focus; no key, paste or text changes its code', async () => {
    const log: string[] = [];
    const { slots, values, focused, group } = await mountField({
      root: recorded(log, { defaultValue: '12', readonly: true }),
    });
    expect(group).toHaveAttribute('data-readonly');
    expect(slots.every((slot) => slot.readOnly && slot.matches(':read-only'))).toBe(true);
    await press(slots[0]!, '{ArrowRight}');
    expect(focused()).toBe(1);
    await press(slots[1]!, '{Backspace}');
    await press(slots[1]!, '{Delete}');
    await paste(slots[1]!, '99');
    await type(slots[1]!, '9');
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(log).toEqual([]);
  });
});

describe('Enter', () => {
  test('with a submit button, the browser clicks it', async () => {
    const { slots, form } = await mountField({ submit: true });
    const log: string[] = [];
    form.addEventListener('click', () => log.push('click'));
    form.addEventListener('submit', () => log.push('submit'));
    await press(slots[0]!, '{Enter}');
    expect(log).toEqual(['click', 'submit']);
  });

  test('with no submit button, the root submits the form, as Enter in one text input does; an incomplete code blocks it', async () => {
    const root = reactive<Record<string, unknown>>({ defaultValue: '123456' });
    const { slots, form, focused } = await mountField({ root });
    const log: string[] = [];
    form.addEventListener('submit', () => log.push('submit'));
    await press(slots[1]!, '{Enter}');
    expect(log).toEqual(['submit']);
    await press(slots[5]!, '{Backspace}');
    await press(slots[1]!, '{Enter}');
    expect(log).toEqual(['submit']);
    expect(focused()).toBe(5);
  });

  test('with no submit button and another text input in the form, Enter submits nothing', async () => {
    const { slots, form } = await mountField({ around: true });
    const log: string[] = [];
    form.addEventListener('submit', () => log.push('submit'));
    await press(slots[0]!, '{Enter}');
    expect(log).toEqual([]);
  });

  test('Enter in a composition, and the key 229 after it, submit nothing', async () => {
    const { slots, form } = await mountField();
    const log: string[] = [];
    form.addEventListener('submit', () => log.push('submit'));
    const slot = slots[0]!;
    slot.focus();
    slot.dispatchEvent(new CompositionEvent('compositionstart'));
    slot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    slot.dispatchEvent(new CompositionEvent('compositionend'));
    slot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', keyCode: 229, bubbles: true }));
    await settle();
    expect(log).toEqual([]);
  });
});

describe('the focus and the tab stop', () => {
  test('the end slot is the tab stop; Tab leaves the field and Shift+Tab comes back to the end slot', async () => {
    const { root, slots, focused, tabStops } = await mountField({
      root: { defaultValue: '123' },
      around: true,
    });
    expect(tabStops()).toEqual([3]);
    root.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe(3);
    await userEvent.keyboard('{ArrowLeft}');
    expect(tabStops()).toEqual([2]);
    await userEvent.tab();
    expect(document.activeElement).toBe(root.querySelector('#after'));
    expect(tabStops()).toEqual([3]);
    await userEvent.tab({ shift: true });
    expect(focused()).toBe(3);
    expect(slots[3]).toHaveFocus();
  });

  test('a click selects the character; a second click on the same slot selects it again; a click after the end slot goes to the end slot', async () => {
    const { slots, focused } = await mountField({ root: { defaultValue: '123' } });
    await userEvent.click(slots[1]!);
    expect(focused()).toBe(1);
    expect(selection(slots[1]!)).toEqual([0, 1]);
    await userEvent.click(slots[1]!);
    expect(selection(slots[1]!)).toEqual([0, 1]);
    await userEvent.keyboard('9');
    await settle();
    expect(slots.map((slot) => slot.value)).toEqual(['1', '9', '3', '', '', '']);
    await userEvent.click(slots[5]!);
    expect(focused()).toBe(3);
  });

  test('a focus on a slot after the end slot goes to the end slot', async () => {
    const { slots, focused } = await mountField({ root: { defaultValue: '1' } });
    slots[4]!.focus();
    expect(focused()).toBe(1);
  });

  test('when the parent shortens the code, a focused slot after the new end slot gives the focus to it; an earlier slot and a focus outside stay', async () => {
    const root = reactive<Record<string, unknown>>({ modelValue: '12345' });
    const { slots, focused } = await mountField({ root, around: true });
    slots[4]!.focus();
    root.modelValue = '12';
    await settle();
    expect(focused()).toBe(2);
    slots[1]!.focus();
    root.modelValue = '';
    await settle();
    expect(focused()).toBe(0);
    root.modelValue = '123';
    await settle();
    slots[1]!.focus();
    root.modelValue = '12';
    await settle();
    expect(focused()).toBe(1);
    const before = document.querySelector<HTMLElement>('#before')!;
    before.focus();
    root.modelValue = '';
    await settle();
    expect(document.activeElement).toBe(before);
  });

  test('a focused slot that a v-if removes does not touch the field, and the end slot becomes the tab stop', async () => {
    const inputs = reactive([{}, {}, {}, {}, {}, {}]);
    const { group } = await mountField({ root: { defaultValue: '12345' }, inputs, field: {} });
    const slots = () => [...group.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')];
    slots()[5]!.focus();
    inputs.pop();
    await settle();
    await settle();
    expect(group).not.toHaveAttribute('data-touched');
    expect(slots().map((slot) => slot.tabIndex)).toEqual([-1, -1, -1, -1, 0]);
  });

  test('a focused field that becomes disabled and then enabled has the end slot as its tab stop', async () => {
    const root = reactive<Record<string, unknown>>({ defaultValue: '123' });
    const { slots, focused, tabStops } = await mountField({ root, around: true });
    await press(slots[3]!, '{ArrowLeft}');
    expect(focused()).toBe(2);
    root.disabled = true;
    await settle();
    root.disabled = false;
    await settle();
    expect(tabStops()).toEqual([3]);
    document.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe(3);
  });

  test('the form input gives the focus to the end slot, as when a form finds the code invalid', async () => {
    const { form, focused } = await mountField({ root: { defaultValue: '12' } });
    form.reportValidity();
    expect(focused()).toBe(2);
  });
});

describe('a composition', () => {
  async function compose(slot: HTMLInputElement, text: string, inputAfterEnd: boolean) {
    slot.focus();
    slot.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    slot.value = text;
    const input = () =>
      slot.dispatchEvent(
        new InputEvent('input', { bubbles: true, inputType: 'insertCompositionText', data: text }),
      );
    if (!inputAfterEnd) input();
    slot.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: text }));
    // A browser runs the microtasks after each event that it sends.
    await settle();
    if (inputAfterEnd) input();
    await settle();
  }

  test.each([false, true])(
    'an accepted composition gives one change and moves the focus (input after compositionend: %s)',
    async (inputAfterEnd) => {
      const log: string[] = [];
      const { slots, values, focused } = await mountField({ root: recorded(log) });
      await compose(slots[0]!, '1a', inputAfterEnd);
      expect(values()).toEqual(['1', '', '', '', '', '']);
      expect(focused()).toBe(1);
      expect(log).toEqual(['invalid 1a input-change', 'change 1 input-change', 'update 1']);
    },
  );

  test.each([false, true])(
    'a refused composition in a filled slot changes nothing and keeps the focus (input after compositionend: %s)',
    async (inputAfterEnd) => {
      const log: string[] = [];
      const { slots, values, focused } = await mountField({
        root: recorded(log, { defaultValue: '12' }),
      });
      await compose(slots[1]!, 'あ', inputAfterEnd);
      expect(values()).toEqual(['1', '2', '', '', '', '']);
      expect(focused()).toBe(1);
      expect(log).toEqual(['invalid あ input-change']);
    },
  );

  test('a slot ignores the keys during a composition, and takes the type of the moment at its end', async () => {
    const log: string[] = [];
    const root = recorded(log, { defaultValue: '12' });
    const { slots, values } = await mountField({ root });
    const slot = slots[2]!;
    slot.focus();
    slot.dispatchEvent(new CompositionEvent('compositionstart'));
    slot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    root.validationType = 'alpha';
    await nextTick();
    slot.value = 'a';
    slot.dispatchEvent(new CompositionEvent('compositionend'));
    await settle();
    expect(log).toEqual(['change a input-change', 'update a']);
    expect(values()).toEqual(['a', '', '', '', '', '']);
  });
});

describe('a fill', () => {
  test('a code that autofill writes into the first slot fills each slot', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({ root: recorded(log) });
    await type(slots[0]!, '123456', 'insertReplacementText');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(focused()).toBe(5);
    expect(log).toEqual([
      'change 123456 input-change',
      'update 123456',
      'complete 123456 input-change',
    ]);
  });

  test('a fill of the form input replaces the code, with valueInvalid and valueComplete; the focus moves only when the field has it', async () => {
    const log: string[] = [];
    const { slots, formInput, values, focused, root } = await mountField({
      root: recorded(log, { defaultValue: '9' }),
      around: true,
    });
    const before = root.querySelector<HTMLElement>('#before')!;
    before.focus();
    const fill = async (text: string) => {
      formInput.value = text;
      formInput.dispatchEvent(new Event('input', { bubbles: true }));
      await settle();
    };
    await fill('12 34');
    expect(values()).toEqual(['1', '2', '3', '4', '', '']);
    expect(document.activeElement).toBe(before);
    slots[0]!.focus();
    await fill('12x3456');
    expect(focused()).toBe(5);
    await fill('');
    expect(focused()).toBe(0);
    expect(log).toEqual([
      'change 1234 input-change',
      'update 1234',
      'invalid 12x3456 input-change',
      'change 123456 input-change',
      'update 123456',
      'complete 123456 input-change',
      'change  input-change',
      'update ',
    ]);
  });

  test.each(['readonly', 'disabled'])(
    'a fill of a %s field changes nothing, and the inputs show the code again',
    async (lock) => {
      const log: string[] = [];
      const { slots, formInput, values } = await mountField({
        root: recorded(log, { defaultValue: '12', [lock]: true }),
      });
      formInput.value = '999999';
      formInput.dispatchEvent(new Event('input', { bubbles: true }));
      slots[0]!.value = '9';
      slots[0]!.dispatchEvent(new InputEvent('input', { bubbles: true }));
      await settle();
      expect(formInput.value).toBe('12');
      expect(values()).toEqual(['1', '2', '', '', '', '']);
      expect(log).toEqual([]);
    },
  );
});

describe('valueComplete', () => {
  test('comes after valueChange and update:modelValue when typed text completes the code, with the code in the form input', async () => {
    const log: string[] = [];
    const root = recorded(log, { defaultValue: '12345' });
    root.onValueComplete = (value: string, details: OTPFieldRootCompleteEventDetails) => {
      log.push(`complete ${value} ${details.reason} ${formInput.value}`);
      expect(details.event.type).toBe('input');
    };
    const { slots, formInput } = await mountField({ root });
    await type(slots[5]!, '6');
    await type(slots[5]!, '7');
    await press(slots[5]!, '{Backspace}');
    await type(slots[5]!, '8');
    expect(log).toEqual([
      'change 123456 input-change',
      'update 123456',
      'complete 123456 input-change 123456',
      'change 123457 input-change',
      'update 123457',
      'change 12345 keyboard',
      'update 12345',
      'change 123458 input-change',
      'update 123458',
      'complete 123458 input-change 123458',
    ]);
  });

  test('a complete paste completes the code each time, also with the code of the field; a paste in a later slot too', async () => {
    const log: string[] = [];
    const { slots } = await mountField({ root: recorded(log, { defaultValue: '12' }) });
    await paste(slots[2]!, '3456');
    await paste(slots[0]!, '654321');
    await paste(slots[0]!, '654321');
    expect(log.filter((entry) => entry.startsWith('complete'))).toEqual([
      'complete 123456 input-paste',
      'complete 654321 input-paste',
      'complete 654321 input-paste',
    ]);
  });

  test('does not come for a cancelled change, a value of the parent or a reset', async () => {
    const log: string[] = [];
    const root = model('', log);
    root.onValueChange = (_: string, details: OTPFieldRootChangeEventDetails) => details.cancel();
    const { slots, form } = await mountField({ root });
    await paste(slots[0]!, '123456');
    root.modelValue = '654321';
    await settle();
    form.reset();
    await settle();
    expect(log.filter((entry) => entry.startsWith('complete'))).toEqual([]);
  });

  test('a parent that writes the code later gets the focus move and valueComplete; a parent that writes another code gets none', async () => {
    const log: string[] = [];
    const root = model('', log, false);
    const { slots, focused } = await mountField({ root });
    await paste(slots[0]!, '123456');
    expect(focused()).toBe(0);
    root.modelValue = '123456';
    await settle();
    expect(focused()).toBe(5);
    expect(log.at(-1)).toBe('complete 123456 input-paste');
    root.modelValue = '';
    await settle();
    log.length = 0;
    await type(slots[0]!, '111111');
    root.modelValue = '654321';
    await settle();
    expect(log.filter((entry) => entry.startsWith('complete'))).toEqual([]);
    expect(focused()).toBe(0);
  });
});

describe('autoSubmit', () => {
  test('submits the form around after valueComplete, with the code in its data; not before the code is complete, and not without autoSubmit', async () => {
    const log: string[] = [];
    const root = recorded(log, { name: 'code', autoSubmit: true });
    const { slots, form } = await mountField({ root });
    form.addEventListener('submit', () =>
      log.push(`submit ${String(new FormData(form).get('code'))}`),
    );
    await type(slots[0]!, '12345');
    expect(log.filter((entry) => entry.startsWith('submit'))).toEqual([]);
    await type(slots[5]!, '6');
    expect(log.slice(-2)).toEqual(['complete 123456 input-change', 'submit 123456']);
    root.autoSubmit = false;
    await paste(slots[0]!, '654321');
    expect(log.at(-1)).toBe('complete 654321 input-paste');
  });

  test('submits the form that `form` names, and none when `form` names no form', async () => {
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other';
    const log: string[] = [];
    other.addEventListener('submit', () => log.push('other'));
    try {
      const root = reactive<Record<string, unknown>>({ autoSubmit: true, form: 'other' });
      const { slots, form, formInput } = await mountField({ root });
      form.addEventListener('submit', () => log.push('around'));
      expect(formInput.form).toBe(other);
      expect(slots.every((slot) => slot.form === other)).toBe(true);
      await paste(slots[0]!, '123456');
      root.form = 'missing';
      await settle();
      await paste(slots[0]!, '654321');
      expect(log).toEqual(['other']);
    } finally {
      other.remove();
    }
  });

  test('a Form validates at the submit: an invalid field blocks it and takes the focus', async () => {
    const validate = vi.fn((value: unknown) => (value === '123456' ? null : 'Wrong code'));
    const { root } = mount(OTPFieldInForm, {
      field: { name: 'code', validate },
      root: { autoSubmit: true },
    });
    await nextTick();
    const slots = [...root.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')];
    await paste(slots[0]!, '654321');
    await settle();
    expect(validate).toHaveBeenLastCalledWith('654321', expect.anything());
    expect(submitsPrevented).toEqual([true]);
    expect(root.querySelector('#error')).toHaveTextContent('Wrong code');
    expect(slots[5]).toHaveFocus();
  });
});

describe('disabled and read-only', () => {
  test.each([
    { name: 'the prop', root: { disabled: true } },
    { name: 'the field', field: { disabled: true } },
  ])(
    'disabled by $name: each slot and the form input are disabled, and no source changes the code',
    async ({ root = {}, field }) => {
      const log: string[] = [];
      const { group, slots, formInput, values } = await mountField({
        root: recorded(log, { defaultValue: '12', ...root }),
        field,
      });
      expect(group).toHaveAttribute('data-disabled');
      expect(slots.every((slot) => slot.disabled)).toBe(true);
      expect(formInput.disabled).toBe(true);
      for (const slot of slots) slot.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete' }));
      await pasteText(slots[0]!, '99');
      await settle();
      expect(values()).toEqual(['1', '2', '', '', '', '']);
      expect(log).toEqual([]);
    },
  );

  test('VUE-112: a disabled fieldset disables the root and each slot', async () => {
    const { group, slots, formInput } = await mountField({ fieldsetDisabled: true });
    expect(group).toHaveAttribute('data-disabled');
    expect(slots.every((slot) => slot.matches(':disabled'))).toBe(true);
    expect(formInput.matches(':disabled')).toBe(true);
  });
});

describe('the field', () => {
  test('Field.Label names the first slot with for, the group and each slot; the description describes the group only', async () => {
    const { root, group, slots } = await mountField({ field: {} });
    const label = root.querySelector('label')!;
    expect(label).toHaveAttribute('for', slots[0]!.id);
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(group).toHaveAttribute('aria-describedby', 'description');
    expect(group).toHaveAccessibleName('Code');
    expect(group).toHaveAccessibleDescription('The code that we sent.');
    for (const slot of slots) {
      expect(slot).toHaveAttribute('aria-labelledby', label.id);
      expect(slot).not.toHaveAttribute('aria-describedby');
    }
    await userEvent.click(label);
    expect(slots[0]).toHaveFocus();
  });

  test('a name of the developer wins: on the root it names the group only, on a slot that slot only; VUE-103: null removes', async () => {
    const { root, group, slots } = await mountField({
      field: {},
      root: { 'aria-labelledby': 'mine', 'aria-describedby': null },
      inputs: [{ 'aria-label': 'Digit 1' }, { 'aria-labelledby': null }, {}],
    });
    const labelId = root.querySelector('label')!.id;
    expect(group).toHaveAttribute('aria-labelledby', 'mine');
    expect(group).not.toHaveAttribute('aria-describedby');
    expect(slots[0]).toHaveAttribute('aria-label', 'Digit 1');
    expect(slots[0]).not.toHaveAttribute('aria-labelledby');
    expect(slots[1]).not.toHaveAttribute('aria-labelledby');
    expect(slots[2]).toHaveAttribute('aria-labelledby', labelId);
  });

  test('with no field, a native label names the first slot, and aria-labelledby on the root names the group', async () => {
    const { group, slots } = await mountField({ root: { id: 'code', 'aria-label': 'Code' } });
    expect(group).toHaveAccessibleName('Code');
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(slots.some((slot) => slot.hasAttribute('aria-labelledby'))).toBe(false);
    expect(slots[0]).toHaveAttribute('id', 'code');
  });

  test('the group and each slot show the state of the field; an invalid field gives each slot aria-invalid', async () => {
    const { group, slots, focused } = await mountField({
      field: { validationMode: 'change' },
      inputs: [{}, {}],
    });
    await type(slots[0]!, '1');
    // An incomplete code misses the pattern of the form input.
    expect(dataAttributes(group)).toEqual(['data-dirty', 'data-filled', 'data-invalid']);
    expect(dataAttributes(slots[0]!)).toEqual(['data-dirty', 'data-filled']);
    expect(dataAttributes(slots[1]!)).toEqual(['data-dirty']);
    expect(slots.every((slot) => slot.getAttribute('aria-invalid') === 'true')).toBe(true);
    expect(focused()).toBe(1);
    await type(slots[1]!, '2');
    expect(dataAttributes(group)).toEqual([
      'data-complete',
      'data-dirty',
      'data-filled',
      'data-valid',
    ]);
    expect(dataAttributes(slots[0]!)).toEqual([
      'data-complete',
      'data-dirty',
      'data-filled',
      'data-valid',
    ]);
    expect(slots[0]).not.toHaveAttribute('aria-invalid');
  });

  test('in blur mode, the field validates the code after the focus leaves the field, not between two slots', async () => {
    const log: unknown[] = [];
    const { slots, group } = await mountField({
      field: recordValidate(log, { validationMode: 'blur' }),
      inputs: [{}, {}],
      around: true,
    });
    await type(slots[0]!, '12');
    slots[0]!.focus();
    slots[1]!.focus();
    await settle();
    expect(log).toEqual([]);
    expect(group).not.toHaveAttribute('data-touched');
    await leave(slots[1]!);
    expect(log).toEqual(['12']);
    expect(group).toHaveAttribute('data-touched');
    expect(slots[0]).toHaveAttribute('data-touched');
  });

  test('a Form validates the code at the submit, and shows its error for the name of the field', async () => {
    const validate = vi.fn(() => 'Wrong code');
    const { root } = mount(OTPFieldInForm, {
      field: { name: 'code', validate },
      root: { defaultValue: '123457' },
    });
    await nextTick();
    root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    await settle();
    expect(validate).toHaveBeenCalledWith('123457', expect.anything());
    expect(root.querySelector('#error')).toHaveTextContent('Wrong code');
    expect(root.querySelector('input[aria-hidden]')).toHaveAttribute('name', 'code');
  });
});

describe('the native validation', () => {
  test('a required field that is empty misses a value, and the first slot is :invalid', async () => {
    const { form, formInput, slots } = await mountField({ root: { required: true } });
    expect(form.checkValidity()).toBe(false);
    expect(formInput.validity.valueMissing).toBe(true);
    expect(slots.every((slot) => slot.matches(':required:invalid'))).toBe(true);
  });

  test.each([
    { validationType: 'numeric', code: '12' },
    { validationType: 'alpha', code: 'ab' },
    { validationType: 'alphanumeric', code: 'a1' },
    { validationType: 'none', code: '-!' },
  ])(
    'an incomplete code of the type $validationType misses the pattern; a complete one passes',
    async ({ validationType, code }) => {
      const root = reactive<Record<string, unknown>>({ validationType, modelValue: code });
      const { formInput } = await mountField({ root, inputs: [{}, {}, {}] });
      expect(formInput.validity.patternMismatch).toBe(true);
      root.modelValue = `${code}${code.at(-1)}`;
      await nextTick();
      expect(formInput.validity.valid).toBe(true);
    },
  );

  test('a read-only or disabled field does not take part in the validation', async () => {
    const root = reactive<Record<string, unknown>>({ required: true, readonly: true });
    const { form } = await mountField({ root });
    expect(form.checkValidity()).toBe(true);
    Object.assign(root, { readonly: false, disabled: true });
    await nextTick();
    expect(form.checkValidity()).toBe(true);
  });
});

describe('a native reset', () => {
  test('puts an uncontrolled field back to its first value, with no valueChange', async () => {
    const log: string[] = [];
    const { slots, form, values } = await mountField({
      root: recorded(log, { defaultValue: '12' }),
    });
    await type(slots[2]!, '3');
    log.length = 0;
    form.reset();
    await settle();
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(log).toEqual(['update 12']);
  });

  test('puts a controlled field back to its first model, and v-model follows', async () => {
    const log: string[] = [];
    const root = model('12', log);
    const { slots, form, formInput } = await mountField({ root });
    await type(slots[2]!, '3');
    form.reset();
    await settle();
    expect(root.modelValue).toBe('12');
    expect(formInput.value).toBe('12');
    form.reset();
    await settle();
    expect(log.slice(-1)).toEqual(['update 12']);
  });

  test('does nothing when a listener prevents the reset', async () => {
    const log: string[] = [];
    const { slots, form, values } = await mountField({ root: recorded(log) });
    await type(slots[0]!, '1');
    form.addEventListener('reset', (event) => event.preventDefault());
    log.length = 0;
    form.reset();
    await settle();
    expect(values()[0]).toBe('1');
    expect(log).toEqual([]);
  });

  test('VUE-21: removes the error of the field and starts no validation', async () => {
    const log: unknown[] = [];
    const { slots, form, group } = await mountField({
      field: recordValidate(log, { validationMode: 'change' }),
      root: { required: true },
    });
    await type(slots[0]!, '1');
    await press(slots[0]!, '{Delete}');
    expect(group).toHaveAttribute('data-invalid');
    log.length = 0;
    form.reset();
    await settle();
    expect(group).not.toHaveAttribute('data-invalid');
    expect(log).toEqual([]);
  });

  test('follows the form that `form` names after a change of the prop', async () => {
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other';
    try {
      const root = reactive<Record<string, unknown>>({ defaultValue: '1' });
      const { slots, values } = await mountField({ root });
      root.form = 'other';
      await settle();
      await type(slots[1]!, '2');
      other.reset();
      await settle();
      expect(values()[1]).toBe('');
    } finally {
      other.remove();
    }
  });
});

describe('the order of the slots', () => {
  function slotsOf(container: Document) {
    return [...container.querySelectorAll<HTMLInputElement>('[data-slot]')];
  }

  test('wrappers and a separator keep the order; a slot that a v-if adds first takes the first character', async () => {
    const scene = reactive({ count: 5, first: false });
    const root = reactive<Record<string, unknown>>({
      length: 5,
      defaultValue: 'abcdef',
      validationType: 'alpha',
    });
    mount(OTPFieldLayouts, { root, scene });
    await nextTick();
    expect(slotsOf(document).map((slot) => slot.value)).toEqual(['a', 'b', 'c', 'd', 'e']);
    Object.assign(scene, { first: true });
    root.length = 6;
    await settle();
    const slots = slotsOf(document);
    expect(slots.map((slot) => slot.dataset.slot)).toEqual(['first', '1', '2', '3', '4', '5']);
    expect(slots.map((slot) => slot.value)).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
    expect(slots[0]!.id).toBe(slots[1]!.id.replace(/-2$/, ''));
    expect(takeReportedMessages()).toEqual([]);
  });

  test('VUE-145: a change of length with the matching slots gives no warning', async () => {
    const scene = reactive({ count: 1 });
    const root = reactive<Record<string, unknown>>({ length: 1 });
    mount(OTPFieldLayouts, { root, scene });
    for (const count of [3, 2]) {
      scene.count = count;
      root.length = count;
      await settle();
      expect(slotsOf(document)).toHaveLength(count);
    }
    expect(takeReportedMessages()).toEqual([]);
  });

  test('a root in a Teleport keeps the order and the focus of its slots', async () => {
    mount(OTPFieldLayouts, {
      root: { length: 6, defaultValue: '12' },
      scene: { count: 6, teleport: true },
    });
    await nextTick();
    const slots = slotsOf(document);
    await type(slots[2]!, '3');
    expect(document.activeElement).toBe(slots[3]);
    expect(slots.map((slot) => slot.value)).toEqual(['1', '2', '3', '', '', '']);
  });
});

describe('a real keyboard and pointer', () => {
  test('types a code, refuses a character, replaces a selected character and deletes', async () => {
    const log: string[] = [];
    const { slots, values, focused } = await mountField({ root: recorded(log) });
    await userEvent.click(slots[0]!);
    await userEvent.keyboard('12x');
    expect(values()).toEqual(['1', '2', '', '', '', '']);
    expect(focused()).toBe(2);
    await userEvent.keyboard('3456');
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(focused()).toBe(5);
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}9');
    expect(values()).toEqual(['1', '2', '3', '9', '5', '6']);
    expect(focused()).toBe(4);
    await userEvent.keyboard('{Backspace}');
    expect(values()).toEqual(['1', '2', '3', '9', '6', '']);
    expect(focused()).toBe(3);
    await userEvent.keyboard('{Delete}');
    expect(values()).toEqual(['1', '2', '3', '6', '', '']);
    expect(focused()).toBe(3);
    expect(log.filter((entry) => entry.startsWith('invalid'))).toEqual(['invalid x input-change']);
  });

  test('takes a code from a real paste, and reports the characters that it refuses', async () => {
    const log: string[] = [];
    const { slots, values, focused, root } = await mountField({
      root: recorded(log),
      around: true,
    });
    const source = root.querySelector<HTMLInputElement>('#before')!;
    source.value = '12 34-56';
    source.focus();
    source.select();
    await userEvent.copy();
    await userEvent.click(slots[0]!);
    await userEvent.paste();
    await settle();
    expect(values()).toEqual(['1', '2', '3', '4', '5', '6']);
    expect(focused()).toBe(5);
    expect(log).toEqual([
      'invalid 12 34-56 input-paste',
      'change 123456 input-paste',
      'update 123456',
      'complete 123456 input-paste',
    ]);
  });

  test('a click on a native label focuses the first slot', async () => {
    const { root, slots } = await mountField({
      root: { id: 'code', defaultValue: '12' },
      label: true,
    });
    await userEvent.click(root.querySelector('label')!);
    expect(slots[0]).toHaveFocus();
    expect(selection(slots[0]!)).toEqual([0, 1]);
  });
});

describe('messages', () => {
  test.each([0, -1, 3.7, Number.NaN, Number.POSITIVE_INFINITY])(
    'a length of %s warns, and the root renders no form input',
    async (length) => {
      const { root } = mount(OTPFields, { root: { length }, inputs: [] });
      await settle();
      expect(root.querySelector('input[aria-hidden]')).toBeNull();
      expect(takeReportedMessages()).toEqual([
        `console.warn: Vase UI: <OTPField.Root> \`length\` must be a positive integer. Received \`length={${String(length)}}\`.`,
      ]);
    },
  );

  test.each([
    { count: 5, text: '5 inputs' },
    { count: 1, text: '1 input' },
  ])('a count of slots that is not the length warns: $text', async ({ count, text }) => {
    mount(OTPFields, { root: { length: 6 }, inputs: Array.from({ length: count }, () => ({})) });
    await settle();
    await settle();
    expect(takeReportedMessages()).toEqual([
      `console.warn: Vase UI: <OTPField.Root> \`length\` must match the number of rendered <OTPField.Input /> parts. Received \`length={6}\` but rendered ${text}.`,
    ]);
  });
});

test('VUE-87: a toolbar item in the root stays an item of the toolbar, and the slots keep their characters', async () => {
  const { root } = mount(OTPFieldInToolbar);
  await nextTick();
  const button = root.querySelector<HTMLElement>('#in-root')!;
  button.focus();
  await userEvent.keyboard('{ArrowRight}');
  expect(document.activeElement).toBe(root.querySelector('#after-root'));
  expect(
    [...root.querySelectorAll<HTMLInputElement>('input:not([aria-hidden])')].map(
      (slot) => slot.value,
    ),
  ).toEqual(['1', '2', '']);
});

// A case that throws in `setup` is the last of the file.
test('a slot outside a root throws', () => {
  const error = mountError(OTPFieldInputAlone);
  expect((error as Error).message).toBe(
    'Vase UI: A part of OTP Field must be inside <OTPField.Root>. Without a root the part has no value to show. Put the part inside <OTPField.Root>.',
  );
  // After the error, Vapor renders the part with no setup, and warns about each binding.
  takeReportedMessages();
});
