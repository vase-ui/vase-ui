import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  ComboboxRootChangeEventDetails,
  ComboboxRootHighlightEventDetails,
} from '@vase-ui/vue/combobox';
import ComboboxInDialog from '../../test/fixtures/ComboboxInDialog.vue';
import ComboboxInlineScene from '../../test/fixtures/ComboboxInlineScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const list = () => byTestId('list')!;
const item = (name: string) => byTestId(`item-${name}`)!;
const options = () =>
  [...document.querySelectorAll('[role="option"]')].map((option) => option.textContent!.trim());
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;
const MANY = Array.from({ length: 30 }, (_, index) => `item-${index}`);

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('`filter` and `filteredItems`', () => {
  test('a custom filter shows each item again at the open after a pick', async () => {
    const movies = [
      { value: 'totoro', label: 'My Neighbor Totoro', search: 'tonari no totoro' },
      { value: 'spirited', label: 'Spirited Away', search: 'sen to chihiro' },
    ];
    mount(ComboboxParts, {
      items: movies,
      labels: true,
      root: {
        filter: (movie: { search: string }, query: string) => movie.search.includes(query),
      },
    });
    await nextTick();
    await userEvent.click(input());
    await userEvent.type(input(), 'tonari');
    await waitFor(() => expect(options()).toEqual(['My Neighbor Totoro']));
    await userEvent.click(item('My Neighbor Totoro'));
    await closed();
    await userEvent.click(input());
    await opened();
    expect(options()).toEqual(['My Neighbor Totoro', 'Spirited Away']);
  });

  test('`filteredItems` with no `items` is the list, and a pick closes it', async () => {
    const root = reactive<Props>({ filteredItems: ['Apple', 'Banana'], modelValue: null });
    root['onUpdate:modelValue'] = (value: unknown) => (root.modelValue = value);
    mount(ComboboxParts, { items: undefined, root });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await closed();
    await userEvent.click(input());
    await opened();
    expect(byTestId('item-Banana')).not.toBe(null);
  });

  test('the highlight follows the order of `filteredItems`, also at the open of a multiple value', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      autoHighlight: true,
      filteredItems: ['Apple', 'Zucchini'],
      onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
        log.push(`${String(value)} ${details.index}`),
    });
    const first = mount(ComboboxParts, { items: ['Apple', 'Zucchini'], root });
    await nextTick();
    await userEvent.click(input());
    await opened();
    root.filteredItems = ['Zucchini', 'Apple'];
    await userEvent.type(input(), 'a');
    await waitFor(() => expect(log.at(-1)).toBe('Zucchini 0'));
    first.unmount();
    log.length = 0;
    mount(ComboboxParts, {
      items: ['Apple', 'Banana', 'Cherry'],
      root: {
        multiple: true,
        filteredItems: ['Cherry', 'Apple'],
        defaultValue: ['Apple'],
        onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
          log.push(`${String(value)} ${details.index}`),
      },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await waitFor(() => expect(highlighted()).toBe('Apple'));
    expect(log.at(-1)).toBe('Apple 1');
  });

  test('an empty `filteredItems` of the parent is the list until the parent changes it', async () => {
    const root = reactive<Props>({ filteredItems: [], defaultValue: 'Banana' });
    mount(ComboboxParts, { items: ['Apple', 'Banana', 'Cherry'], root });
    await nextTick();
    expect(input().value).toBe('Banana');
    await userEvent.click(input());
    await opened();
    expect(options()).toEqual([]);
    root.filteredItems = ['Apple', 'Banana', 'Cherry'];
    await waitFor(() => expect(options()).toHaveLength(3));
    expect(item('Banana')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('the scroll at a new text', () => {
  test('a typed text puts the list at its top, also a wrapper with the scroll; a later scroll stays', async () => {
    mount(ComboboxParts, {
      items: MANY,
      list: { style: 'max-height: 80px; overflow: auto' },
      root: { autoHighlight: true },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    list().scrollTop = 40;
    expect(list().scrollTop).toBeGreaterThan(0);
    await userEvent.type(input(), 'item-1');
    await waitFor(() => expect(list().scrollTop).toBe(0));
    expect(highlighted()).toBe('item-1');
    list().scrollTop = 20;
    await settle();
    expect(list().scrollTop).toBe(20);
  });

  test('the scroll of a popup with the scroll goes to the top, and a surrounding element keeps its scroll', async () => {
    mount(ComboboxParts, {
      items: MANY,
      popup: { style: 'max-height: 80px; overflow: auto' },
      root: { defaultOpen: true },
    });
    await opened();
    await userEvent.click(input());
    popup()!.scrollTop = 40;
    const page = document.scrollingElement!;
    const pageScroll = page.scrollTop;
    await userEvent.keyboard('item-1');
    await waitFor(() => expect(popup()!.scrollTop).toBe(0));
    expect(page.scrollTop).toBe(pageScroll);
  });

  test('an inline list resets its own scroll and not the scroll of the element around it', async () => {
    const wrapper = document.body.appendChild(document.createElement('div'));
    // The input stays in view, so the browser scrolls nothing to show the caret.
    wrapper.style.cssText = 'height: 200px; overflow: auto; padding: 100px 0 400px';
    try {
      mount(ComboboxInlineScene, { items: MANY, listHeight: 80 }, wrapper);
      await nextTick();
      wrapper.scrollTop = 20;
      list().scrollTop = 40;
      const wrapperScroll = wrapper.scrollTop;
      input().focus({ preventScroll: true });
      await userEvent.keyboard('item-1');
      await waitFor(() => expect(list().scrollTop).toBe(0));
      expect(wrapper.scrollTop).toBe(wrapperScroll);
    } finally {
      wrapper.remove();
    }
  });
});

describe('the open state', () => {
  test('a controlled inline list keeps filtering after a pick', async () => {
    mount(ComboboxInlineScene, { root: { open: true, multiple: true } });
    await nextTick();
    await userEvent.type(input(), 'ap');
    await userEvent.click(item('apple'));
    await userEvent.type(input(), 'ban');
    await waitFor(() => expect(options()).toEqual(['banana']));
  });

  test('a close request that the parent ignores keeps the popup and its filter', async () => {
    const requests: boolean[] = [];
    mount(ComboboxParts, {
      items: ['Apple', 'Apricot', 'Banana'],
      root: { open: true, onOpenChange: (open: boolean) => requests.push(open) },
    });
    await opened();
    await userEvent.type(input(), 'ap');
    await waitFor(() => expect(options()).toEqual(['Apple', 'Apricot']));
    await userEvent.keyboard('{Escape}');
    await settle();
    expect(requests).toEqual([false]);
    expect(popup()).not.toBe(null);
    await userEvent.type(input(), 'r');
    await waitFor(() => expect(options()).toEqual(['Apricot']));
  });

  test('an open request of an open popup emits no change', async () => {
    const requests: boolean[] = [];
    mount(ComboboxParts, {
      trigger: true,
      root: { defaultOpen: true, onOpenChange: (open: boolean) => requests.push(open) },
    });
    await opened();
    await userEvent.type(input(), 'a');
    await settle();
    expect(requests).toEqual([]);
  });
});

describe('`limit`', () => {
  test('cuts the list, across groups in their order, after the filter; -1 and a new limit', async () => {
    const root = reactive<Props>({ limit: 2, defaultOpen: true });
    mount(ComboboxParts, { root });
    await opened();
    expect(options()).toEqual(['Apple', 'Apricot']);
    await userEvent.type(input(), 'an');
    await waitFor(() => expect(options()).toEqual(['Banana', 'Mango']));
    root.limit = -1;
    await waitFor(() => expect(options()).toEqual(['Banana', 'Mango', 'Orange']));
    root.limit = 0;
    await waitFor(() => expect(options()).toEqual([]));
  });

  test('stops in a group, drops the groups after it, and keeps their order', async () => {
    mount(ComboboxParts, {
      grouped: true,
      items: [
        { name: 'Fruits', items: ['Apple', 'Banana'] },
        { name: 'Vegetables', items: ['Carrot', 'Lettuce'] },
        { name: 'Nuts', items: ['Almond'] },
      ],
      root: { limit: 3, defaultOpen: true },
    });
    await opened();
    expect(options()).toEqual(['Apple', 'Banana', 'Carrot']);
    expect(byTestId('group-Nuts')).toBe(null);
  });

  test('cuts nothing with no `items`, and a selected item out of the limit gets no highlight', async () => {
    const first = mount(ComboboxStatic, { root: { limit: 1, defaultOpen: true } });
    await opened();
    expect(options()).toEqual(['apple', 'banana', 'cherry']);
    first.unmount();
    mount(ComboboxParts, { root: { limit: 2, defaultValue: 'Cherry' } });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await settle();
    expect(highlighted()).toBe(null);
  });
});

describe('an inline combobox in a dialog', () => {
  test.each([
    { multiple: false, query: '' },
    { multiple: false, query: 'Ba' },
    { multiple: true, query: '' },
    { multiple: true, query: 'Ba' },
  ])(
    'a kept dialog that closes takes the highlight away (multiple: $multiple, text "$query")',
    async ({ multiple, query }) => {
      const log: string[] = [];
      mount(ComboboxInDialog, {
        keepMounted: true,
        root: {
          multiple,
          onItemHighlighted: (value: unknown) => log.push(String(value)),
        },
      });
      await userEvent.click(byTestId('trigger')!);
      await waitFor(() => expect(document.activeElement).toBe(input()));
      if (query) await userEvent.keyboard(query);
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(highlighted()).not.toBe(null));
      await userEvent.keyboard('{Enter}');
      await waitFor(() => expect(byTestId('dialog')).toHaveAttribute('hidden'));
      expect(highlighted()).toBe(null);
      expect(log.at(-1)).toBe('undefined');
    },
  );

  test('a multiple pick after a filter empties the text and shows each item; a pick with no filter keeps the highlight', async () => {
    mount(ComboboxInDialog, { keepOpen: true, root: { multiple: true } });
    await userEvent.click(byTestId('trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('ch');
    await waitFor(() => expect(options()).toEqual(['Cherry']));
    await userEvent.click(item('Cherry'));
    await waitFor(() => expect(input().value).toBe(''));
    expect(options()).toEqual(['Apple', 'Banana', 'Cherry']);
    await userEvent.keyboard('ba');
    await waitFor(() => expect(options()).toEqual(['Banana']));
    await userEvent.clear(input());
    // An emptied text gives the highlight to the item of the last pick.
    await waitFor(() => expect(highlighted()).toBe('Cherry'));
    await userEvent.hover(item('Banana'));
    await userEvent.click(item('Banana'));
    expect(item('Banana')).toHaveAttribute('aria-selected', 'true');
    expect(highlighted()).toBe('Banana');
  });

  test('a single pick closes the dialog, and the next open has no text and each item', async () => {
    mount(ComboboxInDialog, {});
    await userEvent.click(byTestId('trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('ba{ArrowDown}{Enter}');
    await waitFor(() => expect(byTestId('dialog')).toBe(null));
    await userEvent.click(byTestId('trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input().value).toBe('');
    expect(options()).toEqual(['Apple', 'Banana', 'Cherry']);
  });

  test('a cancelled close keeps the dialog and the combobox open', async () => {
    mount(ComboboxInDialog, {
      root: {
        onOpenChange: (open: boolean, details: ComboboxRootChangeEventDetails) => {
          if (!open) details.cancel();
        },
      },
      keepOpen: true,
    });
    await userEvent.click(byTestId('trigger')!);
    await waitFor(() => expect(document.activeElement).toBe(input()));
    expect(input()).toHaveAttribute('aria-expanded', 'true');
  });
});
