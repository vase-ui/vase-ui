import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { dataAttributes, leave, recordValidate } from '../../test/field';
import SliderParts from '../../test/fixtures/SliderParts.vue';
import SliderSlots from '../../test/fixtures/SliderSlots.vue';
import { mount, settle } from '../../test/render';

type Attrs = Record<string, unknown>;

async function mountSlider(props: {
  root?: Attrs;
  thumbs?: Attrs[];
  label?: 'before' | 'after';
  field?: Attrs;
  fieldset?: { native: boolean; disabled: boolean };
  form?: Attrs;
}) {
  const { root } = mount(SliderParts, props);
  await nextTick();
  await nextTick();
  const inputs = () => [...root.querySelectorAll<HTMLInputElement>('input[type=range]')];
  return {
    root,
    form: root.querySelector('form')!,
    group: root.querySelector<HTMLElement>('[role=group]')!,
    field: root.querySelector<HTMLElement>('form > div > div:not(#legend)')!,
    inputs,
    input: (index = 0) => inputs()[index]!,
    values: () => inputs().map((input) => input.valueAsNumber),
    entries: () => [...new FormData(root.querySelector('form')!).entries()].map(String),
  };
}

async function press(input: HTMLInputElement, keys: string) {
  input.focus();
  await userEvent.keyboard(keys);
  await nextTick();
}

describe('a form', () => {
  test('gets one entry for each enabled thumb, in the order of the document, also with index props', async () => {
    const thumbs = reactive<Attrs[]>([{ index: 1 }, { index: 0 }]);
    const { entries } = await mountSlider({
      root: { name: 'volume', defaultValue: [20, 60] },
      thumbs,
    });
    expect(entries()).toEqual(['volume,60', 'volume,20']);
    thumbs[0]!.disabled = true;
    await nextTick();
    expect(entries()).toEqual(['volume,20']);
  });

  test('a disabled slider gives no entry; with form, the entries go to that form', async () => {
    const root = reactive<Attrs>({ name: 'volume', defaultValue: 40, disabled: true });
    const { entries, inputs } = await mountSlider({ root });
    expect(entries()).toEqual([]);
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other';
    Object.assign(root, { disabled: false, form: 'other' });
    await nextTick();
    expect(entries()).toEqual([]);
    expect(inputs()[0]!.form).toBe(other);
    expect([...new FormData(other).entries()].map(String)).toEqual(['volume,40']);
    other.remove();
  });
});

describe('a native reset', () => {
  test('gives the first value and emits only update:modelValue, one time for a controlled range', async () => {
    const log: string[] = [];
    const root = reactive<Attrs>({
      modelValue: [20, 60],
      onValueChange: () => log.push('change'),
      onValueCommitted: () => log.push('commit'),
    });
    root['onUpdate:modelValue'] = (value: unknown) => {
      log.push(`update ${String(value)}`);
      root.modelValue = value;
    };
    const { form, input, values } = await mountSlider({ root, thumbs: [{}, {}] });
    await press(input(1), '{Home}');
    log.length = 0;
    form.reset();
    await settle();
    expect(values()).toEqual([20, 60]);
    expect(log).toEqual(['update 20,60']);
  });

  test('of a controlled slider emits its first model; a reset that a listener prevents does nothing', async () => {
    const log: string[] = [];
    const root = reactive<Attrs>({ modelValue: 30 });
    root['onUpdate:modelValue'] = (value: unknown) => {
      log.push(`update ${String(value)}`);
      root.modelValue = value;
    };
    const { form, input, values } = await mountSlider({ root });
    await press(input(), '{ArrowRight}');
    log.length = 0;
    form.addEventListener('reset', (event) => event.preventDefault(), { once: true });
    form.reset();
    await settle();
    expect(log).toEqual([]);
    form.reset();
    await settle();
    expect(log).toEqual(['update 30']);
    expect(values()).toEqual([30]);
  });

  test('a slider with no default goes back to min; a parent that keeps its value keeps each input', async () => {
    const root = reactive<Attrs>({ min: 10 });
    const { form, input, values } = await mountSlider({ root });
    await press(input(), '{End}');
    form.reset();
    await settle();
    expect(values()).toEqual([10]);
    root.modelValue = 50;
    root['onUpdate:modelValue'] = () => {};
    await nextTick();
    form.reset();
    await settle();
    expect(values()).toEqual([50]);
  });

  test('VUE-21: clears the field, also when the value does not change', async () => {
    const field = reactive<Attrs>({ validationMode: 'change', validate: () => 'Too loud' });
    const {
      form,
      input,
      field: fieldElement,
    } = await mountSlider({
      root: { defaultValue: 20 },
      field,
    });
    await press(input(), '{ArrowRight}{ArrowLeft}');
    await settle();
    await leave(input());
    expect(dataAttributes(fieldElement)).toEqual(['data-filled', 'data-invalid', 'data-touched']);
    form.reset();
    await settle();
    expect(dataAttributes(fieldElement)).toEqual(['data-filled']);
    expect(input()).not.toHaveAttribute('aria-invalid');
  });
});

