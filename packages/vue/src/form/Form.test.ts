import { describe, expect, test, vi } from 'vitest';
import { page, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { vModel } from '../../test/attrs';
import { recordValidate } from '../../test/field';
import FieldsInForm from '../../test/fixtures/FieldsInForm.vue';
import FieldWithInput from '../../test/fixtures/FieldWithInput.vue';
import FormElementReplaced from '../../test/fixtures/FormElementReplaced.vue';
import FormInTransition from '../../test/fixtures/FormInTransition.vue';
import FormValues from '../../test/fixtures/FormValues.vue';
import SubmitWithModifiers from '../../test/fixtures/SubmitWithModifiers.vue';
import TeleportedFields from '../../test/fixtures/TeleportedFields.vue';
import { mount, settle, submitsPrevented, typeAtEnd } from '../../test/render';

type Fields = {
  key?: string;
  root?: Record<string, unknown>;
  input?: Record<string, unknown> | null;
}[];

/** Mounts a form with fields, and waits one render. */
async function mountForm(props: { form?: Record<string, unknown>; fields: Fields }) {
  const { root, exposed } = mount(FieldsInForm, props);
  await nextTick();
  const form = root.querySelector('form')!;
  return {
    root,
    form,
    exposed,
    input: (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!,
    field: (id: string) => root.querySelector(`#${id}`)!.closest('form > div')!,
    submit: () => form.querySelector<HTMLButtonElement>('button[type=submit]')!.click(),
  };
}

describe('the element', () => {
  test('is one form with novalidate, the attributes and listeners of the developer, and no ARIA of its own', async () => {
    const onClick = vi.fn();
    const onReset = vi.fn();
    const { root, form, exposed } = await mountForm({
      form: { id: 'profile', action: '/save', method: 'post', class: 'Form', onClick, onReset },
      fields: [],
    });
    expect(root.children).toHaveLength(1);
    expect(form.getAttributeNames().sort()).toEqual([
      'action',
      'class',
      'id',
      'method',
      'novalidate',
    ]);
    expect(exposed.form.element).toBe(form);
    form.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    form.reset();
    await settle();
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onReset.mock.calls[0]![0]).toBeInstanceOf(Event);
  });

  test('with novalidate, a native control never blocks; :novalidate="false" lets the browser check it first', async () => {
    const submitted = vi.fn();
    const validated: unknown[] = [];
    const attrs = reactive<Record<string, unknown>>({ onSubmit: submitted });
    const { root } = mount(FieldsInForm, {
      form: attrs,
      native: { required: true, id: 'native' },
      fields: [{ root: recordValidate(validated) }],
    });
    await nextTick();
    const form = root.querySelector('form')!;
    form.requestSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);
    attrs.novalidate = false;
    await nextTick();
    expect(form).not.toHaveAttribute('novalidate');
    form.requestSubmit();
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(validated).toEqual(['']);
    root.querySelector<HTMLInputElement>('#native')!.value = 'a';
    form.requestSubmit();
    expect(submitted).toHaveBeenCalledTimes(2);
    expect(validated).toEqual(['', '']);
  });

  test('the element slot renders the element of the developer, with novalidate and the submit of the form', async () => {
    const submitted = vi.fn();
    const { root, exposed } = mount(FormElementReplaced, {
      form: { id: 'replaced', onSubmit: submitted },
    });
    await nextTick();
    const form = root.querySelector('form')!;
    expect(form).toHaveClass('Styled');
    expect(form).toHaveAttribute('id', 'replaced');
    expect(form).toHaveAttribute('novalidate');
    expect(exposed.form.element).toBe(form);
    form.querySelector('button')!.click();
    expect(submitted).not.toHaveBeenCalled();
    expect(form.querySelector('input')).toHaveFocus();
  });
});

