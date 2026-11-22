import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxChipScene from '../../test/fixtures/ComboboxChipScene.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import { fireEvent } from '../../test/fireEvent';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const popup = () => byTestId('popup');
const chip = (value: string) => byTestId(`chip-${value}`)!;
const item = (value: string) => byTestId(`item-${value}`)!;
const active = () => document.activeElement;

/** Props of a root that write each value change in `changes`. */
function recorded(changes: unknown[], props: Props = {}): Props {
  return { ...props, onValueChange: (value: unknown) => changes.push(value) };
}

/** Props of a root that write each highlight event in `log`, as `value reason`. */
function highlights(log: string[], props: Props = {}): Props {
  return {
    ...props,
    onItemHighlighted: (value: unknown, details: { reason: string }) =>
      log.push(`${String(value)} ${details.reason}`),
  };
}

async function mountChips(props: Props = {}) {
  const result = mount(ComboboxChipScene, props);
  await nextTick();
  return result;
}

/** Moves the focus to the start of the input, as a user who clicks before its text. */
function focusInputStart() {
  input().focus();
  input().setSelectionRange(0, 0);
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
}

describe('a chip', () => {
  test('a press on a chip gives the focus to the input and opens the popup', async () => {
    await mountChips({ root: { defaultValue: ['apple'] } });
    await userEvent.click(chip('apple'));
    expect(active()).toBe(input());
    await opened();
  });

  test.each([{ disabled: true }, { readonly: true }])(
    'with $0, the keys of a chip move no focus and remove no value',
    async (lock) => {
      const changes: unknown[] = [];
      await mountChips({ root: recorded(changes, { ...lock, defaultValue: ['apple', 'banana'] }) });
      chip('apple').focus();
      await userEvent.keyboard('{ArrowRight}');
      expect(active()).toBe(chip('apple'));
      await userEvent.keyboard('{Delete}');
      await settle();
      expect(changes).toEqual([]);
      expect(byTestId('chip-banana')).not.toBe(null);
    },
  );

  test('a press on a chip of a disabled root gives the focus to nothing', async () => {
    await mountChips({ root: { disabled: true, defaultValue: ['apple'] } });
    await userEvent.click(chip('apple'));
    expect(active()).not.toBe(chip('apple'));
    expect(active()).not.toBe(input());
    expect(popup()).toBe(null);
  });

  test('a chip of a read-only root has `data-readonly`; a press on it gives the focus to the input', async () => {
    // A chip has no role that takes `aria-readonly`, so its state is a `data-*` attribute.
    const root = reactive<Props>({ readonly: true, defaultValue: ['apple'] });
    await mountChips({ root });
    expect(chip('apple')).toHaveAttribute('data-readonly', '');
    expect(chip('apple')).not.toHaveAttribute('aria-readonly');
    await userEvent.click(chip('apple'));
    expect(active()).toBe(input());
    root.readonly = false;
    await nextTick();
    expect(chip('apple')).not.toHaveAttribute('data-readonly');
  });

  test('Enter, Space, ArrowDown, ArrowUp and a character on a chip give the focus to the input; the arrow keys open the popup', async () => {
    await mountChips({ root: { defaultValue: ['apple'] } });
    for (const key of ['{Enter}', ' ']) {
      chip('apple').focus();
      await userEvent.keyboard(key);
      expect(active(), key).toBe(input());
      expect(input().value, key).toBe('');
    }
    for (const key of ['{ArrowDown}', '{ArrowUp}']) {
      chip('apple').focus();
      await userEvent.keyboard(key);
      await opened();
      expect(active(), key).toBe(input());
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(popup()).toBe(null));
    }
    chip('apple').focus();
    await userEvent.keyboard('b');
    expect(active()).toBe(input());
    expect(input().value).toBe('b');
  });

  test.each(['ArrowDown', 'ArrowUp'])(
    '%s on a chip opens the popup and gives the focus to an input that mounts with the popup',
    async (key) => {
      await mountChips({ layout: 'whileOpen', root: { defaultValue: ['apple'] } });
      await waitFor(() => expect(byTestId('input')).not.toBe(null));
      focusInputStart();
      await userEvent.keyboard('{ArrowLeft}');
      await waitFor(() => expect(byTestId('input')).toBe(null));
      expect(active()).toBe(chip('apple'));
      await userEvent.keyboard(`{${key}}`);
      await waitFor(() => expect(active()).toBe(byTestId('input')));
    },
  );

  test('a character with Control, Meta or Alt keeps the focus on the chip', async () => {
    await mountChips({ root: { defaultValue: ['apple'] } });
    chip('apple').focus();
    for (const key of ['{Control>}a{/Control}', '{Meta>}a{/Meta}', '{Alt>}a{/Alt}']) {
      await userEvent.keyboard(key);
      expect(active(), key).toBe(chip('apple'));
    }
  });

  test('Delete on a chip removes its value, and the focus goes to the chip in its place', async () => {
    const changes: unknown[] = [];
    await mountChips({ root: recorded(changes, { defaultValue: ['apple', 'banana', 'cherry'] }) });
    chip('banana').focus();
    await userEvent.keyboard('{Delete}');
    expect(changes).toEqual([['apple', 'cherry']]);
    await waitFor(() => expect(active()).toBe(chip('cherry')));
  });

  test('the arrow keys go only through the chips that render', async () => {
    await mountChips({ chips: 2, root: { defaultValue: ['apple', 'banana', 'cherry'] } });
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('banana'));
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(input());
    chip('banana').focus();
    await userEvent.keyboard('{ArrowRight}');
    expect(active()).toBe(input());
  });
});

