import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxInForm from '../../test/fixtures/ComboboxInForm.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxStatic from '../../test/fixtures/ComboboxStatic.vue';
import { fireEvent } from '../../test/fireEvent';
import { clientCenter, holdPress } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');
const item = (name: string) => byTestId(`item-${name}`)!;

async function mountParts(props: Props = {}) {
  const result = mount(ComboboxParts, props);
  await nextTick();
  return result;
}

async function mountStatic(props: Props = {}) {
  const result = mount(ComboboxStatic, props);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(popup()).not.toBe(null));
  await waitFor(() => expect(byTestId('positioner')!.style.visibility).toBe(''));
}

async function closed() {
  await waitFor(() => expect(popup()).toBe(null));
}

/** The events of a press of a screen reader: a press with no `detail` and no buttons. */
async function pressWithScreenReader(element: Element) {
  const pointer = { pointerType: 'mouse', width: 1, height: 1, pressure: 0 };
  await fireEvent.pointerDown(element, { ...pointer, detail: 0, buttons: 0 });
  await fireEvent.mouseDown(element, { detail: 0 });
  await fireEvent.pointerUp(element, pointer);
  await fireEvent.mouseUp(element, { detail: 0 });
  await fireEvent.click(element, { detail: 0 });
}

describe('a trigger beside the input', () => {
  test('has the tab index -1 before and after a press on the input and on itself', async () => {
    await mountParts({ trigger: true });
    expect(trigger()).toHaveAttribute('tabindex', '-1');
    await userEvent.click(input());
    expect(trigger()).toHaveAttribute('tabindex', '-1');
    await userEvent.click(trigger());
    expect(trigger()).toHaveAttribute('tabindex', '-1');
  });

  test('has no role, `aria-required` or `aria-readonly`; the input has the state', async () => {
    await mountParts({ trigger: true, root: { required: true, readonly: true } });
    expect(trigger()).not.toHaveAttribute('role');
    expect(trigger()).not.toHaveAttribute('aria-required');
    expect(trigger()).not.toHaveAttribute('aria-readonly');
    expect(input()).toHaveAttribute('aria-required', 'true');
    expect(input()).toHaveAttribute('readonly');
  });

  test('a press of a screen reader opens the popup and keeps the focus on the input', async () => {
    await mountParts({ trigger: true });
    await pressWithScreenReader(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  test('a release after the trigger left the DOM changes no open state', async () => {
    const opens: string[] = [];
    const scene = reactive({ trigger: true });
    const props = reactive<Props>({
      trigger: true,
      scene,
      root: {
        onOpenChange: (open: boolean, details: { reason: string }) =>
          opens.push(`${open} ${details.reason}`),
      },
    });
    await mountParts(props);
    const { clientX, clientY } = clientCenter(trigger());
    await userEvent.pointer({ coords: { x: clientX, y: clientY }, keys: '[MouseLeft>]' });
    await opened();
    expect(opens).toEqual(['true trigger-press']);
    scene.trigger = false;
    await nextTick();
    expect(byTestId('trigger')).toBe(null);
    const away = document.getElementById('outside')!.getBoundingClientRect();
    await userEvent.pointer({ coords: { x: away.left + 5, y: away.top + 5 } });
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await settle();
    expect(opens).toEqual(['true trigger-press']);
  });
});

describe('a disabled trigger', () => {
  test('is disabled by its own prop, also in a root that is not disabled; by the root; and by a field', async () => {
    const first = await mountParts({ inputInPopup: true, root: { disabled: false } });
    expect(trigger()).not.toBeDisabled();
    first.unmount();
    const own = mount(ComboboxStatic, {
      inputInPopup: true,
      root: { disabled: false },
      trigger: { disabled: true },
    });
    await nextTick();
    expect(trigger()).toBeDisabled();
    await userEvent.click(trigger(), { force: true });
    await settle();
    expect(popup()).toBe(null);
    own.unmount();
    const root = await mountParts({ inputInPopup: true, root: { disabled: true } });
    expect(trigger()).toBeDisabled();
    root.unmount();
    mount(ComboboxInForm, { inputInPopup: true, field: { disabled: true } });
    await nextTick();
    expect(trigger()).toBeDisabled();
  });

  test('that is not a native button opens nothing for ArrowDown', async () => {
    const opens: boolean[] = [];
    await mountStatic({
      inputInPopup: true,
      trigger: { as: 'div', disabled: true },
      root: { onOpenChange: (open: boolean) => opens.push(open) },
    });
    trigger().dispatchEvent(
      new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true, cancelable: true }),
    );
    await settle();
    expect(opens).toEqual([]);
    expect(trigger()).toHaveAttribute('aria-disabled', 'true');
  });
});

describe('a read-only root', () => {
  test('gives the trigger `data-readonly` only while read-only, and `aria-readonly` while it is the control', async () => {
    const root = reactive<Props>({ readonly: true });
    await mountParts({ inputInPopup: true, root });
    expect(trigger()).toHaveAttribute('data-readonly', '');
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(trigger()).toHaveAttribute('aria-readonly', 'true');
    root.readonly = false;
    await nextTick();
    expect(trigger()).not.toHaveAttribute('data-readonly');
    expect(trigger()).not.toHaveAttribute('aria-readonly');
  });

  test('a press opens the popup, whose list has `aria-readonly`; a root that is not read-only opens too', async () => {
    const first = await mountParts({ inputInPopup: true, root: { readonly: true } });
    await userEvent.click(trigger());
    await opened();
    expect(byTestId('list')).toHaveAttribute('aria-readonly', 'true');
    first.unmount();
    await mountParts({ inputInPopup: true, root: { readonly: false } });
    await userEvent.click(trigger());
    await opened();
    expect(byTestId('list')).not.toHaveAttribute('aria-readonly');
  });

  test.each(['{ArrowDown}', '{ArrowUp}', '{Enter}', ' '])(
    '%s on the trigger opens the popup once',
    async (key) => {
      const opens: boolean[] = [];
      await mountParts({
        inputInPopup: true,
        root: { readonly: true, onOpenChange: (open: boolean) => opens.push(open) },
      });
      trigger().focus();
      await userEvent.keyboard(key);
      await opened();
      expect(opens).toEqual([true]);
    },
  );

  test('the typeahead of a closed trigger selects nothing', async () => {
    const changes: unknown[] = [];
    await mountStatic({
      inputInPopup: true,
      root: { readonly: true, onValueChange: (value: unknown) => changes.push(value) },
    });
    trigger().focus();
    await userEvent.keyboard('b');
    await settle();
    expect(changes).toEqual([]);
    expect(trigger()).toHaveAttribute('data-placeholder', '');
  });
});

describe('the trigger that is the control', () => {
  test('has `aria-required` while required; its ARIA attributes while closed and open', async () => {
    await mountParts({ inputInPopup: true, root: { required: true } });
    expect(trigger()).toHaveAttribute('aria-required', 'true');
    expect(trigger()).toHaveAttribute('tabindex', '0');
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).not.toHaveAttribute('aria-controls');
    await userEvent.click(trigger());
    await opened();
    expect(popup()).toHaveAttribute('role', 'dialog');
    expect(popup()!.id).not.toBe('');
    expect(trigger()).toHaveAttribute('tabindex', '0');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'dialog');
    expect(trigger()).toHaveAttribute('aria-controls', popup()!.id);
  });

  test('a press opens a popup whose `open` the parent holds, and the input in the popup gets the focus', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    await mountParts({ inputInPopup: true, root });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(input()));
    await settle();
    expect(document.activeElement).toBe(input());
  });

  test('a press of a screen reader opens the popup, as a key does', async () => {
    await mountParts({ inputInPopup: true });
    await pressWithScreenReader(trigger());
    await opened();
    await settle();
    expect(popup()).not.toBe(null);
    await waitFor(() => expect(document.activeElement).toBe(input()));
  });

  test.each([
    { name: 'the value of a Combobox', autocomplete: false, value: 'Apple' },
    { name: 'the text of an Autocomplete', autocomplete: true, value: 'fix' },
  ])('a blur validates $name', async ({ autocomplete, value }) => {
    const validated: unknown[] = [];
    const field = {
      validationMode: 'blur',
      validate: (current: unknown) => {
        validated.push(current);
        return null;
      },
    };
    if (autocomplete) {
      mount(AutocompleteParts, { inputInPopup: true, field, root: { defaultValue: value } });
    } else {
      mount(ComboboxInForm, { inputInPopup: true, field, root: { defaultValue: value } });
    }
    await nextTick();
    await fireEvent.focus(trigger());
    await fireEvent.blur(trigger());
    await settle();
    expect(validated).toContain(value);
  });
});

