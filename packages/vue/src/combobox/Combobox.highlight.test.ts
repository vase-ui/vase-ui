import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ComboboxRootHighlightEventDetails } from '@vase-ui/vue/combobox';
import ComboboxChipScene from '../../test/fixtures/ComboboxChipScene.vue';
import ComboboxInlineScene from '../../test/fixtures/ComboboxInlineScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import { fireEvent } from '../../test/fireEvent';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

/** Checks that `name` has the highlight, and that the input names it. */
async function expectHighlight(name: string | null) {
  await waitFor(() => expect(highlighted()).toBe(name));
  if (name === null) expect(input()).not.toHaveAttribute('aria-activedescendant');
  else expect(input()).toHaveAttribute('aria-activedescendant', item(name).id);
}

/** Root props that write each highlight event in `log`, as `value index reason`. */
function logHighlights(log: string[], props: Props = {}): Props {
  return {
    ...props,
    onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
      log.push(`${String(value)} ${details.index} ${details.reason}`),
  };
}

/** Records the elements that `scrollIntoView` scrolls to in this case. */
function spyScroll() {
  const spy = vi.spyOn(HTMLElement.prototype, 'scrollIntoView');
  onTestFinished(() => spy.mockRestore());
  return spy;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('an inline list with a value', () => {
  test('the selected item has the highlight at the mount, and the list scrolls to it', async () => {
    const scroll = spyScroll();
    mount(ComboboxInlineScene, { root: { defaultValue: 'banana' } });
    await expectHighlight('banana');
    expect(scroll.mock.contexts).toContain(item('banana'));
  });

  test('a new value after the focus left the input gets no highlight', async () => {
    const root = reactive<Props>({ modelValue: 'banana' });
    mount(ComboboxInlineScene, { root });
    await expectHighlight('banana');
    await userEvent.click(input());
    await userEvent.click(byTestId('after')!);
    root.modelValue = 'cherry';
    await settle();
    await expectHighlight(null);
  });

  test('a value that comes after the focus left the input gets no highlight and no scroll', async () => {
    const root = reactive<Props>({ modelValue: null });
    mount(ComboboxInlineScene, { root });
    await userEvent.click(input());
    await userEvent.click(byTestId('after')!);
    const scroll = spyScroll();
    root.modelValue = 'banana';
    await settle();
    await expectHighlight(null);
    expect(scroll).not.toHaveBeenCalled();
  });

  test('typed text removes the highlight and moves it to no other item', async () => {
    mount(ComboboxInlineScene, {
      items: ['apple', 'banana', 'blueberry', 'cherry'],
      root: { defaultValue: 'banana' },
    });
    await expectHighlight('banana');
    await userEvent.click(input());
    await userEvent.keyboard('{End}{Backspace>6/}b');
    await waitFor(() => expect(byTestId('item-cherry')).toBe(null));
    await expectHighlight(null);
  });

  test('with no value, an emptied text gives the highlight to no item', async () => {
    mount(ComboboxInlineScene, { items: ['apple', 'banana', 'blueberry', 'cherry'] });
    await userEvent.click(input());
    await userEvent.keyboard('b{ArrowDown}{ArrowDown}');
    await expectHighlight('blueberry');
    await userEvent.clear(input());
    await expectHighlight(null);
  });

  test('a multiple list highlights the first selected item at the mount; a deselect of another item keeps no highlight on it', async () => {
    mount(ComboboxInlineScene, {
      items: ['apple', 'banana', 'cherry', 'date', 'elderberry'],
      root: { multiple: true, defaultValue: ['apple', 'date'] },
    });
    await expectHighlight('apple');
    await userEvent.click(item('date'));
    await waitFor(() => expect(item('date')).toHaveAttribute('aria-selected', 'false'));
    expect(item('apple')).not.toHaveAttribute('data-highlighted');
  });

  test('a first text that filters out the selected item highlights no other item', async () => {
    mount(ComboboxInlineScene, {
      items: ['b0', 'sel', 'b1', 'b2', 'b3'],
      root: { defaultValue: 'sel', defaultInputValue: 'b' },
    });
    await waitFor(() => expect(byTestId('item-sel')).toBe(null));
    await settle();
    await expectHighlight(null);
  });

  test('an emptied text before the selected item arrives keeps the highlight off the item', async () => {
    const items = reactive(['apple', 'cherry']);
    mount(ComboboxInlineScene, { items, root: { defaultValue: 'banana' } });
    input().focus();
    await userEvent.keyboard('{End}{Backspace>6/}');
    expect(input().value).toBe('');
    await expectHighlight(null);
    items.splice(1, 0, 'banana');
    await waitFor(() => expect(byTestId('item-banana')).not.toBe(null));
    await settle();
    await expectHighlight(null);
  });

  test('a hover highlight stays when the selected item arrives later; after a leave, the item gets no highlight', async () => {
    const items = reactive(['apple', 'cherry']);
    const first = mount(ComboboxInlineScene, { items, root: { defaultValue: 'banana' } });
    await userEvent.hover(item('apple'));
    await expectHighlight('apple');
    const scroll = spyScroll();
    items.splice(1, 0, 'banana');
    await settle();
    await expectHighlight('apple');
    expect(scroll).not.toHaveBeenCalled();
    first.unmount();
    const others = reactive(['apple', 'cherry']);
    mount(ComboboxInlineScene, { items: others, root: { defaultValue: 'banana' } });
    await userEvent.hover(item('apple'));
    await expectHighlight('apple');
    await userEvent.unhover(item('apple'));
    await expectHighlight(null);
    others.splice(1, 0, 'banana');
    await settle();
    await expectHighlight(null);
  });

  test('a virtualized list emits the index of the selected item at the mount', async () => {
    const log: string[] = [];
    const items = Array.from({ length: 50 }, (_, index) => `item-${index}`);
    mount(ComboboxInlineScene, {
      items,
      indexes: true,
      root: logHighlights(log, { virtualized: true, defaultValue: 'item-30' }),
    });
    await waitFor(() => expect(log).toContain('item-30 30 none'));
  });
});

describe('the highlight of a single combobox', () => {
  test('a kept list of a root that the parent holds closed takes no highlight from typed text', async () => {
    mount(ComboboxParts, {
      root: { open: false, autoHighlight: true },
      portal: { keepMounted: true },
    });
    await userEvent.type(input(), 'banana');
    await settle();
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    expect(highlighted()).toBe(null);
  });

  test('an emptied text gives the highlight to the selected item with the reason `none`, and scrolls to it', async () => {
    const log: string[] = [];
    const items = Array.from(
      { length: 200 },
      (_, index) => `item-${String(index).padStart(3, '0')}`,
    );
    mount(ComboboxParts, {
      items,
      inputInPopup: true,
      list: { style: 'max-height: 100px; overflow: auto' },
      root: logHighlights(log, { defaultValue: 'item-180', autoHighlight: true }),
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    const list = byTestId('list')!;
    await userEvent.type(input(), '9');
    await expectHighlight('item-009');
    await waitFor(() => expect(list.scrollTop).toBe(0));
    log.length = 0;
    await userEvent.clear(input());
    await expectHighlight('item-180');
    expect(log).toContain('item-180 180 none');
    await waitFor(() => {
      const box = list.getBoundingClientRect();
      const rect = item('item-180').getBoundingClientRect();
      expect(rect.top >= box.top && rect.bottom <= box.bottom).toBe(true);
    });
  });

  test('an emptied text with the selected item out of the list gives the highlight to no item', async () => {
    const log: string[] = [];
    const items = reactive(['apple', 'banana', 'cherry']);
    mount(ComboboxStatic, {
      items,
      root: logHighlights(log, { defaultValue: 'banana', defaultOpen: true, autoHighlight: true }),
    });
    await opened();
    await userEvent.type(input(), 'a');
    await waitFor(() => expect(highlighted()).not.toBe(null));
    items.splice(1, 1);
    await nextTick();
    log.length = 0;
    await userEvent.clear(input());
    await settle();
    await expectHighlight(null);
    expect(log.some((entry) => entry.startsWith('banana'))).toBe(false);
  });

  test.each([false, true])(
    'an emptied text that a controlled parent refuses gives the selected item no highlight (input in the popup: %s)',
    async (inputInPopup) => {
      mount(ComboboxParts, {
        items: ['apple', 'banana', 'blueberry', 'cherry'],
        inputInPopup,
        root: { defaultValue: 'banana', inputValue: 'b', defaultOpen: true },
      });
      await opened();
      await userEvent.hover(item('blueberry'));
      await userEvent.unhover(item('blueberry'));
      await expectHighlight(null);
      input().focus();
      await userEvent.keyboard('{Backspace}');
      await settle();
      expect(input().value).toBe('b');
      await expectHighlight(null);
    },
  );

  test('with no `items`, a value that the parent clears or sets to an unknown value while closed gives no highlight at the next open', async () => {
    for (const next of [null, 'dragonfruit']) {
      const root = reactive<Props>({ modelValue: 'banana' });
      root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
      const { unmount } = mount(ComboboxStatic, { root });
      await userEvent.click(input());
      await opened();
      await expectHighlight('banana');
      await userEvent.keyboard('{Escape}');
      await closed();
      root.modelValue = next;
      await nextTick();
      await userEvent.click(input());
      await opened();
      await settle();
      await expectHighlight(null);
      unmount();
    }
  });

  test('with no `items` and a kept popup, the selected item is known before the first open', async () => {
    const log: string[] = [];
    mount(ComboboxStatic, {
      portal: { keepMounted: true },
      root: logHighlights(log, { defaultValue: 'banana' }),
    });
    await waitFor(() => expect(item('banana')).toHaveAttribute('aria-selected', 'true'));
    await userEvent.click(input());
    await opened();
    await expectHighlight('banana');
  });

  test('with no `items`, a value that changes while open gets the highlight at the next open, and the old item none', async () => {
    const log: string[] = [];
    const root = reactive<Props>(logHighlights(log, { modelValue: 'banana' }));
    mount(ComboboxStatic, { root });
    await userEvent.click(input());
    await opened();
    await expectHighlight('banana');
    root.modelValue = 'cherry';
    await nextTick();
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
    log.length = 0;
    await userEvent.click(input());
    await opened();
    await expectHighlight('cherry');
    expect(log.some((entry) => entry.startsWith('banana'))).toBe(false);
  });

  test('a value object that the parent makes again with the same contents gets the highlight at the next open', async () => {
    const apple = { id: 1, label: 'apple' };
    const banana = { id: 2, label: 'banana' };
    const cherry = { id: 3, label: 'cherry' };
    const root = reactive<Props>({
      modelValue: { id: 2, label: 'banana' },
      isItemEqualToValue: (a: { id: number }, b: { id: number }) => a.id === b.id,
      itemToStringLabel: (value: { label: string }) => value.label,
    });
    mount(ComboboxStatic, { items: [apple, banana, cherry], root });
    await userEvent.click(input());
    await opened();
    await expectHighlight('banana');
    await userEvent.keyboard('{Escape}');
    await closed();
    root.modelValue = { id: 2, label: 'banana' };
    await nextTick();
    await userEvent.click(input());
    await opened();
    await expectHighlight('banana');
  });
});

describe('the highlight of a multiple combobox', () => {
  test('the popup with the input opens with no text, and the first selected item in the order of the list has the highlight', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: logHighlights(log, { multiple: true, defaultValue: ['banana', 'apple'] }),
    });
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
    expect(item('apple')).toHaveAttribute('aria-selected', 'true');
    expect(item('banana')).toHaveAttribute('aria-selected', 'true');
    await expectHighlight('apple');
    expect(log).toContain('apple 0 none');
  });

  test('with items that render one by one, and in groups, the first selected item in the order of the list has the highlight', async () => {
    const first = mount(ComboboxStatic, {
      root: { multiple: true, defaultValue: ['banana', 'apple', 'cherry'] },
    });
    await userEvent.click(input());
    await opened();
    await expectHighlight('apple');
    first.unmount();
    mount(ComboboxParts, {
      grouped: true,
      items: [
        { name: 'Vegetables', items: ['spinach'] },
        { name: 'Fruits', items: ['plum'] },
      ],
      root: { multiple: true, defaultValue: ['plum', 'spinach'] },
    });
    await userEvent.click(input());
    await opened();
    await expectHighlight('spinach');
  });

  test('ArrowDown on the trigger opens at the first selected item, and the arrow keys go on from it', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['banana'] },
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await expectHighlight('banana');
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('cherry');
    await userEvent.keyboard('{ArrowUp}');
    await expectHighlight('banana');
  });

  test('a pick that a controlled parent refuses keeps the highlight on the item', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, modelValue: ['apple'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'banana');
    await waitFor(() => expect(byTestId('item-apple')).toBe(null));
    await userEvent.click(item('banana'));
    await waitFor(() => expect(input().value).toBe(''));
    await expectHighlight('banana');
    expect(item('banana')).toHaveAttribute('aria-selected', 'false');
  });

  test('a pick with the keys after a filter keeps the highlight on the picked item; a deselect with the pointer keeps it too', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['apple', 'banana'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'cherry');
    await waitFor(() => expect(byTestId('item-apple')).toBe(null));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(input().value).toBe(''));
    await expectHighlight('cherry');
    await userEvent.click(item('banana'));
    await waitFor(() => expect(item('banana')).toHaveAttribute('aria-selected', 'false'));
    expect(popup()).not.toBe(null);
    expect(item('apple')).not.toHaveAttribute('data-highlighted');
    await expectHighlight('banana');
  });

  test('a pick after a filter keeps the popup open and highlights the picked item', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: logHighlights(log, { multiple: true, defaultValue: ['apple'] }),
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'cherry');
    await userEvent.click(item('cherry'));
    await waitFor(() => expect(input().value).toBe(''));
    expect(popup()).not.toBe(null);
    expect(item('cherry')).toHaveAttribute('aria-selected', 'true');
    await expectHighlight('cherry');
    expect(log.at(-1)).toMatch(/^cherry 2 /);
  });

  test('a deselect after a filter gives the highlight back to the first selected item; with no other value, to no item', async () => {
    const first = mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['apple', 'banana'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'banana');
    await userEvent.click(item('banana'));
    await waitFor(() => expect(input().value).toBe(''));
    await expectHighlight('apple');
    first.unmount();
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['banana'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'banana');
    await userEvent.click(item('banana'));
    await waitFor(() => expect(input().value).toBe(''));
    expect(item('banana')).toHaveAttribute('aria-selected', 'false');
    await expectHighlight(null);
  });

  test('an emptied text gives the highlight to the first selected item once, with the input in the popup and outside', async () => {
    const log: string[] = [];
    const first = mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: logHighlights(log, { multiple: true, defaultValue: ['apple', 'banana'] }),
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'banana');
    await waitFor(() => expect(byTestId('item-apple')).toBe(null));
    log.length = 0;
    await userEvent.clear(input());
    await expectHighlight('apple');
    expect(log).toEqual(['apple 0 none']);
    first.unmount();
    mount(ComboboxParts, {
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['apple', 'banana'] },
    });
    await userEvent.click(input());
    await userEvent.type(input(), 'banana');
    await waitFor(() => expect(byTestId('item-apple')).toBe(null));
    await userEvent.clear(input());
    await expectHighlight('apple');
  });

  test('a text typed before Escape is gone at the next open, and the first selected item has the highlight', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, defaultValue: ['apple', 'banana'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'cherry');
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
    await expectHighlight('apple');
  });

  test('an emptied text scrolls the first selected item into view', async () => {
    const items = Array.from({ length: 100 }, (_, index) => `item ${index}`);
    mount(ComboboxParts, {
      inputInPopup: true,
      items,
      list: { style: 'max-height: 100px; overflow: auto' },
      root: { multiple: true, defaultValue: ['item 80'] },
    });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'item 0');
    await waitFor(() => expect(byTestId('item-item 80')).toBe(null));
    const scroll = spyScroll();
    await userEvent.clear(input());
    await expectHighlight('item 80');
    expect(scroll.mock.contexts).toContain(item('item 80'));
  });

  test('a value that the parent changes or empties gets the highlight at the next open', async () => {
    const root = reactive<Props>({ multiple: true, modelValue: ['apple', 'banana'] });
    mount(ComboboxStatic, { root });
    await userEvent.click(input());
    await opened();
    await expectHighlight('apple');
    await userEvent.keyboard('{Escape}');
    await closed();
    root.modelValue = ['cherry'];
    await nextTick();
    await userEvent.click(input());
    await opened();
    await expectHighlight('cherry');
    await userEvent.keyboard('{Escape}');
    await closed();
    root.modelValue = [];
    await nextTick();
    await userEvent.click(input());
    await opened();
    await settle();
    await expectHighlight(null);
  });

  test('the first selected item follows a new value of its item and an item that leaves', async () => {
    const items = reactive(['apple', 'banana', 'cherry']);
    mount(ComboboxStatic, {
      items,
      root: { multiple: true, defaultValue: ['apple', 'cherry'] },
    });
    await userEvent.click(input());
    await opened();
    await expectHighlight('apple');
    await userEvent.keyboard('{Escape}');
    await closed();
    items.splice(0, 1);
    await nextTick();
    await userEvent.click(input());
    await opened();
    await expectHighlight('cherry');
  });
});

describe('the chips of a multiple combobox', () => {
  test.each([{ disabled: true }, { readonly: true }])(
    'with $0, a press on a remove button removes nothing',
    async (lock) => {
      mount(ComboboxChipScene, {
        remove: {},
        root: { ...lock, defaultValue: ['apple', 'banana'] },
      });
      await nextTick();
      if (lock.disabled) expect(byTestId('chip-apple')).toHaveAttribute('data-disabled', '');
      else expect(byTestId('chip-apple')).toHaveAttribute('data-readonly', '');
      await fireEvent.click(byTestId('remove-apple')!);
      await settle();
      expect(byTestId('chip-apple')).not.toBe(null);
    },
  );
});
