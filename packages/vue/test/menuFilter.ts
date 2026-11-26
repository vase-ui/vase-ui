import { expect } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick } from 'vue';
import MenuFilterTree from './fixtures/MenuFilterTree.vue';
import { mount } from './render';
import { waitFor } from './waitFor';

export const byTestId = (id: string) =>
  document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
export const popup = (key?: string) => byTestId(key ? `${key}-popup` : 'popup');
export const input = (key?: string) =>
  byTestId(key ? `${key}-input` : 'input') as HTMLInputElement | null;
export const item = (key: string) => document.querySelector<HTMLElement>(`[data-key="${key}"]`)!;
export const active = () => document.activeElement as HTMLElement | null;
/** The key of the item with `data-highlighted` in the popup of `key`, else in each popup. */
export const highlighted = (key?: string) =>
  (key ? popup(key) : document)
    ?.querySelector('[data-highlighted][data-key]')
    ?.getAttribute('data-key') ?? null;
/** The key of the item that `aria-activedescendant` of the input names. */
export const activeDescendant = (key?: string) => {
  const id = input(key)?.getAttribute('aria-activedescendant');
  return id ? (document.getElementById(id)?.getAttribute('data-key') ?? id) : null;
};
/** The keys of the items that show. */
export const shown = () =>
  [...document.querySelectorAll<HTMLElement>('[data-key]')]
    .filter((element) => element.checkVisibility())
    .map((element) => element.getAttribute('data-key'));

/** Mounts `MenuFilterTree.vue`. */
export async function mountTree(props: Record<string, unknown> = {}) {
  const result = mount(MenuFilterTree, props);
  await nextTick();
  const trigger = result.root.querySelector<HTMLElement>('[data-testid="trigger"]');
  return { ...result, trigger: trigger! };
}

/** Waits for the popup of `key`, else of the root, in its place. */
export async function opened(key?: string) {
  await waitFor(() => expect(popup(key)?.checkVisibility({ opacityProperty: true })).toBe(true));
  return popup(key)!;
}

export async function closed(key?: string) {
  await waitFor(() => expect(popup(key)).toBe(null));
}

/** Opens the menu with a key on the trigger, and waits for the focus in the input. */
export async function openWithKey(trigger: HTMLElement, key = '{Enter}') {
  trigger.focus();
  await userEvent.keyboard(key);
  await opened();
  await waitFor(() => expect(active()).toBe(input()));
}

/** Waits for the focus in the input of the submenu of `key`. */
export async function inSubmenu(key: string) {
  await opened(key);
  await waitFor(() => expect(active()).toBe(input(key)));
}
