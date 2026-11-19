import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { CheckboxChangeEventDetails } from '@vase-ui/vue/checkbox';
import { dataAttributes, leave } from '../../test/field';
import AppleGroup from '../../test/fixtures/AppleGroup.vue';
import GroupInFieldset from '../../test/fixtures/GroupInFieldset.vue';
import { mount, settle } from '../../test/render';

type Item = {
  key: string;
  value?: string;
  parent?: boolean;
  attrs?: Record<string, unknown>;
  item?: Record<string, unknown>;
};

const apples = (...keys: string[]): Item[] => keys.map((key) => ({ key, value: key }));
const parent: Item = { key: 'all', parent: true };

async function mountGroup(props: {
  group?: Record<string, unknown>;
  items: Item[];
  field?: Record<string, unknown>;
  form?: Record<string, unknown>;
}) {
  const { root, exposed } = mount(AppleGroup, props);
  await nextTick();
  return {
    root,
    exposed,
    group: root.querySelector<HTMLElement>('[role=group]')!,
    box: (key: string) => root.querySelector<HTMLInputElement>(`#${key}`)!,
    checked: () =>
      [...root.querySelectorAll<HTMLInputElement>('input:checked')].map((box) => box.id),
    submit: () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click(),
  };
}

/** `v-model` on a group that writes each event in `log`. */
function groupModel(log: string[], modelValue: unknown, write = true) {
  const group = reactive<Record<string, unknown>>({
    modelValue,
    onValueChange: (value: string[]) => log.push(`valueChange ${value.join(',')}`),
  });
  group['onUpdate:modelValue'] = (value: string[]) => {
    log.push(`group ${value.join(',')}`);
    if (write) group.modelValue = value;
  };
  return group;
}

function recordBox(log: string[], name: string, attrs: Record<string, unknown> = {}) {
  return reactive<Record<string, unknown>>({
    onCheckedChange: (checked: boolean) => log.push(`${name} checkedChange ${checked}`),
    'onUpdate:modelValue': (checked: boolean) => log.push(`${name} ${checked}`),
    ...attrs,
  });
}

