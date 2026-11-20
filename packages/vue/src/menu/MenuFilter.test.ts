import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { MenuFilterProviderChangeEventDetails } from '@vase-ui/vue/menu';
import MenuFilterParts from '../../test/fixtures/MenuFilterParts.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const popup = () => byTestId('popup');
const input = () => byTestId('input') as HTMLInputElement;
const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const active = () => document.activeElement;
const shown = () =>
  [...document.querySelectorAll<HTMLElement>('[data-key]')]
    .filter((element) => element.checkVisibility())
    .map((element) => element.getAttribute('data-key'));
const highlighted = () =>
  document.querySelector('[data-highlighted][data-key]')?.getAttribute('data-key') ?? null;

async function mountFilter(setup: Props = {}) {
  const result = mount(MenuFilterParts, setup);
  await nextTick();
  const trigger = result.root.querySelector<HTMLElement>('[data-testid="trigger"]')!;
  return { ...result, trigger };
}

async function open(trigger: HTMLElement, key = '{Enter}') {
  trigger.focus();
  await userEvent.keyboard(key);
  await waitFor(() => expect(popup()).not.toBe(null));
  await waitFor(() => expect(active()).toBe(input()));
}

function queryEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onValueChange: (value: string, details: MenuFilterProviderChangeEventDetails) =>
      log.push(`valueChange "${value}" ${details.reason}`),
  });
}

describe('the parts', () => {
  test('the popup is a dialog with the input and the list; the input controls the list and names the highlighted item', async () => {
    const { trigger } = await mountFilter();
    expect(trigger).toHaveAttribute('aria-haspopup', 'dialog');
    await open(trigger);
    const list = byTestId('list')!;
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(popup()).toHaveAttribute('aria-labelledby', trigger.id);
    expect(list).toHaveAttribute('role', 'menu');
    expect(input()).toHaveAttribute('role', 'searchbox');
    expect(input()).toHaveAttribute('aria-controls', list.id);
    expect(input()).toHaveAttribute('autocomplete', 'off');
    expect(input()).toHaveAttribute('spellcheck', 'false');
    // A key open highlights the first item; the input keeps the focus.
    expect(highlighted()).toBe('apple');
    expect(input()).toHaveAttribute('aria-activedescendant', item('apple').id);
    expect(item('apple')).toHaveAttribute('tabindex', '-1');
    // The clear button renders only with a query.
    expect(byTestId('clear')).toBe(null);
  });

  test('the input takes its `id`; it has `data-highlighted` while it has the focus of a key and no item has the highlight', async () => {
    const { trigger } = await mountFilter({ input: { id: 'query' } });
    await open(trigger);
    expect(input().id).toBe('query');
    expect(highlighted()).toBe('apple');
    expect(input()).not.toHaveAttribute('data-highlighted');
    await userEvent.keyboard('{ArrowUp}');
    expect(highlighted()).toBe(null);
    expect(input()).toHaveAttribute('data-highlighted');
    popup()!.focus();
    await nextTick();
    expect(input()).not.toHaveAttribute('data-highlighted');
  });

  test('a menu whose input left works as a plain menu', async () => {
    const shown = reactive<Record<string, boolean>>({});
    const { trigger } = await mountFilter({ shown });
    await open(trigger);
    shown.input = false;
    await waitFor(() => expect(active()).toBe(popup()));
    popup()!.dispatchEvent(new PointerEvent('pointermove', { bubbles: true }));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('apricot'));
  });

  test('a press opens the menu with the focus in the input and no highlight', async () => {
    const { trigger } = await mountFilter();
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    expect(highlighted()).toBe(null);
  });
});

