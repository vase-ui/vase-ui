import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ComboboxGrid from '../../test/fixtures/ComboboxGrid.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';
import { nextTextMatch } from './typeahead';

const input = () => document.querySelector<HTMLInputElement>('[data-testid="input"]')!;
const item = (name: string) => document.querySelector(`[data-testid="item-${name}"]`)!;
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim();

async function mountGrid(props: Record<string, unknown> = {}) {
  mount(ComboboxGrid, props);
  await nextTick();
  input().focus();
}

describe('the grid keys', () => {
  test('with no highlight, ArrowLeft and ArrowRight stay with the input; ArrowDown gives the first item', async () => {
    await mountGrid();
    await userEvent.keyboard('{ArrowLeft}{ArrowRight}');
    expect(highlighted()).toBe(undefined);
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('a1'));
  });

  test('ArrowRight and ArrowLeft move in the row and on to the next row; ArrowDown and ArrowUp keep the column', async () => {
    await mountGrid();
    await userEvent.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}{ArrowRight}');
    await waitFor(() => expect(highlighted()).toBe('b1'));
    await userEvent.keyboard('{ArrowRight}{ArrowUp}');
    await waitFor(() => expect(highlighted()).toBe('a2'));
    await userEvent.keyboard('{ArrowLeft}');
    await waitFor(() => expect(highlighted()).toBe('a1'));
    expect(item('a1')).toHaveAttribute('role', 'gridcell');
    expect(item('a1').parentElement).toHaveAttribute('role', 'row');
  });

  test('a shorter row gives its last item', async () => {
    await mountGrid();
    await userEvent.keyboard('{ArrowDown}{ArrowRight}{ArrowRight}{ArrowDown}{ArrowDown}');
    await waitFor(() => expect(highlighted()).toBe('c2'));
  });

  test('in a right-to-left list, ArrowLeft moves forward', async () => {
    await mountGrid({ dir: 'rtl' });
    await userEvent.keyboard('{ArrowDown}{ArrowLeft}');
    await waitFor(() => expect(highlighted()).toBe('a2'));
  });
});

describe('nextTextMatch', () => {
  const texts = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry'];

  test('each key of a string searches from the text after the start, so a match that still fits stays', () => {
    expect(nextTextMatch(texts, 'a', -1, -1)).toBe(0);
    expect(nextTextMatch(texts, 'ap', -1, 0)).toBe(0);
    expect(nextTextMatch(texts, 'apr', -1, 0)).toBe(1);
  });

  test('the same letter again goes to the next text with that letter; the search wraps', () => {
    expect(nextTextMatch(texts, 'bb', -1, 2)).toBe(3);
    expect(nextTextMatch(texts, 'bbb', -1, 3)).toBe(2);
    expect(nextTextMatch(texts, 'z', -1, -1)).toBe(-1);
  });
});
