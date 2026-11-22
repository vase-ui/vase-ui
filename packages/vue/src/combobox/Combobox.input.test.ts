import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ComboboxRootHighlightEventDetails } from '@vase-ui/vue/combobox';
import ComboboxGrid from '../../test/fixtures/ComboboxGrid.vue';
import ComboboxInForm from '../../test/fixtures/ComboboxInForm.vue';
import ComboboxInlineScene from '../../test/fixtures/ComboboxInlineScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxPieces from '../../test/fixtures/ComboboxPieces.vue';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import { fireEvent } from '../../test/fireEvent';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

async function mountParts(props: Props = {}) {
  const result = mount(ComboboxParts, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('a disabled input', () => {
  test('is disabled by its own prop, also in a root that is not disabled, and by a disabled field', async () => {
    const first = await mountParts({ root: { disabled: false }, input: { disabled: true } });
    expect(input()).toBeDisabled();
    first.unmount();
    mount(ComboboxInForm, { field: { disabled: true } });
    await nextTick();
    expect(input()).toBeDisabled();
  });
});

describe('an inline input', () => {
  test('a `<textarea>` in the slot has the ARIA attributes of the control before an interaction', async () => {
    mount(ComboboxPieces, { scene: 'InlineTextarea' });
    await nextTick();
    const textarea = input();
    expect(textarea.localName).toBe('textarea');
    expect(textarea).toHaveAttribute('role', 'combobox');
    expect(textarea).toHaveAttribute('aria-expanded', 'true');
    expect(textarea).toHaveAttribute('aria-controls', byTestId('list')!.id);
    expect(textarea).toHaveAttribute('aria-haspopup', 'listbox');
    expect(textarea).toHaveAttribute('aria-autocomplete', 'list');
  });

  test('is expanded with the id of its list, as a listbox or a grid, also with no `open`', async () => {
    const first = mount(ComboboxInlineScene, {});
    await nextTick();
    expect(input()).toHaveAttribute('role', 'combobox');
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(input()).toHaveAttribute('aria-controls', byTestId('list')!.id);
    await userEvent.click(input());
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    first.unmount();
    mount(ComboboxGrid, { root: { open: true } });
    await nextTick();
    const grid = document.querySelector('[role="grid"]')!;
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(input()).toHaveAttribute('aria-haspopup', 'grid');
    expect(input()).toHaveAttribute('aria-controls', grid.id);
  });

  test('Escape goes on to the elements around the root, with a value and with no list', async () => {
    const keys: string[] = [];
    mount(ComboboxPieces, {
      scene: 'InlineNoList',
      onOuterKey: (key: string) => keys.push(key),
      root: { defaultValue: 'apple' },
    });
    await nextTick();
    input().focus();
    await userEvent.keyboard('{Escape}');
    expect(keys).toEqual(['Escape']);
  });

  test('Enter with no highlight keeps the text', async () => {
    mount(ComboboxInlineScene, { items: ['Apple', 'Banana'] });
    await nextTick();
    await userEvent.click(input());
    await userEvent.type(input(), 'Ba');
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{Enter}');
    expect(input().value).toBe('Ba');
  });

  test('the highlight of an item that leaves the list does not come back at the next press', async () => {
    const items = reactive(['apple']);
    mount(ComboboxInlineScene, { items });
    await nextTick();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(input()).toHaveAttribute('aria-activedescendant');
    items.splice(0);
    await nextTick();
    await userEvent.click(input());
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('the keys of the input', () => {
  test('Escape on a closed input clears the value; after a pick, Escape closes and puts the label back, and a second Escape clears it', async () => {
    await mountParts({ items: ['apple', 'banana'], root: { defaultValue: 'apple' } });
    input().focus();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(input().value).toBe(''));
    await userEvent.type(input(), 'a');
    await opened();
    await userEvent.click(item('apple'));
    await closed();
    await userEvent.type(input(), 'a');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(input().value).toBe('apple');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(input().value).toBe(''));
  });

  test('a controlled text keeps the caret at an insert in the middle', async () => {
    const root = reactive<Props>({ inputValue: '' });
    root['onUpdate:inputValue'] = (text: string) => (root.inputValue = text);
    await mountParts({ root });
    await userEvent.type(input(), 'abcd');
    expect(input().value).toBe('abcd');
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect([input().selectionStart, input().selectionEnd]).toEqual([2, 2]);
    await userEvent.keyboard('xxx');
    expect(input().value).toBe('abxxxcd');
    expect([input().selectionStart, input().selectionEnd]).toEqual([5, 5]);
    await userEvent.keyboard('y');
    expect(input().value).toBe('abxxxycd');
    expect([input().selectionStart, input().selectionEnd]).toEqual([6, 6]);
  });

  test('Control with ArrowDown keeps the popup open', async () => {
    await mountParts({ root: { defaultOpen: true } });
    await opened();
    input().focus();
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}');
    await settle();
    expect(popup()).not.toBe(null);
  });

  test('Space toggles the highlighted item of a multiple root with an empty text, and keeps the popup open', async () => {
    const changes: unknown[] = [];
    await mountParts({
      items: ['apple'],
      root: {
        multiple: true,
        defaultOpen: true,
        onValueChange: (value: unknown) => changes.push(value),
      },
    });
    await userEvent.click(input());
    await userEvent.keyboard('{ArrowDown}');
    expect(item('apple')).toHaveAttribute('data-highlighted');
    expect(item('apple')).toHaveAttribute('aria-selected', 'false');
    await userEvent.keyboard(' ');
    expect(changes.at(-1)).toEqual(['apple']);
    expect(item('apple')).toHaveAttribute('aria-selected', 'true');
    expect(item('apple')).toHaveAttribute('data-highlighted');
    expect(popup()).not.toBe(null);
    expect(input().value).toBe('');
    expect(document.activeElement).toBe(input());
    await userEvent.keyboard(' ');
    expect(changes.at(-1)).toEqual([]);
    expect(item('apple')).toHaveAttribute('aria-selected', 'false');
    expect(popup()).not.toBe(null);
    expect(input().value).toBe('');
  });

  test('Space in a text that is not empty types a space, also with a highlighted item', async () => {
    const changes: unknown[] = [];
    await mountParts({
      items: ['apple'],
      root: { defaultOpen: true, onValueChange: (value: unknown) => changes.push(value) },
    });
    await userEvent.click(input());
    await userEvent.keyboard('a{ArrowDown}');
    expect(item('apple')).toHaveAttribute('data-highlighted');
    await userEvent.keyboard(' ');
    expect(input().value).toBe('a ');
    expect(changes).toEqual([]);
  });

  test('an Enter and an arrow key of an IME (key code 229) select nothing and move no highlight', async () => {
    const changes: unknown[] = [];
    await mountParts({
      items: ['a', 'b', 'c'],
      root: { onValueChange: (value: unknown) => changes.push(value) },
    });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(item('a')).toHaveAttribute('data-highlighted'));
    await fireEvent.keyDown(input(), { key: 'ArrowDown', keyCode: 229, which: 229 });
    expect(item('a')).toHaveAttribute('data-highlighted');
    await fireEvent.keyDown(input(), { key: 'Enter', keyCode: 229, which: 229 });
    await settle();
    expect(changes).toEqual([]);
    expect(input()).toHaveAttribute('aria-expanded', 'true');
    expect(item('a')).toHaveAttribute('data-highlighted');
  });

  test('an Enter of a pick with `index` on each item selects the filtered item', async () => {
    await mountParts({
      items: ['apple', 'banana', 'cherry'],
      itemProps: { apple: { index: 0 }, banana: { index: 1 }, cherry: { index: 2 } },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.type(input(), 'c');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(input().value).toBe('cherry'));
  });

  test('Escape on an open popup with an empty list and no Empty goes on to the elements around', async () => {
    const keys: string[] = [];
    const listen = (event: KeyboardEvent) => keys.push(event.key);
    document.addEventListener('keydown', listen);
    try {
      await mountParts({ items: [], root: { defaultOpen: true } });
      await userEvent.click(input());
      await userEvent.keyboard('{Escape}');
      expect(keys).toEqual(['Escape']);
    } finally {
      document.removeEventListener('keydown', listen);
    }
  });
});

describe('the composition of an IME', () => {
  test('an emptied text at the end of a composition closes a popup that a press does not open', async () => {
    await mountParts({
      items: ['apple'],
      root: { defaultOpen: true, defaultInputValue: 'x', openOnInputClick: false, filter: null },
    });
    await opened();
    await fireEvent.compositionStart(input());
    input().value = '';
    await fireEvent.input(input(), { isComposing: true, inputType: 'insertCompositionText' });
    await fireEvent.compositionEnd(input());
    await closed();
  });

  test('an emptied text at the end of a composition removes the highlight and keeps the popup open', async () => {
    await mountParts({
      items: ['apple'],
      root: { defaultOpen: true, defaultInputValue: 'x', filter: null },
    });
    // The pointer of an earlier case can rest where the popup opens.
    await userEvent.hover(document.getElementById('outside')!);
    await opened();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(input()).toHaveAttribute('aria-activedescendant'));
    await fireEvent.compositionStart(input());
    input().value = '';
    await fireEvent.input(input(), { isComposing: true, inputType: 'insertCompositionText' });
    await fireEvent.compositionEnd(input());
    await settle();
    expect(popup()).not.toBe(null);
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });
});

describe('the props of the root', () => {
  test('the `id` of the trigger stays on the trigger while the input is in the popup', async () => {
    // The parts with the role take `id`: the trigger and the input (the family file names it).
    mount(ComboboxStatic, {
      inputInPopup: true,
      trigger: { id: 'test-id' },
      root: { defaultOpen: true },
    });
    await opened();
    expect(byTestId('trigger')).toHaveAttribute('id', 'test-id');
    expect(input()).not.toHaveAttribute('id', 'test-id');
  });

  test('a read-only root reports the highlight of an arrow key with the reason `keyboard`', async () => {
    const reasons: string[] = [];
    await mountParts({
      root: {
        readonly: true,
        onItemHighlighted: (_: unknown, details: ComboboxRootHighlightEventDetails) =>
          reasons.push(details.reason),
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).not.toBe(null));
    expect(reasons.at(-1)).toBe('keyboard');
  });

  test('`itemToStringLabel` gives the text of a pick, and of a controlled object value that is not in the items', async () => {
    const countries = [
      { code: 'US', name: 'United States' },
      { code: 'CA', name: 'Canada' },
    ];
    const label = (value: { name: string }) => value.name;
    const first = await mountParts({
      items: countries,
      itemProps: {},
      labels: false,
      root: { defaultOpen: true, itemToStringLabel: label },
    });
    await opened();
    await userEvent.click(document.querySelectorAll<HTMLElement>('[role="option"]')[1]!);
    await waitFor(() => expect(input().value).toBe('Canada'));
    first.unmount();
    await mountParts({
      items: countries,
      root: { modelValue: { code: 'JP', name: 'Japan' }, itemToStringLabel: label },
    });
    expect(input().value).toBe('Japan');
  });
});
