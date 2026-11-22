import { describe, expect, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ComboboxRenders from '../../test/fixtures/ComboboxRenders.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

// A highlight step renders only the items whose highlight changes (discussion #665). Each part
// renders only for a change of what it shows. A count reads the scope of its slot, where the part
// gives one. A virtual DOM part calls its slot again at each render. A Vapor part keeps an object
// of the scope while its values stay the same, and the count runs again for each new object. So
// the counts are the same in each mode.

function counter() {
  const renders: Record<string, number> = {};
  return {
    renders,
    count(part: string) {
      renders[part] = (renders[part] ?? 0) + 1;
      return '';
    },
    reset() {
      for (const part of Object.keys(renders)) delete renders[part];
    },
  };
}

async function openList(root: Record<string, unknown> = {}) {
  const spy = counter();
  mount(ComboboxRenders, { count: spy.count, root });
  await nextTick();
  const input = document.querySelector<HTMLInputElement>('[data-testid="input"]')!;
  await userEvent.click(input);
  await waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(300));
  await new Promise((resolve) => setTimeout(resolve, 50));
  spy.reset();
  return spy;
}

describe('the renders', () => {
  test('20 steps of the highlight over 300 items render 39 items and 20 inputs, and no other part', async () => {
    const spy = await openList();
    for (let step = 0; step < 20; step += 1) {
      await userEvent.keyboard('{ArrowDown}');
      await nextTick();
    }
    await waitFor(() =>
      expect(document.querySelector('[data-highlighted]')).toHaveTextContent('Item 19'),
    );
    expect(spy.renders).toEqual({ item: 39, input: 20 });
  });

  test('a pointer that moves over 25 items renders at most two items for each move', async () => {
    const spy = await openList();
    const options = [...document.querySelectorAll<HTMLElement>('[role="option"]')].slice(0, 25);
    for (const option of [...options, ...options.toReversed()]) {
      spy.reset();
      await userEvent.hover(option);
      await nextTick();
      expect(spy.renders.item ?? 0).toBeLessThanOrEqual(2);
    }
  });

  test('a key that keeps the same filtered items renders no item and no list', async () => {
    const spy = await openList();
    // Each item contains the letter.
    await userEvent.keyboard('i');
    await nextTick();
    expect(spy.renders.item).toBe(undefined);
    expect(spy.renders.list).toBe(undefined);
  });

  // In Chromium, a comparison of two siblings walks their siblings. A sort of the items with this
  // comparison then costs more than the square of the count of items.
  test('a highlight step and a filter key compare the order of no two elements', async () => {
    await openList();
    const compare = vi.spyOn(Node.prototype, 'compareDocumentPosition');
    try {
      await userEvent.keyboard('{ArrowDown}{ArrowDown}');
      await waitFor(() =>
        expect(document.querySelector('[data-highlighted]')).toHaveTextContent('Item 1'),
      );
      await userEvent.keyboard('9');
      await waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(57));
      expect(compare).not.toHaveBeenCalled();
    } finally {
      compare.mockRestore();
    }
  });

  test('an open by ArrowDown over 300 items checks the visibility of the first item and its list only', async () => {
    mount(ComboboxRenders, { count: () => '' });
    await nextTick();
    document.querySelector<HTMLInputElement>('[data-testid="input"]')!.focus();
    const read = vi.spyOn(Element.prototype, 'checkVisibility');
    try {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(document.querySelector('[data-highlighted]')).toHaveTextContent('Item 0'),
      );
      await nextTick();
      const first = document.querySelector('[role="option"]');
      const list = document.querySelector('[role="listbox"]');
      expect(new Set(read.mock.contexts)).toEqual(new Set([first, list]));
    } finally {
      read.mockRestore();
    }
  });

  test('a highlight step over 300 items checks the visibility of the next item, and of the items up to it for the index of its event', async () => {
    await openList();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() =>
      expect(document.querySelector('[data-highlighted]')).toHaveTextContent('Item 0'),
    );
    await nextTick();
    const read = vi.spyOn(Element.prototype, 'checkVisibility');
    try {
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() =>
        expect(document.querySelector('[data-highlighted]')).toHaveTextContent('Item 1'),
      );
      await nextTick();
      expect(read).toHaveBeenCalledTimes(3);
    } finally {
      read.mockRestore();
    }
  });

  test('a pick renders only the item whose selected state changed', async () => {
    const spy = await openList({ multiple: true });
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await nextTick();
    spy.reset();
    await userEvent.keyboard('{Enter}');
    await nextTick();
    expect(spy.renders.item).toBe(1);
  });
});
