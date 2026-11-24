import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  SelectRootChangeEventDetails,
  SelectRootOpenChangeEventDetails,
} from '@vase-ui/vue/select';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { clientCenter, holdPress, penDrag, touchDrag } from '../../test/pointer';
import { mount, settle } from '../../test/render';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const item = (value: string) => byTestId(`item-${value}`);
const valueText = () => byTestId('value').textContent;
const shown = (element: HTMLElement | null) => !!element?.checkVisibility();

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  await waitFor(() => expect(byTestId('positioner').style.visibility).toBe(''));
}

function centerOf(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
}

/** A press of the main button at the middle of `element`, which can be disabled. */
async function pressAt(element: Element) {
  await userEvent.pointer({ coords: centerOf(element), keys: '[MouseLeft]' });
}

/** Presses the main button on the trigger, moves to `target` and releases it there. */
async function dragFromTrigger(target: () => Element) {
  await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
  await opened();
  await userEvent.pointer({ coords: centerOf(target()) });
  await userEvent.pointer({ coords: centerOf(target()), keys: '[/MouseLeft]' });
}

/** Items that count the `click` events of the developer listener on each. */
function countedItems(clicks: Record<string, number>, disabled: string[] = []) {
  return ['apple', 'banana', 'cherry'].map((value) => {
    clicks[value] = 0;
    return {
      value,
      text: value,
      disabled: disabled.includes(value),
      attrs: { onClick: () => (clicks[value]! += 1) },
    };
  });
}

describe('a press of an item', () => {
  test('a press of a disabled item selects nothing, and the popup stays open', async () => {
    const changes: unknown[] = [];
    await mountSelect({
      root: { defaultOpen: true, onValueChange: (value: unknown) => changes.push(value) },
      items: [
        { value: 'apple', text: 'Apple' },
        { value: 'banana', text: 'Banana', disabled: true },
      ],
    });
    await opened();
    await pressAt(item('banana'));
    await wait(50);
    expect(changes).toEqual([]);
    expect(valueText()).toBe('');
    expect(shown(popup())).toBe(true);
  });

  test('the items of a disabled root have aria-disabled, and a press calls no click listener and selects nothing', async () => {
    const clicks: Record<string, number> = {};
    await mountSelect({ root: { open: true, disabled: true }, items: countedItems(clicks) });
    await opened();
    expect(item('apple')).toHaveAttribute('aria-disabled', 'true');
    await pressAt(item('apple'));
    expect(clicks.apple).toBe(0);
    expect(valueText()).toBe('');
  });

  test('a press 500 ms after the open calls the click listener of the item once, and selects it', async () => {
    const clicks: Record<string, number> = {};
    await mountSelect({ items: countedItems(clicks) });
    await userEvent.click(trigger());
    await opened();
    await wait(500);
    await userEvent.click(item('banana'));
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(clicks).toEqual({ apple: 0, banana: 1, cherry: 0 });
    expect(valueText()).toBe('banana');
  });

  test('with highlightItemOnHover false, a press selects an item that has no highlight', async () => {
    await mountSelect({ root: { defaultOpen: true, highlightItemOnHover: false } });
    await opened();
    await userEvent.click(item('cherry'));
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(valueText()).toBe('cherry');
  });

  test('a press after a typeahead that ends with Space selects the item', async () => {
    await mountSelect({
      root: { defaultOpen: true },
      items: [
        { value: 'one', text: 'Item One' },
        { value: 'two', text: 'Item Two' },
      ],
    });
    await opened();
    item('one').focus();
    await userEvent.keyboard('item t ');
    await waitFor(() => expect(document.activeElement).toBe(item('two')));
    expect(valueText()).toBe('');
    await userEvent.click(item('two'));
    await waitFor(() => expect(valueText()).toBe('two'));
  });

  test('a cancel of the value keeps the value, and a cancel of the close of `item-press` keeps the popup open', async () => {
    await mountSelect({
      root: {
        defaultOpen: true,
        onValueChange: (_: unknown, details: SelectRootChangeEventDetails) => details.cancel(),
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) => {
          if (!open && details.reason === 'item-press') details.cancel();
        },
      },
    });
    await opened();
    await userEvent.click(item('apple'));
    await wait(50);
    expect(valueText()).toBe('');
    expect(shown(popup())).toBe(true);
  });
});

