import { describe, expect, test, vi } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  ComboboxRootChangeEventDetails,
  ComboboxRootHighlightEventDetails,
} from '@vase-ui/vue/combobox';
import ComboboxAround from '../../test/fixtures/ComboboxAround.vue';
import ComboboxChips from '../../test/fixtures/ComboboxChips.vue';
import ComboboxClearInTransition from '../../test/fixtures/ComboboxClearInTransition.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { touchDrag } from '../../test/pointer';
import ComboboxInline from '../../test/fixtures/ComboboxInline.vue';
import ComboboxParts, { FRUITS } from '../../test/fixtures/ComboboxParts.vue';
import ComboboxPartAlone from '../../test/fixtures/ComboboxPartAlone.vue';
import TextareaCombobox from '../../test/fixtures/ComboboxTextarea.vue';
import ComboboxVirtual from '../../test/fixtures/ComboboxVirtual.vue';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const list = () => byTestId('list')!;
const item = (name: string) => byTestId(`item-${name}`)!;
const itemNames = () =>
  [...document.querySelectorAll('[role="option"], [role="gridcell"]')].map((option) =>
    option.textContent!.trim(),
  );
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim();

async function mountCombobox(props: Props = {}) {
  const result = mount(ComboboxParts, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  return popup()!;
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onValueChange: (value: unknown, details: ComboboxRootChangeEventDetails) =>
      log.push(`valueChange ${JSON.stringify(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) =>
      log.push(`update:modelValue ${JSON.stringify(value)}`),
    onInputValueChange: (text: string, details: ComboboxRootChangeEventDetails) =>
      log.push(
        `inputValueChange ${JSON.stringify(text)} ${details.reason}${details.isItemPress ? ' item' : ''}`,
      ),
    'onUpdate:inputValue': (text: string) => log.push(`update:inputValue ${JSON.stringify(text)}`),
    onOpenChange: (open: boolean, details: ComboboxRootChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update:open ${open}`),
  });
}

describe('the parts', () => {
  test('render their elements with their roles; the popup is in <body>; the attributes of the developer win', async () => {
    const { exposed } = await mountCombobox({
      root: { defaultOpen: true, name: 'fruit' },
      trigger: true,
      clear: {},
      label: true,
      input: { 'aria-label': 'Fruit input', placeholder: 'Type' },
      list: { 'aria-label': 'Fruits' },
    });
    await opened();
    const element = input();
    expect(element.localName).toBe('input');
    expect(element).toHaveAttribute('role', 'combobox');
    expect(element).toHaveAttribute('aria-expanded', 'true');
    expect(element).toHaveAttribute('aria-haspopup', 'listbox');
    expect(element).toHaveAttribute('aria-controls', list().id);
    expect(element).toHaveAttribute('aria-autocomplete', 'list');
    expect(element).toHaveAttribute('aria-labelledby', byTestId('label')!.id);
    expect(element).toHaveAttribute('autocomplete', 'off');
    expect(element).toHaveAttribute('autocorrect', 'off');
    expect(element).toHaveAttribute('autocapitalize', 'none');
    expect(element).toHaveAttribute('spellcheck', 'false');
    expect(element).toHaveAttribute('placeholder', 'Type');
    expect(byTestId('group')).toHaveAttribute('role', 'group');
    expect(byTestId('group')).toHaveAttribute('data-popup-open');
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'button');
    expect(trigger()).toHaveAttribute('tabindex', '-1');
    expect(trigger()).not.toHaveAttribute('role');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-labelledby', byTestId('label')!.id);
    expect(list()).toHaveAttribute('role', 'listbox');
    expect(list()).toHaveAttribute('aria-label', 'Fruits');
    expect(popup()).toHaveAttribute('role', 'presentation');
    expect(byTestId('positioner')!.parentElement).toBe(document.body);
    expect(item('Apple')).toHaveAttribute('role', 'option');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'false');
    expect(item('Apple')).toHaveAttribute('tabindex', '-1');
    expect(exposed.root.element.localName).toBe('div');
    expect(exposed.root.inputElement).toBe(exposed.root.element.lastElementChild);
  });
});

describe('the control', () => {
  test('the separator has the role `presentation` and its orientation in `data-orientation`; `as` and the attributes of the developer reach its element', async () => {
    const separator = reactive<Props>({});
    await mountCombobox({ root: { defaultOpen: true }, separator });
    await opened();
    expect(byTestId('separator')).toHaveAttribute('role', 'presentation');
    expect(byTestId('separator')).toHaveAttribute('data-orientation', 'horizontal');
    expect(byTestId('separator')).not.toHaveAttribute('aria-orientation');
    separator.orientation = 'vertical';
    await nextTick();
    expect(byTestId('separator')).toHaveAttribute('data-orientation', 'vertical');
    Object.assign(separator, { as: 'li', class: 'line', style: 'margin: 4px', role: 'separator' });
    await nextTick();
    const element = byTestId('separator')!;
    expect(element.localName).toBe('li');
    expect(element).toHaveClass('line');
    expect(element.style.margin).toBe('4px');
    expect(element).toHaveAttribute('role', 'separator');
    expect(element).toHaveAttribute('data-orientation', 'vertical');
  });

  test('a root with the input in the popup has the trigger as its control, and the popup is a dialog', async () => {
    await mountCombobox({ inputInPopup: true, label: true });
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(trigger()).toHaveAttribute('tabindex', '0');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-labelledby', byTestId('label')!.id);
    await userEvent.click(trigger());
    const element = await opened();
    expect(element).toHaveAttribute('role', 'dialog');
    expect(trigger()).toHaveAttribute('aria-controls', element.id);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input()).toHaveAttribute('aria-expanded', 'true');
  });

  test('VUE-73: a popup that unmounts while the combobox is open leaves no aria-controls on the trigger', async () => {
    const scene = reactive({ popup: true });
    await mountCombobox({ inputInPopup: true, root: { defaultOpen: true }, scene });
    const element = await opened();
    await waitFor(() => expect(trigger()).toHaveAttribute('aria-controls', element.id));
    scene.popup = false;
    await waitFor(() => expect(popup()).toBe(null));
    await nextTick();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).not.toHaveAttribute('aria-controls');
  });

  test('VUE-116: a press on the label moves the focus to the control', async () => {
    await mountCombobox({ label: true });
    await userEvent.click(byTestId('label')!);
    expect(document.activeElement).toBe(input());
  });
});

