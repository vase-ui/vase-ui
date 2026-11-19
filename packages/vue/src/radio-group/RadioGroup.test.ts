import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { RadioGroupChangeEventDetails } from '@vase-ui/vue/radio-group';
import { dataAttributes, leave } from '../../test/field';
import RadioChoices from '../../test/fixtures/RadioChoices.vue';
import RadiosInFieldset from '../../test/fixtures/RadiosInFieldset.vue';
import { mount, settle } from '../../test/render';

type Item = {
  key: string;
  value?: unknown;
  attrs?: Record<string, unknown>;
  item?: Record<string, unknown>;
  fieldset?: boolean;
};

const choices = (...keys: string[]): Item[] => keys.map((key) => ({ key }));

async function mountGroup(props: {
  group?: Record<string, unknown>;
  items: Item[];
  field?: Record<string, unknown>;
  form?: Record<string, unknown>;
}) {
  const { root, exposed } = mount(RadioChoices, props);
  await nextTick();
  return {
    root,
    exposed,
    group: root.querySelector<HTMLElement>('[role=radiogroup]')!,
    radio: (key: string) => root.querySelector<HTMLInputElement>(`#${key}`)!,
    checked: () => root.querySelector<HTMLInputElement>('input:checked')?.id ?? null,
    focused: () => (document.activeElement as HTMLElement).id,
    submit: () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click(),
  };
}

/** `v-model` on a group that writes each event in `log`. */
function groupModel(log: string[], modelValue: unknown, write = true) {
  const group = reactive<Record<string, unknown>>({
    modelValue,
    onValueChange: (value: unknown) => log.push(`valueChange ${String(value)}`),
  });
  group['onUpdate:modelValue'] = (value: unknown) => {
    log.push(`update ${String(value)}`);
    if (write) group.modelValue = value;
  };
  return group;
}

describe('the group', () => {
  test('is a div with role radiogroup; ARIA attributes say disabled, read-only and required', async () => {
    const attrs = reactive<Record<string, unknown>>({ class: 'Storage' });
    const { exposed, group, radio } = await mountGroup({ group: attrs, items: choices('ssd') });
    expect(group.tagName).toBe('DIV');
    expect(exposed.group.element).toBe(group);
    expect(dataAttributes(group)).toEqual([]);
    Object.assign(attrs, { disabled: true, readonly: true, required: true });
    await nextTick();
    expect(group).toHaveAttribute('aria-disabled', 'true');
    expect(group).toHaveAttribute('aria-readonly', 'true');
    expect(group).toHaveAttribute('aria-required', 'true');
    expect(dataAttributes(group)).toEqual([]);
    expect(radio('ssd').matches(':disabled')).toBe(true);
    expect(radio('ssd')).toHaveAttribute('data-readonly');
    expect(radio('ssd')).not.toHaveAttribute('aria-readonly');
  });
});

describe('selection', () => {
  test('a click or a label selects a radio with one valueChange and one update:modelValue; a click on the checked radio emits nothing', async () => {
    const log: string[] = [];
    const details: RadioGroupChangeEventDetails[] = [];
    const group = groupModel(log, 'ssd');
    group.onValueChange = (value: unknown, given: RadioGroupChangeEventDetails) => {
      log.push(`valueChange ${String(value)}`);
      details.push(given);
    };
    const { root, radio, checked } = await mountGroup({ group, items: choices('ssd', 'hdd') });
    radio('ssd').click();
    radio('hdd').click();
    expect(log).toEqual(['valueChange hdd', 'update hdd']);
    expect(details[0]!.reason).toBe('none');
    expect(details[0]!.event.type).toBe('change');
    await userEvent.click(
      root.querySelectorAll('label')[1]!.parentElement!.querySelector('label')!,
    );
    await nextTick();
    expect(checked()).toBe('ssd');
  });

  test('a radio is checked when its value is strictly the value of the group; null can be a value', async () => {
    const group = reactive<Record<string, unknown>>({ modelValue: null });
    const { checked } = await mountGroup({
      group,
      items: [
        { key: 'none', value: null },
        { key: 'one', value: 1 },
      ],
    });
    expect(checked()).toBe('none');
    group.modelValue = '1';
    await nextTick();
    expect(checked()).toBeNull();
    group.modelValue = 1;
    await nextTick();
    expect(checked()).toBe('one');
  });

  test('a controlled group shows its prop again when the parent does not write it; undefined keeps the value', async () => {
    const log: string[] = [];
    const group = groupModel(log, 'ssd', false);
    const { radio, checked } = await mountGroup({ group, items: choices('ssd', 'hdd') });
    radio('hdd').click();
    await settle();
    expect(log).toEqual(['valueChange hdd', 'update hdd']);
    expect(checked()).toBe('ssd');
    group.modelValue = undefined;
    await nextTick();
    expect(checked()).toBe('ssd');
    radio('hdd').click();
    await nextTick();
    expect(checked()).toBe('hdd');
  });

  test('a cancel keeps the selection; with an arrow key the focus stays on the new radio', async () => {
    const log: string[] = [];
    const group = groupModel(log, 'ssd');
    group.onValueChange = (value: unknown, details: RadioGroupChangeEventDetails) => {
      log.push(`valueChange ${String(value)}`);
      details.cancel();
    };
    const { radio, checked, focused } = await mountGroup({ group, items: choices('ssd', 'hdd') });
    radio('hdd').click();
    await settle();
    expect(checked()).toBe('ssd');
    radio('ssd').focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle();
    expect(focused()).toBe('hdd');
    expect(checked()).toBe('ssd');
    expect(log).toEqual(['valueChange hdd', 'valueChange hdd']);
  });
});