describe('the chips', () => {
  test('a press on a remove button is no press of the chips: the popup stays closed', async () => {
    await mountChips({ remove: {}, root: { defaultValue: ['apple'] } });
    await fireEvent.mouseDown(byTestId('remove-apple')!);
    await settle();
    expect(popup()).toBe(null);
  });

  test('a press on the chips of a root in a disabled field gives the focus to nothing and opens nothing', async () => {
    await mountChips({ field: { disabled: true }, root: { defaultValue: ['apple'] } });
    await fireEvent.mouseDown(byTestId('chips')!);
    await settle();
    expect(active()).not.toBe(input());
    expect(popup()).toBe(null);
  });

  test('a press on the chips of a read-only root gives the focus to the input and opens the popup', async () => {
    await mountChips({ root: { readonly: true, defaultValue: ['apple'] } });
    await fireEvent.mouseDown(byTestId('chips')!);
    expect(active()).toBe(input());
    await opened();
  });

  test('after the popup opens from a chip, ArrowLeft at the start of the input goes to the chip again', async () => {
    await mountChips({ root: { defaultValue: ['apple'] } });
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('apple'));
    await userEvent.keyboard('{ArrowDown}');
    await opened();
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('apple'));
  });
});

describe('the input group around the chips', () => {
  test('a press on a chip opens the popup once', async () => {
    const opens: boolean[] = [];
    await mountChips({
      layout: 'group',
      root: { defaultValue: ['apple'], onOpenChange: (open: boolean) => opens.push(open) },
    });
    await fireEvent.mouseDown(chip('apple'), { button: 0 });
    expect(opens).toEqual([true]);
  });

  test('with `openOnInputClick` false, a press on the group gives the focus to the input and opens nothing', async () => {
    await mountChips({
      layout: 'group',
      root: { openOnInputClick: false, defaultValue: ['apple'] },
    });
    await fireEvent.mouseDown(byTestId('group')!);
    expect(active()).toBe(input());
    await settle();
    expect(popup()).toBe(null);
  });

  test('a press on the group of a root in a disabled field gives the focus to nothing and opens nothing', async () => {
    await mountChips({
      layout: 'group',
      field: { disabled: true },
      root: { defaultValue: ['apple'] },
    });
    await fireEvent.mouseDown(byTestId('group')!);
    await settle();
    expect(active()).not.toBe(input());
    expect(popup()).toBe(null);
  });

  test('a press on the group of a read-only root gives the focus to the input and opens the popup', async () => {
    await mountChips({ layout: 'group', root: { readonly: true, defaultValue: ['apple'] } });
    await fireEvent.mouseDown(byTestId('group')!);
    expect(active()).toBe(input());
    await opened();
  });
});