describe('the group', () => {
  test('is a div with role group and the attributes of the developer; disabled wins over its checkboxes', async () => {
    const attrs = reactive<Record<string, unknown>>({ class: 'Apples', 'aria-label': 'Apples' });
    const { root, exposed, group, box } = await mountGroup({
      group: attrs,
      items: [{ key: 'fuji', value: 'fuji', attrs: { disabled: false } }],
    });
    expect(group.tagName).toBe('DIV');
    expect(group).toHaveClass('Apples');
    expect(group).not.toHaveAttribute('aria-labelledby');
    expect(exposed.group.element).toBe(group);
    attrs.disabled = true;
    await nextTick();
    expect(group).toHaveAttribute('data-disabled');
    expect(group).not.toHaveAttribute('aria-disabled');
    expect(root.querySelector('.state')).toHaveTextContent('true');
    expect(box('fuji').matches(':disabled')).toBe(true);
  });

  test('a press adds the value at the end or removes it; the events come in order with one details object', async () => {
    const log: string[] = [];
    const details: CheckboxChangeEventDetails[] = [];
    const first = ['fuji'];
    const group = groupModel(log, first);
    group.onValueChange = (value: string[], given: CheckboxChangeEventDetails) => {
      log.push(`valueChange ${value.join(',')}`);
      details.push(given);
    };
    const gala = recordBox(log, 'gala', {
      onCheckedChange: (checked: boolean, given: CheckboxChangeEventDetails) => {
        log.push(`gala checkedChange ${checked}`);
        details.push(given);
      },
    });
    const { box } = await mountGroup({
      group,
      items: [
        { key: 'fuji', value: 'fuji' },
        { key: 'gala', value: 'gala', attrs: gala },
      ],
    });
    box('gala').click();
    expect(log).toEqual([
      'gala checkedChange true',
      'valueChange fuji,gala',
      'group fuji,gala',
      'gala true',
    ]);
    expect(details[0]).toBe(details[1]);
    expect(first).toEqual(['fuji']);
    await nextTick();
    box('fuji').click();
    expect(group.modelValue).toEqual(['gala']);
  });

  test('VUE-35: a controlled group shows its prop again, follows a change in place, and null is empty', async () => {
    const log: string[] = [];
    const group = groupModel(log, null, false);
    const { box, checked } = await mountGroup({ group, items: apples('fuji', 'gala') });
    box('fuji').click();
    await settle();
    expect(log).toEqual(['valueChange fuji', 'group fuji']);
    expect(checked()).toEqual([]);
    const value = reactive(['fuji']);
    group.modelValue = value;
    await nextTick();
    value.push('gala');
    await nextTick();
    expect(checked()).toEqual(['fuji', 'gala']);
    group.modelValue = undefined;
    await nextTick();
    expect(checked()).toEqual(['fuji', 'gala']);
    box('gala').click();
    await nextTick();
    expect(checked()).toEqual(['fuji']);
  });

  test('a cancel in checkedChange or in valueChange keeps every state', async () => {
    const log: string[] = [];
    const group = groupModel(log, []);
    group.onValueChange = (value: string[], details: CheckboxChangeEventDetails) => {
      log.push(`valueChange ${value.join(',')}`);
      if (value.includes('gala')) details.cancel();
    };
    const fuji = recordBox(log, 'fuji', {
      onCheckedChange: (checked: boolean, details: CheckboxChangeEventDetails) => {
        log.push(`fuji checkedChange ${checked}`);
        details.cancel();
      },
    });
    const { box, checked } = await mountGroup({
      group,
      items: [
        { key: 'fuji', value: 'fuji', attrs: fuji },
        { key: 'gala', value: 'gala', attrs: recordBox(log, 'gala') },
      ],
    });
    box('fuji').click();
    box('gala').click();
    await settle();
    expect(log).toEqual(['fuji checkedChange true', 'gala checkedChange true', 'valueChange gala']);
    expect(checked()).toEqual([]);
  });

  test('VUE-42: a checkbox with no value keeps its own state, a value with no checkbox stays, and a checkbox emits only for its press', async () => {
    const log: string[] = [];
    const group = groupModel(log, ['fuji', 'pink']);
    const items = reactive<Item[]>([
      { key: 'fuji', value: 'fuji', attrs: recordBox(log, 'fuji') },
      { key: 'gala', value: 'gala' },
      { key: 'other' },
    ]);
    const { box, checked } = await mountGroup({ group, items });
    box('other').click();
    await nextTick();
    expect(checked()).toEqual(['fuji', 'other']);
    expect(group.modelValue).toEqual(['fuji', 'pink']);
    box('gala').click();
    expect(group.modelValue).toEqual(['fuji', 'pink', 'gala']);
    items.splice(1, 1);
    await nextTick();
    expect(group.modelValue).toEqual(['fuji', 'pink', 'gala']);
    items.push({ key: 'gala', value: 'gala' });
    await nextTick();
    expect(box('gala').checked).toBe(true);
    log.length = 0;
    group.modelValue = [];
    await nextTick();
    expect(log).toEqual([]);
    expect(box('fuji').checked).toBe(false);
  });
});