describe('the keyboard', () => {
  test.each([{ name: 'storage' }, {}])(
    'the arrow keys select the next or previous enabled radio and loop; Home and End select nothing (group %o)',
    async (attrs) => {
      const log: string[] = [];
      const group = groupModel(log, 'a');
      Object.assign(group, attrs);
      const { radio, checked, focused } = await mountGroup({
        group,
        items: [
          ...choices('a'),
          { key: 'b', attrs: { disabled: true } },
          { key: 'x', fieldset: true },
          ...choices('c'),
        ],
      });
      radio('a').focus();
      const steps: string[] = [];
      for (const key of [
        '{ArrowDown}',
        '{ArrowDown}',
        '{ArrowUp}',
        '{ArrowLeft}',
        '{Home}',
        '{End}',
      ]) {
        await userEvent.keyboard(key);
        await nextTick();
        steps.push(`${focused()}:${checked()}`);
      }
      expect(steps).toEqual(['c:c', 'a:a', 'c:c', 'a:a', 'a:a', 'a:a']);
      expect(log.filter((entry) => entry.startsWith('valueChange'))).toHaveLength(4);
    },
  );

  test('with Ctrl, Alt or Meta, an arrow key selects nothing and keeps the focus in each browser', async () => {
    const log: string[] = [];
    const { radio, checked, focused } = await mountGroup({
      group: Object.assign(groupModel(log, 'a'), { name: 'storage' }),
      items: choices('a', 'b'),
    });
    for (const key of ['Control', 'Alt', 'Meta']) {
      radio('a').focus();
      await userEvent.keyboard(`{${key}>}{ArrowDown}{/${key}}`);
      await settle();
      expect(`${focused()}:${checked()}`).toBe('a:a');
    }
    expect(log).toEqual([]);
  });

  test('in right-to-left, ArrowLeft selects the next radio', async () => {
    const { root, radio, checked } = await mountGroup({
      group: { defaultValue: 'a', dir: 'rtl' },
      items: choices('a', 'b', 'c'),
    });
    expect(root.querySelector('[role=radiogroup]')).toHaveAttribute('dir', 'rtl');
    radio('a').focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(checked()).toBe('b');
    await userEvent.keyboard('{ArrowRight}');
    expect(checked()).toBe('a');
  });

  test('the group is one tab stop: the checked radio, or the first enabled one; Tab leaves the group', async () => {
    const group = reactive<Record<string, unknown>>({ defaultValue: 'b' });
    const items = reactive<Item[]>([...choices('a', 'b', 'c')]);
    const { root, radio, focused } = await mountGroup({ group, items });
    // The tab stop has no `tabindex`, and each other radio has -1.
    const stops = () =>
      [...root.querySelectorAll<HTMLInputElement>('[role=radiogroup] input')]
        .filter((input) => !input.hasAttribute('tabindex') && !input.disabled)
        .map((input) => input.id);
    expect(stops()).toEqual(['b']);
    root.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe('b');
    await userEvent.tab();
    expect(focused()).toBe('after');
    items[1]!.attrs = { disabled: true };
    await settle();
    expect(stops()).toEqual(['a']);
    await userEvent.tab({ shift: true });
    expect(focused()).toBe('a');
    items.unshift({ key: 'z' });
    await settle();
    radio('c').click();
    await settle();
    expect(stops()).toEqual(['c']);
    group.disabled = true;
    await settle();
    expect(stops()).toEqual([]);
  });

  test('while the checked radio is disabled, the first enabled radio is the tab stop, and the checked radio has no name', async () => {
    const { root, radio, focused } = await mountGroup({
      group: { defaultValue: 'b', name: 'storage' },
      items: [{ key: 'a' }, { key: 'b', attrs: { disabled: true } }, { key: 'c' }],
    });
    expect(radio('a')).not.toHaveAttribute('tabindex');
    expect(radio('c')).toHaveAttribute('tabindex', '-1');
    // WebKit gives no other radio of a named group the focus from Tab while the checked radio of
    // the group is disabled.
    expect(radio('b')).not.toHaveAttribute('name');
    expect(radio('a')).toHaveAttribute('name', 'storage');
    root.querySelector<HTMLElement>('#before')!.focus();
    await userEvent.tab();
    expect(focused()).toBe('a');
    await userEvent.tab();
    expect(focused()).toBe('after');
    await userEvent.tab({ shift: true });
    expect(focused()).toBe('a');
  });

  test('a required group whose checked radio is disabled passes the native check, as with native radios', async () => {
    const b = reactive<Record<string, unknown>>({ disabled: true });
    const { root, radio } = await mountGroup({
      group: { defaultValue: 'b', name: 'storage', required: true },
      items: [{ key: 'a' }, { key: 'b', attrs: b }],
    });
    const form = root.querySelector('form')!;
    expect(radio('b')).not.toHaveAttribute('name');
    expect(radio('a').required).toBe(false);
    expect(form.checkValidity()).toBe(true);
    b.disabled = false;
    await nextTick();
    expect(radio('a').required).toBe(true);
    expect(form.checkValidity()).toBe(true);
  });

  test('the tab stop and the arrow keys follow the order of the document, not the order of the mounts', async () => {
    const items = reactive<Item[]>(choices('a', 'c'));
    const { radio, checked } = await mountGroup({ items });
    items.unshift({ key: 'z' });
    await settle();
    expect(radio('z')).not.toHaveAttribute('tabindex');
    expect(radio('a')).toHaveAttribute('tabindex', '-1');
    items.splice(2, 0, { key: 'b' });
    await settle();
    radio('a').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(checked()).toBe('b');
  });
});

