import axe from 'axe-core';
import { describe, expect, test, vi } from 'vitest';
import { page } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import { dataAttributes } from '../../test/field';
import FieldsetElementReplaced from '../../test/fixtures/FieldsetElementReplaced.vue';
import FieldsetInField from '../../test/fixtures/FieldsetInField.vue';
import FieldsetInTransition from '../../test/fixtures/FieldsetInTransition.vue';
import FieldsetParts from '../../test/fixtures/FieldsetParts.vue';
import LegendAlone from '../../test/fixtures/LegendAlone.vue';
import NestedFieldsets from '../../test/fixtures/NestedFieldsets.vue';
import PartsInFieldset from '../../test/fixtures/PartsInFieldset.vue';
import { mount, settle } from '../../test/render';

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
    expect(fieldset.getAttributeNames().sort()).toEqual(['class', 'data-kind', 'name']);
    expect(exposed.root.element).toBe(fieldset);
    fieldset.click();
    expect(onClick).toHaveBeenCalledTimes(1);
    attrs.disabled = true;
    await settle();
    expect(fieldset.getAttributeNames().sort()).toEqual(['class', 'data-kind', 'disabled', 'name']);
    expect(root.querySelector('.state')).toHaveTextContent('true');
    expect(root.querySelector('input')).toBeDisabled();
  });

  test('the legend has its id or a generated one; a legend with no root gives no error', async () => {
    const attrs = reactive<Record<string, unknown>>({});
    const { root, exposed } = mount(FieldsetParts, { legend: attrs });
    await nextTick();
    const legend = root.querySelector('legend')!;
    expect(legend.id).not.toBe('');
    expect(exposed.legend.element).toBe(legend);
    attrs.id = 'billing';
    await nextTick();
    expect(legend.id).toBe('billing');
    const [own, generated] = mount(LegendAlone).root.querySelectorAll('legend');
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
      expect(group.firstElementChild!.tagName).toBe('LEGEND');
      if (tag === 'fieldset') {
        expect(group).not.toHaveAttribute('data-disabled');
        expect(group.querySelector('#inside')).toBeDisabled();
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
    await expect.element(page.getByRole('group', { name: 'Billing' })).toBeInTheDocument();
    attrs['aria-label'] = 'Invoice';
    await expect.element(page.getByRole('group', { name: 'Invoice' })).toBeInTheDocument();
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
      // The outer fieldset also disables the legend of the inner one.
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
      expect(fieldInLegend).not.toHaveAttribute('data-disabled');
    },
  );
});

describe('the parts of the library in a disabled fieldset', () => {
  test.each([false, true])(
    'a part is disabled, and a part in the first legend is not (native fieldset: %s)',
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
      expect(inLegend).toBeEnabled();
      expect(inLegend.parentElement).not.toHaveAttribute('data-disabled');
      expect([...new FormData(root.querySelector('form')!).keys()]).toEqual(['in-legend']);
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
