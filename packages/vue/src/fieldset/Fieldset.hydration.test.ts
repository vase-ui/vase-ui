import { describe, expect, test } from 'vitest';
import NestedFieldsets from '../../test/fixtures/NestedFieldsets.vue';
import PartsInFieldset from '../../test/fixtures/PartsInFieldset.vue';
import { hydrate, renderOnServer, settle } from '../../test/render';

describe('server render and hydration', () => {
  test('the server HTML of a disabled root has disabled and the disabled state of its parts; the legend keeps its id', async () => {
    const props = { scene: { disabled: true } };
    const root = await renderOnServer('PartsInFieldset', props);
    expect(root.querySelector('fieldset')).toHaveAttribute('disabled');
    const legendId = root.querySelector('legend')!.id;
    expect(legendId).not.toBe('');
    expect(root.querySelector('#company')!.parentElement).toHaveAttribute('data-disabled');
    expect(root.querySelector('#in-legend')!.parentElement).not.toHaveAttribute('data-disabled');
    expect(root.querySelector('#alone')).toHaveAttribute('data-state-disabled');
    hydrate(PartsInFieldset, props, root);
    await settle();
    expect(root.querySelector('legend')!.id).toBe(legendId);
    expect(root.querySelector('#company')!.parentElement).toHaveAttribute('data-disabled');
  });

  test('in a native disabled fieldset, data-disabled comes after the mount', async () => {
    const props = { scene: { disabled: true }, native: true };
    const root = await renderOnServer('PartsInFieldset', props);
    const field = root.querySelector('#company')!.parentElement!;
    expect(field).not.toHaveAttribute('data-disabled');
    expect(root.querySelector('#company')).toBeDisabled();
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
});