describe('the match', () => {
  test('an item that does not match has `hidden` and stays mounted; a group with no shown item is hidden; Empty says so', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({ provider: queryEvents(log) });
    await open(trigger);
    await userEvent.keyboard('ap');
    expect(shown()).toEqual(['apple', 'apricot']);
    expect(item('banana')).toHaveAttribute('hidden');
    expect(byTestId('empty')).toHaveTextContent('');
    await userEvent.keyboard('{Backspace}{Backspace}  carrot ');
    expect(shown()).toEqual(['carrot']);
    expect(byTestId('fruit')).toHaveAttribute('hidden');
    await userEvent.keyboard('x');
    expect(shown()).toEqual([]);
    await waitFor(() => expect(byTestId('empty')).toHaveTextContent('No match'));
    expect(log.slice(0, 4)).toEqual([
      'valueChange "a" input-change',
      'valueChange "ap" input-change',
      'valueChange "a" input-change',
      'valueChange "" input-clear',
    ]);
  });

  test('the label of an item is its text for the match', async () => {
    const { trigger } = await mountFilter();
    await open(trigger);
    await userEvent.keyboard('orange');
    expect(shown()).toEqual([]);
  });

  test('`filter` replaces the match, and `null` shows each item', async () => {
    const provider = reactive<Props>({
      filter: (text: string, query: string) => text.startsWith(query),
    });
    const { trigger } = await mountFilter({ provider });
    await open(trigger);
    await userEvent.keyboard('B');
    expect(shown()).toEqual(['banana']);
    provider.filter = null;
    await nextTick();
    expect(shown()).toEqual(['apple', 'apricot', 'banana', 'carrot']);
  });

  test('`v-model` gets the query after `valueChange`', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({
      provider: queryEvents(log, {
        'onUpdate:modelValue': (value: string) => log.push(`update "${value}"`),
      }),
    });
    await open(trigger);
    await userEvent.keyboard('b');
    expect(log).toEqual(['valueChange "b" input-change', 'update "b"']);
  });

  test('a composition gives the query at its end', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({ provider: queryEvents(log) });
    await open(trigger);
    const element = input();
    element.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }));
    element.value = 'k';
    element.dispatchEvent(new InputEvent('input', { bubbles: true, isComposing: true }));
    expect(log).toEqual([]);
    element.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: 'k' }));
    expect(log).toEqual(['valueChange "k" input-change']);
    element.value = 'ki';
    element.dispatchEvent(new InputEvent('input', { bubbles: true }));
    expect(log.at(-1)).toBe('valueChange "ki" input-change');
  });

  test('a group of radio items with no shown item is hidden', async () => {
    const { trigger } = await mountFilter({ radio: true });
    await open(trigger);
    expect(byTestId('citrus')).not.toHaveAttribute('hidden');
    await userEvent.keyboard('carrot');
    expect(byTestId('citrus')).toHaveAttribute('hidden');
  });

  test('an item whose text changes while it is hidden shows when its new text matches', async () => {
    const texts = reactive<Record<string, string>>({});
    const { trigger } = await mountFilter({ texts });
    await open(trigger);
    await userEvent.keyboard('kiwi');
    expect(shown()).toEqual([]);
    texts.banana = 'Kiwi';
    await waitFor(() => expect(shown()).toEqual(['banana']));
  });
});