describe('open and close', () => {
  test('a press on the input opens; a second press keeps it open; Escape closes', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log) });
    await userEvent.click(input());
    await opened();
    await userEvent.click(input());
    expect(popup()).not.toBe(null);
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual([
      'openChange true input-press',
      'update:open true',
      'openChange false escape-key',
      'update:open false',
    ]);
  });

  test.each(['group', 'chips'])(
    'a press on the padding of the %s moves the focus to the input and opens the popup',
    async (part) => {
      if (part === 'group') await mountCombobox();
      else mount(ComboboxChips, { root: { modelValue: [] } });
      await nextTick();
      byTestId(part)!.style.padding = '12px';
      await userEvent.click(byTestId(part)!, { position: { x: 4, y: 4 } });
      await opened();
      expect(document.activeElement).toBe(input());
    },
  );

  test('a press on the padding of the group, of the popup and of the list keeps the focus in the input and the popup open', async () => {
    const log: string[] = [];
    await mountCombobox({
      root: rootEvents(log),
      popup: { style: 'padding: 12px' },
      list: { style: 'padding: 12px' },
    });
    byTestId('group')!.style.padding = '12px';
    await userEvent.click(input());
    await opened();
    log.length = 0;
    for (const part of ['group', 'popup', 'list']) {
      await userEvent.click(byTestId(part)!, { position: { x: 4, y: 4 } });
      await nextTick();
      expect(document.activeElement).toBe(input());
      expect(input()).toHaveAttribute('aria-expanded', 'true');
    }
    expect(log).toEqual([]);
  });

  test('with `openOnInputClick` false, a press does not open, and typed text does', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { openOnInputClick: false }) });
    await userEvent.click(input());
    expect(popup()).toBe(null);
    await userEvent.keyboard('b');
    await opened();
    expect(log.slice(0, 2)).toEqual(['inputValueChange "b" input-change', 'update:inputValue "b"']);
    expect(log).toContain('openChange true input-change');
  });

  test('with `openOnInputClick` false, an emptied text closes the popup', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { openOnInputClick: false }) });
    input().focus();
    await userEvent.keyboard('b');
    await opened();
    await userEvent.keyboard('{Backspace}');
    await closed();
    expect(log).toContain('openChange false input-clear');
  });

  test('Space on a closed trigger that is the control opens the popup', async () => {
    await mountCombobox({ inputInPopup: true });
    trigger().focus();
    await userEvent.keyboard(' ');
    await opened();
  });

  test('a press on an input in the popup gives it the focus', async () => {
    await mountCombobox({ inputInPopup: true, button: true });
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(input()));
    byTestId('popup-button')!.focus();
    await userEvent.click(input());
    expect(document.activeElement).toBe(input());
  });

  test('text that a script writes opens nothing', async () => {
    await mountCombobox({ root: { openOnInputClick: false } });
    input().value = 'ban';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await nextTick();
    expect(popup()).toBe(null);
  });

  test('ArrowDown on the input opens and highlights the first item; ArrowUp the last', async () => {
    await mountCombobox({ root: { openOnInputClick: false } });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.keyboard('{ArrowUp}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Pear'));
  });

  test('a key open highlights the first or the last item that is not disabled; the arrow keys still reach a disabled item', async () => {
    await mountCombobox({
      root: { openOnInputClick: false },
      itemProps: { Apple: { disabled: true }, Pear: { disabled: true } },
    });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apricot'));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.keyboard('{ArrowUp}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Peach'));
  });

  test('the trigger beside the input toggles the popup and keeps the focus on the input', async () => {
    const log: string[] = [];
    await mountCombobox({ trigger: true, root: rootEvents(log) });
    input().focus();
    await userEvent.click(trigger());
    await opened();
    expect(document.activeElement).toBe(input());
    await userEvent.click(trigger());
    await closed();
    expect(document.activeElement).toBe(input());
    expect(log).toEqual([
      'openChange true trigger-press',
      'update:open true',
      'openChange false trigger-press',
      'update:open false',
    ]);
  });

  test('a press outside closes; a focus that leaves closes', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log) });
    await userEvent.click(input());
    await opened();
    await userEvent.click(document.getElementById('outside')!);
    await closed();
    await userEvent.click(input());
    await opened();
    document.getElementById('before')!.focus();
    await closed();
    expect(log.filter((entry) => entry.startsWith('openChange false'))).toEqual([
      'openChange false outside-press',
      'openChange false focus-out',
    ]);
  });

  test('Escape on a closed input clears the text and the value, and stops the event when it cleared a value', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { defaultValue: 'Banana' }) });
    expect(input().value).toBe('Banana');
    const outer: string[] = [];
    document.body.addEventListener('keydown', (event) => outer.push(event.key), { once: true });
    input().focus();
    await userEvent.keyboard('{Escape}');
    await nextTick();
    expect(input().value).toBe('');
    expect(log).toEqual([
      'inputValueChange "" escape-key',
      'update:inputValue ""',
      'valueChange null escape-key',
      'update:modelValue null',
    ]);
    expect(outer).toEqual([]);
  });

  test('a read-only root opens and moves the highlight, and changes no value', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { readonly: true }) });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Enter}');
    await userEvent.click(item('Banana'));
    expect(log.filter((entry) => entry.includes('valueChange'))).toEqual([]);
    expect(input()).toHaveAttribute('readonly');
    expect(input()).toHaveAttribute('aria-autocomplete', 'none');
    expect(list()).toHaveAttribute('aria-readonly', 'true');
  });

  test('a disabled root opens nothing', async () => {
    await mountCombobox({ root: { disabled: true }, trigger: true });
    expect(input()).toBeDisabled();
    await userEvent.click(trigger(), { force: true });
    expect(popup()).toBe(null);
  });

  test('a press on the padding of the group moves the focus to the input and opens', async () => {
    await mountCombobox();
    const group = byTestId('group')!;
    group.style.padding = '20px';
    await userEvent.click(group, { position: { x: 5, y: 5 } });
    await opened();
    expect(document.activeElement).toBe(input());
  });
});

