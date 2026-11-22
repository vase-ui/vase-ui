import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type { ComboboxRootChangeEventDetails } from '@vase-ui/vue/combobox';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxInlineScene from '../../test/fixtures/ComboboxInlineScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { fireEvent } from '../../test/fireEvent';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;
const textInput = () => document.querySelector<HTMLInputElement>('input[aria-hidden="true"]')!;
const highlighted = () => document.querySelector('[data-highlighted]')?.textContent?.trim() ?? null;

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

describe('the open state', () => {
  test('`close()` of a template ref closes with the reason `imperative-action`, and a cancel keeps the popup open', async () => {
    const reasons: string[] = [];
    let cancel = true;
    const { exposed } = mount(ComboboxParts, {
      root: {
        defaultOpen: true,
        onOpenChange: (_: boolean, details: ComboboxRootChangeEventDetails) => {
          reasons.push(details.reason);
          if (cancel) details.cancel();
        },
      },
    });
    await opened();
    exposed.root.close();
    await settle();
    expect(reasons).toEqual(['imperative-action']);
    expect(popup()).not.toBe(null);
    cancel = false;
    exposed.root.close();
    await closed();
    expect(input()).toHaveAttribute('aria-expanded', 'false');
  });

  test('a cancelled open keeps the popup closed', async () => {
    const opens: boolean[] = [];
    mount(ComboboxParts, {
      root: {
        onOpenChange: (open: boolean, details: ComboboxRootChangeEventDetails) => {
          opens.push(open);
          details.cancel();
        },
      },
    });
    await nextTick();
    await userEvent.click(input());
    await settle();
    expect(opens).toEqual([true]);
    expect(popup()).toBe(null);
  });

  test('a pick in a popup that the parent holds open keeps it open', async () => {
    mount(ComboboxParts, { trigger: true, root: { open: true } });
    await opened();
    await userEvent.click(item('Apple'));
    await settle();
    expect(popup()).not.toBe(null);
  });

  test('Escape closes after a typed text that the user emptied', async () => {
    mount(ComboboxParts, { root: { defaultOpen: true } });
    await opened();
    await userEvent.type(input(), 'a');
    await userEvent.clear(input());
    await userEvent.keyboard('{Escape}');
    await closed();
  });

  test('a press on the text of an element around the input closes the popup', async () => {
    mount(ComboboxParts, { trigger: true, label: true });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(byTestId('label')!, { position: { x: 1, y: 1 } });
    await closed();
  });

  test('`items` that become undefined keep the popup open with no item', async () => {
    const { unmount } = mount(ComboboxParts, { items: [], root: { defaultOpen: true } });
    await opened();
    unmount();
    mount(ComboboxParts, { items: undefined, root: { defaultOpen: true } });
    await opened();
    expect(input()).toHaveAttribute('aria-expanded', 'true');
  });

  test('a pick keeps its selected item after the parent narrows the items at the close', async () => {
    const items = reactive(['Apple', 'Banana', 'Cherry']);
    mount(ComboboxParts, {
      items,
      root: {
        onOpenChange: (open: boolean) => {
          if (!open) void nextTick(() => items.splice(0, 3, 'Cherry'));
        },
      },
    });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.click(item('Cherry'));
    await closed();
    await userEvent.click(input());
    await opened();
    expect(item('Cherry')).toHaveAttribute('aria-selected', 'true');
  });
});

describe('a modal popup', () => {
  test('VUE-222: with the input in the popup, Tab from the last tab stop closes the popup, and the focus goes to the element after the trigger', async () => {
    mount(ComboboxParts, { inputInPopup: true, button: true, root: { modal: true } });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(byTestId('popup-button'));
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(document.activeElement).toBe(document.getElementById('outside'));
  });

  test.each([{ modal: false }, { modal: true }])(
    'VUE-223: an open popup with modal $modal gives no element `aria-hidden` or `inert`',
    async ({ modal }) => {
      mount(ComboboxParts, { trigger: true, label: true, root: { modal } });
      await nextTick();
      await userEvent.click(input());
      await opened();
      const page = [
        document.getElementById('before')!,
        byTestId('label')!,
        byTestId('group')!,
        input(),
        trigger(),
        document.getElementById('outside')!,
        popup()!,
      ];
      for (const element of page) {
        expect(element.closest('[aria-hidden="true"], [inert]')).toBe(null);
      }
    },
  );
});

