import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ComboboxRootChangeEventDetails } from '@vase-ui/vue/combobox';
import ComboboxInTransition from '../../test/fixtures/ComboboxInTransition.vue';
import ComboboxInlineScene from '../../test/fixtures/ComboboxInlineScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { clientCenter } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;
type Details = ComboboxRootChangeEventDetails;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());

/** A root that records each text change as `text reason event isItemPress`. */
function textLog(log: string[], props: Props = {}, cancel?: (details: Details) => boolean) {
  return {
    ...props,
    onInputValueChange: (text: string, details: Details) => {
      log.push(
        `${JSON.stringify(text)} ${details.reason} ${details.event.type}${details.isItemPress ? ' item' : ''}`,
      );
      if (cancel?.(details)) details.cancel();
    },
  };
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

async function leaving() {
  await waitFor(() => expect(popup()?.className).toContain('combobox-leave-leave-active'));
}

async function reopened() {
  await waitFor(() => {
    expect(popup()).not.toBe(null);
    expect(popup()!.className).not.toContain('leave');
  });
}

/** Empties the input with one key, as a user who selects its text and deletes it. */
async function emptyInput() {
  input().focus();
  input().select();
  await userEvent.keyboard('{Backspace}');
}

describe('the text of a single combobox', () => {
  test('a multiple root starts with no text', async () => {
    mount(ComboboxParts, { root: { multiple: true, defaultValue: ['Apple'] } });
    await nextTick();
    expect(input().value).toBe('');
  });

  test('follows a controlled value and new items with one text change each, and mounts no list', async () => {
    const log: string[] = [];
    const items = reactive(['Apple', 'Banana', 'Cherry']);
    const root = reactive<Props>(textLog(log, { modelValue: 'Apple' }));
    mount(ComboboxParts, { items, root });
    await nextTick();
    expect(input().value).toBe('Apple');
    root.modelValue = 'Banana';
    await nextTick();
    expect(input().value).toBe('Banana');
    root.modelValue = 'Cherry';
    await nextTick();
    expect(input().value).toBe('Cherry');
    expect(log).toEqual(['"Banana" none vase-ui', '"Cherry" none vase-ui']);
    expect(document.querySelector('[role="listbox"]')).toBe(null);
    items.splice(0, 3, 'Apricot', 'Ambrosia');
    root.modelValue = 'Apricot';
    await nextTick();
    expect(input().value).toBe('Apricot');
  });

  test('a new `itemToStringLabel` gives a new text for the same value', async () => {
    const root = reactive<Props>({ modelValue: 'b' });
    mount(ComboboxParts, { items: ['a', 'b'], root });
    await nextTick();
    expect(input().value).toBe('b');
    root.itemToStringLabel = (value: string) => (value === 'b' ? 'Banana' : value);
    await nextTick();
    expect(input().value).toBe('Banana');
  });

  test('keeps the label of a value whose items load later', async () => {
    const items = reactive<string[]>([]);
    mount(ComboboxParts, { items, root: { modelValue: 'banana' } });
    await nextTick();
    expect(input().value).toBe('banana');
    items.push('apple', 'banana', 'bread');
    await nextTick();
    expect(input().value).toBe('banana');
  });

  test('a cancelled change of the text to a new label keeps the text; the next change applies', async () => {
    let cancelSync = true;
    const root = reactive<Props>({
      modelValue: 'One',
      onInputValueChange: (_: string, details: Details) => {
        if (cancelSync && details.reason === 'none') details.cancel();
      },
    });
    mount(ComboboxParts, { items: ['One', 'Two'], root });
    await nextTick();
    expect(input().value).toBe('One');
    root.modelValue = 'Two';
    await nextTick();
    expect(input().value).toBe('One');
    cancelSync = false;
    root.modelValue = 'One';
    await nextTick();
    root.modelValue = 'Two';
    await nextTick();
    expect(input().value).toBe('Two');
  });

  test('a pick that the parent changes to another value shows the label of that value', async () => {
    const root = reactive<Props>({ modelValue: null, defaultOpen: true });
    root.onValueChange = (next: string | null) =>
      (root.modelValue = next === 'Banana' ? 'Cherry' : next);
    mount(ComboboxParts, { items: ['Apple', 'Banana', 'Cherry'], root });
    await opened();
    await userEvent.click(item('Banana'));
    await waitFor(() => expect(input().value).toBe('Cherry'));
  });

  test('a typed text with no pick is gone at the close, with the reason `input-clear`', async () => {
    const log: string[] = [];
    mount(ComboboxParts, { items: ['apple', 'banana'], root: textLog(log) });
    await nextTick();
    await userEvent.type(input(), 'app');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(input().value).toBe('');
    expect(log.at(-1)).toMatch(/^"" input-clear/);
  });
});

describe('the input in the popup', () => {
  test('a press on the trigger closes the popup and gives the focus to the trigger', async () => {
    mount(ComboboxParts, { inputInPopup: true });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.click(trigger());
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
  });

  test('a pick with the keys gives the focus back to the trigger, and the next open has no text and the selected item highlighted', async () => {
    mount(ComboboxParts, { inputInPopup: true, items: ['Apple', 'Banana', 'Cherry'] });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ban');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    expect(trigger()).toHaveTextContent('Banana');
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
    expect(item('Banana')).toHaveAttribute('aria-selected', 'true');
    await waitFor(() => expect(item('Banana')).toHaveAttribute('data-highlighted'));
  });

  test('Escape drops the typed text and keeps the value', async () => {
    const changes: unknown[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['Apple', 'Banana', 'Cherry'],
      root: { defaultValue: 'Apple', onValueChange: (value: unknown) => changes.push(value) },
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ban');
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    expect(trigger()).toHaveTextContent('Apple');
    expect(changes).toEqual([]);
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'true');
    expect(byTestId('item-Banana')).not.toBe(null);
  });

  test('the filter follows the text after a cancelled close of a pick', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['Apple', 'Apricot', 'Banana'],
      root: {
        onOpenChange: (open: boolean, details: Details) => {
          if (!open) details.cancel();
        },
      },
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ap');
    await userEvent.click(item('Apple'));
    expect(popup()).not.toBe(null);
    expect(trigger()).toHaveTextContent('Apple');
    await userEvent.clear(input());
    await userEvent.type(input(), 'ba');
    await waitFor(() => expect(options()).toEqual(['Banana']));
  });
});