describe('text', () => {
  test('a pick fills the input outside the popup; a close puts the label of the value back', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Cherry'));
    await closed();
    expect(input().value).toBe('Cherry');
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{Backspace>3/}');
    expect(input().value).toBe('Che');
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(input().value).toBe('Cherry');
  });

  test('an emptied text sets the value to null with `input-clear`', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { defaultValue: 'Apple' }) });
    input().focus();
    input().select();
    await userEvent.keyboard('{Backspace}');
    expect(log).toContain('valueChange null input-clear');
  });

  test('a controlled text shows only the value of the parent; cancel() keeps the text', async () => {
    const root = reactive<Props>({
      inputValue: 'a',
      onInputValueChange: (_: string, details: ComboboxRootChangeEventDetails) => details.cancel(),
    });
    await mountCombobox({ root });
    expect(input().value).toBe('a');
    input().focus();
    await userEvent.keyboard('b');
    await nextTick();
    await nextTick();
    expect(input().value).toBe('a');
  });

  test('the text follows the label of the value while the developer gives no text', async () => {
    const root = reactive<Props>({ modelValue: 'Apple' });
    await mountCombobox({ root });
    expect(input().value).toBe('Apple');
    root.modelValue = 'Lemon';
    await waitFor(() => expect(input().value).toBe('Lemon'));
  });

  test('Home and End move the caret and scroll the input there', async () => {
    await mountCombobox({ root: { defaultInputValue: 'a long text '.repeat(10) } });
    const element = input();
    element.style.width = '60px';
    element.focus();
    element.setSelectionRange(4, 4);
    await userEvent.keyboard('{End}');
    expect(element.selectionStart).toBe(element.value.length);
    expect(element.scrollLeft).toBeGreaterThan(0);
    await userEvent.keyboard('{Home}');
    expect(element.selectionStart).toBe(0);
    expect(element.scrollLeft).toBe(0);
  });
});