describe('read-only', () => {
  test('a click, a label, Space and an arrow key select nothing; the arrow keys move the focus; required has no effect', async () => {
    const log: string[] = [];
    const group = groupModel(log, 'a');
    Object.assign(group, { readonly: true, required: true, name: 'storage' });
    const { root, radio, checked, focused } = await mountGroup({ group, items: choices('a', 'b') });
    radio('b').click();
    await userEvent.click(root.querySelectorAll('label')[1]!);
    radio('a').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(focused()).toBe('b');
    await userEvent.keyboard(' ');
    expect(checked()).toBe('a');
    expect(log).toEqual([]);
    expect(radio('a').required).toBe(false);
    expect(root.querySelector('form')!.checkValidity()).toBe(true);
  });
});

describe('read-only and required on one radio', () => {
  test('a read-only radio has data-readonly and no required; a click and an arrow key reach it and select nothing', async () => {
    const log: string[] = [];
    const { radio, checked, focused } = await mountGroup({
      group: Object.assign(groupModel(log, 'a'), { name: 'storage' }),
      items: [{ key: 'a' }, { key: 'b', attrs: { readonly: true, required: true } }],
    });
    expect(radio('b')).toHaveAttribute('data-readonly');
    expect(radio('a')).not.toHaveAttribute('data-readonly');
    expect(radio('b').required).toBe(false);
    radio('b').click();
    radio('a').focus();
    await userEvent.keyboard('{ArrowDown}');
    await settle();
    expect(`${focused()}:${checked()}`).toBe('b:a');
    expect(log).toEqual([]);
  });

  test('the state of a radio says required for its own prop or for the group, and a required radio makes the group required', async () => {
    const group = reactive<Record<string, unknown>>({ name: 'storage' });
    const b = reactive<Record<string, unknown>>({ required: true });
    const {
      root,
      radio,
      group: element,
    } = await mountGroup({
      group,
      items: [{ key: 'a' }, { key: 'b', attrs: b }],
    });
    const form = root.querySelector('form')!;
    expect(radio('b').required).toBe(true);
    expect(radio('a').required).toBe(false);
    expect(element).toHaveAttribute('aria-required', 'true');
    // HTML makes the group required when one of its radios is required.
    expect(radio('a').validity.valueMissing).toBe(true);
    expect(form.checkValidity()).toBe(false);
    b.readonly = true;
    await nextTick();
    // A required read-only radio does not block a native submit.
    expect(form.checkValidity()).toBe(true);
    b.readonly = false;
    group.readonly = true;
    await nextTick();
    // A required radio in a read-only group does not block a native submit.
    expect(form.checkValidity()).toBe(true);
    b.required = false;
    group.readonly = false;
    await nextTick();
    expect(element).not.toHaveAttribute('aria-required');
  });
});

