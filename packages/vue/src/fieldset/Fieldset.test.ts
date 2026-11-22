import axe from 'axe-core';
import { describe, expect, test, vi } from 'vitest';
import { nextTick, reactive } from 'vue';
import { dataAttributes } from '../../test/field';
import FieldsetElementReplaced from '../../test/fixtures/FieldsetElementReplaced.vue';
import FieldsetGroupRoot from '../../test/fixtures/FieldsetGroupRoot.vue';
import FieldsetGroupRootInField from '../../test/fixtures/FieldsetGroupRootInField.vue';
import FieldsetInField from '../../test/fixtures/FieldsetInField.vue';
import FieldsetInTransition from '../../test/fixtures/FieldsetInTransition.vue';
import FieldsetLegends from '../../test/fixtures/FieldsetLegends.vue';
import FieldsetParts from '../../test/fixtures/FieldsetParts.vue';
import LegendAlone from '../../test/fixtures/LegendAlone.vue';
import NestedFieldsets from '../../test/fixtures/NestedFieldsets.vue';
import PartsInFieldset from '../../test/fixtures/PartsInFieldset.vue';
import { mount, settle } from '../../test/render';
import { screen } from '../../test/queries';

describe('the parts', () => {
  test('the root is a fieldset with the attributes of the developer, and disabled follows its prop', async () => {
    const onClick = vi.fn();
    const attrs = reactive<Record<string, unknown>>({
      name: 'billing',
      class: 'Group',
      'data-kind': 'billing',
      onClick,
    });
    const { root, exposed } = mount(FieldsetParts, { root: attrs });
    await nextTick();
    const fieldset = root.querySelector('fieldset')!;
    expect(root.children).toHaveLength(1);
    const named = ['aria-labelledby', 'class', 'data-kind'];
    expect(fieldset.getAttributeNames().sort()).toEqual([...named, 'name']);
    expect(exposed.root.element).toBe(fieldset);
    fieldset.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    attrs.disabled = true;
    await settle();
    expect(fieldset.getAttributeNames().sort()).toEqual([...named, 'disabled', 'name']);
    expect(root.querySelector('.state')).toHaveTextContent('true');
    expect(root.querySelector('input')).toBeDisabled();
  });

  test('VUE-218: the legend is a div with its id or a generated one; a legend with no root gives no error', async () => {
    const attrs = reactive<Record<string, unknown>>({});
    const { root, exposed } = mount(FieldsetParts, { legend: attrs });
    await nextTick();
    const legend = root.querySelector('fieldset > div')!;
    expect(legend).toHaveTextContent('Billing');
    expect(legend.id).not.toBe('');
    expect(exposed.legend.element).toBe(legend);
    attrs.id = 'billing';
    await nextTick();
    expect(legend.id).toBe('billing');
    const [own, generated] = mount(LegendAlone).root.querySelectorAll('div');
    expect(own!.id).toBe('own');
    expect(generated!.id).not.toBe('');
  });

  test('the element slot renders the element of the developer; an element that is not a fieldset shows data-disabled', async () => {
    for (const tag of ['fieldset', 'div'] as const) {
      const { root } = mount(FieldsetElementReplaced, { scene: { disabled: true }, tag });
      await nextTick();
      const group = root.querySelector('.Group')!;
      expect(group.tagName).toBe(tag.toUpperCase());
      expect(group).toHaveAttribute('data-state-disabled');
      expect(group).toHaveAccessibleName('Billing');
      // A root that is not a `<fieldset>` disables its parts too.
      expect(group.querySelector('#inside')).toBeDisabled();
      expect(group.querySelector('#in-field')).toBeDisabled();
      if (tag === 'fieldset') {
        expect(group).not.toHaveAttribute('data-disabled');
      } else {
        expect(group).toHaveAttribute('data-disabled');
      }
    }
  });

  test('the root renders its element as the root, for Transition', async () => {
    const scene = reactive({ shown: false });
    const { root } = mount(FieldsetInTransition, { scene });
    scene.shown = true;
    await nextTick();
    expect(root.querySelector('fieldset')).toHaveClass('v-enter-from', 'v-enter-active');
  });
});