describe('the parent checkbox', () => {
  test('is unchecked, indeterminate or checked from allValues; another value does not count and stays', async () => {
    const { box } = await mountGroup({
      group: { allValues: ['fuji', 'gala'], defaultValue: ['pink'] },
      items: [parent, ...apples('fuji', 'gala', 'pink')],
    });
    const all = box('all');
    expect(all.checked).toBe(false);
    expect(all.indeterminate).toBe(false);
    box('fuji').click();
    await nextTick();
    expect(all.indeterminate).toBe(true);
    expect(all).toHaveAttribute('data-indeterminate');
    box('gala').click();
    await nextTick();
    expect(all.checked).toBe(true);
    expect(all.indeterminate).toBe(false);
    all.click();
    await settle();
    expect(box('fuji').checked).toBe(false);
    expect(box('pink').checked).toBe(true);
  });

  test('ticks all, unticks all, and gives the selection back; a press on a child starts again; a cancel does not advance', async () => {
    const log: string[] = [];
    const cancel = { next: false };
    const all = recordBox(log, 'all', {
      onCheckedChange: (checked: boolean, details: CheckboxChangeEventDetails) => {
        log.push(`all checkedChange ${checked}`);
        if (cancel.next) details.cancel();
      },
    });
    const group = groupModel(log, ['fuji']);
    group.allValues = ['fuji', 'gala', 'pink'];
    const { box, checked } = await mountGroup({
      group,
      items: [{ ...parent, attrs: all }, ...apples('fuji', 'gala', 'pink')],
    });
    const press = async () => {
      box('all').click();
      await settle();
      return checked().filter((id) => id !== 'all');
    };
    expect(await press()).toEqual(['fuji', 'gala', 'pink']);
    expect(await press()).toEqual([]);
    log.length = 0;
    expect(await press()).toEqual(['fuji']);
    // The browser checked the parent, but the selection makes it indeterminate and not checked.
    expect(log).toEqual(['all checkedChange false', 'valueChange fuji', 'group fuji', 'all false']);
    cancel.next = true;
    log.length = 0;
    expect(await press()).toEqual(['fuji']);
    expect(log).toEqual(['all checkedChange true']);
    cancel.next = false;
    expect(await press()).toEqual(['fuji', 'gala', 'pink']);
    box('gala').click();
    await settle();
    expect(await press()).toEqual(['fuji', 'gala', 'pink']);
    expect(await press()).toEqual([]);
    expect(await press()).toEqual(['fuji', 'pink']);
  });

  test('a disabled child keeps its state, also when it becomes disabled after the mount', async () => {
    const gala = reactive<Record<string, unknown>>({});
    const { box, checked } = await mountGroup({
      group: { allValues: ['fuji', 'gala', 'pink'], defaultValue: ['fuji'] },
      items: [
        parent,
        { key: 'fuji', value: 'fuji', attrs: { disabled: true } },
        { key: 'gala', value: 'gala', attrs: gala },
        { key: 'pink', value: 'pink' },
      ],
    });
    gala.disabled = true;
    await nextTick();
    box('all').click();
    await settle();
    expect(checked()).toEqual(['fuji', 'pink']);
    expect(box('all').indeterminate).toBe(true);
    box('all').click();
    await settle();
    expect(checked()).toEqual(['fuji']);
  });

  test('VUE-153: a disabled child keeps its state after another child with its value unmounts', async () => {
    const items = reactive<Item[]>([
      parent,
      { key: 'gala1', value: 'gala', attrs: { disabled: true } },
      { key: 'gala2', value: 'gala' },
      { key: 'pink', value: 'pink' },
    ]);
    const { box, checked } = await mountGroup({
      group: { allValues: ['gala', 'pink'], defaultValue: ['gala'] },
      items,
    });
    items.splice(2, 1);
    await nextTick();
    box('all').click();
    await settle();
    expect(checked()).toContain('gala1');
    expect(box('pink').checked).toBe(true);
    box('all').click();
    await settle();
    expect(checked()).toContain('gala1');
    expect(box('pink').checked).toBe(false);
  });

  test('emits its new state, has no name, and names its children in aria-controls in the order of allValues', async () => {
    const log: string[] = [];
    const items = reactive<Item[]>([
      { ...parent, attrs: recordBox(log, 'all', { name: 'all' }) },
      { key: 'gala', value: 'gala', attrs: recordBox(log, 'gala') },
      { key: 'fuji', value: 'fuji', attrs: reactive({}) },
    ]);
    const group = groupModel(log, []);
    group.allValues = ['fuji', 'gala'];
    const { box } = await mountGroup({ group, items, field: { name: 'apples' } });
    const all = box('all');
    all.click();
    expect(log).toEqual([
      'all checkedChange true',
      'valueChange fuji,gala',
      'group fuji,gala',
      'all true',
    ]);
    expect(all).not.toHaveAttribute('name');
    expect(all).toHaveAttribute('aria-controls', 'fuji gala');
    items[2]!.attrs!.id = 'red';
    await nextTick();
    expect(all).toHaveAttribute('aria-controls', 'red gala');
    items.splice(1, 1);
    await nextTick();
    expect(all).toHaveAttribute('aria-controls', 'red');
  });
});

