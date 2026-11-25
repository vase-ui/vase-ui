import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { AutocompleteRootChangeEventDetails } from '@vase-ui/vue/autocomplete';
import AutocompleteInTransition from '../../test/fixtures/AutocompleteInTransition.vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import AutocompleteTextarea from '../../test/fixtures/AutocompleteTextarea.vue';
import AutocompleteValueAlone from '../../test/fixtures/AutocompleteValueAlone.vue';
import {
  finishAnimations,
  mostMatches,
  opacityUntilRest,
  shownOpacity,
} from '../../test/animation';
import { screen } from '../../test/queries';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const form = () => byTestId('form') as HTMLFormElement;
const itemNames = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim();

async function mountAutocomplete(props: Props = {}) {
  const result = mount(AutocompleteParts, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

describe('the text', () => {
  test('typed text is the value, and opens the popup; a press does not open it', async () => {
    const log: string[] = [];
    await mountAutocomplete({
      root: {
        onValueChange: (value: string, details: AutocompleteRootChangeEventDetails) =>
          log.push(`valueChange ${value} ${details.reason}`),
        'onUpdate:modelValue': (value: string) => log.push(`update ${value}`),
      },
    });
    await userEvent.click(input());
    expect(popup()).toBe(null);
    await userEvent.keyboard('f');
    await opened();
    expect(itemNames()).toEqual(['feature', 'fix']);
    expect(log).toEqual(['valueChange f input-change', 'update f']);
    expect(input()).toHaveAttribute('aria-autocomplete', 'list');
    expect(byTestId('item-fix')).not.toHaveAttribute('aria-selected');
  });

  test('a pick makes the text of the item the value, and closes the popup', async () => {
    await mountAutocomplete();
    input().focus();
    await userEvent.keyboard('d');
    await opened();
    await userEvent.click(byTestId('item-docs')!);
    await waitFor(() => expect(popup()).toBe(null));
    expect(input().value).toBe('docs');
  });

  test('with no `autoHighlight`, an open highlights nothing, and the next arrow key gives the first item', async () => {
    await mountAutocomplete();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await nextTick();
    expect(highlighted()).toBe(undefined);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test("with `autoHighlight: 'always'`, the first item has the highlight at the open and while the text is empty", async () => {
    await mountAutocomplete({ root: { autoHighlight: 'always' } });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test("with `autoHighlight: 'always'`, a press open highlights the first item, and so does an emptied text", async () => {
    await mountAutocomplete({ root: { autoHighlight: 'always', openOnInputClick: true } });
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('feature'));
    await userEvent.keyboard('d');
    await waitFor(() => expect(highlighted()).toBe('docs'));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test('with `keepHighlight`, a pointer that leaves the list keeps the highlight', async () => {
    await mountAutocomplete({ root: { keepHighlight: true, openOnInputClick: true } });
    await userEvent.click(input());
    await opened();
    await userEvent.hover(byTestId('item-fix')!);
    await waitFor(() => expect(highlighted()).toBe('fix'));
    await userEvent.hover(input());
    await nextTick();
    expect(highlighted()).toBe('fix');
  });
  test('a listener of `input` after the one of Autocomplete.Input can change a controlled text, and the caret stays where that listener put it', async () => {
    const root: Props = reactive({ modelValue: '' });
    await mountAutocomplete({
      root,
      input: {
        onInput: (event: Event) => {
          const element = event.target as HTMLInputElement;
          const { selectionStart, selectionEnd } = element;
          element.value = element.value.toUpperCase();
          element.setSelectionRange(selectionStart, selectionEnd);
          root.modelValue = element.value;
        },
      },
    });
    input().focus();
    await userEvent.keyboard('ac');
    await userEvent.keyboard('{ArrowLeft}b');
    await userEvent.keyboard('d');
    expect(input()).toHaveValue('ABDC');
    expect(input().selectionStart).toBe(3);
    expect(root.modelValue).toBe('ABDC');
  });

  test('VUE-59: a cancel of the change keeps the text of an uncontrolled root', async () => {
    await mountAutocomplete({
      root: {
        onValueChange: (_: string, details: AutocompleteRootChangeEventDetails) => details.cancel(),
      },
    });
    input().focus();
    await userEvent.keyboard('f');
    await nextTick();
    await nextTick();
    expect(input().value).toBe('');
  });
});

describe('the modes', () => {
  test("`'both'`: a key highlight shows the text of its item; Enter makes it the value; a pointer highlight shows none", async () => {
    const root = reactive<Props>({ mode: 'both', openOnInputClick: true });
    await mountAutocomplete({ root });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('f');
    await waitFor(() => expect(itemNames()).toEqual(['feature', 'fix']));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(input().value).toBe('feature'));
    expect(itemNames()).toEqual(['feature', 'fix']);
    await userEvent.hover(byTestId('item-fix')!);
    await waitFor(() => expect(input().value).toBe('f'));
    await userEvent.keyboard('{ArrowUp}');
    await waitFor(() => expect(input().value).toBe('feature'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(popup()).toBe(null));
    expect(input().value).toBe('feature');
    expect(input()).toHaveAttribute('aria-autocomplete', 'both');
  });

  test("`'inline'` and `'none'` keep each item", async () => {
    await mountAutocomplete({ root: { mode: 'none' } });
    input().focus();
    await userEvent.keyboard('f');
    await opened();
    expect(itemNames()).toHaveLength(4);
  });
});

describe('the form', () => {
  test('the input is the form control: its name, its text and `required`', async () => {
    await mountAutocomplete({ root: { name: 'tag', required: true, defaultValue: 'fix' } });
    expect(input()).toHaveAttribute('name', 'tag');
    expect(input()).toBeRequired();
    expect([...new FormData(form()).entries()]).toEqual([['tag', 'fix']]);
  });

  test('with the input in the popup, the root holds the value inputs', async () => {
    await mountAutocomplete({ inputInPopup: true, root: { name: 'tag', defaultValue: 'docs' } });
    await waitFor(() => expect([...new FormData(form()).entries()]).toEqual([['tag', 'docs']]));
    expect(byTestId('trigger')).toHaveTextContent('docs');
  });

  test('BUG-6206: a reset gives a controlled root the text of its mount, with update:modelValue only', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      name: 'tag',
      modelValue: 'fix',
      onValueChange: () => log.push('valueChange'),
    });
    root['onUpdate:modelValue'] = (text: string) => {
      log.push(`update ${text}`);
      root.modelValue = text;
    };
    await mountAutocomplete({ root });
    await userEvent.type(input(), 'es');
    await waitFor(() => expect(input().value).toBe('fixes'));
    log.length = 0;
    form().reset();
    await settle();
    expect(log).toEqual(['update fix']);
    expect(input().value).toBe('fix');
  });

  test('a reset gives the defaultValue of the reset, after a change of it', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      name: 'tag',
      defaultValue: 'fix',
      'onUpdate:modelValue': (text: string) => log.push(`update ${text}`),
    });
    await mountAutocomplete({ root });
    root.defaultValue = 'docs';
    await nextTick();
    expect(input().value).toBe('fix');
    form().reset();
    await settle();
    expect(log).toEqual(['update docs']);
    expect(input().value).toBe('docs');
  });

  test.each([
    { name: 'v-model', root: { modelValue: 'Grace' }, shown: 'Grace' },
    { name: 'defaultValue', root: { defaultValue: 'Kay' }, shown: 'Kay' },
  ])(
    'a reset with no edit gives a textarea in the slot of the input the text of $name, and emits nothing',
    async ({ root, shown }) => {
      const log: string[] = [];
      mount(AutocompleteTextarea, {
        root: reactive<Props>({
          ...root,
          'onUpdate:modelValue': (text: string) => log.push(`update ${text}`),
        }),
      });
      await nextTick();
      const textarea = form().querySelector('textarea')!;
      expect(textarea).toHaveValue(shown);
      form().reset();
      await settle();
      expect(textarea).toHaveValue(shown);
      expect(log).toEqual([]);
    },
  );

  test('`submitOnItemClick` submits the form of the root after a pick, also from an input in the popup', async () => {
    const values: unknown[] = [];
    await mountAutocomplete({
      inputInPopup: true,
      root: { name: 'tag', submitOnItemClick: true },
    });
    form().addEventListener('submit', () => values.push(new FormData(form()).get('tag')));
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await userEvent.click(byTestId('item-chore')!);
    await waitFor(() => expect(values).toEqual(['chore']));
  });
});

const outside = () => document.getElementById('outside') as HTMLInputElement;

describe('the items', () => {
  test('a press calls the click listener of the item once, and Enter on a highlighted item calls it too', async () => {
    const clicks: unknown[] = [];
    await mountAutocomplete({
      root: { openOnInputClick: true },
      onItemClick: (item: unknown) => clicks.push(item),
    });
    await userEvent.click(input());
    await opened();
    await userEvent.click(byTestId('item-fix')!);
    await waitFor(() => expect(popup()).toBe(null));
    expect(clicks).toEqual(['fix']);
    await userEvent.click(input());
    await opened();
    expect(byTestId('item-fix')).not.toHaveAttribute('aria-selected');
    expect(byTestId('item-fix')).not.toHaveAttribute('data-selected');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('fix'));
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(clicks).toEqual(['fix', 'fix']));
  });

  test('Space while the text is empty fills the input with the highlighted item', async () => {
    await mountAutocomplete({ root: { openOnInputClick: true } });
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('feature'));
    await userEvent.keyboard(' ');
    await waitFor(() => expect(input().value).toBe('feature'));
  });

  test('Tab closes the popup after Enter picked an item and the user typed again', async () => {
    await mountAutocomplete();
    input().focus();
    await userEvent.keyboard('f');
    await opened();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(input().value).toBe('feature'));
    await userEvent.keyboard('s');
    await opened();
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(popup()).toBe(null));
  });

  test('object items show and filter by `label`, else by `value`; `itemToStringValue` gives the text of an object with no label', async () => {
    const { unmount } = await mountAutocomplete({
      items: [
        { value: 'a', label: 'Apple' },
        { value: 'b', label: 'Banana' },
      ],
    });
    input().focus();
    await userEvent.keyboard('ban');
    await waitFor(() => expect(itemNames()).toEqual(['Banana']));
    await userEvent.click(byTestId('item-Banana')!);
    await waitFor(() => expect(input().value).toBe('Banana'));
    unmount();
    await mountAutocomplete({
      items: [{ value: 'kiwi' }, { value: 'lime' }],
    });
    input().focus();
    await userEvent.keyboard('li');
    await waitFor(() => expect(itemNames()).toEqual(['lime']));
    await userEvent.click(byTestId('item-lime')!);
    await waitFor(() => expect(input().value).toBe('lime'));
  });
});