describe('an inline list', () => {
  test('a close of a multiple inline list empties its text', async () => {
    const root = reactive<Props>({ multiple: true, open: true });
    mount(ComboboxInlineScene, { root });
    await nextTick();
    await userEvent.type(input(), 'a');
    root.open = false;
    await nextTick();
    expect(input().value).toBe('');
  });

  test('a value with no item gets no highlight; a value with an item gets it', async () => {
    const first = mount(ComboboxInlineScene, { root: { defaultValue: 'missing' } });
    await settle();
    expect(highlighted()).toBe(null);
    first.unmount();
    mount(ComboboxInlineScene, { root: { defaultValue: 'apple' } });
    await waitFor(() => expect(highlighted()).toBe('apple'));
  });
});

describe('the hidden text input', () => {
  test('a focus of it goes to the input, else to the trigger that is the control', async () => {
    const first = mount(ComboboxParts, { root: { name: 'fruit' } });
    await nextTick();
    await fireEvent.focus(textInput());
    expect(document.activeElement).toBe(input());
    first.unmount();
    mount(ComboboxParts, { inputInPopup: true, root: { name: 'fruit', defaultOpen: true } });
    await opened();
    await fireEvent.focus(textInput());
    expect(document.activeElement).toBe(trigger());
  });

  test('an autofill with no matching item changes no value', async () => {
    const changes: unknown[] = [];
    mount(ComboboxParts, {
      items: ['apple'],
      root: { name: 'fruit', onValueChange: (value: unknown) => changes.push(value) },
    });
    await nextTick();
    textInput().value = 'orange';
    textInput().dispatchEvent(new Event('input', { bubbles: true }));
    await settle();
    expect(changes).toEqual([]);
  });
});

describe('an Autocomplete in a field', () => {
  test('a focus that leaves the popup with its input validates the text', async () => {
    const values: unknown[] = [];
    mount(AutocompleteParts, {
      inputInPopup: true,
      field: {
        validationMode: 'blur',
        validate: (value: unknown) => {
          values.push(value);
          return null;
        },
      },
      root: { defaultValue: 'query' },
    });
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await userEvent.click(document.getElementById('outside')!);
    await waitFor(() => expect(values).toContain('query'));
  });
});

describe('the highlight of `autoHighlight` always', () => {
  test('a text with no match and then no text gives the highlight back to the first item', async () => {
    mount(AutocompleteParts, {
      items: ['apple', 'banana'],
      root: { autoHighlight: 'always', defaultOpen: true },
    });
    await opened();
    await userEvent.type(input(), 'z');
    await waitFor(() => expect(document.querySelectorAll('[role="option"]')).toHaveLength(0));
    await userEvent.clear(input());
    await waitFor(() => expect(highlighted()).toBe('apple'));
  });
});

describe('the list of the popup', () => {
  test('a right press on an item selects nothing and keeps the popup open', async () => {
    const changes: unknown[] = [];
    mount(ComboboxParts, {
      root: { defaultOpen: true, onValueChange: (value: unknown) => changes.push(value) },
    });
    await opened();
    await userEvent.click(item('Apple'), { button: 'right' });
    await settle();
    expect(changes).toEqual([]);
    expect(popup()).not.toBe(null);
  });

  test('Shift+Tab closes the popup with no pick and moves the focus to the element before', async () => {
    const changes: unknown[] = [];
    mount(ComboboxParts, { root: { onValueChange: (value: unknown) => changes.push(value) } });
    await nextTick();
    await userEvent.click(input());
    await opened();
    await userEvent.keyboard('{ArrowDown}');
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await closed();
    expect(document.activeElement).toBe(document.getElementById('before'));
    expect(changes).toEqual([]);
  });

  test('a list with every item disabled selects nothing for Enter', async () => {
    const changes: unknown[] = [];
    mount(ComboboxParts, {
      items: ['Apple', 'Banana'],
      itemProps: { Apple: { disabled: true }, Banana: { disabled: true } },
      root: { defaultOpen: true, onValueChange: (value: unknown) => changes.push(value) },
    });
    await opened();
    input().focus();
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await settle();
    expect(changes).toEqual([]);
  });
});