describe('the name of the group', () => {
  test('the legend names the group, and an aria-label of the developer wins', async () => {
    const attrs = reactive<Record<string, unknown>>({});
    mount(FieldsetParts, { root: attrs });
    expect(screen.getByRole('group', { name: 'Billing' })).toBeInTheDocument();
    attrs['aria-label'] = 'Invoice';
    expect(await screen.findByRole('group', { name: 'Invoice' })).toBeInTheDocument();
  });

  test('VUE-131: the first legend names the root, and the next one when the first goes; each has its own id', async () => {
    const scene = reactive({ legend: 'two' as const, first: true });
    const { root } = mount(FieldsetLegends, { scene });
    await nextTick();
    const fieldset = root.querySelector('fieldset')!;
    const [first, second] = [root.querySelector('.first')!, root.querySelector('.second')!];
    expect(first.id).not.toBe(second.id);
    expect(fieldset).toHaveAccessibleName('Billing');
    scene.first = false;
    await nextTick();
    expect(fieldset).toHaveAccessibleName('Invoice');
  });

  test.each(['radio', 'checkbox', 'slider'] as const)(
    'a %s group that the element slot renders has the name of the legend once, and an attribute of the developer wins',
    async (group) => {
      const attrs = reactive<Record<string, unknown>>({});
      const { root } = mount(FieldsetGroupRoot, { group, root: attrs });
      await nextTick();
      const element = root.querySelector('.Group')!;
      const legendId = root.querySelector('.Group > div')!.id;
      expect(element).toHaveAttribute('aria-labelledby', legendId);
      expect(element).toHaveAccessibleName('Storage');
      for (const [name, value] of [
        ['aria-label', 'Disks'],
        ['aria-label', ''],
        ['aria-labelledby', ''],
      ]) {
        attrs[name!] = value;
        await nextTick();
        expect(element).not.toHaveAttribute('aria-labelledby', legendId);
        expect(element).toHaveAccessibleName(value);
        delete attrs[name!];
        await nextTick();
        expect(element).toHaveAttribute('aria-labelledby', legendId);
      }
    },
  );

  test('a group that the element slot renders takes the label of its field when the root has no legend', async () => {
    const { root } = mount(FieldsetGroupRootInField);
    await settle();
    expect(root.querySelector('.Group')).toHaveAccessibleName('Storage');
  });

  test('a root with a legend and labelled inputs has no accessibility violation', async () => {
    const { root } = mount(PartsInFieldset, { scene: { disabled: false } });
    await nextTick();
    const results = await axe.run(root);
    expect(results.violations).toEqual([]);
  });
});

describe('nested fieldsets', () => {
  test.each([false, true])(
    'a root in a disabled fieldset is disabled, and its attribute follows its own prop (native fieldset around: %s)',
    async (native) => {
      const scene = reactive({ outer: true, inner: false });
      const { root } = mount(NestedFieldsets, { scene, native });
      await settle();
      const inner = root.querySelector('#inner')!;
      const state = () => root.querySelector('.state')!.textContent;
      expect(inner.matches(':disabled')).toBe(true);
      expect(inner).not.toHaveAttribute('disabled');
      expect(inner).not.toHaveAttribute('data-disabled');
      expect(state()).toBe('true');
      expect(root.querySelector('#nested')).toBeDisabled();
      const nestedField = root.querySelector('#nested-field')!;
      const fieldInLegend = root.querySelector('#field-in-legend')!;
      // The legend of the inner root is a `<div>`, so each disabled fieldset disables it.
      expect(nestedField).toHaveAttribute('data-disabled');
      expect(fieldInLegend).toHaveAttribute('data-disabled');
      scene.outer = false;
      await settle();
      expect(state()).toBe('false');
      expect(root.querySelector('#nested')).toBeEnabled();
      expect(nestedField).not.toHaveAttribute('data-disabled');
      scene.inner = true;
      await settle();
      expect(inner).toHaveAttribute('disabled');
      expect(state()).toBe('true');
      expect(nestedField).toHaveAttribute('data-disabled');
      expect(fieldInLegend).toHaveAttribute('data-disabled');
    },
  );
});

