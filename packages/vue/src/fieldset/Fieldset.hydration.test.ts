import { describe, expect, test } from 'vitest';
import { expectNoAxeViolations } from '../../test/axe';
import FieldsetElementReplaced from '../../test/fixtures/FieldsetElementReplaced.vue';
import FieldsetGroupRoot from '../../test/fixtures/FieldsetGroupRoot.vue';
import FieldsetLegends from '../../test/fixtures/FieldsetLegends.vue';
import FieldsetParts from '../../test/fixtures/FieldsetParts.vue';
import NestedFieldsets from '../../test/fixtures/NestedFieldsets.vue';
import PartsInFieldset from '../../test/fixtures/PartsInFieldset.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML of a disabled root has disabled and the disabled state of its parts, also in its legend; the legend keeps its id', async () => {
    const props = { scene: { disabled: true } };
    const root = await renderOnServer('PartsInFieldset', props);
    expect(root.querySelector('fieldset')).toHaveAttribute('disabled');
    const legendId = root.querySelector('fieldset > div')!.id;
    expect(legendId).not.toBe('');
    expect(root.querySelector('[name=company]')!.parentElement).toHaveAttribute('data-disabled');
    expect(root.querySelector('[name=in-legend]')!.parentElement).toHaveAttribute('data-disabled');
    expect(root.querySelector('#alone')).toHaveAttribute('data-state-disabled');
    hydrate(PartsInFieldset, props, root);
    await settle();
    expect(root.querySelector('fieldset > div')!.id).toBe(legendId);
    expect(root.querySelector('[name=company]')!.parentElement).toHaveAttribute('data-disabled');
    expect(root.querySelector('[name=in-legend]')!.parentElement).toHaveAttribute('data-disabled');
  });

  test('in a native disabled fieldset, data-disabled comes after the mount', async () => {
    const props = { scene: { disabled: true }, native: true };
    const root = await renderOnServer('PartsInFieldset', props);
    const field = root.querySelector('[name=company]')!.parentElement!;
    expect(field).not.toHaveAttribute('data-disabled');
    expect(root.querySelector('[name=company]')).toBeDisabled();
    hydrate(PartsInFieldset, props, root);
    await settle();
    expect(field).toHaveAttribute('data-disabled');
  });

  test('the server HTML of a root in a disabled root has its disabled state', async () => {
    const props = { scene: { outer: true, inner: false } };
    const root = await renderOnServer('NestedFieldsets', props);
    expect(root.querySelector('.state')).toHaveTextContent('true');
    expect(root.querySelector('#inner')).not.toHaveAttribute('disabled');
    hydrate(NestedFieldsets, props, root);
  });

  test('in a disabled root that renders a div, an input is disabled in the server HTML and after the mount, with a field and with none', async () => {
    const props = { scene: { disabled: true }, tag: 'div' };
    const root = await renderOnServer('FieldsetElementReplaced', props);
    const inputs = ['#inside', '[name=in-field]'].map((id) => root.querySelector(id)!);
    for (const input of inputs) expect(input).toBeDisabled();
    hydrate(FieldsetElementReplaced, props, root);
    await settle();
    for (const input of inputs) expect(input).toBeDisabled();
    expect(root.querySelector('[name=in-field]')!.parentElement).toHaveAttribute('data-disabled');
  });
});

describe('the name in the server HTML', () => {
  test.each(['wrapped', 'native', 'as', 'two'] as const)(
    'VUE-89: the server HTML of the root names its first legend, and the client keeps the name (legend: %s)',
    async (legend) => {
      const props = { scene: { legend } };
      const root = await renderOnServer('FieldsetLegends', props);
      const fieldset = root.querySelector('fieldset')!;
      const legendId = fieldset.getAttribute('aria-labelledby');
      const legendElement = root.querySelector(`#${legendId}`);
      expect(legendElement).toHaveTextContent('Billing');
      expect(legendElement!.localName).toBe(
        legend === 'native' || legend === 'as' ? 'legend' : 'div',
      );
      expect(fieldset).toHaveAccessibleName('Billing');
      hydrate(FieldsetLegends, props, root);
      await settle();
      expect(fieldset).toHaveAttribute('aria-labelledby', legendId);
    },
  );

  test('a legend with an id names the root from the mount on', async () => {
    const props = { legend: { id: 'own' } };
    const root = await renderOnServer('FieldsetParts', props);
    const fieldset = root.querySelector('fieldset')!;
    expect(fieldset.getAttribute('aria-labelledby')).not.toBe('own');
    hydrate(FieldsetParts, props, root);
    await settle();
    expect(fieldset).toHaveAttribute('aria-labelledby', 'own');
  });

  test('a root with no legend has the generated id and no axe violation in the server HTML, and no aria-labelledby after the mount', async () => {
    const props = { scene: { legend: 'none' } };
    const root = await renderOnServer('FieldsetLegends', props);
    const fieldset = root.querySelector('fieldset')!;
    expect(fieldset.getAttribute('aria-labelledby')).not.toBeNull();
    await expectNoAxeViolations(root);
    hydrate(FieldsetLegends, props, root);
    await settle();
    expect(fieldset).not.toHaveAttribute('aria-labelledby');
  });

  test.each([
    ['aria-label', 'Invoice'],
    ['aria-label', ''],
    ['aria-labelledby', 'heading'],
    ['aria-labelledby', ''],
  ])(
    'an attribute of the developer wins over the legend on both sides: %s="%s"',
    async (name, value) => {
      const props = { root: { [name]: value } };
      const root = await renderOnServer('FieldsetParts', props);
      const fieldset = root.querySelector('fieldset')!;
      const expectNamedByDeveloper = () => {
        expect(fieldset.getAttribute(name)).toBe(value);
        if (name === 'aria-label') expect(fieldset).not.toHaveAttribute('aria-labelledby');
      };
      expectNamedByDeveloper();
      hydrate(FieldsetParts, props, root);
      await settle();
      expectNamedByDeveloper();
    },
  );

  test.each(['radio', 'checkbox', 'slider'] as const)(
    'the server HTML of a %s group that the element slot renders has the name of the legend once, and an aria-label of the developer wins',
    async (group) => {
      const named = await renderOnServer('FieldsetGroupRoot', { group });
      const element = named.querySelector('.Group')!;
      const legendId = element.getAttribute('aria-labelledby');
      expect(named.querySelector(`#${legendId}`)).toHaveTextContent('Storage');
      hydrate(FieldsetGroupRoot, { group }, named);
      await settle();
      expect(element).toHaveAttribute('aria-labelledby', legendId);

      const props = { group, root: { 'aria-label': 'Disks' } };
      const labelled = await renderOnServer('FieldsetGroupRoot', props);
      const labelledElement = labelled.querySelector('.Group')!;
      const labelledLegendId = labelled.querySelector('.Group > div')!.id;
      expect(labelledElement).not.toHaveAttribute('aria-labelledby', labelledLegendId);
      expect(labelledElement).toHaveAccessibleName('Disks');
      hydrate(FieldsetGroupRoot, props, labelled);
      await settle();
      expect(labelledElement).not.toHaveAttribute('aria-labelledby', labelledLegendId);
      expect(labelledElement).toHaveAccessibleName('Disks');
    },
  );
});