describe('the input in the popup', () => {
  test('a pick with the keys gives the focus back to the trigger, and the text stays at the next open', async () => {
    await mountAutocomplete({ inputInPopup: true });
    byTestId('trigger')!.focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('do{ArrowDown}{Enter}');
    await waitFor(() => expect(popup()?.checkVisibility() ?? false).toBe(false));
    await waitFor(() => expect(document.activeElement).toBe(byTestId('trigger')));
    expect(byTestId('trigger')).toHaveTextContent('docs');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input().value).toBe('docs');
  });

  test('Escape keeps the typed text', async () => {
    await mountAutocomplete({ inputInPopup: true });
    await userEvent.click(byTestId('trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('fe');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()?.checkVisibility() ?? false).toBe(false));
    expect(byTestId('trigger')).toHaveTextContent('fe');
  });

  test('Autocomplete.Value gives its slot the text, also the empty text, and the slot content wins', async () => {
    const root = reactive<Props>({ defaultValue: 'fix' });
    const { unmount } = await mountAutocomplete({
      inputInPopup: true,
      root,
      valueSlot: (value: string) => `[${value}]`,
    });
    expect(byTestId('trigger')).toHaveTextContent('[fix]');
    unmount();
    await mountAutocomplete({ inputInPopup: true, valueSlot: (value: string) => `[${value}]` });
    expect(byTestId('trigger')).toHaveTextContent('[]');
  });
});

describe('a read-only or disabled root', () => {
  test('a read-only root opens with the keys, has `aria-autocomplete="none"`, and a press or a highlight changes no text', async () => {
    const changes: string[] = [];
    await mountAutocomplete({
      root: { readonly: true, mode: 'both', onValueChange: (value: string) => changes.push(value) },
    });
    expect(input()).toHaveAttribute('aria-autocomplete', 'none');
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('feature'));
    expect(input().value).toBe('');
    await userEvent.click(byTestId('item-fix')!);
    await settle();
    expect(changes).toEqual([]);
    expect(input().value).toBe('');
  });

  test('a read-only state that starts drops the inline text of the highlight, and the text does not come back after it', async () => {
    const root = reactive<Props>({ mode: 'both' });
    await mountAutocomplete({ root });
    input().focus();
    await userEvent.keyboard('f{ArrowDown}');
    await waitFor(() => expect(input().value).toBe('feature'));
    root.readonly = true;
    await waitFor(() => expect(input().value).toBe('f'));
    root.readonly = false;
    await settle();
    expect(input().value).toBe('f');
  });

  test('the input of a read-only root is read-only, and the input of a disabled root is disabled', async () => {
    const { unmount } = await mountAutocomplete({ root: { readonly: true, name: 'tag' } });
    expect(input().readOnly).toBe(true);
    expect(input().disabled).toBe(false);
    unmount();
    await mountAutocomplete({ root: { disabled: true, name: 'tag' } });
    expect(input().disabled).toBe(true);
  });

  test('a browser fill of the input is the value; `autocomplete` is on the input', async () => {
    const changes: string[] = [];
    await mountAutocomplete({
      input: { autocomplete: 'on' },
      root: { name: 'tag', onValueChange: (value: string) => changes.push(value) },
    });
    expect(input()).toHaveAttribute('autocomplete', 'on');
    input().value = 'docs';
    input().dispatchEvent(new Event('input', { bubbles: true }));
    await waitFor(() => expect(changes).toEqual(['docs']));
    expect([...new FormData(form()).entries()]).toEqual([['tag', 'docs']]);
  });

  test('the trigger and the input group have no `data-placeholder`', async () => {
    const { unmount } = await mountAutocomplete();
    expect(byTestId('group')).not.toHaveAttribute('data-placeholder');
    unmount();
    await mountAutocomplete({ inputInPopup: true });
    expect(byTestId('trigger')).not.toHaveAttribute('data-placeholder');
  });
});