describe('the input and the chips', () => {
  test('the chips of a disabled root: the input, the chip and the remove button are disabled, and Backspace removes nothing', async () => {
    await mountChips({
      layout: 'before',
      remove: {},
      root: { disabled: true, defaultValue: ['apple'] },
    });
    expect(input()).toBeDisabled();
    expect(chip('apple')).toHaveAttribute('data-disabled', '');
    expect(byTestId('remove-apple')).toBeDisabled();
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await settle();
    expect(byTestId('chip-apple')).not.toBe(null);
  });

  test('Backspace in the input of a read-only root removes nothing', async () => {
    const changes: unknown[] = [];
    await mountChips({
      root: recorded(changes, { readonly: true, defaultValue: ['apple', 'banana'] }),
    });
    expect(input()).toHaveAttribute('readonly');
    await userEvent.click(input());
    // WebKit goes back in the history for a real Backspace on a read-only input.
    input().dispatchEvent(new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true }));
    await settle();
    expect(changes).toEqual([]);
    expect(byTestId('chip-banana')).not.toBe(null);
  });

  test('ArrowLeft after the focus came back to the input goes to the last chip again', async () => {
    await mountChips({ root: { defaultValue: ['apple', 'banana', 'cherry'] } });
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}{ArrowLeft}');
    expect(active()).toBe(chip('banana'));
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('cherry'));
  });

  test('after a press from a chip back on the input, Backspace removes the last value', async () => {
    const changes: unknown[] = [];
    await mountChips({
      root: recorded(changes, {
        openOnInputClick: false,
        defaultValue: ['apple', 'banana', 'cherry'],
      }),
    });
    await userEvent.click(input());
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('cherry'));
    await userEvent.click(input());
    expect(active()).toBe(input());
    await userEvent.keyboard('{Backspace}');
    expect(changes).toEqual([['apple', 'banana']]);
  });

  test('after the focus leaves a chip and Tab comes back to the input, Backspace removes the last value', async () => {
    const changes: unknown[] = [];
    await mountChips({ root: recorded(changes, { defaultValue: ['apple', 'banana', 'cherry'] }) });
    byTestId('outside')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(input());
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('cherry'));
    // A press on a button does not focus it in WebKit, so the case then gives it the focus.
    await userEvent.click(byTestId('outside')!);
    expect(active()).not.toBe(chip('cherry'));
    byTestId('outside')!.focus();
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(input());
    await userEvent.keyboard('{Backspace}');
    expect(changes).toEqual([['apple', 'banana']]);
  });

  test('Tab from a chip goes to the input; then Backspace removes the last value, and ArrowLeft goes to the last chip', async () => {
    const changes: unknown[] = [];
    await mountChips({
      root: recorded(changes, { open: false, defaultValue: ['apple', 'banana', 'cherry'] }),
    });
    await userEvent.click(input());
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('cherry'));
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(input());
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(chip('cherry'));
    await userEvent.keyboard('{Tab}');
    expect(active()).toBe(input());
    await userEvent.keyboard('{Backspace}');
    expect(changes).toEqual([['apple', 'banana']]);
  });

  test('with no chip rendered, ArrowLeft keeps the focus on the input, and Backspace removes the last value', async () => {
    const changes: unknown[] = [];
    await mountChips({ chips: 0, root: recorded(changes, { defaultValue: ['apple', 'banana'] }) });
    expect(byTestId('chips')).toHaveTextContent('+2 selected');
    focusInputStart();
    await userEvent.keyboard('{ArrowLeft}');
    expect(active()).toBe(input());
    await userEvent.keyboard('{Backspace}');
    expect(changes).toEqual([['apple']]);
  });
});

