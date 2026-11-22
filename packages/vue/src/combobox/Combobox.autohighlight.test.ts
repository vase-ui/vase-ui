import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  ComboboxRootChangeEventDetails,
  ComboboxRootHighlightEventDetails,
} from '@vase-ui/vue/combobox';
import ComboboxChipScene from '../../test/fixtures/ComboboxChipScene.vue';
import ComboboxGrid from '../../test/fixtures/ComboboxGrid.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
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

async function expectHighlight(name: string | null) {
  await waitFor(() => expect(highlighted()).toBe(name));
  if (name === null) expect(input()).not.toHaveAttribute('aria-activedescendant');
  else expect(input()).toHaveAttribute('aria-activedescendant', item(name).id);
}

function logHighlights(log: string[], props: Props = {}): Props {
  return {
    ...props,
    onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
      log.push(`${String(value)} ${details.index} ${details.reason}`),
  };
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

describe('`autoHighlight`', () => {
  test('typed text that opens a kept list highlights its first item', async () => {
    mount(ComboboxParts, {
      items: ['apple', 'apricot', 'banana'],
      portal: { keepMounted: true },
      root: { autoHighlight: true },
    });
    await nextTick();
    input().focus();
    await userEvent.keyboard('a');
    await expectHighlight('apple');
  });

  test('with no `items`, typed text highlights the first item that renders, also after a space', async () => {
    mount(ComboboxStatic, {
      items: ['alpha one', 'beta'],
      root: { autoHighlight: true },
    });
    await nextTick();
    await userEvent.type(input(), 'al');
    await expectHighlight('alpha one');
    await userEvent.keyboard(' ');
    await expectHighlight('alpha one');
  });

  test('a Space in a grid with a highlighted cell types a space and selects nothing', async () => {
    const changes: unknown[] = [];
    mount(ComboboxGrid, {
      root: { autoHighlight: true, onValueChange: (value: unknown) => changes.push(value) },
    });
    await nextTick();
    await userEvent.type(input(), 'a');
    await expectHighlight('a1');
    await userEvent.keyboard(' ');
    expect(input().value).toBe('a ');
    await expectHighlight('a1');
    expect(changes).toEqual([]);
  });

  test('the first item after the end of a composition has the highlight', async () => {
    mount(ComboboxParts, {
      items: ['apple', 'banana', 'cherry'],
      root: { autoHighlight: true, openOnInputClick: false },
    });
    await nextTick();
    input().focus();
    await fireEvent.compositionStart(input());
    input().value = 'ch';
    await fireEvent.input(input(), { isComposing: true, inputType: 'insertCompositionText' });
    await fireEvent.compositionEnd(input());
    await opened();
    await expectHighlight('cherry');
  });

  test('a cancelled change of the text changes no value and opens nothing', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['apple', 'banana'],
      root: {
        autoHighlight: true,
        defaultValue: 'apple',
        openOnInputClick: false,
        onInputValueChange: (_: string, details: ComboboxRootChangeEventDetails) => {
          log.push('text');
          details.cancel();
        },
        onValueChange: () => log.push('value'),
        onOpenChange: () => log.push('open'),
      },
    });
    await nextTick();
    await userEvent.clear(input());
    await userEvent.type(input(), 'b');
    await settle();
    expect(log.filter((entry) => entry !== 'text')).toEqual([]);
    expect(log).toContain('text');
    expect(popup()).toBe(null);
  });

  test('a multiple root highlights the first match of the text', async () => {
    mount(ComboboxParts, {
      items: ['apple', 'banana', 'cherry'],
      root: { multiple: true, autoHighlight: true },
    });
    await nextTick();
    await userEvent.type(input(), 'ba');
    await opened();
    await expectHighlight('banana');
  });

  test('a removal of the chip of the highlighted item removes the highlight', async () => {
    mount(ComboboxChipScene, {
      layout: 'before',
      remove: {},
      root: { autoHighlight: true, defaultOpen: true, defaultValue: ['apple'] },
    });
    await opened();
    await userEvent.type(input(), 'a');
    await expectHighlight('apple');
    await fireEvent.click(byTestId('remove-apple')!);
    await expectHighlight(null);
  });

  test('a pick of an item with the text keeps the highlight in step after Backspace to one match', async () => {
    mount(ComboboxParts, {
      items: ['alpha', 'beta', 'epsilon'],
      root: { autoHighlight: true },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('epsilon'));
    await waitFor(() => expect(popup()).toBe(null));
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{End}{Backspace}');
    await expectHighlight('epsilon');
  });

  test('after a new text over a pick, the first ArrowDown moves on from the first match', async () => {
    mount(ComboboxParts, {
      items: ['Apple', 'Grape', 'Grapefruit'],
      root: { autoHighlight: true },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Apple'));
    await userEvent.click(input());
    await userEvent.clear(input());
    await userEvent.type(input(), 'Ape');
    await opened();
    await expectHighlight('Grape');
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('Grapefruit');
  });

  test('a new text emits the new first item with the reason `none` and its index', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['banana', 'apple', 'apricot'],
      root: logHighlights(log, { autoHighlight: true, defaultOpen: true }),
    });
    await opened();
    await userEvent.click(input());
    await userEvent.keyboard('{ArrowDown}');
    expect(log.at(-1)).toBe('banana 0 keyboard');
    await userEvent.type(input(), 'ap');
    await waitFor(() => expect(log.at(-1)).toBe('apple 0 none'));
  });

  test('a pick with Enter emits one highlight event of no item', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['Apple', 'Apricot', 'Banana'],
      root: logHighlights(log, { autoHighlight: true }),
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.type(input(), 'ap');
    await expectHighlight('Apple');
    log.length = 0;
    await userEvent.keyboard('{Enter}');
    await waitFor(() => expect(popup()).toBe(null));
    expect(log.filter((entry) => entry.startsWith('undefined'))).toHaveLength(1);
  });
});