describe('the highlight', () => {
  test('itemHighlighted gets the pointer event of a hover, and the open of `autoHighlight`', async () => {
    const log: string[] = [];
    await mountAutocomplete({
      root: {
        autoHighlight: true,
        onItemHighlighted: (value: unknown, details: { reason: string; event?: Event }) =>
          log.push(`${String(value)} ${details.reason} ${details.event?.type ?? 'none'}`),
      },
    });
    input().focus();
    await userEvent.keyboard('f');
    await waitFor(() => expect(log.at(-1)).toMatch(/^feature /));
    await userEvent.hover(byTestId('item-fix')!);
    await waitFor(() => expect(log.at(-1)).toMatch(/^fix pointer pointer/));
  });

  test('`autoHighlight` highlights the first item while the user types and filters, names it in `aria-activedescendant`, and keeps a highlight when the text empties', async () => {
    await mountAutocomplete({ root: { autoHighlight: true } });
    input().focus();
    await userEvent.keyboard('f');
    await waitFor(() => expect(highlighted()).toBe('feature'));
    await userEvent.keyboard('i');
    await waitFor(() => expect(highlighted()).toBe('fix'));
    expect(input()).toHaveAttribute('aria-activedescendant', byTestId('item-fix')!.id);
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(highlighted()).toBe('feature'));
    await userEvent.keyboard('{Backspace}');
    await waitFor(() => expect(itemNames()).toHaveLength(4));
    await settle();
    expect(highlighted()).toBe('feature');
    expect(input()).toHaveAttribute('aria-activedescendant', byTestId('item-feature')!.id);
  });

  test('`autoHighlight` highlights nothing at a press open, and the first item at an ArrowDown open', async () => {
    const { unmount } = await mountAutocomplete({
      root: { autoHighlight: true, openOnInputClick: true },
    });
    await userEvent.click(input());
    await opened();
    await nextTick();
    expect(highlighted()).toBe(undefined);
    unmount();
    await mountAutocomplete({ root: { autoHighlight: true } });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test("with `autoHighlight: 'always'`, an outside blur keeps the last pointer highlight", async () => {
    await mountAutocomplete({ root: { autoHighlight: 'always', keepHighlight: true, open: true } });
    input().focus();
    await opened();
    await userEvent.hover(byTestId('item-docs')!);
    await waitFor(() => expect(highlighted()).toBe('docs'));
    outside().focus();
    await settle();
    expect(highlighted()).toBe('docs');
    expect(input()).toHaveAttribute('aria-activedescendant', byTestId('item-docs')!.id);
  });

  test('items that arrive after the user typed get the highlight of `autoHighlight`', async () => {
    const root = reactive<Props>({ autoHighlight: true, filter: null });
    const items = reactive<string[]>([]);
    await mountAutocomplete({ root, items });
    input().focus();
    await userEvent.keyboard('f');
    await settle();
    items.push('feature', 'fix');
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test("with `autoHighlight: 'always'`, items that arrive after the text empties get the highlight", async () => {
    const items = reactive<string[]>([]);
    await mountAutocomplete({ root: { autoHighlight: 'always', filter: null }, items });
    input().focus();
    await userEvent.keyboard('f');
    await opened();
    await userEvent.keyboard('{Backspace}');
    await settle();
    items.push('feature', 'fix');
    await waitFor(() => expect(highlighted()).toBe('feature'));
  });

  test('a clear press and a close drop the highlight that waits for later items', async () => {
    const items = reactive<string[]>([]);
    const { unmount } = await mountAutocomplete({
      root: { autoHighlight: true, filter: null },
      items,
      clear: true,
    });
    input().focus();
    await userEvent.keyboard('f');
    await opened();
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(input().value).toBe(''));
    items.push('feature');
    await waitFor(() => expect(itemNames()).toEqual(['feature']));
    await settle();
    expect(highlighted()).toBe(undefined);
    unmount();
    items.length = 0;
    const root = reactive<Props>({ autoHighlight: true, filter: null, open: true });
    await mountAutocomplete({ root, items });
    input().focus();
    await userEvent.keyboard('f');
    await settle();
    root.open = false;
    await nextTick();
    root.open = true;
    await nextTick();
    items.push('feature');
    await waitFor(() => expect(itemNames()).toEqual(['feature']));
    await settle();
    expect(input().value).toBe('f');
    expect(highlighted()).toBe(undefined);
  });

  test('without `keepHighlight`, a pointer that leaves the list clears the highlight; with it, the keys go on from the kept item', async () => {
    const root = reactive<Props>({ openOnInputClick: true });
    await mountAutocomplete({ root });
    await userEvent.click(input());
    await opened();
    await userEvent.hover(byTestId('item-fix')!);
    await waitFor(() => expect(highlighted()).toBe('fix'));
    await userEvent.hover(input());
    await waitFor(() => expect(highlighted()).toBe(undefined));
    root.keepHighlight = true;
    await nextTick();
    await userEvent.hover(byTestId('item-fix')!);
    await waitFor(() => expect(highlighted()).toBe('fix'));
    await userEvent.hover(input());
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('docs'));
  });
});

describe('the modes and the filter', () => {
  test("`'inline'` shows the text of a key highlight and filters nothing", async () => {
    const calls: unknown[] = [];
    await mountAutocomplete({
      root: { mode: 'inline', filter: (item: unknown) => (calls.push(item), true) },
    });
    input().focus();
    await userEvent.keyboard('f');
    await opened();
    expect(itemNames()).toHaveLength(4);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(input().value).toBe('feature'));
    expect(calls).toEqual([]);
  });

  test.each(['list', 'both'])(
    'mode %s uses a custom filter, and `filter` null keeps each item',
    async (mode) => {
      const root = reactive<Props>({
        mode,
        filter: (item: string, query: string) => item.endsWith(query),
      });
      await mountAutocomplete({ root });
      input().focus();
      await userEvent.keyboard('s');
      await waitFor(() => expect(itemNames()).toEqual(['docs']));
      root.filter = null;
      await waitFor(() => expect(itemNames()).toHaveLength(4));
    },
  );

  test.each(['list', 'both'])('mode %s compares with the `locale` of the root', async (mode) => {
    await mountAutocomplete({
      items: ['Äpple', 'Apa'],
      root: { mode, locale: 'sv' },
    });
    input().focus();
    await userEvent.keyboard('a');
    await waitFor(() => expect(itemNames()).toEqual(['Apa']));
  });

  test("`'both'`: a text of the parent replaces the inline text of the highlight", async () => {
    const root = reactive<Props>({ mode: 'both', modelValue: '' });
    root['onUpdate:modelValue'] = (value: string) => (root.modelValue = value);
    await mountAutocomplete({ root });
    input().focus();
    await userEvent.keyboard('f{ArrowDown}');
    await waitFor(() => expect(input().value).toBe('feature'));
    root.modelValue = 'docs';
    await waitFor(() => expect(input().value).toBe('docs'));
    await userEvent.hover(byTestId('item-docs')!);
    await settle();
    expect(input().value).toBe('docs');
  });

  test("`'both'`: the keys over the list do not put it at its top", async () => {
    const items = Array.from(
      { length: 30 },
      (_, index) => `item ${String(index).padStart(2, '0')}`,
    );
    await mountAutocomplete({
      items,
      root: { mode: 'both' },
      list: { style: 'max-height: 80px; overflow: auto' },
    });
    input().focus();
    await userEvent.keyboard('i');
    await opened();
    for (let step = 0; step < 10; step += 1) await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('item 09'));
    await settle();
    expect(byTestId('list')!.scrollTop).toBeGreaterThan(0);
  });

  test('a null value of the parent is the empty text', async () => {
    await mountAutocomplete({ root: { modelValue: null } });
    expect(input().value).toBe('');
  });
});