describe('in a native form', () => {
  test('each checked, enabled checkbox gives an entry with the name of the field; the parent gives none', async () => {
    const { root, box } = await mountGroup({
      group: { allValues: ['fuji', 'gala'], defaultValue: ['fuji'] },
      items: [parent, ...apples('fuji', 'gala')],
      field: { name: 'apples' },
    });
    box('gala').click();
    await nextTick();
    expect([...new FormData(root.querySelector('form')!)]).toEqual([
      ['apples', 'fuji'],
      ['apples', 'gala'],
    ]);
  });

  test('a reset gives the first value with one update:modelValue, and starts the cycle of the parent again', async () => {
    const log: string[] = [];
    const group = groupModel(log, ['fuji'], false);
    group.allValues = ['fuji', 'gala'];
    const { root, box, checked } = await mountGroup({
      group,
      items: [parent, ...apples('fuji', 'gala')],
    });
    const form = root.querySelector('form')!;
    form.reset();
    await settle();
    expect(log).toEqual([]);
    box('gala').click();
    group.modelValue = ['gala'];
    await nextTick();
    log.length = 0;
    form.reset();
    await settle();
    expect(log).toEqual(['group fuji']);
    group.modelValue = ['fuji'];
    group['onUpdate:modelValue'] = (value: string[]) => (group.modelValue = value);
    await nextTick();
    box('all').click();
    await settle();
    box('all').click();
    await settle();
    box('all').click();
    await settle();
    expect(checked()).toEqual(['fuji']);
  });
});