describe('the highlight of a multiple root after a pick', () => {
  test('Enter on a selected item deselects it and keeps the highlight on it; ArrowDown goes on from it', async () => {
    const items = ['JavaScript', 'TypeScript', 'Python', 'Ruby'];
    mount(ComboboxParts, {
      items,
      root: { multiple: true, defaultValue: ['JavaScript', 'TypeScript'] },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.hover(item('TypeScript'));
    await expectHighlight('TypeScript');
    await userEvent.keyboard('{Enter}');
    expect(item('TypeScript')).toHaveAttribute('aria-selected', 'false');
    await expectHighlight('TypeScript');
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('Python');
  });

  test('a pick of the last values with the pointer keeps the highlight on the picked item, and ArrowDown goes on from it', async () => {
    const items = ['JavaScript', 'TypeScript', 'Python', 'Ruby'];
    mount(ComboboxParts, { items, root: { multiple: true } });
    await nextTick();
    await userEvent.click(input());
    await opened();
    for (const name of ['JavaScript', 'TypeScript', 'Python']) {
      await userEvent.hover(item(name));
      await userEvent.click(item(name));
    }
    await expectHighlight('Python');
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('Ruby');
  });

  test('a removal of the chip of the highlighted item removes the highlight', async () => {
    mount(ComboboxChipScene, {
      layout: 'before',
      remove: {},
      root: { defaultOpen: true, defaultValue: ['apple', 'banana'] },
    });
    await opened();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).not.toBe(null));
    const name = highlighted()!;
    await fireEvent.click(byTestId(`remove-${name}`)!);
    await expectHighlight(null);
  });
});

