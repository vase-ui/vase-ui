import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { SelectRootOpenChangeEventDetails } from '@vase-ui/vue/select';
import SelectGroups from '../../test/fixtures/SelectGroups.vue';
import SelectInToolbar from '../../test/fixtures/SelectInToolbar.vue';
import SelectInTransition from '../../test/fixtures/SelectInTransition.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { clientCenter } from '../../test/pointer';
import { mount } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
type Item = { value: unknown; text: string; label?: string; disabled?: boolean };

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const item = (value: string) => byTestId(`item-${value}`);
const valueText = () => byTestId('value').textContent;
const shown = (element: HTMLElement | null) => !!element?.checkVisibility();
const itemsOf = (...values: string[]): Item[] => values.map((value) => ({ value, text: value }));

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  await waitFor(() => expect(byTestId('positioner')?.style.visibility ?? '').toBe(''));
}

async function focused(element: () => Element | null) {
  await waitFor(() => expect(document.activeElement).toBe(element()));
}

function centerOf(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
}

describe('the typeahead', () => {
  test('matches the `label` of an item whose text differs', async () => {
    await mountSelect({
      items: [
        { value: 'one', text: 'Option 1', label: 'Apple' },
        { value: 'two', text: 'Option 2', label: 'Fruit' },
      ],
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('one'));
    await userEvent.keyboard('fr');
    await focused(() => item('two'));
  });

  test('starts a new search after the focus leaves the trigger', async () => {
    await mountSelect({ items: itemsOf('banana', 'avocado') });
    trigger().focus();
    await userEvent.keyboard('b');
    expect(valueText()).toBe('banana');
    document.getElementById('after')!.focus();
    trigger().focus();
    await userEvent.keyboard('a');
    expect(valueText()).toBe('avocado');
  });

  test('starts a new search after the focus leaves the open popup', async () => {
    await mountSelect({ items: itemsOf('apple', 'banana', 'avocado') });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('b');
    await focused(() => item('banana'));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    trigger().focus();
    await userEvent.keyboard('a');
    expect(valueText()).toBe('apple');
  });

  test('a closed trigger whose only match is disabled selects nothing', async () => {
    await mountSelect({
      items: [
        { value: 'apple', text: 'apple' },
        { value: 'banana', text: 'banana', disabled: true },
      ],
    });
    trigger().focus();
    await waitFor(() => expect(item('banana')).not.toBe(null));
    await userEvent.keyboard('b');
    await wait(20);
    expect(valueText()).toBe('');
  });

  test('a disabled item whose text starts with the letter twice does not stop the cycle of a closed trigger', async () => {
    await mountSelect({
      items: [
        { value: 'aaron', text: 'aaron', disabled: true },
        { value: 'apple', text: 'apple' },
        { value: 'avocado', text: 'avocado' },
      ],
    });
    trigger().focus();
    await waitFor(() => expect(item('apple')).not.toBe(null));
    await userEvent.keyboard('a');
    expect(valueText()).toBe('apple');
    await userEvent.keyboard('a');
    expect(valueText()).toBe('avocado');
  });

  test('the typeahead of an open popup skips a disabled item', async () => {
    await mountSelect({
      root: { defaultOpen: true },
      items: [
        { value: 'avocado', text: 'avocado' },
        { value: 'apricot', text: 'apricot', disabled: true },
        { value: 'apple', text: 'apple' },
      ],
    });
    await opened();
    item('avocado').focus();
    await userEvent.keyboard('a');
    await focused(() => item('apple'));
    expect(item('apricot')).not.toHaveAttribute('data-highlighted');
  });

  test('after a value of the parent, a closed trigger searches from that value', async () => {
    const root = reactive<Props>({
      modelValue: null,
      'onUpdate:modelValue': (value: unknown) => (root.modelValue = value),
    });
    await mountSelect({ root, items: itemsOf('a1', 'a2', 'car', 'cat', 'dog') });
    trigger().focus();
    await userEvent.keyboard('a');
    expect(valueText()).toBe('a1');
    root.modelValue = null;
    await nextTick();
    document.getElementById('after')!.focus();
    trigger().focus();
    await userEvent.keyboard('a');
    expect(valueText()).toBe('a1');
    root.modelValue = 'car';
    await nextTick();
    document.getElementById('after')!.focus();
    trigger().focus();
    await userEvent.keyboard('c');
    expect(valueText()).toBe('cat');
    await userEvent.keyboard('a');
    expect(valueText()).toBe('cat');
  });
});

describe('a disabled or read-only root', () => {
  test('a disabled trigger is out of the tab order and a press opens nothing; enabled again, it takes both', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      disabled: true,
      onOpenChange: (open: boolean) => log.push(String(open)),
    });
    await mountSelect({ root });
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(document.getElementById('after'));
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft]' });
    await wait(20);
    expect(log).toEqual([]);
    root.disabled = false;
    await nextTick();
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger());
    await userEvent.click(trigger());
    await opened();
    expect(log).toEqual(['true']);
  });

  test('a read-only trigger has `aria-readonly` and stays in the tab order', async () => {
    await mountSelect({ root: { readonly: true, defaultValue: 'banana' } });
    expect(trigger()).toHaveAttribute('aria-readonly', 'true');
    document.getElementById('before')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(trigger());
  });

  test.each(['{ArrowDown}', '{ArrowUp}', '{Enter}', ' '])(
    '%s opens a read-only select; Select.List has `aria-readonly`; Enter and the typeahead change no value',
    async (key) => {
      const changes: unknown[] = [];
      await mountSelect({
        root: { readonly: true, onValueChange: (value: unknown) => changes.push(value) },
        list: {},
      });
      trigger().focus();
      await userEvent.keyboard(key);
      await opened();
      expect(byTestId('list')).toHaveAttribute('aria-readonly', 'true');
      await userEvent.keyboard('{Home}');
      await focused(() => item('apple'));
      await userEvent.keyboard('b');
      await focused(() => item('banana'));
      expect(item('banana')).toHaveAttribute('data-highlighted', '');
      await userEvent.keyboard('{Enter}');
      await wait(20);
      expect(changes).toEqual([]);
      expect(valueText()).toBe('');
    },
  );
});