describe('a drag from the trigger', () => {
  test('to an item calls its click listener once and selects it', async () => {
    const clicks: Record<string, number> = {};
    await mountSelect({ items: countedItems(clicks) });
    await dragFromTrigger(() => item('cherry'));
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(valueText()).toBe('cherry');
    expect(clicks).toEqual({ apple: 0, banana: 0, cherry: 1 });
  });

  test('to a disabled item calls no click listener and selects nothing; the popup stays open', async () => {
    const clicks: Record<string, number> = {};
    const changes: unknown[] = [];
    await mountSelect({
      root: { onValueChange: (value: unknown) => changes.push(value) },
      items: countedItems(clicks, ['cherry']),
    });
    await dragFromTrigger(() => item('cherry'));
    await wait(50);
    expect(clicks.cherry).toBe(0);
    expect(changes).toEqual([]);
    expect(shown(popup())).toBe(true);
  });

  test('with highlightItemOnHover false selects the item', async () => {
    await mountSelect({ root: { highlightItemOnHover: false } });
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
    await opened();
    await userEvent.pointer({ coords: centerOf(item('banana')) });
    expect(item('banana')).not.toHaveAttribute('data-highlighted');
    await userEvent.pointer({ coords: centerOf(item('banana')), keys: '[/MouseLeft]' });
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(valueText()).toBe('banana');
  });

  test('in a multiple select selects the item and keeps the popup open; the item has the focus, and ArrowDown goes on from it', async () => {
    await mountSelect({ root: { multiple: true } });
    await dragFromTrigger(() => item('apricot'));
    await waitFor(() => expect(item('apricot')).toHaveAttribute('aria-selected', 'true'));
    expect(shown(popup())).toBe(true);
    await waitFor(() => expect(document.activeElement).toBe(item('apricot')));
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(item('banana')));
  });
});

