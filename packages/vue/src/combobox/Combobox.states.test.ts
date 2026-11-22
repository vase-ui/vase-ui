import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ComboboxChips from '../../test/fixtures/ComboboxChips.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { clientCenter } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');

async function mountCombobox(props: Props = {}) {
  const result = mount(ComboboxParts, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

/** A press of the main button at the middle of `element`, which can be disabled. */
async function pressAt(element: Element) {
  const { clientX: x, clientY: y } = clientCenter(element);
  await userEvent.pointer({ coords: { x, y }, keys: '[MouseLeft]' });
}

describe('the chips of a disabled or read-only root', () => {
  test.each([{ disabled: true }, { readonly: true }])(
    'with $0, a chip and its remove button remove no value, by a press or a key',
    async (lock) => {
      const changes: unknown[] = [];
      mount(ComboboxChips, {
        root: {
          ...lock,
          modelValue: ['Apple', 'Banana'],
          onValueChange: (value: unknown) => changes.push(value),
        },
      });
      await nextTick();
      const chip = byTestId('chip-Apple')!;
      const remove = byTestId('remove-Apple')!;
      // A chip has no role that takes `aria-disabled`, so its state is a `data-*` attribute.
      if (lock.disabled) {
        expect(chip).toHaveAttribute('data-disabled', '');
        expect(remove).toBeDisabled();
      } else {
        expect(remove).not.toBeDisabled();
      }
      await pressAt(remove);
      chip.focus();
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
      chip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Delete', bubbles: true }));
      await settle();
      expect(changes).toEqual([]);
      expect(byTestId('chip-Apple')).not.toBe(null);
    },
  );

  test('a remove button removes its value for Space and for Enter', async () => {
    const root = reactive<Props>({ modelValue: ['Apple', 'Banana', 'Cherry'] });
    root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
    mount(ComboboxChips, { root });
    await nextTick();
    byTestId('remove-Apple')!.focus();
    await userEvent.keyboard(' ');
    await waitFor(() => expect(root.modelValue).toEqual(['Banana', 'Cherry']));
    byTestId('remove-Banana')!.focus();
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(root.modelValue).toEqual(['Cherry']));
    byTestId('remove-Cherry')!.focus();
    await userEvent.keyboard('a');
    await settle();
    expect(root.modelValue).toEqual(['Cherry']);
  });
});

describe('the clear button', () => {
  test.each([{ disabled: true }, { readonly: true }])(
    'of a root with $0 clears nothing',
    async (lock) => {
      const changes: unknown[] = [];
      await mountCombobox({
        clear: {},
        root: {
          ...lock,
          defaultValue: 'Apple',
          onValueChange: (value: unknown) => changes.push(value),
        },
      });
      await pressAt(byTestId('clear')!);
      await settle();
      expect(changes).toEqual([]);
      expect(input().value).toBe('Apple');
    },
  );

  test('of a multiple root clears each value', async () => {
    const root = reactive<Props>({ multiple: true, modelValue: ['Apple', 'Banana'] });
    root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
    await mountCombobox({ clear: {}, root });
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(byTestId('clear')).toBe(null));
  });
});

describe('the state attributes', () => {
  test('the trigger that is the control has `data-placeholder` only with no value', async () => {
    for (const [root, placeholder] of [
      [{}, true],
      [{ defaultValue: 'Apple' }, false],
      [{ multiple: true, defaultValue: [] }, true],
      [{ multiple: true, defaultValue: ['Apple'] }, false],
    ] as const) {
      const { unmount } = await mountCombobox({ inputInPopup: true, root });
      if (placeholder) expect(trigger()).toHaveAttribute('data-placeholder', '');
      else expect(trigger()).not.toHaveAttribute('data-placeholder');
      unmount();
    }
  });

  test('the input and the trigger have `data-list-empty` while the filtered list is empty', async () => {
    await mountCombobox({ trigger: true });
    input().focus();
    await userEvent.keyboard('an');
    await opened();
    expect(input()).not.toHaveAttribute('data-list-empty');
    await userEvent.keyboard('zzz');
    await waitFor(() => expect(input()).toHaveAttribute('data-list-empty', ''));
    expect(trigger()).toHaveAttribute('data-list-empty', '');
  });

  test('the list of a read-only root has `aria-readonly`; the input has `readonly`, `aria-required` and keeps its text', async () => {
    const root = reactive<Props>({ required: true });
    const { unmount } = await mountCombobox({ root: { ...root, defaultOpen: true } });
    await opened();
    expect(byTestId('list')).not.toHaveAttribute('aria-readonly');
    expect(input()).toHaveAttribute('aria-required', 'true');
    unmount();
    await mountCombobox({ root: { readonly: true, defaultOpen: true, defaultValue: 'Apple' } });
    await opened();
    expect(byTestId('list')).toHaveAttribute('aria-readonly', 'true');
    // The native `readonly` gives the read-only state: CSS has `:read-only`.
    expect(input()).toHaveAttribute('readonly');
    input().focus();
    await userEvent.keyboard('xyz');
    await settle();
    expect(input().value).toBe('Apple');
  });

  test('`form` gives the value to another form', async () => {
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other-form';
    try {
      const { unmount } = await mountCombobox({
        root: { name: 'fruit', form: 'other-form', defaultValue: 'Apple' },
      });
      expect([...new FormData(other).entries()]).toEqual([['fruit', 'Apple']]);
      unmount();
      await mountCombobox({
        root: {
          name: 'fruit',
          form: 'other-form',
          multiple: true,
          defaultValue: ['Apple', 'Lemon'],
        },
      });
      expect([...new FormData(other).entries()]).toEqual([
        ['fruit', 'Apple'],
        ['fruit', 'Lemon'],
      ]);
    } finally {
      other.remove();
    }
  });
});