describe('native forms', () => {
  test('a group with a name gives one entry; with no name, disabled or a disabled checked radio it gives none', async () => {
    const group = reactive<Record<string, unknown>>({ name: 'storage', defaultValue: 'ssd' });
    const ssd = reactive<Record<string, unknown>>({});
    const { root, radio } = await mountGroup({
      group,
      items: [{ key: 'ssd', attrs: ssd }, ...choices('hdd')],
    });
    const data = () => [...new FormData(root.querySelector('form')!)];
    expect(data()).toEqual([['storage', 'ssd']]);
    radio('hdd').click();
    await nextTick();
    expect(data()).toEqual([['storage', 'hdd']]);
    radio('ssd').click();
    ssd.disabled = true;
    await nextTick();
    expect(data()).toEqual([]);
    ssd.disabled = false;
    group.disabled = true;
    await nextTick();
    expect(data()).toEqual([]);
    group.disabled = false;
    group.name = undefined;
    await nextTick();
    expect(data()).toEqual([]);
  });

  test('with the form prop, the form of that id gets the entry', async () => {
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other';
    try {
      const { root } = await mountGroup({
        group: { name: 'storage', form: 'other', defaultValue: 'ssd' },
        items: choices('ssd'),
      });
      expect([...new FormData(root.querySelector('form')!)]).toEqual([]);
      expect([...new FormData(other)]).toEqual([['storage', 'ssd']]);
    } finally {
      other.remove();
    }
  });

  test('a required group with a name and no value blocks the submit, and the first enabled radio gets the focus', async () => {
    const { radio, focused, submit } = await mountGroup({
      group: { name: 'storage', required: true },
      items: [{ key: 'ssd', attrs: { disabled: true } }, ...choices('hdd')],
      form: { novalidate: false },
    });
    submit();
    expect(radio('hdd').validity.valueMissing).toBe(true);
    expect(focused()).toBe('hdd');
  });

  test('a reset gives the first value with one update:modelValue; nothing for no change, a prevented reset or another form', async () => {
    const log: string[] = [];
    const group = groupModel(log, 'ssd', false);
    const { root, radio, checked } = await mountGroup({ group, items: choices('ssd', 'hdd') });
    const form = root.querySelector('form')!;
    form.reset();
    await settle();
    expect(log).toEqual([]);
    group.modelValue = 'hdd';
    await nextTick();
    const prevent = (event: Event) => event.preventDefault();
    window.addEventListener('reset', prevent);
    form.reset();
    window.removeEventListener('reset', prevent);
    await settle();
    expect(log).toEqual([]);
    form.reset();
    await settle();
    group.modelValue = 'hdd';
    form.reset();
    await settle();
    expect(log).toEqual(['update ssd', 'update ssd']);
    expect(checked()).toBe('hdd');
    expect(radio('ssd').checked).toBe(false);
  });
});

