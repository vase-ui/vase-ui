import { describe, expect, inject, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ComboboxRenders from '../../test/fixtures/ComboboxRenders.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

// The fault of discussion #665: a highlight step rendered each item. Each part renders only for a
// change of what it shows. The counts are renders of the virtual DOM: a Vapor component updates
// each binding alone, and a Vapor app reads a function prop of the root as a getter.

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

describe.runIf(inject('app') === 'vdom')('the renders', () => {
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

  test('a key that keeps the same filtered items renders no item', async () => {
    const spy = await openList();
    await userEvent.keyboard(' ');
    await nextTick();
    expect(spy.renders.item).toBe(undefined);
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