describe('items that arrive later', () => {
  test('a typed text of a root that the parent holds closed highlights nothing when the parent opens it later', async () => {
    const items = reactive<string[]>([]);
    const root = reactive<Props>({
      autoHighlight: true,
      open: false,
      onOpenChange: (_: boolean, details: ComboboxRootChangeEventDetails) => details.cancel(),
    });
    mount(ComboboxParts, { items, root });
    await nextTick();
    await userEvent.type(input(), '32');
    items.push('32');
    root.open = true;
    await opened();
    await settle();
    expect(item('32')).not.toHaveAttribute('data-highlighted');
  });

  test('a hovered item keeps the highlight when new items render', async () => {
    const items = reactive<string[]>([]);
    mount(ComboboxStatic, { items, root: { autoHighlight: true } });
    await nextTick();
    await userEvent.type(input(), 'a');
    items.push('a1', 'a2', 'a3');
    await opened();
    await userEvent.hover(item('a2'));
    await expectHighlight('a2');
    items.push('a4');
    await settle();
    await expectHighlight('a2');
  });

  test('the first result has the highlight after a typed text left out the items that rendered', async () => {
    const items = reactive(['blackberry', 'blueberry', 'cherry']);
    mount(ComboboxParts, { items, root: { autoHighlight: true } });
    await nextTick();
    await userEvent.type(input(), 'b');
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('blueberry');
    await userEvent.type(input(), 'l');
    await expectHighlight('blackberry');
  });

  test('new candidates keep the item that the keys reached', async () => {
    const items = reactive(['32']);
    mount(ComboboxParts, { items, root: { autoHighlight: true } });
    await nextTick();
    await userEvent.type(input(), '32');
    await opened();
    items.push('320');
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('320');
    items.splice(0, 1, '321');
    await settle();
    await expectHighlight('320');
  });

  test('a text that the parent clears drops the wait for a first item', async () => {
    const changes: unknown[] = [];
    const items = reactive<string[]>([]);
    const root = reactive<Props>({
      autoHighlight: true,
      inputValue: '',
      onValueChange: (value: unknown) => changes.push(value),
    });
    root['onUpdate:inputValue'] = (text: string) => (root.inputValue = text);
    mount(ComboboxParts, { items, root });
    await nextTick();
    await userEvent.type(input(), '32');
    root.inputValue = '';
    await nextTick();
    items.push('32');
    await settle();
    expect(input().value).toBe('');
    expect(input()).not.toHaveAttribute('aria-activedescendant');
  });

  test('a close drops the wait for a first item', async () => {
    const items = reactive<string[]>([]);
    const root = reactive<Props>({ autoHighlight: true, open: true });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    mount(ComboboxParts, { items, root });
    await nextTick();
    await userEvent.type(input(), '32');
    root.open = false;
    await nextTick();
    items.push('32');
    root.open = true;
    await opened();
    await settle();
    expect(item('32')).not.toHaveAttribute('data-highlighted');
  });

  test('`autoHighlight` turned off drops the wait for a first item', async () => {
    const items = reactive<string[]>([]);
    const root = reactive<Props>({ autoHighlight: true });
    mount(ComboboxParts, { items, root });
    await nextTick();
    await userEvent.type(input(), '32');
    root.autoHighlight = false;
    await nextTick();
    root.autoHighlight = true;
    items.push('32');
    await opened();
    await settle();
    expect(item('32')).not.toHaveAttribute('data-highlighted');
  });
});

describe('`itemHighlighted`', () => {
  test('a pointer highlight after the keys has the reason `pointer`', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['apple', 'banana'],
      root: logHighlights(log, { defaultOpen: true }),
    });
    await opened();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    expect(log.at(-1)).toBe('apple 0 keyboard');
    await userEvent.hover(item('banana'));
    await waitFor(() => expect(log.at(-1)).toBe('banana 1 pointer'));
  });

  test('typed text and the clear button that remove the highlight give no reason `keyboard`', async () => {
    const log: string[] = [];
    mount(ComboboxParts, {
      items: ['apple', 'banana'],
      clear: {},
      root: logHighlights(log, { defaultOpen: true, defaultValue: 'apple' }),
    });
    await opened();
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('x');
    await waitFor(() => expect(log.at(-1)).toMatch(/^undefined -1 /));
    expect(log.at(-1)).not.toMatch(/keyboard$/);
    await userEvent.keyboard('{Backspace}');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).not.toBe(null));
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(log.at(-1)).toMatch(/^undefined -1 /));
    expect(log.at(-1)).not.toMatch(/keyboard$/);
  });

  test('an emptied text with no value gives the highlight to no item', async () => {
    mount(ComboboxParts, { items: ['apple', 'banana'] });
    await nextTick();
    await userEvent.type(input(), 'ap');
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await expectHighlight('apple');
    await userEvent.clear(input());
    await expectHighlight(null);
  });
});