describe('a kept popup', () => {
  test('keeps the filter and the text of its input from the close until the next open', async () => {
    await mountCombobox({ inputInPopup: true, portal: { keepMounted: true } });
    await userEvent.click(trigger());
    await waitFor(() => expect(popup()).not.toHaveAttribute('hidden'));
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('ap');
    await waitFor(() => expect(itemNames()).toEqual(['Apple', 'Apricot', 'Grape']));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
    await nextTick();
    expect(itemNames()).toEqual(['Apple', 'Apricot', 'Grape']);
    expect(input().value).toBe('ap');
    await userEvent.click(trigger());
    await waitFor(() => expect(popup()).not.toHaveAttribute('hidden'));
    await waitFor(() => expect(itemNames()).toHaveLength(FRUITS.length));
    expect(input().value).toBe('');
  });

  test('the typeahead of a closed trigger reads the order of the kept items with no comparison of two elements', async () => {
    const values: unknown[] = [];
    await mountCombobox({
      inputInPopup: true,
      portal: { keepMounted: true },
      root: { 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    trigger().focus();
    const compare = vi.spyOn(Node.prototype, 'compareDocumentPosition');
    try {
      await userEvent.keyboard('b');
      expect(values).toEqual(['Banana']);
      expect(compare).not.toHaveBeenCalled();
    } finally {
      compare.mockRestore();
    }
  });
});

describe('filter', () => {
  test('the query is the text with no space at the ends; a group with no item is left out; `limit` cuts the list', async () => {
    await mountCombobox({
      grouped: true,
      items: [
        { name: 'A', items: ['Apple', 'Apricot'] },
        { name: 'B', items: ['Banana', 'Blueberry'] },
      ],
      root: { limit: 3 },
    });
    await userEvent.click(input());
    await opened();
    expect(itemNames()).toEqual(['Apple', 'Apricot', 'Banana']);
    await userEvent.keyboard(' ap ');
    await waitFor(() => expect(itemNames()).toEqual(['Apple', 'Apricot']));
    expect(byTestId('group-B')).toBe(null);
    expect(byTestId('group-A')).toHaveAttribute('role', 'group');
    expect(byTestId('group-A')).toHaveAttribute(
      'aria-labelledby',
      byTestId('group-A')!.firstElementChild!.id,
    );
  });

  test('a single combobox shows each item while its input shows the label of its value', async () => {
    await mountCombobox({ root: { defaultValue: 'Cherry' } });
    await userEvent.click(input());
    await opened();
    expect(itemNames()).toHaveLength(FRUITS.length);
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(itemNames()).toEqual(['Cherry']));
  });

  test('`filter` null keeps each item; `filteredItems` is the list to show', async () => {
    await mountCombobox({ root: { filter: null } });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('zz');
    expect(itemNames()).toHaveLength(FRUITS.length);
    const second = await mountCombobox({ root: { filteredItems: ['Pear'] } });
    second.unmount();
  });

  test('an item keeps its element when the filter moves it', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    const grape = item('Grape');
    await userEvent.keyboard('gr');
    await waitFor(() => expect(itemNames()).toEqual(['Grape']));
    expect(item('Grape')).toBe(grape);
  });
});

describe('highlight', () => {
  test('arrow keys move the highlight; from the last item the input has it, then the first item', async () => {
    const values: unknown[] = [];
    await mountCombobox({
      items: ['Apple', 'Banana', 'Cherry'],
      root: {
        onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
          values.push(`${String(value)} ${details.index} ${details.reason}`),
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Cherry'));
    expect(input()).toHaveAttribute('aria-activedescendant', item('Cherry').id);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe(undefined));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    expect(values).toEqual([
      'Apple 0 keyboard',
      'Banana 1 keyboard',
      'Cherry 2 keyboard',
      'undefined -1 keyboard',
      'Apple 0 keyboard',
    ]);
  });

  test('a virtualized list counts the keys on the filtered values; an item that mounts gets the highlight', async () => {
    const { exposed } = mount(ComboboxVirtual);
    await nextTick();
    await userEvent.click(input());
    await opened();
    for (let step = 0; step < 7; step += 1) await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Item 6'));
    expect(exposed.highlights.at(-1)).toBe('Item 6 6');
    expect(input()).toHaveAttribute('aria-activedescendant', byTestId('item-6')!.id);
    expect(byTestId('item-0')).toBe(null);
  });

  test('with `loopFocus` false, the highlight stays at the last item', async () => {
    await mountCombobox({ items: ['Apple', 'Banana'], root: { loopFocus: false } });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Banana'));
  });

  test('the selected item has the highlight at the open', async () => {
    await mountCombobox({ root: { defaultValue: 'Lemon' } });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Lemon'));
  });

  test('typed text removes the highlight; with `autoHighlight` the first item has it, and an emptied text keeps it', async () => {
    await mountCombobox({ root: { autoHighlight: true } });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('an');
    await waitFor(() => expect(highlighted()).toBe('Banana'));
    await userEvent.clear(input());
    await waitFor(() => expect(itemNames().length).toBeGreaterThan(2));
    expect(highlighted()).toBe('Banana');
  });

  test('with `autoHighlight`, an emptied text gives the highlight back to the selected item', async () => {
    await mountCombobox({
      inputInPopup: true,
      root: { autoHighlight: true, defaultValue: 'Lemon' },
    });
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('a');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(highlighted()).toBe('Lemon'));
  });

  test('a move of the pointer highlights its item; a leave removes it', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    await userEvent.hover(item('Banana'));
    await waitFor(() => expect(highlighted()).toBe('Banana'));
    await userEvent.hover(document.getElementById('outside')!);
    await waitFor(() => expect(highlighted()).toBe(undefined));
  });

  test('a list that opens and scrolls under a pointer at rest keeps the highlight of the keys', async () => {
    await mountCombobox({ list: { style: 'max-height: 90px; overflow: auto' } });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(byTestId('positioner')!.style.visibility).toBe(''));
    const rect = list().getBoundingClientRect();
    await userEvent.keyboard('{Escape}');
    await closed();
    // The pointer rests where the list shows at the next open.
    await userEvent.pointer({ coords: { x: rect.left + 20, y: rect.top + 45 } });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    for (const name of ['Apricot', 'Banana', 'Cherry', 'Grape', 'Lemon', 'Mango']) {
      await userEvent.keyboard('{ArrowDown}');
      // WebKit sends a `pointermove` after the scroll of the list.
      await new Promise((resolve) => setTimeout(resolve, 100));
      expect(highlighted()).toBe(name);
    }
  });

  // WebKit on Linux gives this `pointermove` after a scroll of the list.
  test('a `pointermove` at the place where the pointer rests from before the open does not move the highlight', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(byTestId('positioner')!.style.visibility).toBe(''));
    const rect = item('Banana').getBoundingClientRect();
    const rest = { x: Math.round(rect.left + 20), y: Math.round(rect.top + rect.height / 2) };
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.pointer({ coords: rest });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    item('Banana').dispatchEvent(
      new PointerEvent('pointermove', {
        bubbles: true,
        pointerType: 'mouse',
        clientX: rest.x,
        clientY: rest.y,
      }),
    );
    await nextTick();
    expect(highlighted()).toBe('Apple');
  });

  test('an item that leaves the list takes its highlight with it', async () => {
    const log: string[] = [];
    const root = rootEvents(log, { items: ['Apple', 'Banana', 'Cherry'] });
    await mountCombobox({ root });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Banana'));
    root.items = ['Apple', 'Cherry'];
    await waitFor(() => expect(itemNames()).toEqual(['Apple', 'Cherry']));
    expect(input()).not.toHaveAttribute('aria-activedescendant');
    log.length = 0;
    await userEvent.keyboard('{Enter}');
    await closed();
    expect(log.filter((entry) => entry.includes('valueChange'))).toEqual([]);
  });

  test('an item that changes its value gives a new highlight event', async () => {
    const values: unknown[] = [];
    const itemProps = reactive<Record<string, Props>>({});
    await mountCombobox({
      itemProps,
      root: { onItemHighlighted: (value: unknown) => values.push(value) },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(values).toEqual(['Apple']));
    itemProps.Apple = { value: 'Apple 2' };
    await waitFor(() => expect(values).toEqual(['Apple', 'Apple 2']));
  });

  test('a virtualized list counts the keys from the first value again after a close', async () => {
    const { exposed } = mount(ComboboxVirtual);
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Item 2'));
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Item 0'));
    expect(exposed.highlights.at(-1)).toBe('Item 0 0');
  });

  test('typed text sets no scroll position of a virtualized list', async () => {
    mount(ComboboxVirtual);
    await nextTick();
    await userEvent.click(input());
    await opened();
    const listbox = document.querySelector<HTMLElement>('[role="listbox"]')!;
    listbox.style.cssText = 'max-height: 40px; overflow: auto';
    listbox.scrollTop = 20;
    // Each item has the letter.
    await userEvent.keyboard('i');
    await nextTick();
    expect(listbox.scrollTop).toBe(20);
  });

  test('an emptied text gives the highlight to the item of the last pick of a multiple combobox', async () => {
    const root = reactive<Props>({
      modelValue: [],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
    });
    mount(ComboboxChips, { root });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await userEvent.click(item('Cherry'));
    await userEvent.hover(document.getElementById('outside')!);
    await userEvent.keyboard('b');
    await waitFor(() => expect(itemNames()).toEqual(['Banana']));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(highlighted()).toBe('Cherry'));
  });

  test('with `highlightItemOnHover` false, the pointer highlights nothing', async () => {
    await mountCombobox({ root: { highlightItemOnHover: false } });
    await userEvent.click(input());
    await opened();
    await userEvent.hover(item('Banana'));
    await nextTick();
    expect(highlighted()).toBe(undefined);
  });

  test('a disabled item gets the highlight and no pick', async () => {
    const log: string[] = [];
    await mountCombobox({
      items: ['Apple', 'Banana'],
      itemProps: { Apple: { disabled: true } },
      root: rootEvents(log),
    });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    expect(item('Apple')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    expect(log.filter((entry) => entry.includes('valueChange'))).toEqual([]);
  });
});