describe('the controlled open state', () => {
  test('a drag from the trigger to an item selects it while the parent holds `open`; an open that the parent refuses selects nothing', async () => {
    const changes: unknown[] = [];
    const parent = { accepts: false };
    const root = reactive<Props>({
      open: false,
      onValueChange: (value: unknown) => changes.push(value),
    });
    root['onUpdate:open'] = (open: boolean) => {
      if (parent.accepts) root.open = open;
    };
    await mountSelect({ root });
    const refused = await holdPress(trigger());
    await refused.release({ x: refused.point.x, y: refused.point.y + 60 });
    await settle();
    expect(shown(popup())).toBe(false);
    // The trigger takes the focus as a button does.
    const webkitOnMac = server.browser === 'webkit' && server.platform === 'darwin';
    expect(document.activeElement).toBe(webkitOnMac ? document.body : trigger());
    parent.accepts = true;
    await dragFromTrigger(() => item('cherry'));
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(changes).toEqual(['cherry']);
  });

  test('a press opens the popup that the parent holds, and the popup keeps the focus', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    await mountSelect({ root });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(popup()));
    await settle();
    expect(document.activeElement).toBe(popup());
  });

  test('a press closes the popup that the parent holds, and the trigger keeps the focus', async () => {
    const root = reactive<Props>({ open: false });
    root['onUpdate:open'] = (open: boolean) => (root.open = open);
    await mountSelect({ root });
    await userEvent.click(trigger());
    await opened();
    await waitFor(() => expect(document.activeElement).toBe(popup()));
    await pressAt(trigger());
    await waitFor(() => expect(shown(popup())).toBe(false));
    await settle();
    expect(document.activeElement).toBe(trigger());
  });

  test('the popup follows `open`; a close request with `open` true emits openChange and keeps the popup', async () => {
    const log: string[] = [];
    const root = reactive<Props>({
      open: true,
      onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) =>
        log.push(`${open} ${details.reason}`),
    });
    await mountSelect({ root });
    await opened();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(log).toEqual(['false escape-key']));
    expect(shown(popup())).toBe(true);
    root.open = false;
    await waitFor(() => expect(shown(popup())).toBe(false));
    expect(trigger()).toHaveAttribute('aria-expanded', 'false');
  });

  test('`defaultOpen` with `open` false does not open', async () => {
    await mountSelect({ root: { defaultOpen: true, open: false } });
    trigger().focus();
    await waitFor(() => expect(popup()).not.toBe(null));
    await wait(50);
    expect(shown(popup())).toBe(false);
  });

  test('`close()` closes with `imperative-action`; a cancel keeps the popup; with the popup closed it emits nothing', async () => {
    const log: string[] = [];
    let cancel = true;
    const { exposed } = await mountSelect({
      root: {
        defaultOpen: true,
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) => {
          log.push(`${open} ${details.reason}`);
          if (cancel) details.cancel();
        },
      },
    });
    await opened();
    exposed.root.close();
    await nextTick();
    expect(log).toEqual(['false imperative-action']);
    expect(shown(popup())).toBe(true);
    cancel = false;
    exposed.root.close();
    await waitFor(() => expect(shown(popup())).toBe(false));
    exposed.root.close();
    await nextTick();
    expect(log).toEqual(['false imperative-action', 'false imperative-action']);
  });

  test('`close()` after a cancelled open emits nothing', async () => {
    const log: string[] = [];
    const { exposed } = await mountSelect({
      root: {
        open: false,
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) => {
          log.push(`${open} ${details.reason}`);
          if (open) details.cancel();
        },
      },
    });
    await userEvent.click(trigger());
    expect(log).toEqual(['true trigger-press']);
    exposed.root.close();
    await nextTick();
    expect(log).toEqual(['true trigger-press']);
  });

  test('a cancel of the close of Escape keeps the popup open and its highlight', async () => {
    await mountSelect({
      root: {
        onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) => {
          if (!open) details.cancel();
        },
      },
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(document.activeElement).toBe(item('apple')));
    await userEvent.keyboard('{Escape}');
    await wait(50);
    expect(shown(popup())).toBe(true);
    expect(document.activeElement).toBe(item('apple'));
    expect(item('apple')).toHaveAttribute('data-highlighted', '');
  });

  test('the popup with no Select.List has no `aria-orientation`; with `modal` false the page has no backdrop', async () => {
    await mountSelect({ root: { defaultOpen: true, modal: false } });
    await opened();
    expect(popup()).not.toHaveAttribute('aria-orientation');
    expect(document.querySelector('body > div[role="presentation"]:not([data-testid])')).toBe(null);
  });

  test('a custom `id` of the popup is the id that the trigger names', async () => {
    await mountSelect({ popup: { id: 'fruits' }, root: { defaultOpen: true } });
    await opened();
    expect(popup().id).toBe('fruits');
    expect(trigger()).toHaveAttribute('aria-controls', 'fruits');
  });
});