describe('the text of a multiple combobox after a pick', () => {
  test('a pick with the pointer empties the text with `input-clear`, the click and `isItemPress`; with a key, the keydown', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana'],
      root: textLog(log, { multiple: true }),
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'app');
    await userEvent.click(item('apple'));
    expect(log.at(-1)).toBe('"" input-clear click item');
    await userEvent.type(input(), 'ban');
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(log.at(-1)).toBe('"" input-clear keydown item');
    expect(popup()).not.toBe(null);
    expect(document.activeElement).toBe(input());
  });

  test.each([
    { name: 'the input in the popup', inputInPopup: true, inline: false },
    { name: 'an inline list', inputInPopup: false, inline: true },
  ])(
    'with $name, a cancel of the clear of the pick keeps the text and the highlight',
    async ({ inputInPopup, inline }) => {
      const log: string[] = [];
      const root = textLog(log, { multiple: true }, (details) => !!details.isItemPress);
      if (inline) mount(ComboboxInlineScene, { items: ['apple', 'banana'], root });
      else mount(ComboboxParts, { inputInPopup, items: ['apple', 'banana'], root });
      await nextTick();
      if (inputInPopup) {
        await userEvent.click(trigger());
        await opened();
        await waitFor(() => expect(document.activeElement).toBe(input()));
      }
      await userEvent.type(input(), 'app');
      await userEvent.keyboard('{ArrowDown}{Enter}');
      expect(log.at(-1)).toBe('"" input-clear keydown item');
      expect(input().value).toBe('app');
      expect(input()).toHaveAttribute('aria-activedescendant', item('apple').id);
    },
  );

  test('a kept text is gone at the close, with a clear that is no item press', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana'],
      root: textLog(log, { multiple: true }, (details) => !!details.isItemPress),
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'app');
    await userEvent.click(item('apple'));
    expect(input().value).toBe('app');
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log.at(-1)).toMatch(/^"" input-clear [\w-]+$/);
    await userEvent.click(trigger());
    await opened();
    expect(input().value).toBe('');
  });

  test('with the input outside the popup, a cancel of the close of the pick keeps the text; the close of a pick marks its clear as an item press', async () => {
    const log: string[] = [];
    const root = reactive<Props>(
      textLog(log, {
        multiple: true,
        onOpenChange: (open: boolean, details: Details) => {
          if (!open && details.reason === 'item-press' && root.cancelClose) details.cancel();
        },
        cancelClose: true,
      }),
    );
    mount(ComboboxParts, { items: ['apple', 'banana'], root });
    await nextTick();
    await userEvent.type(input(), 'app');
    await opened();
    await userEvent.click(item('apple'));
    expect(input().value).toBe('app');
    expect(popup()).not.toBe(null);
    root.cancelClose = false;
    await userEvent.clear(input());
    await userEvent.type(input(), 'ban');
    await userEvent.click(item('banana'));
    await closed();
    expect(input().value).toBe('');
    expect(log.at(-1)).toMatch(/^"" input-clear \S+ item$/);
    await userEvent.type(input(), 'ch');
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log.at(-1)).toMatch(/^"" input-clear \S+$/);
  });

  test('a drag from the trigger that picks an item gives a clear that a cancel keeps', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana'],
      root: textLog(log, { multiple: true }, (details) => !!details.isItemPress),
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'app');
    await userEvent.keyboard('{Escape}');
    await closed();
    const start = clientCenter(trigger());
    await userEvent.pointer({
      coords: { x: start.clientX, y: start.clientY },
      keys: '[MouseLeft>]',
    });
    await opened();
    await waitFor(() => expect(byTestId('positioner')?.style.visibility ?? '').toBe(''));
    const target = clientCenter(item('apple'));
    await userEvent.pointer({ coords: { x: target.clientX, y: target.clientY } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await waitFor(() => expect(item('apple')).toHaveAttribute('aria-selected', 'true'));
  });

  test('a cancel of the value keeps the text of the input in the popup', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      items: ['apple', 'banana'],
      root: {
        multiple: true,
        onValueChange: (_: unknown, details: Details) => details.cancel(),
      },
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'app');
    await userEvent.click(item('apple'));
    expect(input().value).toBe('app');
    expect(popup()).not.toBe(null);
  });
});

