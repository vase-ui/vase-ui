import { describe, expect, onTestFinished, test, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import ListFixture from '../../test/fixtures/ListFixture.vue';
import { mount } from '../../test/render';
import { nextTextMatch } from './typeahead';

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

test('an item that `hidden` or `visibility: hidden` hides does not match, and does not stop the letter that goes to the next item', async () => {
  mount(ListFixture, {
    items: [
      { key: 'aaron', text: 'Aaron', hidden: true },
      { key: 'apple', text: 'Apple', invisible: true },
      { key: 'apricot', text: 'Apricot' },
      { key: 'avocado', text: 'Avocado' },
    ],
  });
  await nextTick();
  await nextTick();
  document.querySelector<HTMLElement>('[data-testid="container"]')!.focus();
  await userEvent.keyboard('a');
  expect(document.activeElement).toBe(item('apricot'));
  await userEvent.keyboard('a');
  expect(document.activeElement).toBe(item('avocado'));
});

describe('nextTextMatch', () => {
  const texts = ['Apple', 'Apricot', 'Banana', 'Blueberry', 'Cherry'];

  test('each key of a string searches from the text after the start, so a match that still fits stays', () => {
    expect(nextTextMatch(texts, 'a', -1, -1)).toBe(0);
    expect(nextTextMatch(texts, 'ap', -1, 0)).toBe(0);
    expect(nextTextMatch(texts, 'apr', -1, 0)).toBe(1);
  });

  test('a letter typed again matches a text that starts with the two letters', () => {
    expect(nextTextMatch(['Apple', 'Aaron', 'Apricot'], 'aa', -1, 0)).toBe(1);
  });

  test('a string of more than one letter starts after the highlight and wraps', () => {
    const toys = ['Toy Story 2', 'Toy Story 3', 'Toy Story 4'];
    expect(nextTextMatch(toys, 'toy', -1, -1)).toBe(0);
    expect(nextTextMatch(toys, 'toytoy', -1, 0)).toBe(-1);
    expect(nextTextMatch(toys, 'toy', 0, 0)).toBe(1);
    expect(nextTextMatch(toys, 'toy', 2, 2)).toBe(0);
  });

  test('the match does not follow the locale of the runtime: `i` matches `Istanbul` in a Turkish runtime', () => {
    const lower = String.prototype.toLocaleLowerCase;
    const spy = vi
      .spyOn(String.prototype, 'toLocaleLowerCase')
      .mockImplementation(function lowerInTurkish(this: string) {
        return lower.call(this, 'tr');
      });
    onTestFinished(() => spy.mockRestore());
    expect(nextTextMatch(['Istanbul'], 'i', -1, -1)).toBe(0);
    expect(nextTextMatch(['istanbul'], 'I', -1, -1)).toBe(0);
  });

  test('the same letter again goes to the next text with that letter; the search wraps', () => {
    expect(nextTextMatch(texts, 'bb', -1, 2)).toBe(3);
    expect(nextTextMatch(texts, 'bbb', -1, 3)).toBe(2);
    expect(nextTextMatch(texts, 'z', -1, -1)).toBe(-1);
  });
});