describe('the form, more cases', () => {
  test.each([
    { submitOnItemClick: false, submits: [] },
    { submitOnItemClick: true, submits: ['docs'] },
  ])(
    'Enter on a highlighted item with `submitOnItemClick` $submitOnItemClick submits $submits',
    async ({ submitOnItemClick, submits }) => {
      const seen: unknown[] = [];
      await mountAutocomplete({ root: { name: 'tag', submitOnItemClick } });
      form().addEventListener('submit', () => seen.push(new FormData(form()).get('tag')));
      input().focus();
      await userEvent.keyboard('d{ArrowDown}{Enter}');
      await waitFor(() => expect(input().value).toBe('docs'));
      await settle();
      expect(seen).toEqual(submits);
    },
  );

  test('Enter with no highlight submits the typed text', async () => {
    const submits: unknown[] = [];
    await mountAutocomplete({ root: { name: 'tag' } });
    form().addEventListener('submit', () => submits.push(new FormData(form()).get('tag')));
    input().focus();
    await userEvent.keyboard('xyz{Enter}');
    await waitFor(() => expect(submits).toEqual(['xyz']));
  });

  test('`form` gives the text to another form', async () => {
    const other = document.body.appendChild(document.createElement('form'));
    other.id = 'other-form';
    try {
      await mountAutocomplete({ root: { name: 'tag', form: 'other-form', defaultValue: 'fix' } });
      expect([...new FormData(other).entries()]).toEqual([['tag', 'fix']]);
      expect([...new FormData(form()).entries()]).toEqual([]);
    } finally {
      other.remove();
    }
  });

  test('a required empty input blocks the submit', async () => {
    await mountAutocomplete({ root: { name: 'tag', required: true } });
    let submits = 0;
    form().addEventListener('submit', () => (submits += 1));
    await userEvent.click(document.getElementById('submit-button')!);
    expect(submits).toBe(0);
    expect(input().validity.valueMissing).toBe(true);
  });
});