describe('a value that the parent keeps after the user emptied the input', () => {
  const label = (value: string) => (value === 'apple' ? 'Apple' : value);

  test('new `items` give the input the label again, and the next open shows each item', async () => {
    const root = reactive<Props>({
      modelValue: 'apple',
      items: ['apple', 'banana'],
      itemToStringLabel: label,
    });
    mount(ComboboxParts, { root });
    await nextTick();
    expect(input().value).toBe('Apple');
    await emptyInput();
    await settle();
    expect(input().value).toBe('');
    expect(popup()).toBe(null);
    root.items = ['apple', 'banana'];
    await nextTick();
    expect(input().value).toBe('Apple');
    expect(document.activeElement).toBe(input());
    await userEvent.click(input());
    await opened();
    expect(options()).toEqual(['apple', 'banana']);
  });

  test('VUE-225: the input of a closed popup shows the label again when the focus leaves it', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['apple', 'banana'],
      root: textLog(log, { modelValue: 'apple', itemToStringLabel: label }),
    });
    await nextTick();
    await emptyInput();
    await settle();
    expect(input().value).toBe('');
    expect(popup()).toBe(null);
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).not.toBe(input());
    expect(input().value).toBe('Apple');
    expect(log.at(-1)).toBe('"Apple" none blur');
  });

  test.each([
    { name: 'new `items`', putBack: (root: Props) => (root.items = ['apple', 'banana']) },
    { name: 'a focus that leaves the input', putBack: () => userEvent.keyboard('{Tab}') },
  ])(
    'after $name put the label back, the text follows a new value of the parent',
    async ({ putBack }) => {
      const root = reactive<Props>({
        modelValue: 'apple',
        items: ['apple', 'banana'],
        itemToStringLabel: label,
      });
      mount(ComboboxParts, { root });
      await nextTick();
      await emptyInput();
      await settle();
      await putBack(root);
      await nextTick();
      expect(input().value).toBe('Apple');
      root.modelValue = 'banana';
      await nextTick();
      expect(input().value).toBe('banana');
    },
  );

  test('an inline list keeps its emptied text and its value at new `items`', async () => {
    const root = reactive<Props>({ defaultValue: 'apple', items: ['apple', 'banana'] });
    mount(ComboboxInlineScene, { root });
    await nextTick();
    expect(input().value).toBe('apple');
    await emptyInput();
    await settle();
    expect(input().value).toBe('');
    root.items = ['apple', 'banana', 'cherry'];
    await settle();
    expect(input().value).toBe('');
    expect(item('apple')).toHaveAttribute('aria-selected', 'true');
  });

  test('an emptied text and a typed text stay when the text listener or a later update gives new `items`', async () => {
    const root = reactive<Props>({
      modelValue: 'apple',
      items: ['apple', 'banana'],
      itemToStringLabel: label,
    });
    root.onInputValueChange = () => (root.items = [...(root.items as string[])]);
    mount(ComboboxParts, { root });
    await nextTick();
    await emptyInput();
    await settle();
    expect(input().value).toBe('');
    await userEvent.keyboard('b');
    await opened();
    expect(input().value).toBe('b');
    root.items = ['apple', 'banana', 'blueberry'];
    await settle();
    expect(input().value).toBe('b');
  });
});