describe('selection', () => {
  test('a pick emits the value, the text and the open state, in this order; a pick of the selected item emits no valueChange', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log, { defaultValue: 'Apple' }) });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Banana'));
    await closed();
    expect(log.slice(2)).toEqual([
      'valueChange "Banana" item-press',
      'update:modelValue "Banana"',
      'inputValueChange "Banana" item-press',
      'update:inputValue "Banana"',
      'openChange false item-press',
      'update:open false',
    ]);
    log.length = 0;
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Banana'));
    await closed();
    expect(log.filter((entry) => entry.includes('valueChange'))).toEqual([]);
  });

  test('a link in an item selects nothing; a link to a fragment closes the popup', async () => {
    const log: string[] = [];
    const prevent = (event: Event) => event.preventDefault();
    await mountCombobox({
      itemProps: {
        Apple: { as: 'a', href: '#apple', onClick: prevent },
        Banana: { as: 'a', href: '/banana', onClick: prevent },
      },
      root: rootEvents(log),
    });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Banana'));
    expect(popup()).not.toBe(null);
    await userEvent.click(item('Apple'));
    await closed();
    expect(log.filter((entry) => entry.includes('valueChange'))).toEqual([]);
    expect(log).toContain('openChange false item-press');
  });

  test('a pick in an inline list puts the label in the input', async () => {
    mount(ComboboxInline);
    await nextTick();
    input().focus();
    await userEvent.keyboard('ba');
    await waitFor(() => expect(itemNames()).toEqual(['Banana']));
    await userEvent.click(item('Banana'));
    await nextTick();
    expect(input().value).toBe('Banana');
  });

  test('a cancel keeps the popup open', async () => {
    await mountCombobox({
      root: {
        onValueChange: (_: unknown, details: ComboboxRootChangeEventDetails) => details.cancel(),
      },
    });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Banana'));
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(input().value).toBe('');
  });

  test('Space picks the highlighted item while the text is empty', async () => {
    const log: string[] = [];
    await mountCombobox({ root: rootEvents(log) });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard(' ');
    expect(log).toContain('valueChange "Apple" item-press');
  });

  test('Enter with no highlight closes and lets the form submit', async () => {
    const form = document.body.appendChild(document.createElement('form'));
    let submits = 0;
    form.addEventListener('submit', (event) => {
      submits += 1;
      event.preventDefault();
    });
    try {
      mount(ComboboxParts, {}, form);
      await nextTick();
      await userEvent.click(input());
      await opened();
      await userEvent.keyboard('{Enter}');
      await closed();
      expect(submits).toBe(1);
    } finally {
      form.remove();
    }
  });

  test('a multiple combobox adds and removes values; after a typed filter, the popup closes', async () => {
    const root = reactive<Props>({
      modelValue: [],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
    });
    mount(ComboboxChips, { root });
    await nextTick();
    await userEvent.click(input());
    await opened();
    expect(document.querySelector('[role="listbox"]')).toHaveAttribute(
      'aria-multiselectable',
      'true',
    );
    await userEvent.click(item('Apple'));
    await userEvent.click(item('Banana'));
    expect(root.modelValue).toEqual(['Apple', 'Banana']);
    expect(popup()).not.toBe(null);
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    await userEvent.click(item('Apple'));
    expect(root.modelValue).toEqual(['Banana']);
    await userEvent.keyboard('ch');
    await waitFor(() => expect(itemNames()).toEqual(['Cherry']));
    await userEvent.click(item('Cherry'));
    await closed();
    expect(root.modelValue).toEqual(['Banana', 'Cherry']);
    expect(input().value).toBe('');
  });
});