describe('the highlight', () => {
  test('the arrow keys move the highlight while the input keeps the focus; at an end the highlight goes', async () => {
    const { trigger } = await mountFilter();
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('apple');
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('apricot');
    expect(active()).toBe(input());
    await userEvent.keyboard('{ArrowUp}{ArrowUp}');
    expect(highlighted()).toBe(null);
    await userEvent.keyboard('{ArrowUp}');
    expect(highlighted()).toBe('carrot');
  });

  test('with `autoHighlight` set to `always`, the first item has the highlight at the open', async () => {
    const { trigger } = await mountFilter({ provider: { autoHighlight: 'always' } });
    await userEvent.click(trigger);
    await waitFor(() => expect(highlighted()).toBe('apple'));
  });

  test('a change of the query removes the highlight; with `autoHighlight` the first shown item has it', async () => {
    const provider = reactive<Props>({});
    const { trigger } = await mountFilter({ provider });
    await open(trigger);
    await userEvent.keyboard('b');
    expect(highlighted()).toBe(null);
    provider.autoHighlight = true;
    await userEvent.keyboard('a');
    await waitFor(() => expect(highlighted()).toBe('banana'));
    await userEvent.keyboard('{Backspace}{Backspace}');
    await waitFor(() => expect(highlighted()).toBe(null));
    provider.autoHighlight = 'always';
    await userEvent.keyboard('c{Backspace}');
    await waitFor(() => expect(highlighted()).toBe('apple'));
  });

  test('Enter on the input clicks the highlighted item one time and prevents its default; a key with a modifier or a prevented key does nothing', async () => {
    const clicks: string[] = [];
    const { trigger } = await mountFilter({
      root: {
        onOpenChange: (_: boolean, details: { reason: string; event: Event; cancel(): void }) => {
          if (details.reason === 'item-press') {
            clicks.push(String((details.event as MouseEvent).ctrlKey));
            details.cancel();
          }
        },
      },
    });
    await open(trigger);
    let enter: KeyboardEvent | undefined;
    input().addEventListener('keydown', (event) => (enter ??= event));
    await userEvent.keyboard('{Enter}');
    expect(enter?.defaultPrevented).toBe(true);
    expect(clicks).toEqual(['false']);
    await userEvent.keyboard('{Control>}{Enter}{/Control}');
    expect(clicks).toEqual(['false']);
    const stop = (event: KeyboardEvent) => event.preventDefault();
    popup()!.addEventListener('keydown', stop, { capture: true });
    await userEvent.keyboard('{Enter}');
    expect(clicks).toEqual(['false']);
    popup()!.removeEventListener('keydown', stop, { capture: true });
  });

  test('Enter clicks the highlighted item; Space clicks it only while the input is empty', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({
      root: {
        onOpenChange: (open: boolean, details: { reason: string }) =>
          log.push(`${open} ${details.reason}`),
      },
    });
    await open(trigger);
    await userEvent.keyboard('a ');
    expect(input().value).toBe('a ');
    await userEvent.keyboard('{Backspace}{Backspace}{ArrowDown} ');
    await waitFor(() => expect(popup()).toBe(null));
    expect(log).toEqual(['true trigger-press', 'false item-press']);
  });

  test('Home and End move the highlight while the input is empty, and keep their default while it has text', async () => {
    const { trigger } = await mountFilter();
    await open(trigger);
    await userEvent.keyboard('{End}');
    expect(highlighted()).toBe('carrot');
    await userEvent.keyboard('a{ArrowDown}');
    expect(highlighted()).toBe('apple');
    let prevented: boolean | undefined;
    const read = (event: KeyboardEvent) => (prevented = event.defaultPrevented);
    document.addEventListener('keydown', read);
    try {
      await userEvent.keyboard('{End}');
    } finally {
      document.removeEventListener('keydown', read);
    }
    expect(prevented).toBe(false);
    expect(highlighted()).toBe('apple');
  });
});

describe('the query', () => {
  test('the query goes back to empty when the popup left the DOM, with `popup-close`', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({ provider: queryEvents(log) });
    await open(trigger);
    await userEvent.keyboard('b');
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    await waitFor(() => expect(log.at(-1)).toBe('valueChange "" popup-close'));
    await open(trigger);
    expect(input().value).toBe('');
  });

  test('a cancel keeps the text of the input', async () => {
    const provider = reactive<Props>({
      onValueChange: (_: string, details: MenuFilterProviderChangeEventDetails) => details.cancel(),
    });
    const { trigger } = await mountFilter({ provider });
    await open(trigger);
    await userEvent.keyboard('b');
    await nextTick();
    expect(input().value).toBe('');
  });

  test('Clear empties the query and gives the focus to the input', async () => {
    const log: string[] = [];
    const { trigger } = await mountFilter({ provider: queryEvents(log) });
    await open(trigger);
    await userEvent.keyboard('b');
    const clear = byTestId('clear')!;
    expect(clear).toHaveAttribute('tabindex', '-1');
    expect(clear).toHaveAttribute('aria-hidden', 'true');
    await userEvent.click(clear);
    expect(log.at(-1)).toBe('valueChange "" clear-press');
    expect(active()).toBe(input());
    await waitFor(() => expect(byTestId('clear')).toBe(null));
  });
});