describe('a remove button', () => {
  test('has the tab index -1', async () => {
    await mountChips({ remove: {}, root: { defaultValue: ['apple'] } });
    expect(byTestId('remove-apple')).toHaveAttribute('tabindex', '-1');
  });

  test('a press keeps the popup open and the focus on the input', async () => {
    await mountChips({ remove: {}, root: { defaultValue: ['apple'] } });
    await userEvent.click(input());
    await opened();
    await userEvent.click(byTestId('remove-apple')!);
    await settle();
    expect(popup()).not.toBe(null);
    expect(active()).toBe(input());
  });

  test('a press on a chip outside the popup keeps the popup open and the focus on the input in the popup', async () => {
    await mountChips({ layout: 'popup', remove: {}, root: { defaultValue: ['apple'] } });
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.click(byTestId('remove-apple')!);
    expect(byTestId('remove-apple')).toBe(null);
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(active()).toBe(input());
    expect(item('apple')).toHaveAttribute('aria-selected', 'false');
  });

  test.each([{ disabled: true }, { readonly: true }])(
    'a remove button that is not a native button, of a root with $0, removes nothing for a click and Enter',
    async (lock) => {
      const changes: unknown[] = [];
      await mountChips({
        remove: { as: 'div' },
        root: recorded(changes, { ...lock, defaultValue: ['apple'] }),
      });
      const remove = byTestId('remove-apple')!;
      remove.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
      remove.dispatchEvent(
        new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }),
      );
      await settle();
      expect(changes).toEqual([]);
    },
  );

  test('a removal keeps the highlight of another item, also of an item that the filter keeps when the removed value is out of the list', async () => {
    await mountChips({
      layout: 'before',
      remove: {},
      root: { defaultOpen: true, defaultValue: ['apple', 'banana'] },
    });
    await opened();
    await userEvent.hover(item('apple'));
    await waitFor(() => expect(item('apple')).toHaveAttribute('data-highlighted'));
    await fireEvent.click(byTestId('remove-banana')!);
    expect(item('apple')).toHaveAttribute('data-highlighted');
  });

  test('a removal of a value that the list does not show keeps the highlight of the shown item', async () => {
    await mountChips({
      layout: 'before',
      remove: {},
      items: ['banana'],
      root: { defaultOpen: true, defaultValue: ['apple', 'banana'] },
    });
    await opened();
    await userEvent.hover(item('banana'));
    await waitFor(() => expect(item('banana')).toHaveAttribute('data-highlighted'));
    await fireEvent.click(byTestId('remove-apple')!);
    expect(item('banana')).toHaveAttribute('data-highlighted');
  });

  test('a removal of the value of the highlighted item removes the highlight with the reason `pointer`', async () => {
    const reasons: string[] = [];
    await mountChips({
      layout: 'before',
      remove: {},
      root: highlights(reasons, { defaultOpen: true, defaultValue: ['apple'] }),
    });
    await opened();
    await fireEvent.pointerMove(item('apple'), { pointerType: 'mouse' });
    await waitFor(() => expect(item('apple')).toHaveAttribute('data-highlighted'));
    await fireEvent.click(byTestId('remove-apple')!);
    await nextTick();
    expect(item('apple')).not.toHaveAttribute('data-highlighted');
    expect(reasons.at(-1)).toBe('undefined pointer');
  });

  test('Delete on the chip of the highlighted item removes the highlight with the reason `keyboard`', async () => {
    const reasons: string[] = [];
    // The parent holds the popup open, so the focus of the chip closes nothing.
    await mountChips({
      layout: 'before',
      root: highlights(reasons, { open: true, defaultValue: ['apple', 'banana'] }),
    });
    await opened();
    await fireEvent.pointerMove(item('apple'), { pointerType: 'mouse' });
    await waitFor(() => expect(item('apple')).toHaveAttribute('data-highlighted'));
    chip('apple').focus();
    await userEvent.keyboard('{Delete}');
    await nextTick();
    expect(byTestId('chip-apple')).toBe(null);
    expect(item('apple')).not.toHaveAttribute('data-highlighted');
    expect(reasons.at(-1)).toBe('undefined keyboard');
  });
});

describe('the clear button', () => {
  test('of an Autocomplete empties the text and gives the focus to the input', async () => {
    mount(AutocompleteParts, { root: { defaultValue: 'fix' }, clear: true });
    await nextTick();
    expect(input().value).toBe('fix');
    await userEvent.click(byTestId('clear')!);
    expect(input().value).toBe('');
    expect(active()).toBe(input());
  });

  test('clears after a pointer move on the input', async () => {
    mount(ComboboxParts, { root: { defaultValue: 'Apple' }, clear: {} });
    await nextTick();
    await fireEvent.pointerMove(input(), { pointerType: 'mouse' });
    await userEvent.click(byTestId('clear')!);
    await waitFor(() => expect(byTestId('clear')).toBe(null));
  });

  test('a clear button outside the popup keeps the popup open and the focus on the input in the popup', async () => {
    mount(ComboboxParts, { inputInPopup: true, clear: {}, root: { defaultValue: 'Apple' } });
    await nextTick();
    await userEvent.click(byTestId('trigger')!);
    await opened();
    await waitFor(() => expect(active()).toBe(input()));
    await userEvent.click(byTestId('clear')!);
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(active()).toBe(input());
    expect(item('Apple')).toHaveAttribute('aria-selected', 'false');
  });

  test('a kept clear button in the popup has no `hidden` with a value; a press clears the value and keeps the popup open', async () => {
    mount(ComboboxParts, {
      inputInPopup: true,
      clearInPopup: true,
      clear: { keepMounted: true },
      root: { defaultValue: 'Apple' },
    });
    await nextTick();
    await userEvent.click(byTestId('trigger')!);
    await opened();
    // CSS selects a clear button with nothing to clear with `[hidden]`, so the button has no
    // `data-visible`.
    const clear = byTestId('clear')!;
    await waitFor(() => expect(clear).not.toHaveAttribute('hidden'));
    expect(clear).not.toHaveAttribute('data-visible');
    await userEvent.click(clear);
    await waitFor(() => expect(clear).toHaveAttribute('hidden'));
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(active()).toBe(input());
    expect(byTestId('trigger')).toHaveTextContent('Pick a fruit');
    expect(item('Apple')).toHaveAttribute('aria-selected', 'false');
  });
});
