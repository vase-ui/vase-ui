import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import type { ComboboxRootHighlightEventDetails } from '@vase-ui/vue/combobox';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import ComboboxVirtualized from '../../test/fixtures/ComboboxVirtualized.vue';
import { clientCenter, touchDrag } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;

async function mountStatic(props: Props = {}) {
  const result = mount(ComboboxStatic, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

/** Item props that count the `click` events of a developer listener on each item. */
function countedClicks(clicks: Record<string, number>, names: string[]) {
  return Object.fromEntries(
    names.map((name) => {
      clicks[name] = 0;
      return [name, { onClick: () => (clicks[name]! += 1) }];
    }),
  );
}

describe('the click listener of an item', () => {
  test('runs once for a press, and once for Enter on the highlighted item', async () => {
    const clicks: Record<string, number> = {};
    await mountStatic({ itemProps: countedClicks(clicks, ['apple', 'banana', 'cherry']) });
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('banana'));
    expect(clicks.banana).toBe(1);
    await closed();
    await userEvent.click(input());
    await opened();
    // The selected item has the highlight at the open, so ArrowDown goes to the next item.
    await userEvent.keyboard('{ArrowDown}{Enter}');
    expect(clicks).toEqual({ apple: 0, banana: 1, cherry: 1 });
  });

  test('the items of a disabled root have `aria-disabled`, and a press calls no click listener and selects nothing', async () => {
    const clicks: Record<string, number> = {};
    await mountStatic({
      root: { defaultOpen: true, disabled: true },
      itemProps: countedClicks(clicks, ['apple']),
    });
    await opened();
    expect(item('apple')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.click(item('apple'), { force: true });
    await settle();
    expect(clicks.apple).toBe(0);
    expect(input().value).toBe('');
  });
});

describe.skipIf(server.browser !== 'chromium')('a touch', () => {
  test('a tap on an item selects it and keeps the focus on the input', async () => {
    await mountStatic();
    await userEvent.click(input());
    await opened();
    expect(document.activeElement).toBe(input());
    const point = clientCenter(item('banana'));
    const at = { x: point.clientX, y: point.clientY };
    await touchDrag(at, at, 0);
    await waitFor(() => expect(input().value).toBe('banana'));
    expect(document.activeElement).toBe(input());
  });
});

describe('an item that is a link', () => {
  test('an `<a>` with no `href` selects and closes as an item', async () => {
    await mountStatic({ root: { defaultOpen: true }, itemProps: { apple: { as: 'a' } } });
    await opened();
    expect(item('apple').localName).toBe('a');
    await userEvent.click(item('apple'));
    await waitFor(() => expect(input().value).toBe('apple'));
    await closed();
  });
});

describe('a virtualized list', () => {
  test.each([false, true])(
    'a press and the keys select the filtered item (index given: %s)',
    async (indexed) => {
      const first = mount(ComboboxVirtualized, { indexed });
      await nextTick();
      await userEvent.click(input());
      await opened();
      await userEvent.type(input(), 'f');
      await waitFor(() => expect(byTestId('item-one')).toBe(null));
      await userEvent.click(item('five'));
      await waitFor(() => expect(input().value).toBe('five'));
      await closed();
      first.unmount();
      mount(ComboboxVirtualized, { indexed });
      await nextTick();
      await userEvent.click(input());
      await opened();
      await userEvent.type(input(), 'f');
      await waitFor(() => expect(byTestId('item-one')).toBe(null));
      await userEvent.keyboard('{ArrowDown}{Enter}');
      await waitFor(() => expect(input().value).toBe('four'));
      await closed();
    },
  );

  test('a window of the items with no index gets the places of its items in the filtered items', async () => {
    const highlights: number[] = [];
    mount(ComboboxVirtualized, {
      from: 2,
      to: 4,
      root: {
        defaultOpen: true,
        onItemHighlighted: (_: unknown, details: ComboboxRootHighlightEventDetails) =>
          highlights.push(details.index),
      },
    });
    await opened();
    await userEvent.hover(item('three'));
    await userEvent.hover(item('four'));
    await waitFor(() => expect(highlights).toEqual([2, 3]));
  });
});

describe('the `index` of an item', () => {
  test('a hover moves the highlight in a list that is not virtualized', async () => {
    await mountStatic({
      indexes: true,
      root: { defaultOpen: true, autoHighlight: true, items: ['apple', 'banana', 'cherry'] },
    });
    await opened();
    await userEvent.hover(item('banana'));
    await waitFor(() => expect(item('banana')).toHaveAttribute('data-highlighted'));
    await userEvent.hover(item('cherry'));
    await waitFor(() => expect(item('cherry')).toHaveAttribute('data-highlighted'));
    expect(item('banana')).not.toHaveAttribute('data-highlighted');
  });
});
