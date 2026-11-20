import { expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ListFixture from '../../test/fixtures/ListFixture.vue';
import { mount } from '../../test/render';

const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;

test('a typed string matches the start of a text with no regard to case, and goes on from the highlight', async () => {
  mount(ListFixture, {
    items: [
      { key: 'b', text: 'Banana' },
      { key: 'c', text: 'cherry' },
      { key: 'c2', text: 'Coconut' },
    ],
  });
  await nextTick();
  await nextTick();
  document.querySelector<HTMLElement>('[data-testid="container"]')!.focus();
  await userEvent.keyboard('C');
  expect(document.activeElement).toBe(item('c'));
  await new Promise((resolve) => setTimeout(resolve, 550));
  await userEvent.keyboard('c');
  expect(document.activeElement).toBe(item('c2'));
  await new Promise((resolve) => setTimeout(resolve, 550));
  await userEvent.keyboard('x');
  expect(document.activeElement).toBe(item('c2'));
});