describe('VUE-220: a popup that leaves in a <Transition>', () => {
  test('keeps its filtered items while it leaves', async () => {
    const after: string[] = [];
    mount(ComboboxInTransition, {
      inputInPopup: true,
      root: { multiple: true },
      log: { add: (entry: string) => after.push(entry) },
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ap');
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot']));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()?.className).toContain('combobox-leave-leave-active'));
    expect(options()).toEqual(['apple', 'apricot']);
    expect(input().value).toBe('ap');
    await waitFor(() => expect(after.slice(-2)).toEqual(['after-leave', 'child unmounted']));
    expect(after.filter((entry) => entry === 'after-leave')).toHaveLength(1);
  });

  test('an open during the leave keeps the same popup with no text, each item and the selected item highlighted', async () => {
    const log: string[] = [];
    mount(ComboboxInTransition, {
      inputInPopup: true,
      root: textLog(log, { defaultValue: 'banana' }),
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    const first = popup()!;
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'banana');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()?.className).toContain('combobox-leave-leave-active'));
    await userEvent.click(trigger(), { force: true });
    await waitFor(() => expect(popup()?.className ?? '').not.toContain('leave'));
    expect(popup()).toBe(first);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input().value).toBe('');
    expect(options()).toEqual(['apple', 'apricot', 'banana']);
    await waitFor(() => expect(item('banana')).toHaveAttribute('data-highlighted'));
    expect(input()).toHaveAttribute('aria-activedescendant', item('banana').id);
    expect(log.filter((entry) => entry.startsWith('""'))).toHaveLength(1);
  });

  test.each([
    { name: 'single', multiple: false },
    { name: 'multiple', multiple: true },
  ])(
    'with $name and the input outside, an open by the trigger after Escape shows no text and each item, and the next Escape changes no text',
    async ({ multiple }) => {
      const log: string[] = [];
      mount(ComboboxInTransition, { root: textLog(log, { multiple }) });
      await nextTick();
      await userEvent.type(input(), 'app');
      await opened();
      await waitFor(() => expect(options()).toEqual(['apple']));
      await userEvent.keyboard('{Escape}');
      await leaving();
      expect(input().value).toBe('');
      await userEvent.click(trigger(), { force: true });
      await reopened();
      expect(input().value).toBe('');
      await waitFor(() => expect(options()).toEqual(['apple', 'apricot', 'banana']));
      log.length = 0;
      await userEvent.keyboard('{Escape}');
      await closed();
      expect(log).toEqual([]);
    },
  );

  test('a text typed in an emptied input during the leave stays when the text listener gives new `items`', async () => {
    const root = reactive<Props>({ defaultValue: 'apple', items: ['apple', 'apricot', 'banana'] });
    root.onInputValueChange = () => (root.items = [...(root.items as string[])]);
    mount(ComboboxInTransition, { root });
    await nextTick();
    expect(input().value).toBe('apple');
    await userEvent.click(input());
    await opened();
    await emptyInput();
    expect(input().value).toBe('');
    await userEvent.keyboard('{Escape}');
    await leaving();
    await userEvent.keyboard('a');
    await settle();
    expect(input().value).toBe('a');
  });

  test('an open of the parent during the leave shows no text and each item, and the next Escape changes no text', async () => {
    const log: string[] = [];
    const root = reactive<Props>(textLog(log, { multiple: true, open: false }));
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    mount(ComboboxInTransition, { root });
    await nextTick();
    await userEvent.type(input(), 'app');
    await opened();
    await userEvent.keyboard('{Escape}');
    await leaving();
    root.open = true;
    await reopened();
    expect(input().value).toBe('');
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot', 'banana']));
    log.length = 0;
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(log).toEqual([]);
  });

  test('with the input in the popup and a parent that writes the label of the value to the text, an open during the leave after a pick shows no text and each item', async () => {
    const root = reactive<Props>({ modelValue: null, inputValue: '' });
    root.onValueChange = (next: string | null) => {
      root.modelValue = next;
      root.inputValue = next ?? '';
    };
    root['onUpdate:inputValue'] = (text: string) => (root.inputValue = text);
    mount(ComboboxInTransition, { inputInPopup: true, root });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ap');
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot']));
    await userEvent.click(item('apple'));
    await leaving();
    expect(input().value).toBe('ap');
    expect(options()).toEqual(['apple', 'apricot']);
    await userEvent.click(trigger(), { force: true });
    await reopened();
    await waitFor(() => expect(input().value).toBe(''));
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot', 'banana']));
  });

  test('a text and an open that the parent writes in one update during the leave give that text, with no clear after it', async () => {
    const log: string[] = [];
    const root = reactive<Props>(textLog(log, { open: false, inputValue: '' }));
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    root['onUpdate:inputValue'] = (text: string) => (root.inputValue = text);
    mount(ComboboxInTransition, { inputInPopup: true, root });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.type(input(), 'ap');
    await userEvent.keyboard('{Escape}');
    await leaving();
    log.length = 0;
    root.inputValue = 'banana';
    root.open = true;
    await reopened();
    await settle();
    expect(input().value).toBe('banana');
    expect(log).toEqual([]);
  });

  test('a pick in a filtered single combobox keeps its filtered items while the popup leaves, and the next open shows each item', async () => {
    mount(ComboboxInTransition, {});
    await nextTick();
    await userEvent.type(input(), 'ap');
    await opened();
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot']));
    await userEvent.click(item('apple'));
    await leaving();
    expect(input().value).toBe('apple');
    expect(options()).toEqual(['apple', 'apricot']);
    await userEvent.click(trigger(), { force: true });
    await reopened();
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot', 'banana']));
  });

  test('Escape after a typed text that matches the selected label keeps its filtered items while the popup leaves', async () => {
    mount(ComboboxInTransition, { root: { defaultValue: 'apple' } });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('x{Backspace}');
    await waitFor(() => expect(options()).toEqual(['apple']));
    await userEvent.keyboard('{Escape}');
    await leaving();
    expect(input().value).toBe('apple');
    expect(options()).toEqual(['apple']);
    await closed();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot', 'banana']));
  });

  test('a close that the parent does not apply keeps the text and the filter', async () => {
    const log: string[] = [];
    mount(ComboboxInTransition, { root: textLog(log, { multiple: true, open: true }) });
    await opened();
    await userEvent.type(input(), 'ap');
    await waitFor(() => expect(options()).toEqual(['apple', 'apricot']));
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(popup()).not.toBe(null);
    expect(input().value).toBe('ap');
    expect(options()).toEqual(['apple', 'apricot']);
    expect(log.filter((entry) => entry.startsWith('""'))).toEqual([]);
  });
});