describe('in a field', () => {
  test('the label names the group; the group has aria-invalid, and each radio data-invalid', async () => {
    const field = reactive<Record<string, unknown>>({ invalid: true });
    const { root, group, radio } = await mountGroup({ items: choices('ssd'), field });
    const label = root.querySelector('label')!;
    expect(label).not.toHaveAttribute('for');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(group).toHaveAttribute('aria-describedby', 'description error');
    expect(group).toHaveAttribute('aria-invalid', 'true');
    expect(group).not.toHaveAttribute('data-invalid');
    expect(radio('ssd')).toHaveAttribute('aria-describedby', 'description error');
    expect(radio('ssd')).toHaveAttribute('data-invalid');
    expect(radio('ssd')).not.toHaveAttribute('aria-invalid');
    const readonly = await mountGroup({
      group: { readonly: true },
      items: choices('a'),
      field: { invalid: true },
    });
    expect(readonly.group).not.toHaveAttribute('aria-invalid');
    const disabled = await mountGroup({ items: choices('b'), field: { disabled: true } });
    expect(disabled.group).toHaveAttribute('aria-disabled', 'true');
    expect(disabled.radio('b').matches(':disabled')).toBe(true);
  });

  test('the field gets the value: filled, dirty and validate; it is touched when the focus leaves the group', async () => {
    const validated: unknown[] = [];
    const { root, radio } = await mountGroup({
      items: choices('ssd', 'hdd'),
      field: {
        validationMode: 'blur',
        validate: (value: unknown) => (validated.push(value), value ? null : 'Pick one.'),
      },
    });
    const field = root.querySelector('form > div')!;
    expect(field).not.toHaveAttribute('data-filled');
    radio('ssd').focus();
    radio('hdd').focus();
    await settle();
    expect(field).not.toHaveAttribute('data-touched');
    await leave(radio('hdd'));
    expect(validated).toEqual([undefined]);
    expect(field).toHaveAttribute('data-invalid');
    radio('hdd').click();
    await settle();
    expect(dataAttributes(field)).toEqual([
      'data-dirty',
      'data-filled',
      'data-touched',
      'data-valid',
    ]);
    expect(dataAttributes(radio('hdd'))).toEqual(['data-dirty', 'data-touched', 'data-valid']);
    root.querySelector('form')!.reset();
    await settle();
    expect(dataAttributes(field)).toEqual([]);
  });

  test.each(['blur', 'submit'])(
    'BUG-1425: a required group with no value and no change is invalid after a leave only in %s mode',
    async (validationMode) => {
      const { root, group, radio } = await mountGroup({
        group: { required: true },
        items: choices('ssd', 'hdd'),
        field: { name: 'storage', validationMode },
      });
      const field = root.querySelector('form > div')!;
      radio('ssd').focus();
      await leave(radio('ssd'));
      expect(field).toHaveAttribute('data-touched');
      expect(field).not.toHaveAttribute('data-dirty');
      if (validationMode === 'submit') {
        expect(root.querySelector('#error')).toBeNull();
        expect(group).not.toHaveAttribute('aria-invalid');
        return;
      }
      expect(root.querySelector('#error')).toHaveTextContent(radio('ssd').validationMessage);
      expect(group).toHaveAttribute('aria-invalid', 'true');
      radio('hdd').click();
      await settle();
      expect(root.querySelector('#error')).toBeNull();
      expect(field).toHaveAttribute('data-valid');
    },
  );

  test('no value and null are the same for dirty', async () => {
    const group = reactive<Record<string, unknown>>({});
    const { root } = await mountGroup({ group, items: choices('ssd'), field: {} });
    group.modelValue = null;
    await nextTick();
    expect(root.querySelector('form > div')).not.toHaveAttribute('data-dirty');
  });

  test('a Form focuses the tab stop of an invalid group; a change removes the error', async () => {
    const form = reactive<Record<string, unknown>>({ errors: { storage: 'Taken.' } });
    form['onUpdate:errors'] = (errors: unknown) => (form.errors = errors);
    const { radio, focused, submit } = await mountGroup({
      group: { defaultValue: 'hdd' },
      items: choices('ssd', 'hdd'),
      field: { name: 'storage' },
      form,
    });
    expect(radio('ssd').name).toBe('storage');
    submit();
    expect(focused()).toBe('hdd');
    radio('ssd').click();
    await settle();
    expect(form.errors).toEqual({});
  });

  test('a Field.Item gives its radio a label, a description and its own disabled state', async () => {
    const { root, radio, checked } = await mountGroup({
      group: { defaultValue: 'ssd' },
      items: [
        { key: 'ssd', item: {} },
        { key: 'hdd', item: { disabled: true } },
        { key: 'nvme', item: {} },
      ],
      field: {},
    });
    const items = root.querySelectorAll('[role=radiogroup] > div');
    expect(items[0]!.querySelector('label')).toHaveAttribute('for', 'ssd');
    expect(radio('ssd')).toHaveAttribute('aria-describedby', 'description ssd-description');
    expect(radio('hdd').matches(':disabled')).toBe(true);
    expect(items[1]).toHaveAttribute('data-disabled');
    radio('ssd').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(checked()).toBe('nvme');
  });
});

describe('in a fieldset', () => {
  test.each([false, true])(
    'the legend of a Fieldset.Root names the group; a disabled fieldset disables it (native fieldset: %s)',
    async (native) => {
      const scene = reactive({ disabled: false });
      const { root } = mount(RadiosInFieldset, { scene, native });
      await settle();
      const group = root.querySelector('[role=radiogroup]')!;
      if (!native) expect(group).toHaveAttribute('aria-labelledby', 'legend');
      scene.disabled = true;
      await settle();
      expect(group).toHaveAttribute('aria-disabled', 'true');
      expect(root.querySelector('#ssd')!.matches(':disabled')).toBe(true);
    },
  );
});