describe('the field', () => {
  test('the input is the control of the field: its label, its description, `required`, and the states', async () => {
    await mountAutocomplete({ field: { name: 'tag' }, root: { required: true } });
    const field = byTestId('field')!;
    expect(byTestId('label')).toHaveAttribute('for', input().id);
    expect(input()).toHaveAttribute('aria-describedby', 'description');
    expect(input()).toBeRequired();
    expect(field).not.toHaveAttribute('data-filled');
    input().focus();
    await userEvent.keyboard('f');
    await waitFor(() => expect(field).toHaveAttribute('data-dirty'));
    expect(field).toHaveAttribute('data-filled');
    outside().focus();
    await waitFor(() => expect(field).toHaveAttribute('data-touched'));
  });

  test('a default value is filled; `validate` in blur mode makes the field invalid, then valid', async () => {
    await mountAutocomplete({
      field: {
        name: 'tag',
        validationMode: 'blur',
        validate: (value: string) => (value === 'bad' ? 'error' : null),
      },
      root: { defaultValue: 'fix' },
    });
    const field = byTestId('field')!;
    expect(field).toHaveAttribute('data-filled');
    await userEvent.clear(input());
    await userEvent.type(input(), 'bad');
    outside().focus();
    await waitFor(() => expect(field).toHaveAttribute('data-invalid'));
    expect(input()).toHaveAttribute('aria-invalid', 'true');
    input().focus();
    await userEvent.keyboard('{Backspace}');
    outside().focus();
    await waitFor(() => expect(field).toHaveAttribute('data-valid'));
  });

  test('the list has the aria-label of the input', async () => {
    const first = await mountAutocomplete({
      root: { defaultOpen: true },
      input: { 'aria-label': 'Tags' },
    });
    await waitFor(() => expect(popup()?.checkVisibility({ visibilityProperty: true })).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Tags' })).toBe(byTestId('list'));
    first.unmount();

    await mountAutocomplete({ root: { defaultOpen: true }, field: { name: 'tag' } });
    await waitFor(() => expect(popup()?.checkVisibility({ visibilityProperty: true })).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Tag' })).toBe(byTestId('list'));
  });
});

describe('a popup in a <Transition>', () => {
  test('an open while the autocomplete leaves keeps the popup and the backdrop, which go back from where they are', async () => {
    const log = new Set<string>();
    const root = reactive<Props>({ open: true });
    mount(AutocompleteInTransition, {
      root,
      popup: { class: 'slow' },
      backdrop: { class: 'slow' },
      log,
    });
    await opened();
    const first = popup()!;
    const backdrop = byTestId('backdrop')!;
    await Promise.all([finishAnimations(first), finishAnimations(backdrop)]);
    await waitFor(() => expect(log.has('after-enter')).toBe(true));
    const popups = mostMatches('[data-testid="popup"]');
    root.open = false;
    await waitFor(() => expect(shownOpacity(first)).toBeLessThan(0.8));
    const atOpen = [first, backdrop].map(shownOpacity);
    root.open = true;
    const frames = await opacityUntilRest([first, backdrop]);
    expect(popup()).toBe(first);
    expect(byTestId('backdrop')).toBe(backdrop);
    expect(popups()).toBe(1);
    expect(log.has('after-leave') || log.has('backdrop-after-leave')).toBe(false);
    frames.forEach((opacities, index) => {
      expect(Math.min(...opacities)).toBeGreaterThan(atOpen[index]! - 0.15);
      expect(opacities.at(-1)).toBe(1);
    });
  });

  test('the content of the popup stays mounted until the leave ends', async () => {
    const log: string[] = [];
    const root = reactive<Props>({ open: true });
    mount(AutocompleteInTransition, {
      root,
      popup: { class: 'slow' },
      log: { add: (entry: string) => log.push(entry) },
    });
    await opened();
    const element = popup()!;
    await finishAnimations(element);
    await waitFor(() => expect(log).toContain('after-enter'));
    root.open = false;
    await waitFor(() => expect(element).toHaveClass('auto-leave-leave-active'));
    await nextTick();
    expect(log).not.toContain('child unmounted');
    await finishAnimations(element);
    await waitFor(() => expect(element.isConnected).toBe(false));
    expect(log.slice(-2)).toEqual(['after-leave', 'child unmounted']);
  });

  test('with `:css="false"`, the enter runs once with no `appear`, and the popup leaves when `done` runs', async () => {
    const log: string[] = [];
    const root = reactive<Props>({ open: true });
    let endLeave = () => {};
    mount(AutocompleteInTransition, {
      root,
      jsHooks: {
        enter(done: () => void) {
          log.push('enter');
          done();
        },
        leave(done: () => void) {
          log.push('leave');
          endLeave = done;
        },
      },
      log: { add: (entry: string) => log.push(entry) },
    });
    await opened();
    const element = popup()!;
    await waitFor(() => expect(log).toEqual(['before-enter', 'enter', 'after-enter']));
    root.open = false;
    await waitFor(() => expect(log).toContain('leave'));
    expect(element.isConnected).toBe(true);
    expect(log).not.toContain('child unmounted');
    endLeave();
    await waitFor(() => expect(element.isConnected).toBe(false));
    expect(log).toEqual([
      'before-enter',
      'enter',
      'after-enter',
      'leave',
      'after-leave',
      'child unmounted',
    ]);
  });
});

// The case throws in `setup`, so it is the last of the file.
test('a part outside the root throws an error that names the root of Autocomplete', () => {
  expect(String(mountError(AutocompleteValueAlone))).toBe(
    'Error: Vase UI: <Autocomplete.Value> must be inside <Autocomplete.Root>. Without a root the part has no combobox. Put the part inside its root.',
  );
  // After the error, Vapor renders the part with no setup, and warns about each binding.
  takeReportedMessages();
});