describe('multiple', () => {
  test('a press that deselects an item keeps its highlight', async () => {
    // A trigger of fixed width keeps the popup in place: Firefox sends `pointerout` when the popup
    // moves under a pointer that rests.
    await mountSelect({
      trigger: { style: 'width: 200px' },
      root: { multiple: true, defaultValue: ['apple'], defaultOpen: true },
    });
    await opened();
    await userEvent.click(item('banana'));
    await waitFor(() => expect(item('banana')).toHaveAttribute('data-highlighted', ''));
    await userEvent.click(item('banana'));
    await waitFor(() => expect(item('banana')).toHaveAttribute('aria-selected', 'false'));
    expect(item('banana')).toHaveAttribute('data-highlighted', '');
  });

  test('an open with the keys starts on the first selected item; the arrow keys go on from it', async () => {
    await mountSelect({ root: { multiple: true, defaultValue: ['cherry', 'apricot'] } });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apricot'));
    expect(item('cherry')).not.toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('banana'));
    await userEvent.keyboard('{ArrowUp}');
    await focused(() => item('apricot'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(item('apricot')).toHaveAttribute('aria-selected', 'false'));
    expect(item('apricot')).toHaveAttribute('data-highlighted', '');
  });

  test('the first selected item follows an item whose value changes, and an item that leaves', async () => {
    const items = reactive(itemsOf('a', 'b', 'c'));
    await mountSelect({ root: { multiple: true, defaultValue: ['a', 'c'] }, items });
    await userEvent.click(trigger());
    await focused(() => item('a'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    items[0]!.value = 'x';
    items[0]!.text = 'x';
    await nextTick();
    await userEvent.click(trigger());
    await focused(() => item('c'));
    expect(item('x')).not.toHaveAttribute('data-highlighted');
  });

  test('a new value of the parent moves the first selected item back up the list', async () => {
    const options = [0, 1, 2, 3].map((id) => ({ value: { id }, text: `opt-${id}` }));
    const root = reactive<Props>({
      multiple: true,
      modelValue: [{ id: 2 }, { id: 3 }],
      isItemEqualToValue: (a: { id: number }, b: { id: number }) => a.id === b.id,
    });
    await mountSelect({ root, items: options, valueSlot: 'value' });
    const option = (index: number) =>
      popup().querySelectorAll<HTMLElement>('[role="option"]')[index]!;
    await userEvent.click(trigger());
    await focused(() => option(2));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    root.modelValue = [{ id: 0 }, { id: 1 }];
    root.isItemEqualToValue = (a: { id: number }, b: { id: number }) => a.id === b.id;
    await nextTick();
    await userEvent.click(trigger());
    await focused(() => option(0));
    expect(option(1)).not.toHaveAttribute('data-highlighted');
  });

  test('the open scrolls the first selected item into view', async () => {
    const items = Array.from({ length: 100 }, (_, index) => ({
      value: `item ${index}`,
      text: `item ${index}`,
    }));
    await mountSelect({
      root: { multiple: true, defaultValue: ['item 80', 'item 90'] },
      items,
      popup: { style: 'max-height: 200px; overflow-y: auto' },
    });
    await userEvent.click(trigger());
    await focused(() => item('item 80'));
    const box = popup().getBoundingClientRect();
    const rect = item('item 80').getBoundingClientRect();
    expect(rect.top).toBeGreaterThanOrEqual(box.top - 1);
    expect(rect.bottom).toBeLessThanOrEqual(box.bottom + 1);
  });

  test('an aligned popup puts the first selected item over the value', async () => {
    await mountSelect({
      positioner: {},
      trigger: { style: 'margin-top: 200px' },
      root: { multiple: true, defaultValue: ['banana', 'cherry'] },
    });
    await userEvent.click(trigger());
    await focused(() => item('banana'));
    expect(byTestId('positioner')).toHaveAttribute('data-side', 'none');
    const value = byTestId('value').getBoundingClientRect();
    const text = item('banana').firstElementChild!.getBoundingClientRect();
    expect(Math.abs(text.top + text.height / 2 - (value.top + value.height / 2))).toBeLessThan(1);
  });
});

describe('groups', () => {
  test('the keys go across the groups and skip the labels and the separators', async () => {
    mount(SelectGroups);
    await nextTick();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await focused(() => item('carrot'));
    await userEvent.keyboard('{End}');
    await focused(() => item('leek'));
    await userEvent.keyboard('{Home}');
    await focused(() => item('apple'));
  });

  test('with `multiple`, the open starts on the first selected item in the order of the document', async () => {
    mount(SelectGroups, { root: { multiple: true, defaultValue: ['leek', 'banana'] } });
    await nextTick();
    await userEvent.click(trigger());
    await focused(() => item('banana'));
    expect(item('leek')).not.toHaveAttribute('data-highlighted');
  });

  test('the selected item stays selected while the items of a group change their order or grow', async () => {
    const groups = reactive([
      { name: 'one', labels: [{ key: 'one', text: 'Group one' }], items: ['b', 'c'] },
      { name: 'two', labels: [{ key: 'two', text: 'Group two' }], items: ['z'] },
    ]);
    mount(SelectGroups, { root: { open: true, defaultValue: 'b' }, groups });
    await waitFor(() => expect(item('b')).toHaveAttribute('aria-selected', 'true'));
    groups[0]!.items.unshift('a');
    await nextTick();
    groups[0]!.items.reverse();
    await nextTick();
    expect(item('b')).toHaveAttribute('aria-selected', 'true');
    groups[0]!.items.reverse();
    await nextTick();
    expect(item('b')).toHaveAttribute('aria-selected', 'true');
    expect(valueText()).toBe('b');
  });
});

describe('the highlight', () => {
  test('with highlightItemOnHover false, a pointer that leaves the popup keeps the highlight of the keys', async () => {
    await mountSelect({ root: { defaultOpen: true, highlightItemOnHover: false } });
    await opened();
    await userEvent.hover(item('apple'));
    await focused(() => popup());
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(item('apple')).toHaveAttribute('data-highlighted', ''));
    await userEvent.unhover(popup());
    await wait(20);
    expect(item('apple')).toHaveAttribute('data-highlighted', '');
  });

  test('an open with ArrowUp, then a press open with no value, highlights nothing', async () => {
    const root = reactive<Props>({
      modelValue: 'banana',
      'onUpdate:modelValue': (value: unknown) => (root.modelValue = value),
    });
    await mountSelect({ root });
    trigger().focus();
    await userEvent.keyboard('{ArrowUp}');
    await focused(() => item('banana'));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    root.modelValue = null;
    await nextTick();
    await userEvent.click(trigger());
    await focused(() => popup());
    await wait(50);
    expect(popup().querySelector('[data-highlighted]')).toBe(null);
  });

  test('the item keeps the highlight while the popup leaves in a <Transition>', async () => {
    mount(SelectInTransition);
    await nextTick();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    const b = () => popup().querySelectorAll<HTMLElement>('[role="option"]')[1]!;
    await focused(b);
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveClass('pop-leave-active'));
    expect(b()).toHaveAttribute('data-highlighted', '');
    const a = popup().querySelector('[role="option"]')!;
    await userEvent.pointer({ coords: centerOf(a) });
    expect(b()).toHaveAttribute('data-highlighted', '');
  });

  test('a Tab out of an open popup leaves no tab stop in the closed popup', async () => {
    await mountSelect();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(document.activeElement).toBe(document.getElementById('after'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    expect(document.activeElement).toBe(trigger());
  });
});

describe('the keys of the popup', () => {
  test('the arrow keys of a popup in a toolbar move the highlight, and not the focus of the toolbar', async () => {
    mount(SelectInToolbar);
    await nextTick();
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await focused(() => item('a'));
    await userEvent.keyboard('{ArrowRight}{ArrowLeft}');
    await wait(20);
    expect(document.activeElement).toBe(item('a'));
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('b'));
    expect(document.activeElement).not.toBe(byTestId('next'));
  });

  test('ArrowDown from a button in the popup gives the focus to the highlighted item', async () => {
    await mountSelect({
      root: { defaultValue: 'apple' },
      list: {},
      items: itemsOf('apple', 'banana', 'cherry'),
    });
    trigger().focus();
    await userEvent.keyboard('{Enter}');
    await focused(() => item('apple'));
    const button = popup().appendChild(document.createElement('button'));
    button.textContent = 'Select all';
    button.focus();
    expect(item('apple')).toHaveAttribute('data-highlighted', '');
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('banana'));
    button.remove();
  });

  test('a canceled close of Shift+Tab keeps the popup, and the focus goes to the trigger (VUE-69)', async () => {
    await mountSelect({
      root: {
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) => {
          if (!open) details.cancel();
        },
      },
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await focused(() => trigger());
    expect(shown(popup())).toBe(true);
  });
});
