import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import type { ComboboxRootHighlightEventDetails } from '@vase-ui/vue/combobox';
import ComboboxGrid from '../../test/fixtures/ComboboxGrid.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

async function mountGrid(props: Props = {}) {
  const result = mount(ComboboxGrid, props);
  await nextTick();
  return result;
}

/** Presses each key and gives the highlighted cell after it. */
async function walk(keys: string[]) {
  const cells: (string | null)[] = [];
  for (const key of keys) {
    await userEvent.keyboard(key);
    cells.push(highlighted());
  }
  return cells;
}

describe('a grid', () => {
  test('has the roles grid, row, gridcell and rowgroup, with no `aria-orientation`', async () => {
    const first = await mountGrid();
    const grid = document.querySelector('[role="grid"]')!;
    expect(grid).not.toHaveAttribute('aria-orientation');
    expect(document.querySelectorAll('[role="row"]')).toHaveLength(3);
    expect(document.querySelectorAll('[role="gridcell"]')).toHaveLength(8);
    first.unmount();
    await mountGrid({ grouped: true });
    expect(byTestId('group')).toHaveAttribute('role', 'rowgroup');
  });

  test('the arrow keys move across the rows and the columns, also into a shorter row and in a group', async () => {
    for (const grouped of [false, true]) {
      const { unmount } = await mountGrid({ grouped });
      input().focus();
      expect(
        await walk(['{ArrowDown}', '{ArrowRight}', '{ArrowRight}', '{ArrowDown}', '{ArrowDown}']),
      ).toEqual(['a1', 'a2', 'a3', 'b3', 'c2']);
      expect(await walk(['{ArrowLeft}', '{ArrowUp}'])).toEqual(['c1', 'b1']);
      unmount();
    }
  });

  test('a right-to-left grid mirrors ArrowLeft and ArrowRight', async () => {
    await mountGrid({ dir: 'rtl' });
    input().focus();
    expect(await walk(['{ArrowDown}', '{ArrowLeft}', '{ArrowRight}'])).toEqual(['a1', 'a2', 'a1']);
  });

  test('with no highlight, ArrowLeft and ArrowRight move the caret of the input', async () => {
    await mountGrid();
    input().focus();
    await userEvent.keyboard('ab');
    await userEvent.keyboard('{ArrowLeft}');
    expect([input().selectionStart, highlighted()]).toEqual([1, null]);
    await userEvent.keyboard('{ArrowRight}');
    expect([input().selectionStart, highlighted()]).toEqual([2, null]);
  });

  test('a key that the grid does not use gives no new highlight event; `autoHighlight` keeps the keys of the grid', async () => {
    const log: string[] = [];
    await mountGrid({
      root: {
        autoHighlight: true,
        onItemHighlighted: (value: unknown, details: ComboboxRootHighlightEventDetails) =>
          log.push(`${String(value)} ${details.reason}`),
      },
    });
    await userEvent.type(input(), 'a');
    await waitFor(() => expect(highlighted()).toBe('a1'));
    await userEvent.keyboard('{ArrowRight}');
    expect(highlighted()).toBe('a2');
    const count = log.length;
    await userEvent.keyboard('{Shift}');
    expect(log).toHaveLength(count);
  });
});