describe('the drag from the trigger', () => {
  test('a second touch on another item does not select twice', async () => {
    const changes: unknown[] = [];
    await mountStatic({
      inputInPopup: true,
      root: { onValueChange: (value: unknown) => changes.push(value) },
    });
    const { clientX, clientY } = clientCenter(trigger());
    await userEvent.pointer({ coords: { x: clientX, y: clientY }, keys: '[MouseLeft]' });
    await opened();
    await fireEvent.pointerMove(item('apple'), { pointerType: 'mouse' });
    await waitFor(() => expect(item('apple')).toHaveAttribute('data-highlighted'));
    await fireEvent.pointerDown(item('apple'), { pointerType: 'touch', isPrimary: true });
    await fireEvent.pointerDown(item('banana'), { pointerType: 'touch', isPrimary: false });
    await fireEvent.mouseUp(item('apple'));
    await fireEvent.click(item('apple'), { detail: 1 });
    await settle();
    expect(changes).toEqual(['apple']);
  });

  test('a later drag onto an item selects it, after a press on an item that the close cut', async () => {
    const changes: unknown[] = [];
    await mountParts({
      trigger: true,
      root: { onValueChange: (value: unknown) => changes.push(value) },
    });
    const { clientX, clientY } = clientCenter(trigger());
    await userEvent.pointer({ coords: { x: clientX, y: clientY }, keys: '[MouseLeft]' });
    await opened();
    await fireEvent.pointerDown(item('Apple'), { pointerType: 'touch', isPrimary: true });
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.pointer({ coords: { x: clientX, y: clientY }, keys: '[MouseLeft>]' });
    await opened();
    const target = clientCenter(item('Apple'));
    await userEvent.pointer({ coords: { x: target.clientX, y: target.clientY } });
    await waitFor(() => expect(item('Apple')).toHaveAttribute('data-highlighted'));
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    await closed();
    expect(changes).toEqual(['Apple']);
  });

  test.each([
    { name: 'the input in the popup', setup: { inputInPopup: true } },
    { name: 'the input outside', setup: { trigger: true } },
  ])(
    'with $name and an `open` that the parent holds, a drag to an item selects it; an open that the parent refuses selects nothing',
    async ({ setup }) => {
      const changes: unknown[] = [];
      const parent = { accepts: false };
      const root = reactive<Props>({
        open: false,
        onValueChange: (value: unknown) => changes.push(value),
      });
      root['onUpdate:open'] = (open: boolean) => {
        if (parent.accepts) root.open = open;
      };
      await mountParts({ ...setup, root });
      const refused = await holdPress(trigger());
      await refused.release({ x: refused.point.x, y: refused.point.y + 60 });
      await settle();
      expect(popup()).toBe(null);
      parent.accepts = true;
      const press = await holdPress(trigger());
      await opened();
      const target = clientCenter(item('Banana'));
      await press.release({ x: target.clientX, y: target.clientY });
      await closed();
      expect(changes).toEqual(['Banana']);
    },
  );

  test.each([
    { name: 'the input in the popup', setup: { inputInPopup: true } },
    { name: 'the input outside', setup: { trigger: true } },
  ])(
    'with $name, a press on the trigger of a popup that the parent keeps open starts no drag: its release outside asks for no close',
    async ({ setup }) => {
      const log: string[] = [];
      await mountParts({
        ...setup,
        root: {
          open: true,
          onOpenChange: (open: boolean, details: { reason: string }) =>
            log.push(`${open} ${details.reason}`),
        },
      });
      await opened();
      const press = await holdPress(trigger());
      await press.release({ x: 2, y: window.innerHeight - 2 });
      await settle();
      expect(log).toEqual(['false trigger-press']);
      expect(popup()).not.toBe(null);
    },
  );

  test('a release on an item with no move from the press point selects nothing', async () => {
    const changes: unknown[] = [];
    await mountStatic({
      inputInPopup: true,
      root: { onValueChange: (value: unknown) => changes.push(value) },
    });
    const point = clientCenter(trigger());
    const mouse = {
      pointerType: 'mouse',
      button: 0,
      buttons: 1,
      width: 1,
      height: 1,
      pressure: 0.5,
    };
    await fireEvent.pointerDown(trigger(), { ...mouse, ...point });
    await opened();
    await fireEvent.pointerUp(item('banana'), { ...mouse, buttons: 0, ...point });
    await settle();
    expect(changes).toEqual([]);
  });
});

