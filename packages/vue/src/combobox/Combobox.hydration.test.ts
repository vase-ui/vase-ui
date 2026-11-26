import { describe, expect, test } from 'vitest';
import { nextTick } from 'vue';
import ComboboxInField from '../../test/fixtures/ComboboxInField.vue';
import ComboboxInline from '../../test/fixtures/ComboboxInline.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { within } from '../../test/queries';
import { hydrate, renderOnServer } from '../../test/render';
import { waitFor } from '../../test/waitFor';

const byTestId = (root: ParentNode, id: string) =>
  root.querySelector<HTMLElement>(`[data-testid="${id}"]`);

describe('server render and hydration', () => {
  test('VUE-77: the server HTML of an open root has the root, the control and the form inputs, and no popup; the input names the list only after the mount', async () => {
    const props = {
      root: { defaultOpen: true, name: 'fruit', defaultValue: 'Apple' },
      trigger: true,
    };
    const root = await renderOnServer('ComboboxParts', props);
    const input = byTestId(root, 'input')!;
    expect(input).toHaveAttribute('role', 'combobox');
    expect(input).toHaveAttribute('aria-expanded', 'true');
    expect(input).toHaveValue('Apple');
    expect(input).not.toHaveAttribute('aria-controls');
    expect(root.querySelector('input[type="hidden"][name="fruit"]')).toHaveValue('Apple');
    expect(byTestId(root, 'popup')).toBe(null);
    hydrate(ComboboxParts, props, root);
    await nextTick();
    expect(byTestId(root, 'input')).toBe(input);
    await waitFor(() => expect(byTestId(document.body, 'popup')).not.toBe(null));
    expect(input).toHaveAttribute('aria-controls', byTestId(document.body, 'list')!.id);
  });

  test('an input with an id of its own: the text input of the form keeps the id of the server HTML in the hydration, then takes the id of the input', async () => {
    const props = { input: { id: 'own' } };
    const root = await renderOnServer('ComboboxParts', props);
    const textInput = root.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;
    expect(textInput.id).toMatch(/-hidden-input$/);
    expect(textInput.id).not.toBe('own-hidden-input');
    hydrate(ComboboxParts, props, root);
    await waitFor(() => expect(textInput.id).toBe('own-hidden-input'));
    expect(root.querySelector('input[aria-hidden="true"]')).toBe(textInput);
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

  test('a disabled portal of an open root renders the shown popup and backdrop in place with no `display: none`, and hydrates with no message', async () => {
    const props = {
      root: { defaultOpen: true },
      portal: { disabled: true },
      backdrop: {},
    };
    const root = await renderOnServer('ComboboxParts', props);
    const popup = byTestId(root, 'popup')!;
    const backdrop = byTestId(root, 'backdrop')!;
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
    hydrate(ComboboxParts, props, root);
    await nextTick();
    expect(byTestId(root, 'popup')).toBe(popup);
    expect(byTestId(root, 'backdrop')).toBe(backdrop);
    expect(popup.style.display).toBe('');
    expect(backdrop.style.display).toBe('');
  });

  test('the list of an inline root is in the server HTML; the text of its status comes after the mount', async () => {
    const root = await renderOnServer('ComboboxInline');
    expect(byTestId(root, 'list')!.querySelectorAll('[role="option"]')).toHaveLength(3);
    expect(byTestId(root, 'input')).toHaveAttribute('aria-expanded', 'true');
    expect(byTestId(root, 'status')).toHaveTextContent('');
    hydrate(ComboboxInline, {}, root);
    await waitFor(() => expect(byTestId(root, 'status')).toHaveTextContent('Three fruits.'));
  });

  test.each([
    { name: 'before the list', props: { label: true } },
    { name: 'after the list', props: { labelAfter: true } },
  ])(
    'the server HTML of an inline combobox names its list after Combobox.Label $name, and the page hydrates with no message',
    async ({ props }) => {
      const root = await renderOnServer('ComboboxInline', props);
      const list = byTestId(root, 'list')!;
      const label = byTestId(root, 'label')!;
      expect(list).toHaveAttribute('aria-labelledby', label.id);
      expect(list).not.toHaveAttribute('aria-label');
      hydrate(ComboboxInline, props, root);
      await nextTick();
      expect(byTestId(root, 'list')).toBe(list);
      expect(list).toHaveAttribute('aria-labelledby', label.id);
      expect(list).not.toHaveAttribute('aria-label');
      expect(within(root).getByRole('listbox', { name: 'Fruits' })).toBe(list);
    },
  );

  test('the server HTML of an open combobox with a disabled portal names its list after a Field.Label that comes after it, and the page hydrates with no message', async () => {
    const props = {
      root: { defaultOpen: true },
      portal: { disabled: true },
      labelAfter: true,
    };
    const root = await renderOnServer('ComboboxInField', props);
    const list = byTestId(root, 'list')!;
    const label = byTestId(root, 'field-label')!;
    expect(list).toHaveAttribute('aria-labelledby', label.id);
    expect(list).not.toHaveAttribute('aria-label');
    hydrate(ComboboxInField, props, root);
    await waitFor(() => expect(list.checkVisibility({ opacityProperty: true })).toBe(true));
    expect(byTestId(root, 'list')).toBe(list);
    expect(list).toHaveAttribute('aria-labelledby', label.id);
    expect(list).not.toHaveAttribute('aria-label');
    expect(within(root).getByRole('listbox', { name: 'Fruit' })).toBe(list);
  });
});