describe('the focus', () => {
  test('the focus that comes back to the input from an item removes the highlight; a pointer move in the popup gives the focus back to the input', async () => {
    const { trigger } = await mountFilter();
    await open(trigger);
    item('banana').focus();
    await nextTick();
    expect(highlighted()).toBe('banana');
    input().focus();
    await nextTick();
    expect(highlighted()).toBe(null);
    item('banana').focus();
    await userEvent.hover(item('carrot'));
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('a key on an item that has the real focus gives the focus back to the input', async () => {
    const { trigger } = await mountFilter();
    await open(trigger);
    item('banana').focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(input());
    expect(highlighted()).toBe('carrot');
    item('banana').focus();
    await userEvent.keyboard('k');
    expect(active()).toBe(input());
    expect(input().value).toBe('k');
  });

  test('a horizontal list: Down gives the first item, and Left and Right move the caret while the input has text', async () => {
    const { trigger } = await mountFilter({ root: { orientation: 'horizontal' } });
    await userEvent.click(trigger);
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.keyboard('a{ArrowLeft}');
    expect(highlighted()).toBe(null);
    expect(input().selectionStart).toBe(0);
    let down: KeyboardEvent | undefined;
    input().addEventListener('keydown', (event) => (down ??= event));
    await userEvent.keyboard('{ArrowDown}');
    expect(down?.defaultPrevented).toBe(true);
    expect(highlighted()).toBe('apple');
    await userEvent.keyboard('{ArrowRight}');
    expect(highlighted()).toBe('apricot');
  });

  test('the key across the list opens the submenu and prevents its default; the other one closes it', async () => {
    const { trigger } = await mountFilter({ submenu: true });
    await open(trigger);
    await userEvent.keyboard('{End}');
    let across: KeyboardEvent | undefined;
    input().addEventListener('keydown', (event) => (across ??= event));
    await userEvent.keyboard('{ArrowRight}');
    expect(across?.defaultPrevented).toBe(true);
    await waitFor(() => expect(active()).toBe(item('cherry')));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('a submenu trigger that the query hides closes its submenu', async () => {
    const provider = reactive<Props>({ modelValue: '' });
    const { trigger } = await mountFilter({ submenu: true, provider });
    await open(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(byTestId('sub-popup')).not.toBe(null));
    provider.modelValue = 'apple';
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
  });

  test('a submenu with no portal takes the keys of its popup', async () => {
    const { trigger } = await mountFilter({ submenu: true, submenuPortal: { disabled: true } });
    await open(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(item('cherry')));
    await userEvent.keyboard('{ArrowDown}');
    expect(active()).toBe(item('date'));
  });

  test('the key toward the start in the empty input of a filterable submenu closes it, and the focus goes back to the input of the parent', async () => {
    const { trigger } = await mountFilter({ filterSubmenu: true });
    await open(trigger);
    await userEvent.keyboard('{End}{ArrowRight}');
    await waitFor(() => expect(active()).toBe(byTestId('sub-input')));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(byTestId('sub-popup')).toBe(null));
    await waitFor(() => expect(active()).toBe(input()));
  });

  test('a popup near the bottom of the view stays on its side while the query shrinks the list', async () => {
    const style = reactive<Props>({ style: 'position: fixed; left: 10px; bottom: 0' });
    const { trigger } = await mountFilter({ trigger: style });
    const positioner = () => document.querySelector('[data-testid="positioner"]')!;
    // The heights of the full list and of the list that the query shrinks.
    await open(trigger);
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'top'));
    const full = popup()!.offsetHeight;
    await userEvent.keyboard('carrot');
    await waitFor(() => expect(shown()).toEqual(['carrot']));
    const short = popup()!.offsetHeight;
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    // Under the trigger there is room for the short list only.
    style.style = `position: fixed; left: 10px; bottom: ${Math.round((full + short) / 2)}px`;
    await nextTick();
    await open(trigger);
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'top'));
    await userEvent.keyboard('carrot');
    await waitFor(() => expect(shown()).toEqual(['carrot']));
    await new Promise((resolve) => setTimeout(resolve, 100));
    expect(positioner()).toHaveAttribute('data-side', 'top');
  });

  test.runIf(server.browser === 'webkit')(
    'in WebKit, the highlighted item has `aria-selected` while the input has the focus',
    async () => {
      const { trigger } = await mountFilter();
      await open(trigger);
      expect(item('apple')).toHaveAttribute('aria-selected', 'true');
      popup()!.focus();
      await nextTick();
      expect(item('apple')).not.toHaveAttribute('aria-selected');
    },
  );
});