describe('the focus ring', () => {
  const ringed = (element: Element) => element.matches(':focus-visible');

  async function tabTo(element: Element) {
    document.getElementById('before')!.focus();
    for (let tabs = 0; tabs < 4 && document.activeElement !== element; tabs += 1) {
      await userEvent.keyboard('{Tab}');
    }
    expect(document.activeElement).toBe(element);
  }

  async function focused(element: Element) {
    await waitFor(() => expect(document.activeElement).toBe(element));
  }

  test.each([
    { from: 'the trigger', target: () => trigger() },
    { from: 'a button that is not the trigger', target: () => document.getElementById('outside')! },
  ])(
    'a press on the trigger after Tab to $from gives the selected item and each item under the pointer no ring, and an arrow key gives the next item the ring',
    async ({ target }) => {
      await mountSelect({ root: { defaultValue: 'banana' } });
      await tabTo(target());
      await pressAt(trigger());
      await opened();
      await focused(item('banana'));
      expect(ringed(item('banana'))).toBe(false);
      for (const value of ['cherry', 'apple']) {
        await userEvent.pointer({ coords: centerOf(item(value)) });
        await focused(item(value));
        expect(ringed(item(value))).toBe(false);
      }
      await userEvent.keyboard('{ArrowDown}');
      await focused(item('apricot'));
      expect(ringed(item('apricot'))).toBe(true);
    },
  );

  test('an arrow key after a press on an item of a multiple select that stays open gives the next item the ring', async () => {
    await mountSelect({ root: { multiple: true } });
    await tabTo(trigger());
    await pressAt(trigger());
    await opened();
    await pressAt(item('apricot'));
    await focused(item('apricot'));
    await userEvent.keyboard('{ArrowDown}');
    await focused(item('banana'));
    expect(ringed(item('banana'))).toBe(true);
  });

  test('an open with a key gives the selected item the ring, and a hover takes it away', async () => {
    await mountSelect({ root: { defaultValue: 'banana' } });
    await tabTo(trigger());
    await userEvent.keyboard('{Enter}');
    await opened();
    await focused(item('banana'));
    expect(ringed(item('banana'))).toBe(true);
    await userEvent.pointer({ coords: centerOf(item('cherry')) });
    await focused(item('cherry'));
    expect(ringed(item('cherry'))).toBe(false);
  });

  test('the close gives the trigger the focus with no ring after a press on an item, and with the ring after Escape', async () => {
    await mountSelect({ root: { defaultValue: 'banana' } });
    await tabTo(document.getElementById('outside')!);
    await pressAt(trigger());
    await opened();
    await pressAt(item('cherry'));
    await waitFor(() => expect(shown(popup())).toBe(false));
    await focused(trigger());
    expect(ringed(trigger())).toBe(false);
    await userEvent.keyboard('{Enter}');
    await opened();
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(shown(popup())).toBe(false));
    await focused(trigger());
    expect(ringed(trigger())).toBe(true);
  });

  test('a press on the trigger that closes the popup gives the trigger the focus with no ring', async () => {
    await mountSelect({ root: { defaultValue: 'banana' } });
    await tabTo(document.getElementById('outside')!);
    await pressAt(trigger());
    await opened();
    await pressAt(trigger());
    await waitFor(() => expect(shown(popup())).toBe(false));
    await focused(trigger());
    expect(ringed(trigger())).toBe(false);
  });

  test.skipIf(server.browser !== 'chromium').each(['touch', 'pen'] as const)(
    'a %s open gives the selected item no ring',
    async (type) => {
      await mountSelect({ root: { defaultValue: 'banana' } });
      await tabTo(trigger());
      const point = centerOf(trigger());
      await (type === 'touch' ? touchDrag(point, point, 0) : penDrag(point, point, 0));
      await opened();
      await focused(item('banana'));
      expect(ringed(item('banana'))).toBe(false);
    },
  );

  test('a release on an item that the pointer did not highlight gives it the focus with no ring', async () => {
    await mountSelect({ root: { multiple: true, highlightItemOnHover: false } });
    await tabTo(trigger());
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
    await opened();
    await userEvent.pointer({ coords: centerOf(item('apricot')) });
    await userEvent.pointer({ coords: centerOf(item('apricot')), keys: '[/MouseLeft]' });
    await waitFor(() => expect(item('apricot')).toHaveAttribute('aria-selected', 'true'));
    await focused(item('apricot'));
    expect(ringed(item('apricot'))).toBe(false);
  });
});