describe('submit', () => {
  test('a submit that passes runs the listener one time with the native event, and Form does not prevent it', async () => {
    const data: (string | null)[] = [];
    const events: Event[] = [];
    const { exposed, submit } = await mountForm({
      form: {
        onSubmit: (event: Event) => {
          events.push(event);
          data.push(new FormData(exposed.form.element).get('email') as string | null);
        },
      },
      fields: [{ input: { name: 'email', defaultValue: 'a@b.c', required: true } }],
    });
    submit();
    expect(events).toHaveLength(1);
    expect(events[0]).toBeInstanceOf(SubmitEvent);
    expect(data).toEqual(['a@b.c']);
    expect(submitsPrevented).toEqual([false]);
  });

  test('the native modifiers .prevent and .once work', async () => {
    const submits: SubmitEvent[] = [];
    const { root } = mount(SubmitWithModifiers, { submits });
    const button = root.querySelector('button')!;
    button.click();
    button.click();
    expect(submits).toHaveLength(1);
    expect(submitsPrevented).toEqual([true, false]);
  });

  test('Enter in a text input, a submit button outside with the form attribute, and requestSubmit() submit', async () => {
    const submitted = vi.fn();
    const validated: unknown[] = [];
    const { form, input } = await mountForm({
      form: { id: 'profile', onSubmit: submitted },
      fields: [{ root: recordValidate(validated), input: { id: 'name', defaultValue: 'a' } }],
    });
    input('name').focus();
    await userEvent.keyboard('{Enter}');
    expect(submitted).toHaveBeenCalledTimes(1);
    const outside = document.body.appendChild(document.createElement('button'));
    try {
      outside.type = 'submit';
      outside.setAttribute('form', 'profile');
      outside.click();
    } finally {
      outside.remove();
    }
    form.requestSubmit();
    expect(submitted).toHaveBeenCalledTimes(3);
    expect(validated).toEqual(['a', 'a', 'a']);
  });

  test('a blocked submit is prevented, runs no listener, and focuses the first invalid control in the document', async () => {
    const submitted = vi.fn();
    const fields = reactive<Fields>([
      { key: 'b', input: { id: 'b', required: true } },
      { key: 'c', input: { id: 'c', required: true } },
    ]);
    const { root } = mount(FieldsInForm, { form: { onSubmit: submitted }, fields });
    await nextTick();
    const submit = () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
    input('c').focus();
    submit();
    expect(submitted).not.toHaveBeenCalled();
    expect(submitsPrevented).toEqual([true]);
    expect(input('b')).toHaveFocus();
    fields.unshift({ key: 'a', input: { id: 'a', required: true } });
    await nextTick();
    submit();
    expect(input('a')).toHaveFocus();
    fields.reverse();
    await nextTick();
    submit();
    expect(input('c')).toHaveFocus();
  });
});

describe('the values of the form', () => {
  test('@submit.prevent gets the event and the typed values of the named fields; a disabled field and a field outside the form have none', async () => {
    const submits: { prevented: boolean; values: Record<string, unknown> }[] = [];
    const { root } = mount(FormValues, { submits });
    await nextTick();
    const form = root.querySelector('form')!;
    form.querySelector('button')!.click();
    expect(submits).toEqual([
      {
        prevented: true,
        values: {
          // Two fields with one name: the last in the document wins.
          name: 'Grace',
          city: 'Lyon',
          terms: true,
          news: false,
          // A checkbox that is disabled gives no value.
          fruits: ['apple'],
          size: 2,
          // No enabled radio is checked.
          plan: null,
        },
      },
    ]);
    // An uncontrolled field gives its value as a controlled one does.
    await typeAtEnd(root.querySelector<HTMLInputElement>('input[name=name]')!, 'x');
    root.querySelector<HTMLInputElement>('[aria-label=Pear]')!.click();
    root.querySelector<HTMLInputElement>('[role=switch]')!.click();
    await nextTick();
    form.querySelector('button')!.click();
    expect(submits[1]!.values).toMatchObject({ news: true, fruits: ['apple', 'pear'] });
    expect([...new FormData(form).keys()]).toContain('native');
  });

  test('validate of a field gets the values of the form, and an empty object with no form', async () => {
    const seen: unknown[] = [];
    const validate = (_value: unknown, values: unknown) => {
      seen.push(values);
    };
    const { submit } = await mountForm({
      fields: [
        { root: { name: 'a', validate }, input: { defaultValue: 'x' } },
        { root: { name: 'b' }, input: { defaultValue: 'y' } },
      ],
    });
    submit();
    expect(seen).toEqual([{ a: 'x', b: 'y' }]);
    seen.length = 0;
    const { exposed } = mount(FieldWithInput, { root: { validate } });
    await nextTick();
    exposed.field.validate();
    expect(seen).toEqual([{}]);
  });
});