describe('the parts of the library in a disabled fieldset', () => {
  test.each([false, true])(
    'a part is disabled; a part in the first <legend> of a native fieldset is not, and a part in Fieldset.Legend is (native fieldset: %s)',
    async (native) => {
      const { root } = mount(PartsInFieldset, { scene: { disabled: true }, native });
      await settle();
      const company = root.querySelector('#company')!;
      const field = company.parentElement!;
      expect(dataAttributes(field)).toEqual(['data-disabled']);
      for (const part of field.querySelectorAll('label, p')) {
        expect(part).toHaveAttribute('data-disabled');
      }
      expect(company).toBeDisabled();
      expect(root.querySelector('#alone')).toBeDisabled();
      expect(root.querySelector('#alone')).toHaveAttribute('data-state-disabled');
      const inLegend = root.querySelector('#in-legend')!;
      if (native) {
        expect(inLegend).toBeEnabled();
        expect(inLegend.parentElement).not.toHaveAttribute('data-disabled');
      } else {
        expect(inLegend).toBeDisabled();
        expect(inLegend.parentElement).toHaveAttribute('data-disabled');
      }
      expect([...new FormData(root.querySelector('form')!).keys()]).toEqual(
        native ? ['in-legend'] : [],
      );
    },
  );

  test.each([false, true])(
    'a part follows the fieldset, and its own disabled prop holds (native fieldset: %s)',
    async (native) => {
      const scene = reactive({ disabled: false });
      const field = reactive<Record<string, unknown>>({});
      const { root } = mount(PartsInFieldset, { scene, native, field });
      await settle();
      const fieldRoot = root.querySelector('#company')!.parentElement!;
      const alone = root.querySelector('#alone')!;
      expect(fieldRoot).not.toHaveAttribute('data-disabled');
      scene.disabled = true;
      await settle();
      expect(fieldRoot).toHaveAttribute('data-disabled');
      expect(alone).toHaveAttribute('data-state-disabled');
      scene.disabled = false;
      await settle();
      expect(fieldRoot).not.toHaveAttribute('data-disabled');
      expect(alone).not.toHaveAttribute('data-state-disabled');
      field.disabled = true;
      scene.disabled = true;
      await settle();
      scene.disabled = false;
      await settle();
      expect(fieldRoot).toHaveAttribute('data-disabled');
    },
  );

  test.each([false, true])(
    'a field in a disabled fieldset has no validity, and the form does not validate it (native fieldset: %s)',
    async (native) => {
      const scene = reactive({ disabled: false });
      const submitted = vi.fn();
      const validated: unknown[] = [];
      const { root } = mount(PartsInFieldset, {
        scene,
        native,
        form: { onSubmit: submitted },
        field: { validate: (value: unknown) => (validated.push(value), 'Wrong.') },
      });
      await settle();
      const company = root.querySelector('#company')!;
      const submit = () => root.querySelector<HTMLButtonElement>('button[type=submit]')!.click();
      submit();
      await nextTick();
      expect(company).toHaveAttribute('aria-invalid', 'true');
      scene.disabled = true;
      await settle();
      expect(company).not.toHaveAttribute('aria-invalid');
      expect(company.parentElement!.querySelector(':scope > div')).toBeNull();
      submit();
      expect(submitted).toHaveBeenCalledTimes(1);
      expect(validated).toEqual(['']);
    },
  );

  test('a fieldset in a field disables only what is in it', async () => {
    const scene = reactive({ disabled: true });
    const { root } = mount(FieldsetInField, { scene });
    await settle();
    const field = root.firstElementChild!;
    expect(root.querySelector('#company')).toBeDisabled();
    expect(field).not.toHaveAttribute('data-disabled');
    expect(field).not.toHaveAttribute('data-invalid');
    scene.disabled = false;
    await settle();
    expect(field).toHaveAttribute('data-invalid');
  });
});
