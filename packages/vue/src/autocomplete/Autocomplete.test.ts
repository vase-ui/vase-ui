import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { AutocompleteRootChangeEventDetails } from '@vase-ui/vue/autocomplete';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import { mount } from '../../test/render';
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
