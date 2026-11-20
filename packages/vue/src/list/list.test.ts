import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import ListFixture from '../../test/fixtures/ListFixture.vue';
import { mount } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Item = {
  key: string;
  text?: string;
  disabled?: boolean;
  native?: boolean;
  hidden?: boolean;
  link?: boolean;
  absent?: boolean;
};

const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
const container = () => document.querySelector<HTMLElement>('[data-testid="container"]')!;
const highlighted = () =>
  document.querySelector('[data-highlighted]')?.getAttribute('data-key') ?? null;

async function mountList(props: Record<string, unknown>) {
  const result = mount(ListFixture, props);
  await nextTick();
  await nextTick();
  return result;
}

const keys = (...names: string[]) => names.map((key) => ({ key }));

describe('the order', () => {
  test('follows the document after a `v-for` change, and leaves out a hidden and a native disabled item', async () => {
    const items = reactive<Item[]>(keys('a', 'b', 'c', 'd'));
    await mountList({ items });
    container().focus();
    items.reverse();
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('d'));
    items.splice(1, 2, { key: 'c', hidden: true }, { key: 'b', native: true, disabled: true });
    await nextTick();
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('a'));
  });

  test('an item that its part disabled keeps the highlight', async () => {
    await mountList({ items: [{ key: 'a' }, { key: 'b', disabled: true }] });
    container().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(document.activeElement).toBe(item('b'));
  });

  test('the highlight goes when its item leaves, with the reason `none`', async () => {
    const log: string[] = [];
    const items = reactive<Item[]>(keys('a', 'b'));
    await mountList({ items, onHighlight: (entry: string) => log.push(entry) });
    container().focus();
    await userEvent.keyboard('{ArrowDown}');
    items.splice(0, 1);
    await waitFor(() => expect(log.at(-1)).toBe('none none'));
    expect(highlighted()).toBe(null);
  });
});

describe('the keys', () => {
  test('a horizontal list moves with the left and right keys in the direction of its element', async () => {
    await mountList({ items: keys('a', 'b', 'c'), orientation: 'horizontal', dir: 'rtl' });
    container().focus();
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(item('a'));
    await userEvent.keyboard('{ArrowLeft}');
    expect(document.activeElement).toBe(item('b'));
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(item('b'));
  });

  test('a key with a modifier moves nothing', async () => {
    await mountList({ items: keys('a', 'b') });
    container().focus();
    await userEvent.keyboard('{Control>}{ArrowDown}{/Control}');
    expect(highlighted()).toBe(null);
  });

  test('with `canLeave`, an arrow key at an end removes the highlight, and the next one goes on from the other end', async () => {
    await mountList({ items: keys('a', 'b'), virtual: true, canLeave: true });
    const owner = document.querySelector<HTMLInputElement>('input')!;
    owner.focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe('b');
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe(null);
    await userEvent.keyboard('{ArrowDown}');
    expect(highlighted()).toBe('a');
    expect(document.activeElement).toBe(owner);
  });
});

describe('virtual mode', () => {
  test('a link item is no tab stop, and a press keeps the focus on the owner', async () => {
    await mountList({ items: [{ key: 'a' }, { key: 'l', link: true }], virtual: true });
    const owner = document.querySelector<HTMLInputElement>('input')!;
    expect(item('l')).toHaveAttribute('tabindex', '-1');
    owner.focus();
    await userEvent.click(item('l'), { position: { x: 5, y: 5 } }).catch(() => undefined);
    expect(document.activeElement).toBe(owner);
  });
});

describe('the keys that the list does not use', () => {
  test('an arrow key moves the highlight and prevents its default; a key of a composition and a key in an empty list do nothing', async () => {
    await mountList({ items: keys('a', 'b') });
    container().focus();
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    container().dispatchEvent(down);
    expect(down.defaultPrevented).toBe(true);
    await nextTick();
    expect(highlighted()).toBe('a');
    const composing = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
      isComposing: true,
    });
    container().dispatchEvent(composing);
    await nextTick();
    expect(highlighted()).toBe('a');
    expect(composing.defaultPrevented).toBe(false);
  });

  test('an item that renders no element is out of the list', async () => {
    await mountList({ items: [{ key: 'a' }, { key: 'x', absent: true }, { key: 'b' }] });
    container().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    expect(highlighted()).toBe('b');
  });

  test('an empty list does not prevent an arrow key', async () => {
    await mountList({ items: [] });
    const down = new KeyboardEvent('keydown', {
      key: 'ArrowDown',
      bubbles: true,
      cancelable: true,
    });
    container().dispatchEvent(down);
    expect(down.defaultPrevented).toBe(false);
  });
});

describe('the pointer', () => {
  test('a move highlights an item and gives it the focus; a scroll under a pointer that rests highlights nothing', async () => {
    await mountList({ items: keys('a', 'b', 'c', 'd', 'e', 'f') });
    await userEvent.hover(item('a'));
    await waitFor(() => expect(document.activeElement).toBe(item('a')));
    container().scrollTop = 60;
    await new Promise((resolve) => setTimeout(resolve, 200));
    expect(highlighted()).toBe('a');
  });

  test.runIf(server.browser === 'webkit')(
    'the `pointermove` of WebKit after a scroll under a pointer that rests highlights nothing',
    async () => {
      await mountList({ items: keys('a', 'b', 'c', 'd', 'e', 'f') });
      await userEvent.hover(item('b'));
      await waitFor(() => expect(highlighted()).toBe('b'));
      container().scrollTop = 30;
      await new Promise((resolve) => setTimeout(resolve, 300));
      expect(highlighted()).toBe('b');
    },
  );
});
