import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import ComboboxInline from '../../test/fixtures/ComboboxInline.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const byTestId = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('server render and hydration', () => {
  test('the server HTML of an open root has the root, the control and the form inputs, and no popup', async () => {
    const props = {
      root: { defaultOpen: true, name: 'fruit', defaultValue: 'Apple' },
      trigger: true,
    };
    const root = await renderOnServer('ComboboxParts', props);
    const input = byTestId(root, 'input')!;
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveValue('Apple');
    expect(root.querySelector('input[type="hidden"][name="fruit"]')).toHaveValue('Apple');
    expect(byTestId(root, 'popup')).toBe(null);
    hydrate(ComboboxParts, props, root);
    await nextTick();
    expect(byTestId(root, 'input')).toBe(input);
    await waitFor(() => expect(byTestId(document.body, 'popup')).not.toBe(null));
    expect(input).toHaveAttribute('aria-controls', byTestId(document.body, 'list')!.id);
  });

  test('a trigger before the input is the control in the server HTML and the first render, and the input is the control after the mount', async () => {
    const props = { triggerFirst: true };
    const root = await renderOnServer('ComboboxParts', props);
    const trigger = byTestId(root, 'trigger')!;
    expect(trigger).toHaveAttribute('role', 'combobox');
    hydrate(ComboboxParts, props, root);
    await waitFor(() => expect(trigger).not.toHaveAttribute('role'));
    expect(trigger).toHaveAttribute('tabindex', '-1');
    expect(byTestId(root, 'input')).toHaveAttribute('role', 'combobox');
  });

  test('a root with the input in the popup has the trigger as its control', async () => {
    const props = { inputInPopup: true };
    const root = await renderOnServer('ComboboxParts', props);
    const trigger = byTestId(root, 'trigger')!;
    expect(trigger).toHaveAttribute('role', 'combobox');
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger).toHaveTextContent('Pick a fruit');
    hydrate(ComboboxParts, props, root);
    await nextTick();
    expect(trigger).toHaveAttribute('role', 'combobox');
  });

  test('a disabled portal renders the popup in place in the server HTML', async () => {
    const props = { root: { defaultOpen: true }, portal: { disabled: true } };
    const root = await renderOnServer('ComboboxParts', props);
    const popup = byTestId(root, 'popup')!;
    expect(popup.querySelectorAll('[role="option"]')).toHaveLength(10);
    hydrate(ComboboxParts, props, root);
    await nextTick();
    expect(byTestId(root, 'popup')).toBe(popup);
  });

  test('the list of an inline root is in the server HTML; the text of its status comes after the mount', async () => {
    const root = await renderOnServer('ComboboxInline');
    expect(byTestId(root, 'list')!.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(byTestId(root, 'input')).toHaveAttribute('aria-expanded', 'true');
    expect(byTestId(root, 'status')).toHaveTextContent('');
    hydrate(ComboboxInline, {}, root);
    await waitFor(() => expect(byTestId(root, 'status')).toHaveTextContent('Three fruits.'));
  });
});