describe('in a field', () => {
  test('the label names the group with aria-labelledby and has no for; the descriptions describe the group and each checkbox', async () => {
    const { root, group, box } = await mountGroup({ items: apples('fuji'), field: {} });
    const label = root.querySelector('label')!;
    expect(label).not.toHaveAttribute('for');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(group).toHaveAttribute('aria-describedby', 'description');
    expect(box('fuji')).toHaveAttribute('aria-describedby', 'description');
    const disabled = await mountGroup({ items: apples('gala'), field: { disabled: true } });
    expect(disabled.group).toHaveAttribute('data-disabled');
    expect(disabled.box('gala').matches(':disabled')).toBe(true);
    const named = await mountGroup({
      group: { 'aria-label': 'Apples' },
      items: apples('gala'),
      field: {},
    });
    expect(named.group).not.toHaveAttribute('aria-labelledby');
  });

  test('the field gets the array: filled, and dirty while the items differ from the first ones', async () => {
    const { root, box } = await mountGroup({
      group: { defaultValue: ['fuji', 'gala'] },
      items: apples('fuji', 'gala'),
      field: {},
    });
    const field = root.querySelector('form > div')!;
    expect(dataAttributes(field)).toEqual(['data-filled']);
    box('fuji').click();
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-dirty', 'data-filled']);
    expect(dataAttributes(box('gala'))).toEqual(['data-dirty']);
    box('fuji').click();
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-filled']);
    box('fuji').click();
    box('gala').click();
    await nextTick();
    expect(dataAttributes(field)).toEqual(['data-dirty']);
  });

  test('validate gets the array one time for each press; the field is touched when the focus leaves the group', async () => {
    const validated: unknown[] = [];
    const field = reactive<Record<string, unknown>>({
      validationMode: 'change',
      validate: (value: string[]) => (validated.push([...value]), value.length ? null : 'Pick.'),
    });
    const { root, box } = await mountGroup({
      group: { allValues: ['fuji', 'gala'] },
      items: [parent, ...apples('fuji', 'gala')],
      field,
    });
    const fieldElement = root.querySelector('form > div')!;
    box('all').click();
    await settle();
    box('fuji').click();
    await settle();
    expect(validated).toEqual([['fuji', 'gala'], ['gala']]);
    box('gala').click();
    await settle();
    expect(box('fuji')).toHaveAttribute('aria-invalid', 'true');
    expect(box('gala')).toHaveAttribute('aria-invalid', 'true');
    box('fuji').focus();
    box('gala').focus();
    await settle();
    expect(fieldElement).not.toHaveAttribute('data-touched');
    await leave(box('gala'));
    expect(fieldElement).toHaveAttribute('data-touched');
  });

  test('a Form focuses the first enabled checkbox that is not the parent, or the first that fails; a press removes the error', async () => {
    const form = reactive<Record<string, unknown>>({ errors: { apples: 'Taken.' } });
    form['onUpdate:errors'] = (errors: unknown) => (form.errors = errors);
    const pink = reactive<Record<string, unknown>>({});
    const { box, submit } = await mountGroup({
      group: { allValues: ['fuji', 'gala', 'pink'] },
      items: [
        parent,
        { key: 'fuji', value: 'fuji', attrs: { disabled: true } },
        { key: 'gala', value: 'gala' },
        { key: 'pink', value: 'pink', attrs: pink },
      ],
      field: { name: 'apples' },
      form,
    });
    submit();
    expect(box('gala')).toHaveFocus();
    box('gala').click();
    await settle();
    expect(form.errors).toEqual({});
    pink.required = true;
    await nextTick();
    submit();
    expect(box('pink')).toHaveFocus();
  });

  test('VUE-78: a Form focuses the first checkbox in the document, also one that mounts later', async () => {
    const items = reactive<Item[]>(apples('gala', 'pink'));
    const { box, submit } = await mountGroup({
      items,
      field: { name: 'apples' },
      form: { errors: { apples: 'Taken.' } },
    });
    items.unshift({ key: 'fuji', value: 'fuji' });
    await nextTick();
    submit();
    expect(box('fuji')).toHaveFocus();
  });

  test('the message of validate goes on the first checkbox that counts, and leaves every checkbox', async () => {
    const field = {
      validationMode: 'change',
      validate: (value: string[]) => (value.includes('pink') ? null : 'Pick pink.'),
    };
    const { root, box } = await mountGroup({
      items: [{ key: 'fuji', value: 'fuji', attrs: { disabled: true } }, ...apples('gala', 'pink')],
      field,
    });
    box('gala').click();
    await settle();
    expect(box('gala').validationMessage).toBe('Pick pink.');
    box('pink').click();
    await settle();
    expect(root.querySelectorAll('input:invalid')).toHaveLength(0);
  });

  test('a Field.Item gives its checkbox a label, a description and its own disabled state', async () => {
    const { root, box } = await mountGroup({
      items: [
        { key: 'fuji', value: 'fuji', item: {} },
        { key: 'gala', value: 'gala', item: { disabled: true } },
      ],
      field: {},
    });
    const [fujiItem, galaItem] = root.querySelectorAll('[role=group] > div');
    const fujiLabel = fujiItem!.querySelector('label')!;
    expect(fujiLabel).toHaveAttribute('for', 'fuji');
    expect(box('fuji')).toHaveAttribute('aria-describedby', 'description fuji-description');
    await userEvent.click(fujiLabel);
    expect(box('fuji').checked).toBe(true);
    expect(box('gala').matches(':disabled')).toBe(true);
    expect(galaItem).toHaveAttribute('data-disabled');
    expect(galaItem!.querySelector('label')).toHaveAttribute('data-disabled');
    expect(galaItem!.querySelector('p')).toHaveAttribute('data-disabled');
    expect(fujiItem).not.toHaveAttribute('data-disabled');
  });
});

describe('in a fieldset', () => {
  test.each([false, true])(
    'the legend of a Fieldset.Root names the group; a disabled fieldset disables it (native fieldset: %s)',
    async (native) => {
      const scene = reactive({ disabled: false });
      const { root } = mount(GroupInFieldset, { scene, native });
      await settle();
      const group = root.querySelector('[role=group]')!;
      if (!native) expect(group).toHaveAttribute('aria-labelledby', 'legend');
      scene.disabled = true;
      await settle();
      expect(group).toHaveAttribute('data-disabled');
      expect(root.querySelector('#fuji')!.matches(':disabled')).toBe(true);
      expect(root.querySelector('#fuji')).toHaveAttribute('data-state-disabled');
      expect(root.querySelector('#alone')).toHaveAttribute('data-state-disabled');
    },
  );
});