describe('validation at a submit', () => {
  test('each field validates whatever its mode, and an empty required field shows its error', async () => {
    const validated: unknown[] = [];
    const { submit, input, field } = await mountForm({
      fields: [
        {
          root: recordValidate(validated, { validationMode: 'blur' }),
          input: { id: 'blur', defaultValue: 'a' },
        },
        { root: { validationMode: 'change' }, input: { id: 'required', required: true } },
      ],
    });
    submit();
    await nextTick();
    expect(validated).toEqual(['a']);
    expect(field('required')).toHaveAttribute('data-invalid');
    expect(input('required')).toHaveAttribute('aria-invalid', 'true');
    expect(field('required').querySelector(':scope > div')).toHaveTextContent(
      input('required').validationMessage,
    );
    expect(input('required')).toHaveFocus();
  });

  test('a validate error, the invalid prop and an error of errors each block the submit', async () => {
    const submitted = vi.fn();
    const root = reactive<Record<string, unknown>>({ name: 'email', validate: () => 'Wrong.' });
    const form = reactive<Record<string, unknown>>({ onSubmit: submitted });
    const { submit } = await mountForm({ form, fields: [{ root, input: { id: 'email' } }] });
    submit();
    expect(submitted).not.toHaveBeenCalled();
    root.validate = undefined;
    root.invalid = true;
    await nextTick();
    submit();
    expect(submitted).not.toHaveBeenCalled();
    root.invalid = false;
    form.errors = { email: 'Taken.' };
    await nextTick();
    submit();
    expect(submitted).not.toHaveBeenCalled();
    form.errors = {};
    await nextTick();
    submit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });

  test('a pending promise does not block; an earlier error of a promise blocks in blur mode', async () => {
    const submitted = vi.fn();
    const answers: ((result: string | null) => void)[] = [];
    const validate = () => new Promise<string | null>((resolve) => answers.push(resolve));
    const root = reactive<Record<string, unknown>>({ validate });
    const { submit, field } = await mountForm({
      form: { onSubmit: submitted },
      fields: [{ root, input: { id: 'name', defaultValue: 'a' } }],
    });
    submit();
    expect(submitted).toHaveBeenCalledTimes(1);
    expect(answers).toHaveLength(1);
    // In submit mode, an error after the submit shows, and the next submit validates again.
    answers[0]!('Taken.');
    await settle();
    expect(field('name')).toHaveAttribute('data-invalid');
    submit();
    expect(submitted).toHaveBeenCalledTimes(2);
    answers[1]!(null);
    await settle();
    expect(field('name')).toHaveAttribute('data-valid');
    root.validationMode = 'blur';
    await nextTick();
    submit();
    answers[2]!('Taken.');
    await settle();
    submit();
    expect(submitted).toHaveBeenCalledTimes(3);
  });

  test('a field with no name blocks, and two fields with one name are two fields', async () => {
    const submitted = vi.fn();
    const { submit, input, field } = await mountForm({
      form: { onSubmit: submitted },
      fields: [
        { input: { id: 'no-name', required: true } },
        { root: { name: 'tag' }, input: { id: 'first', required: true } },
        { root: { name: 'tag' }, input: { id: 'second', defaultValue: 'a', required: true } },
      ],
    });
    submit();
    expect(input('no-name')).toHaveFocus();
    await typeAtEnd(input('no-name'), 'a');
    await nextTick();
    expect(field('no-name')).not.toHaveAttribute('data-invalid');
    submit();
    await nextTick();
    expect(input('first')).toHaveFocus();
    expect(field('first')).toHaveAttribute('data-invalid');
    expect(field('second')).toHaveAttribute('data-valid');
    await typeAtEnd(input('first'), 'a');
    submit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});

describe('errors', () => {
  test('a field is invalid while errors has its name; the form follows changes in place', async () => {
    const errors = reactive<Record<string, string | string[]>>({ email: 'Taken.', other: 'None.' });
    const { field, input } = await mountForm({
      form: { errors },
      fields: [
        { root: { name: 'email' }, input: { id: 'email' } },
        { root: { name: 'tags' }, input: { id: 'tags' } },
      ],
    });
    expect(field('email')).toHaveAttribute('data-invalid');
    expect(input('email')).toHaveAttribute('aria-invalid', 'true');
    expect(field('email').querySelector(':scope > div')).toHaveTextContent('Taken.');
    expect(field('tags')).not.toHaveAttribute('data-invalid');
    errors.tags = ['First.'];
    await nextTick();
    expect(field('tags').querySelector(':scope > div')).toHaveTextContent('First.');
    (errors.tags as string[]).push('Second.');
    await nextTick();
    expect(field('tags').querySelectorAll('li')).toHaveLength(2);
  });

  test('an object with no prototype works', async () => {
    const errors = Object.assign(Object.create(null), { email: 'Taken.' });
    const { field } = await mountForm({
      form: { errors },
      fields: [{ root: { name: 'email' }, input: { id: 'email' } }],
    });
    expect(field('email')).toHaveAttribute('data-invalid');
  });

  test('an edit asks to remove the error of its field; a parent that keeps the object keeps the error', async () => {
    const updates: unknown[] = [];
    const errors = { email: 'Taken.', name: 'Short.' };
    const name = vModel('Colm');
    name.id = 'name';
    const { input, field } = await mountForm({
      form: { errors, 'onUpdate:errors': (next: unknown) => updates.push(next) },
      fields: [
        { root: { name: 'email' }, input: { id: 'email' } },
        { root: { name: 'name' }, input: name },
        { root: { name: 'toString' }, input: { id: 'to-string' } },
      ],
    });
    // Only an own key is an error.
    await typeAtEnd(input('to-string'), 'a');
    await nextTick();
    expect(updates).toEqual([]);
    await typeAtEnd(input('email'), 'a');
    await nextTick();
    expect(updates).toEqual([{ name: 'Short.' }]);
    expect(errors).toEqual({ email: 'Taken.', name: 'Short.' });
    expect(field('email')).toHaveAttribute('data-invalid');
    name.modelValue = 'Ann';
    await nextTick();
    expect(updates).toHaveLength(1);
    await typeAtEnd(input('email'), 'b');
    await nextTick();
    expect(updates).toHaveLength(2);
  });

  test('the first change of errors after a submit that passed moves the focus, unless the user edited a field or reset the form', async () => {
    const form = reactive<Record<string, unknown>>({ errors: {} });
    const { submit, input } = await mountForm({
      form,
      fields: [
        { root: { name: 'email' }, input: { id: 'email' } },
        { root: { name: 'name' }, input: { id: 'name' } },
      ],
    });
    // With no submit before, the focus does not move.
    form.errors = { name: 'Short.' };
    await nextTick();
    expect(input('name')).not.toHaveFocus();
    form.errors = {};
    await nextTick();
    submit();
    (form.errors as Record<string, string>).name = 'Short.';
    await nextTick();
    expect(input('name')).toHaveFocus();
    input('name').blur();
    form.errors = { email: 'Taken.' };
    await nextTick();
    expect(input('email')).not.toHaveFocus();
    form.errors = {};
    await nextTick();
    submit();
    await typeAtEnd(input('email'), 'a');
    form.errors = { name: 'Short.' };
    await nextTick();
    expect(input('email')).toHaveFocus();
    input('email').blur();
    form.errors = {};
    await nextTick();
    // After a reset, the form is as before its first submit.
    submit();
    input('email').closest('form')!.reset();
    await settle();
    form.errors = { name: 'Short.' };
    await nextTick();
    expect(input('name')).not.toHaveFocus();
  });
});

describe('validate()', () => {
  test('validates the fields, or the fields with a name, and returns whether they are valid', async () => {
    const submitted = vi.fn();
    const updates: unknown[] = [];
    const validated: unknown[] = [];
    const fields = reactive<Fields>([
      { key: 'a', root: { name: 'a' }, input: { id: 'a', required: true } },
      { key: 'b', root: recordValidate(validated, { name: 'b' }), input: { id: 'b' } },
    ]);
    const { root, exposed } = mount(FieldsInForm, {
      form: { onSubmit: submitted, 'onUpdate:errors': (next: unknown) => updates.push(next) },
      fields,
    });
    await nextTick();
    const form = exposed.form;
    expect(form.validate()).toBe(false);
    await nextTick();
    expect(root.querySelector('#a')).toHaveAttribute('aria-invalid', 'true');
    expect(root.querySelector('#a')).not.toHaveFocus();
    expect(validated).toEqual(['']);
    expect(form.validate('b')).toBe(true);
    expect(validated).toEqual(['', '']);
    expect(form.validate('a')).toBe(false);
    expect(form.validate('unknown')).toBe(true);
    expect(validated).toEqual(['', '']);
    fields[1]!.root!.validate = () => new Promise(() => {});
    await nextTick();
    expect(form.validate('b')).toBe(true);
    // The names of this moment: a new name, and a field that unmounted.
    fields[0]!.root!.name = 'renamed';
    await nextTick();
    expect(form.validate('a')).toBe(true);
    expect(form.validate('renamed')).toBe(false);
    fields.shift();
    await nextTick();
    expect(form.validate('renamed')).toBe(true);
    expect(submitted).not.toHaveBeenCalled();
    expect(updates).toEqual([]);
  });
});

describe('reset', () => {
  test('removes the errors of the fields one time, and a prevented reset changes nothing', async () => {
    const updates: unknown[] = [];
    const form = reactive<Record<string, unknown>>({
      errors: { a: 'Bad.', b: 'Bad.', other: 'Kept.' },
      'onUpdate:errors': (errors: unknown) => updates.push(errors),
    });
    const fields = reactive<Fields>([{ root: { name: 'a' } }, { root: { name: 'b' } }]);
    const { root } = await mountForm({ form, fields });
    const element = root.querySelector('form')!;
    element.reset();
    await settle();
    expect(updates).toEqual([{ other: 'Kept.' }]);
    form.errors = { other: 'Kept.' };
    await nextTick();
    element.reset();
    await settle();
    expect(updates).toHaveLength(1);
    form.errors = { a: 'Bad.' };
    await nextTick();
    element.addEventListener('reset', (event) => event.preventDefault(), { once: true });
    element.reset();
    await settle();
    expect(updates).toHaveLength(1);
    // A field that unmounted is no field of the form.
    form.errors = { a: 'Bad.', b: 'Bad.' };
    fields.pop();
    await nextTick();
    element.reset();
    await settle();
    expect(updates).toEqual([{ other: 'Kept.' }, { b: 'Bad.' }]);
  });
});

describe('the fields of the form', () => {
  test('a field counts only when the browser gives its control to the form', async () => {
    const outside = document.createElement('div');
    document.body.prepend(outside);
    const otherForm = document.body.appendChild(document.createElement('form'));
    otherForm.id = 'other';
    try {
      const submitted = vi.fn();
      const { root } = mount(TeleportedFields, {
        form: { onSubmit: submitted },
        outside,
        otherForm,
      });
      await nextTick();
      const submit = () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      submit();
      expect(submitted).not.toHaveBeenCalled();
      const control = outside.querySelector<HTMLInputElement>('#outside-with-form-attribute')!;
      expect(control).toHaveFocus();
      await typeAtEnd(control, 'a');
      submit();
      expect(submitted).toHaveBeenCalledTimes(1);
    } finally {
      outside.remove();
      otherForm.remove();
    }
  });

  test('a disabled field and an unmounted field do not count; a disabled field shows no error', async () => {
    const submitted = vi.fn();
    const first = reactive<Record<string, unknown>>({});
    const firstInput = reactive<Record<string, unknown>>({ id: 'first', required: true });
    const fields = reactive<Fields>([
      { key: 'first', root: first, input: firstInput },
      { key: 'second', input: { id: 'second', required: true } },
    ]);
    const { root } = mount(FieldsInForm, { form: { onSubmit: submitted }, fields });
    await nextTick();
    const submit = () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
    const input = (id: string) => root.querySelector<HTMLInputElement>(`#${id}`)!;
    submit();
    await nextTick();
    expect(input('first')).toHaveFocus();
    firstInput.disabled = true;
    await nextTick();
    expect(input('first')).not.toHaveAttribute('aria-invalid');
    expect(input('first').closest('form > div')!.querySelector(':scope > div')).toBeNull();
    submit();
    expect(input('second')).toHaveFocus();
    fields.pop();
    await nextTick();
    submit();
    expect(submitted).toHaveBeenCalledTimes(1);
    firstInput.disabled = false;
    first.disabled = true;
    await nextTick();
    submit();
    expect(submitted).toHaveBeenCalledTimes(2);
    first.disabled = false;
    await nextTick();
    submit();
    expect(submitted).toHaveBeenCalledTimes(2);
  });

  test('a field with no control does not count', async () => {
    const submitted = vi.fn();
    const { submit } = await mountForm({
      form: { onSubmit: submitted },
      fields: [{ root: { validate: () => 'Wrong.' }, input: null }],
    });
    submit();
    expect(submitted).toHaveBeenCalledTimes(1);
  });
});

describe('lifetime and accessibility', () => {
  test('renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(FormInTransition, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('form')).toHaveClass('v-enter-from', 'v-enter-active');
  });

  test('is a form landmark with the name that the developer gives', async () => {
    await mountForm({ form: { 'aria-label': 'Profile' }, fields: [] });
    await expect.element(page.getByRole('form', { name: 'Profile' })).toBeInTheDocument();
  });
});