describe('a field', () => {
  test('the first input is its control: Field.Label names it, with the id of the field or of the thumb', async () => {
    const thumbs = reactive<Attrs[]>([{}, {}]);
    const { field, input, group } = await mountSlider({
      root: { defaultValue: [20, 60] },
      thumbs,
      field: {},
    });
    const label = field.querySelector('label')!;
    expect(label.htmlFor).toBe(input(0).id);
    // A slider always has a value, so no part has `data-filled`.
    expect(field).toHaveAttribute('data-filled');
    expect(group).not.toHaveAttribute('data-filled');
    expect(input(0).labels?.[0]).toBe(label);
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(input(1)).toHaveAttribute('aria-labelledby', label.id);
    thumbs[0]!.id = 'start';
    await nextTick();
    expect(label.htmlFor).toBe('start');
  });

  test('each input has the ids of the description and the error, and aria-invalid while the field is invalid; an aria-describedby of the developer wins', async () => {
    const field = reactive<Attrs>({ invalid: false });
    const { input } = await mountSlider({
      root: { defaultValue: [20, 40, 60] },
      thumbs: [{}, {}, { 'aria-describedby': 'mine' }],
      field,
    });
    expect(input(0)).toHaveAttribute('aria-describedby', 'description');
    field.invalid = true;
    await nextTick();
    await nextTick();
    for (const index of [0, 1]) {
      expect(input(index)).toHaveAttribute('aria-describedby', 'description error');
      expect(input(index)).toHaveAttribute('aria-invalid', 'true');
    }
    expect(input(2)).toHaveAttribute('aria-describedby', 'mine');
  });

  test('disabled and name of the field win over the props', async () => {
    const field = reactive<Attrs>({ disabled: true, name: 'level' });
    const { input, group } = await mountSlider({ root: { name: 'volume' }, field });
    expect(input().disabled).toBe(true);
    expect(group).toHaveAttribute('data-disabled');
    field.disabled = false;
    await nextTick();
    expect(input()).toHaveAttribute('name', 'level');
  });

  test('a range is dirty when it changes from [20, 30] to [20, 20]; a move between thumbs is no leave', async () => {
    const { input, field } = await mountSlider({
      root: { defaultValue: [20, 30] },
      thumbs: [{}, {}],
      field: {},
    });
    await press(input(1), '{Home}');
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled']);
    input(0).focus();
    await settle();
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled']);
    await leave(input(0));
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled', 'data-touched']);
  });

  test('VUE-87: a move to an input that a Teleport puts in another place is no leave', async () => {
    const target = document.body.appendChild(document.createElement('div'));
    const { root } = mount(SliderSlots, { target, field: {} });
    await nextTick();
    const field = root.querySelector<HTMLElement>('form > div')!;
    const [start, end] = [
      root.querySelector<HTMLInputElement>('.Input')!,
      target.querySelector('input')!,
    ];
    start.focus();
    end.focus();
    await settle();
    expect(field).not.toHaveAttribute('data-touched');
    await leave(end);
    expect(field).toHaveAttribute('data-touched');
    target.remove();
  });

  test.each(['submit', 'blur', 'change'])(
    'validationMode %s: validate gets the value at its moment',
    async (validationMode) => {
      const validated: unknown[] = [];
      const field = reactive(recordValidate(validated, { validationMode }));
      const { input, form } = await mountSlider({
        root: { defaultValue: [20, 60] },
        thumbs: [{}, {}],
        field,
        form: {},
      });
      await press(input(0), '{ArrowRight}');
      await settle();
      await leave(input(0));
      form.requestSubmit();
      await settle();
      expect(validated).toEqual(
        validationMode === 'submit'
          ? [[21, 60]]
          : validationMode === 'blur'
            ? [
                [21, 60],
                [21, 60],
              ]
            : [
                [21, 60],
                [21, 60],
              ],
      );
    },
  );

  test('a blocked submit gives the first enabled input the focus', async () => {
    const thumbs = reactive<Attrs[]>([{}, {}]);
    const { form, input } = await mountSlider({
      root: { defaultValue: [20, 60] },
      thumbs,
      field: { validate: () => 'Too loud' },
      form: {},
    });
    form.requestSubmit();
    await settle();
    expect(document.activeElement).toBe(input(0));
    thumbs[0]!.disabled = true;
    await nextTick();
    form.requestSubmit();
    await settle();
    expect(document.activeElement).toBe(input(1));
  });

  test('the values of a form at a submit have the value of the slider, under its name; a disabled slider has none', async () => {
    const submitted: unknown[] = [];
    const root = reactive<Attrs>({ defaultValue: [20, 60], name: 'volume' });
    const { form } = await mountSlider({
      root,
      thumbs: [{}, {}],
      field: {},
      form: { onSubmit: (_: Event, values: unknown) => submitted.push(values) },
    });
    form.requestSubmit();
    await settle();
    root.disabled = true;
    await nextTick();
    form.requestSubmit();
    await settle();
    expect(submitted).toEqual([{ volume: [20, 60] }, {}]);
  });

  test('an edit removes the error that the form has for the field', async () => {
    const updates: unknown[] = [];
    const { input } = await mountSlider({
      root: { defaultValue: 20 },
      field: { name: 'volume' },
      form: {
        errors: { volume: 'Too loud' },
        'onUpdate:errors': (errors: unknown) => updates.push(errors),
      },
    });
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    await press(input(), '{ArrowRight}');
    await settle();
    expect(updates).toEqual([{}]);
  });
});

describe('a fieldset', () => {
  test.each([true, false])(
    'VUE-112: a disabled fieldset disables the slider (native: %s); the legend of a Fieldset.Root names it',
    async (native) => {
      const fieldset = reactive({ native, disabled: true });
      const { group, input, inputs } = await mountSlider({
        fieldset,
        thumbs: [{}, {}],
        root: { defaultValue: [1, 2] },
      });
      await nextTick();
      expect(group).toHaveAttribute('data-disabled');
      expect(inputs().every((element) => element.matches(':disabled'))).toBe(true);
      // The legend of a native fieldset names the fieldset.
      if (!native) expect(group).toHaveAttribute('aria-labelledby', 'legend');
      fieldset.disabled = false;
      await settle();
      expect(group).not.toHaveAttribute('data-disabled');
      expect(input().matches(':disabled')).toBe(false);
    },
  );
});