describe('chips', () => {
  test('Backspace in an empty input removes the last value; ArrowLeft at the start goes to the last chip; a chip removes its value', async () => {
    const root = reactive<Props>({
      modelValue: ['Apple', 'Banana', 'Cherry'],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
    });
    mount(ComboboxChips, { root });
    await nextTick();
    expect(byTestId('chips')).toHaveAttribute('role', 'toolbar');
    input().focus();
    await userEvent.keyboard('{Backspace}');
    expect(root.modelValue).toEqual(['Apple', 'Banana']);
    await nextTick();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(byTestId('chip-Banana'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(byTestId('chip-Apple'));
    await userEvent.keyboard('{Delete}');
    expect(root.modelValue).toEqual(['Banana']);
    await waitFor(() => expect(document.activeElement).toBe(byTestId('chip-Banana')));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(input());
  });

  test('ChipRemove removes its value, keeps the focus on the input and leaves `touched` false', async () => {
    const reasons: string[] = [];
    const root = reactive<Props>({
      modelValue: ['Apple', 'Banana'],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
      onValueChange: (_: unknown, details: ComboboxRootChangeEventDetails) =>
        reasons.push(details.reason),
    });
    mount(ComboboxChips, { root });
    await nextTick();
    input().focus();
    const blurs: string[] = [];
    input().addEventListener('blur', () => blurs.push('blur'));
    await userEvent.click(byTestId('remove-Apple')!);
    expect(root.modelValue).toEqual(['Banana']);
    expect(reasons).toEqual(['chip-remove-press']);
    expect(document.activeElement).toBe(input());
    expect(blurs).toEqual([]);
  });

  test('the chips are a toolbar only with a value; a chip that takes the focus closes the popup', async () => {
    const root = reactive<Props>({
      modelValue: [],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
    });
    mount(ComboboxChips, { root });
    await nextTick();
    expect(byTestId('chips')).not.toHaveAttribute('role');
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    expect(byTestId('chips')).toHaveAttribute('role', 'toolbar');
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(byTestId('chip-Apple'));
    await closed();
  });

  test('ChipRemove stops its click, unless a listener calls `allowPropagation()`', async () => {
    let allow = false;
    const root = reactive<Props>({
      modelValue: ['Apple', 'Banana'],
      'onUpdate:modelValue': (value: string[]) => (root.modelValue = value),
      onValueChange: (_: unknown, details: ComboboxRootChangeEventDetails) => {
        if (allow) details.allowPropagation();
      },
    });
    mount(ComboboxChips, { root });
    await nextTick();
    const clicks: string[] = [];
    const onClick = () => clicks.push('click');
    document.body.addEventListener('click', onClick);
    try {
      await userEvent.click(byTestId('remove-Apple')!);
      expect(clicks).toEqual([]);
      allow = true;
      await userEvent.click(byTestId('remove-Banana')!);
      expect(clicks).toEqual(['click']);
    } finally {
      document.body.removeEventListener('click', onClick);
    }
  });

  test('in a right-to-left chips, ArrowRight goes to the chip before, and ArrowLeft to the chip after', async () => {
    mount(ComboboxChips, { root: { modelValue: ['Apple', 'Banana'] } });
    await nextTick();
    byTestId('chips')!.dir = 'rtl';
    input().focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(byTestId('chip-Banana'));
    await userEvent.keyboard('{ArrowRight}');
    expect(document.activeElement).toBe(byTestId('chip-Apple'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(byTestId('chip-Banana'));
  });
});

describe('clear', () => {
  test('a press empties the text and the value, and moves the focus to the input; with no value the button is not rendered', async () => {
    const log: string[] = [];
    await mountCombobox({ clear: {}, root: rootEvents(log, { defaultValue: 'Pear' }) });
    expect(byTestId('clear')).toHaveAttribute('tabindex', '-1');
    await userEvent.click(byTestId('clear')!);
    expect(log).toEqual([
      'inputValueChange "" clear-press',
      'update:inputValue ""',
      'valueChange null clear-press',
      'update:modelValue null',
    ]);
    expect(document.activeElement).toBe(input());
    await waitFor(() => expect(byTestId('clear')).toBe(null));
  });

  test('a press removes the highlight', async () => {
    await mountCombobox({ clear: {}, root: { defaultValue: 'Apple' } });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.click(byTestId('clear')!);
    await nextTick();
    expect(highlighted()).toBe(undefined);
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });

  test('a kept button has `hidden` with no value', async () => {
    await mountCombobox({ clear: { keepMounted: true } });
    expect(byTestId('clear')).toHaveAttribute('hidden');
  });
});

describe('the parts of the popup', () => {
  test('the positioner anchors to the group of the input and tells its side', async () => {
    await mountCombobox({ root: { defaultOpen: true } });
    await opened();
    const positioner = byTestId('positioner')!;
    await waitFor(() => expect(positioner.style.visibility).toBe(''));
    const group = byTestId('group')!;
    group.style.width = '400px';
    await waitFor(() => {
      const { left, width } = positioner.getBoundingClientRect();
      expect(Math.abs(left + width / 2 - 200)).toBeLessThan(2);
    });
    expect(positioner).toHaveAttribute('data-side', 'bottom');
    expect(input()).toHaveAttribute('data-popup-side', 'bottom');
    expect(byTestId('group')).toHaveAttribute('data-popup-side', 'bottom');
  });

  test('an input group in the popup is no anchor: the popup anchors to the trigger', async () => {
    await mountCombobox({ inputInPopup: true, positioner: { align: 'start' } });
    trigger().style.marginLeft = '100px';
    await userEvent.click(trigger());
    await opened();
    await waitFor(() =>
      expect(Math.round(byTestId('positioner')!.getBoundingClientRect().left)).toBe(
        Math.round(trigger().getBoundingClientRect().left),
      ),
    );
    expect(byTestId('popup-group')).toHaveAttribute('role', 'group');
  });

  test('the hidden text input has the id of the control', async () => {
    const { exposed } = await mountCombobox({ input: { id: 'fruit' } });
    await nextTick();
    expect(exposed.root.inputElement.id).toBe('fruit-hidden-input');
  });

  test('Icon is a hidden span with an arrow; Value shows the label of the value, else the placeholder', async () => {
    const root = reactive<Props>({ modelValue: null });
    await mountCombobox({ inputInPopup: true, root });
    expect(trigger()).toHaveTextContent('Pick a fruit');
    expect(trigger()).toHaveAttribute('data-placeholder');
    root.modelValue = 'Lemon';
    await nextTick();
    expect(trigger()).toHaveTextContent('Lemon');
    expect(trigger()).not.toHaveAttribute('data-placeholder');
    const icon = mount(ComboboxPartAlone, { part: 'Icon' }).root.firstElementChild!;
    expect(icon.localName).toBe('span');
    expect(icon).toHaveAttribute('aria-hidden', 'true');
    expect(icon).toHaveTextContent('▼');
  });

  test('the slot of an item gets its state; a selected item has `aria-selected`', async () => {
    await mountCombobox({ root: { defaultValue: 'Banana', defaultOpen: true } });
    await opened();
    expect(item('Banana')).toHaveAttribute('aria-selected', 'true');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'false');
  });

  test('the text of Status and of Empty comes one task after the mount; Empty shows only for an empty list', async () => {
    await mountCombobox({ status: true, empty: true, root: { defaultOpen: true } });
    await opened();
    expect(byTestId('status')).toHaveAttribute('role', 'status');
    expect(byTestId('status')).toHaveAttribute('aria-live', 'polite');
    expect(byTestId('empty')).toHaveAttribute('aria-atomic', 'true');
    expect(byTestId('status')).toHaveTextContent('');
    await waitFor(() => expect(byTestId('status')).toHaveTextContent('Ten fruits.'));
    expect(byTestId('empty')).toHaveTextContent('');
    input().focus();
    await userEvent.keyboard('zz');
    await waitFor(() => expect(byTestId('empty')).toHaveTextContent('No fruit.'));
    expect(byTestId('positioner')).toHaveAttribute('data-empty');
    expect(input()).toHaveAttribute('data-list-empty');
  });
});

describe('fixes of Base UI', () => {
  test('BUG-5574: a pick with the mouse while a composition runs leaves no composed text in the input', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    input().dispatchEvent(new CompositionEvent('compositionstart', { data: '' }));
    input().value = 'ba';
    input().dispatchEvent(
      new InputEvent('input', { inputType: 'insertCompositionText', data: 'ba' }),
    );
    await userEvent.click(item('Cherry'));
    await closed();
    expect(input().value).toBe('Cherry');
  });

  test('BUG-5776: the typeahead of a closed trigger skips a mounted item that is disabled', async () => {
    const values: unknown[] = [];
    await mountCombobox({
      inputInPopup: true,
      portal: { keepMounted: true },
      itemProps: { Apple: { disabled: true } },
      root: { 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    trigger().focus();
    await userEvent.keyboard('a');
    expect(values).toEqual(['Apricot']);
  });

  test('VUE-100: Home and End in an input in the popup move the caret, and not the highlight', async () => {
    await mountCombobox({ inputInPopup: true });
    await userEvent.click(trigger());
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('ap{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Home}');
    expect(input().selectionStart).toBe(0);
    expect(highlighted()).toBe('Apple');
    await userEvent.keyboard('{Shift>}{End}{/Shift}');
    expect([input().selectionStart, input().selectionEnd]).toEqual([0, 2]);
  });

  test('VUE-122: the keys of the chips do nothing for a value that is not a list', async () => {
    mount(ComboboxChips, { root: { multiple: false, modelValue: 'Apple' } });
    await nextTick();
    input().focus();
    await userEvent.keyboard('{ArrowLeft}{Backspace}');
    expect(document.activeElement).toBe(input());
  });

  test('VUE-97: a `<textarea>` in the slot of the input keeps its arrow keys and Home and End, and has the role only while the list shows', async () => {
    mount(TextareaCombobox);
    await nextTick();
    const textarea = document.querySelector('textarea')!;
    expect(textarea).not.toHaveAttribute('role');
    expect(textarea).not.toHaveAttribute('autocomplete');
    textarea.focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(popup()).toBe(null);
    await userEvent.keyboard('a');
    await opened();
    await waitFor(() => expect(textarea).toHaveAttribute('role', 'combobox'));
    expect(textarea).toHaveAttribute('aria-expanded', 'true');
  });
});

describe('more rules', () => {
  test('an input in the popup starts with no text when the trigger shows the value', async () => {
    await mountCombobox({ inputInPopup: true, root: { defaultValue: 'Lemon' } });
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
  });

  test('the developer value of `autocorrect` is the one attribute of the input', async () => {
    await mountCombobox({ input: { autocorrect: 'on' } });
    expect(input().getAttribute('autocorrect')).toBe('on');
  });

  test('a press on the clear button keeps the popup open; a press on it and on an item gives the input no blur', async () => {
    await mountCombobox({ clear: {}, root: { defaultValue: 'Apple' } });
    await userEvent.click(input());
    await opened();
    const blurs: string[] = [];
    input().addEventListener('blur', () => blurs.push('blur'));
    await userEvent.click(byTestId('clear')!);
    await nextTick();
    expect(popup()).not.toBe(null);
    expect(document.activeElement).toBe(input());
    await userEvent.click(item('Banana'));
    await closed();
    expect(document.activeElement).toBe(input());
    expect(blurs).toEqual([]);
  });

  test('a clear button in a <Transition> that shows again while it leaves enters again', async () => {
    const root = reactive<Props>({ modelValue: 'Apple' });
    mount(ComboboxClearInTransition, { root });
    await nextTick();
    const first = byTestId('clear')!;
    root.modelValue = null;
    await nextTick();
    expect(first.className).toContain('fade-leave-active');
    root.modelValue = 'Banana';
    await nextTick();
    await waitFor(() => expect(first.isConnected).toBe(false));
    await waitFor(() => expect(byTestId('clear')).not.toBe(null));
    expect(byTestId('clear')!.className).toContain('fade-enter');
  });

  test('typed text puts the list at its top', async () => {
    await mountCombobox({ list: { style: 'max-height: 60px; overflow: auto' } });
    await userEvent.click(input());
    await opened();
    list().scrollTop = 100;
    await userEvent.keyboard('e');
    await waitFor(() => expect(list().scrollTop).toBe(0));
  });

  test('the highlight of an inline list goes at a blur and comes back at a focus', async () => {
    mount(ComboboxInline);
    await nextTick();
    input().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('Banana'));
    document.getElementById('outside')!.focus();
    await waitFor(() => expect(highlighted()).toBe(undefined));
    input().focus();
    await waitFor(() => expect(highlighted()).toBe('Banana'));
  });

  test.each([true, 'always'] as const)(
    'with `autoHighlight` %s, items that come after the blur of an inline input get the highlight only with `always`',
    async (autoHighlight) => {
      const root = reactive<Props>({ items: [], autoHighlight, filter: null });
      mount(ComboboxInline, { root });
      await nextTick();
      input().focus();
      await userEvent.keyboard('32');
      await nextTick();
      document.getElementById('outside')!.focus();
      root.items = ['32'];
      await waitFor(() => expect(itemNames()).toEqual(['32']));
      await nextTick();
      expect(highlighted()).toBe(autoHighlight === 'always' ? '32' : undefined);
    },
  );

  test('a filter that makes the popup smaller keeps the side of its flip', async () => {
    await mountCombobox({ positioner: { sideOffset: 4 } });
    // The room below the group holds one item, and not the full list.
    byTestId('group')!.style.cssText = 'position: fixed; bottom: 100px; left: 10px; width: 200px';
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(byTestId('positioner')).toHaveAttribute('data-side', 'top'));
    await userEvent.keyboard('peac');
    await waitFor(() => expect(itemNames()).toEqual(['Peach']));
    // The popup moves to its new size, and stays above the group.
    await waitFor(() => {
      const group = byTestId('group')!.getBoundingClientRect();
      const positioner = byTestId('positioner')!.getBoundingClientRect();
      expect(positioner.height).toBeLessThan(60);
      expect(Math.round(group.top - positioner.bottom)).toBe(4);
    });
    expect(byTestId('positioner')).toHaveAttribute('data-side', 'top');
  });

  test('a modal popup blocks the page and locks its scroll, and leaves the group of the input free', async () => {
    await mountCombobox({ root: { modal: true, defaultValue: 'Apple' }, clear: {} });
    await userEvent.click(input());
    await opened();
    const block = await waitFor(() => {
      const element = document.querySelector<HTMLElement>('body > div[role="presentation"]');
      expect(element).not.toBe(null);
      return element!;
    });
    await waitFor(() => expect(block.style.clipPath).toContain('polygon'));
    await waitFor(() => expect(isScrollLocked()).toBe(true));
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(input().value).toBe(''));
  });

  test.skipIf(server.browser !== 'chromium')(
    'a modal popup that a touch opened locks the scroll only when it is as wide as the view',
    async () => {
      const tap = async () => {
        const rect = input().getBoundingClientRect();
        const point = { x: rect.left + 5, y: rect.top + rect.height / 2 };
        await touchDrag(point, point, 0);
        await opened();
      };
      const narrow = await mountCombobox({ root: { modal: true } });
      await tap();
      await waitFor(() => expect(byTestId('positioner')!.style.visibility).toBe(''));
      await new Promise((resolve) => setTimeout(resolve, 20));
      expect(isScrollLocked()).toBe(false);
      narrow.unmount();
      await mountCombobox({ root: { modal: true }, positioner: { style: 'width: 100vw' } });
      await tap();
      await waitFor(() => expect(isScrollLocked()).toBe(true));
    },
  );

  test.skipIf(server.browser !== 'chromium')(
    'a touch that drags outside closes nothing, and a tap outside closes',
    async () => {
      await mountCombobox({ root: { defaultOpen: true } });
      await opened();
      const outside = document.getElementById('outside')!.getBoundingClientRect();
      const point = { x: outside.left + 5, y: outside.top + 5 };
      await touchDrag(point, { x: point.x - 40, y: point.y - 40 }, 4);
      await nextTick();
      expect(popup()).not.toBe(null);
      await touchDrag(point, point, 0);
      await closed();
    },
  );

  test('the release of the press of the trigger beside the input on the input keeps the popup open', async () => {
    await mountCombobox({ trigger: true });
    const start = trigger().getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: start.left + 3, y: start.top + 3 },
      keys: '[MouseLeft>]',
    });
    await opened();
    const field = input().getBoundingClientRect();
    await userEvent.pointer({ coords: { x: field.left + 5, y: field.top + 5 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await nextTick();
    expect(popup()).not.toBe(null);
  });

  test('the release of the press of the trigger on an item selects it; at a place outside it closes', async () => {
    const values: unknown[] = [];
    await mountCombobox({
      inputInPopup: true,
      root: { 'onUpdate:modelValue': (value: unknown) => values.push(value) },
    });
    const start = trigger().getBoundingClientRect();
    await userEvent.pointer({
      coords: { x: start.left + 5, y: start.top + 5 },
      keys: '[MouseLeft>]',
    });
    await opened();
    await waitFor(() => expect(byTestId('positioner')!.style.visibility).toBe(''));
    const target = item('Banana').getBoundingClientRect();
    await userEvent.pointer({ coords: { x: target.left + 5, y: target.top + 5 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await closed();
    expect(values).toEqual(['Banana']);
    const log: string[] = [];
    await userEvent.pointer({
      coords: { x: start.left + 5, y: start.top + 5 },
      keys: '[MouseLeft>]',
    });
    await opened();
    const away = document.getElementById('outside')!.getBoundingClientRect();
    document.addEventListener('pointerup', () => log.push('up'), { once: true });
    await userEvent.pointer({ coords: { x: away.left + 5, y: away.top + 5 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await closed();
    expect(log).toEqual(['up']);
  });
});

describe('focus', () => {
  test('Tab on the input goes to the first tab stop of the popup; Tab from the last one closes the popup', async () => {
    await mountCombobox({ button: true });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('popup-button'));
    await userEvent.keyboard('{Tab}');
    await closed();
  });

  test('a popup with no tab stop takes no Tab: the focus leaves the input and the popup closes', async () => {
    await mountCombobox();
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(document.activeElement).not.toBe(input());
  });
});

describe('around the combobox', () => {
  test('in a popover: a pick and Escape close only the combobox; Escape on an empty list with no Empty also closes the popover', async () => {
    mount(ComboboxAround, { around: 'popover' });
    await waitFor(() => expect(byTestId('popover')).not.toBe(null));
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await closed();
    expect(byTestId('popover')).not.toBe(null);
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('popover')).not.toBe(null);
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('zz');
    await waitFor(() => expect(itemNames()).toEqual([]));
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(byTestId('popover')).toBe(null));
  });

  test('in a dialog: a pick closes only the combobox', async () => {
    mount(ComboboxAround, { around: 'dialog' });
    await nextTick();
    await userEvent.click(byTestId('dialog-trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    await userEvent.keyboard('{Enter}');
    await closed();
    expect(input().value).toBe('Apple');
    expect(byTestId('dialog')).not.toBe(null);
  });

  test('in a dialog: Escape closes only the combobox', async () => {
    mount(ComboboxAround, { around: 'dialog' });
    await nextTick();
    await userEvent.click(byTestId('dialog-trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('dialog')).not.toBe(null);
  });

  test('in Toolbar.Input: ArrowDown opens the list, and ArrowLeft at the start of the text goes to the button before', async () => {
    mount(ComboboxAround, { around: 'toolbar' });
    await nextTick();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    expect(document.activeElement).toBe(input());
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(byTestId('first'));
    await closed();
  });
});

// The case throws in `setup`, so it is the last of the file.
describe('a part outside its root', () => {
  test('throws an error that names the part', () => {
    expect(String(mountError(ComboboxPartAlone, { part: 'Item' }))).toContain(
      '<Combobox.Item> or <Autocomplete.Item> must be inside <Combobox.Root> or <Autocomplete.Root>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});