describe('the typeahead of a closed trigger', () => {
  test('selects after the popup opened and closed, with `items`', async () => {
    await mountParts({ inputInPopup: true });
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    await userEvent.keyboard('b');
    await waitFor(() => expect(trigger()).toHaveTextContent('Banana'));
    expect(popup()).toBe(null);
  });

  test.each([false, true])(
    'with no `items`, goes on from the selected item after the popup opened and closed (keepMounted %s)',
    async (keepMounted) => {
      await mountStatic({
        inputInPopup: true,
        items: ['apple', 'apricot', 'banana'],
        portal: { keepMounted },
        root: { defaultValue: 'apple' },
      });
      await userEvent.click(trigger());
      await opened();
      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(document.activeElement).toBe(trigger()));
      await userEvent.keyboard('a');
      await waitFor(() => expect(trigger()).toHaveTextContent('apricot'));
    },
  );

  test('with no `items`, goes on from the selected item after a new order of the items while closed', async () => {
    const items = reactive(['apple', 'apricot', 'banana']);
    await mountStatic({ inputInPopup: true, items, root: { defaultValue: 'apple' } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    items.splice(0, 2, 'apricot', 'apple');
    await nextTick();
    await userEvent.keyboard('a');
    await waitFor(() => expect(trigger()).toHaveTextContent('apricot'));
  });

  test('matches only the labels of the mounted items', async () => {
    const items = reactive(['Apple', 'Banana', 'Blueberry']);
    await mountStatic({ inputInPopup: true, indexes: true, items });
    await userEvent.click(trigger());
    await opened();
    items.splice(1, 1);
    await waitFor(() => expect(byTestId('item-Banana')).toBe(null));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(trigger()));
    await userEvent.keyboard('b');
    await waitFor(() => expect(trigger()).toHaveTextContent('Blueberry'));
  });
});
