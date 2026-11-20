import { describe, expect, test } from 'vitest';
import { server, userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import type {
  SelectRootChangeEventDetails,
  SelectRootOpenChangeEventDetails,
} from '@vase-ui/vue/select';
import SelectArrowsInTransition from '../../test/fixtures/SelectArrowsInTransition.vue';
import SelectInPopover from '../../test/fixtures/SelectInPopover.vue';
import SelectInTransition from '../../test/fixtures/SelectInTransition.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { clientCenter, touchDrag } from '../../test/pointer';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { wait } from '../../test/wait';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`)!;
const trigger = () => byTestId('trigger');
const popup = () => byTestId('popup');
const item = (value: string) => byTestId(`item-${value}`);
const valueText = () => byTestId('value').textContent;

/** A popup that covers the trigger: the trigger has the room for it above and below. */
const aligned = { positioner: {}, trigger: { style: 'margin-top: 200px' } };

async function mountSelect(setup: Props = {}) {
  const result = mount(SelectParts, setup);
  await nextTick();
  return result;
}

const shown = (element: HTMLElement | null) => !!element?.checkVisibility();

async function opened() {
  await waitFor(() => expect(shown(popup())).toBe(true));
  await waitFor(() => expect(byTestId('positioner').style.visibility).toBe(''));
  return popup();
}

async function closed() {
  await waitFor(() => expect(shown(popup())).toBe(false));
}

async function focused(element: () => Element | null) {
  await waitFor(() => expect(document.activeElement).toBe(element()));
}

function centerOf(element: Element) {
  const { clientX, clientY } = clientCenter(element);
  return { x: clientX, y: clientY };
}

/** Presses the main button of the real mouse at `from`, and releases it at `to`. */
async function pressAndRelease(from: { x: number; y: number }, to: { x: number; y: number }) {
  await userEvent.pointer({ coords: from, keys: '[MouseLeft>]' });
  await userEvent.pointer({ coords: to });
  await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
}

/** Props of a root that write each event in `log`. */
function rootEvents(log: string[], props: Props = {}) {
  return reactive<Props>({
    ...props,
    onValueChange: (value: unknown, details: SelectRootChangeEventDetails) =>
      log.push(`valueChange ${JSON.stringify(value)} ${details.reason}`),
    'onUpdate:modelValue': (value: unknown) => log.push(`update ${JSON.stringify(value)}`),
    onOpenChange: (open: boolean, details: SelectRootOpenChangeEventDetails) =>
      log.push(`openChange ${open} ${details.reason}`),
    'onUpdate:open': (open: boolean) => log.push(`update:open ${open}`),
  });
}

describe('the parts', () => {
  test('render their elements and roles; a template ref has element, inputElement and close()', async () => {
    const { exposed } = await mountSelect({
      label: {},
      list: {},
      arrow: {},
      root: { defaultOpen: true, defaultValue: 'banana', name: 'fruit' },
    });
    await opened();
    const root = byTestId('root');
    expect(root.localName).toBe('div');
    expect(exposed.root.element).toBe(root);
    expect(exposed.root.inputElement).toBe(root.querySelector('input[aria-hidden="true"]'));
    expect(root.lastElementChild).toHaveAttribute('type', 'hidden');
    expect(trigger().localName).toBe('button');
    expect(trigger()).toHaveAttribute('type', 'button');
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(trigger()).toHaveAttribute('aria-haspopup', 'listbox');
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', byTestId('list').id);
    expect(trigger()).toHaveAttribute('aria-labelledby', byTestId('label').id);
    expect(byTestId('value').localName).toBe('span');
    expect(popup()).toHaveAttribute('role', 'presentation');
    expect(byTestId('list')).toHaveAttribute('role', 'listbox');
    expect(item('banana')).toHaveAttribute('role', 'option');
    expect(item('banana')).toHaveAttribute('aria-selected', 'true');
    expect(item('apple')).toHaveAttribute('aria-selected', 'false');
    expect(byTestId('arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(byTestId('positioner').parentElement).toBe(document.body);
    exposed.root.close();
    await closed();
  });

  test('the popup is the listbox with no Select.List', async () => {
    await mountSelect({ root: { defaultOpen: true, multiple: true, readonly: true } });
    await opened();
    expect(popup()).toHaveAttribute('role', 'listbox');
    expect(popup()).toHaveAttribute('aria-multiselectable', 'true');
    expect(popup()).toHaveAttribute('aria-readonly', 'true');
    expect(trigger()).toHaveAttribute('aria-controls', popup().id);
    expect(trigger()).toHaveAttribute('aria-readonly', 'true');
  });

  test('VUE-73: aria-controls of the open trigger follows the id of the popup', async () => {
    const popupProps = reactive<Props>({ id: 'first' });
    await mountSelect({ popup: popupProps });
    expect(trigger()).not.toHaveAttribute('aria-controls');
    await userEvent.click(trigger());
    await opened();
    expect(trigger()).toHaveAttribute('aria-controls', 'first');
    popupProps.id = 'second';
    await nextTick();
    expect(trigger()).toHaveAttribute('aria-controls', 'second');
  });

  test('a Select.List that leaves gives the listbox back to the popup, and a popup that leaves is no longer named', async () => {
    const show = reactive({ list: true, popup: true });
    await mountSelect({ list: {}, show, root: { defaultOpen: true } });
    await opened();
    expect(trigger()).toHaveAttribute('aria-controls', byTestId('list').id);
    show.list = false;
    await nextTick();
    expect(popup()).toHaveAttribute('role', 'listbox');
    expect(trigger()).toHaveAttribute('aria-controls', popup().id);
    show.popup = false;
    await nextTick();
    expect(trigger()).toHaveAttribute('aria-expanded', 'true');
    expect(trigger()).not.toHaveAttribute('aria-controls');
  });

  test('render the tag of `as`', async () => {
    await mountSelect({ root: { as: 'section' }, trigger: { as: 'span' }, value: { as: 'b' } });
    expect(byTestId('root').localName).toBe('section');
    expect(trigger().localName).toBe('span');
    expect(trigger()).toHaveAttribute('role', 'combobox');
    expect(trigger()).toHaveAttribute('tabindex', '0');
    expect(byTestId('value').localName).toBe('b');
  });

  test('a part with no root throws an error that names it', () => {
    expect(String(mountError(SelectInTransition, { noRoot: true }))).toContain(
      '<Select.Trigger> must be inside <Select.Root>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});

describe('VUE-95: the content stays', () => {
  test('the portal renders nothing until the trigger gets the focus; then the closed popup stays, hidden and inert, with no tab stop', async () => {
    await mountSelect();
    expect(popup()).toBe(null);
    trigger().focus();
    await waitFor(() => expect(popup()).not.toBe(null));
    expect(shown(popup())).toBe(false);
    expect(popup()).toHaveAttribute('inert');
    expect(popup()).not.toHaveAttribute('hidden');
    await userEvent.keyboard('{Tab}');
    expect(document.activeElement).toBe(document.getElementById('after'));
  });

  test('a key on a trigger that never had a popup selects the next item whose text starts with it', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    trigger().focus();
    await userEvent.keyboard('b');
    expect(valueText()).toBe('banana');
    expect(log).toEqual(['valueChange "banana" none', 'update "banana"']);
    expect(shown(popup())).toBe(false);
  });

  test('the popup element and the items stay the same elements after a close', async () => {
    await mountSelect();
    await userEvent.click(trigger());
    const first = await opened();
    const apple = item('apple');
    await userEvent.keyboard('{Escape}');
    await closed();
    await userEvent.click(trigger());
    expect(await opened()).toBe(first);
    expect(item('apple')).toBe(apple);
  });
});

describe('animation', () => {
  test('a <Transition> around the popup runs the enter and the leave, with one after-enter and one after-leave for each open and close', async () => {
    const log: string[] = [];
    mount(SelectInTransition, { log: { add: (entry: string) => log.push(entry) } });
    await nextTick();
    // The first open by a mouse press mounts the content: the button has no focus at `pointerdown`.
    await userEvent.click(byTestId('trigger'));
    await waitFor(() => expect(log).toEqual(['before-enter', 'after-enter']));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(log).toContain('after-leave'));
    expect(shown(popup())).toBe(false);
    await userEvent.click(byTestId('trigger'));
    await waitFor(() =>
      expect(log).toEqual([
        'before-enter',
        'after-enter',
        'before-leave',
        'after-leave',
        'before-enter',
        'after-enter',
      ]),
    );
  });

  test('defaultOpen has the enter', async () => {
    const log: string[] = [];
    mount(SelectInTransition, {
      root: { defaultOpen: true },
      log: { add: (entry: string) => log.push(entry) },
    });
    await waitFor(() => expect(log).toEqual(['before-enter', 'after-enter']));
  });

  test('a <Transition> around the backdrop runs its enter and its leave; the closed backdrop is hidden and inert, and a press on it closes the popup', async () => {
    const log: string[] = [];
    mount(SelectInTransition, { backdrop: true, log: { add: (entry: string) => log.push(entry) } });
    await nextTick();
    await userEvent.click(byTestId('trigger'));
    await waitFor(() => expect(log).toContain('backdrop after-enter'));
    const backdrop = byTestId('backdrop');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).not.toHaveAttribute('inert');
    expect(document.elementFromPoint(2, 2)).toBe(backdrop);
    await userEvent.pointer({ coords: { x: 2, y: 2 }, keys: '[MouseLeft]' });
    await waitFor(() => expect(log).toContain('backdrop after-leave'));
    expect(shown(backdrop)).toBe(false);
    expect(backdrop).toHaveAttribute('inert');
    await closed();
  });

  test('a popup with display: flex from a class does not show while closed', async () => {
    mount(SelectInTransition, { popup: { class: 'flex' } });
    byTestId('trigger').focus();
    await waitFor(() => expect(popup()).not.toBe(null));
    expect(getComputedStyle(popup()).display).toBe('none');
  });
});

describe('the value', () => {
  test('a press of an item selects it and closes the popup', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item('cherry'));
    await closed();
    expect(log).toEqual([
      'openChange true trigger-press',
      'update:open true',
      'valueChange "cherry" item-press',
      'update "cherry"',
      'openChange false item-press',
      'update:open false',
    ]);
    expect(valueText()).toBe('cherry');
  });

  test('VUE-91: a press of the selected item emits no valueChange and closes the popup', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log, { defaultValue: 'banana', defaultOpen: true }) });
    await opened();
    await userEvent.click(item('banana'));
    await closed();
    expect(log).toEqual(['openChange false item-press', 'update:open false']);
  });

  test('a cancelled change keeps the value, and the popup still closes', async () => {
    await mountSelect({
      root: {
        defaultOpen: true,
        onValueChange: (_: unknown, d: SelectRootChangeEventDetails) => d.cancel(),
      },
    });
    await opened();
    await userEvent.click(item('apple'));
    await closed();
    expect(byTestId('value').textContent).toBe('');
  });

  test('a controlled root shows the value of the parent', async () => {
    const props = reactive<Props>({ modelValue: 'apple', defaultOpen: true });
    await mountSelect({ root: props });
    await opened();
    await userEvent.click(item('cherry'));
    expect(valueText()).toBe('apple');
    props.modelValue = 'banana';
    await nextTick();
    expect(valueText()).toBe('banana');
  });

  test('with multiple, a press adds or removes the value, and the popup stays open', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log, { multiple: true, defaultOpen: true }) });
    await opened();
    await userEvent.click(item('apple'));
    await userEvent.click(item('cherry'));
    await userEvent.click(item('apple'));
    expect(shown(popup())).toBe(true);
    expect(valueText()).toBe('cherry');
    expect(log.filter((entry) => entry.startsWith('update '))).toEqual([
      'update ["apple"]',
      'update ["apple","cherry"]',
      'update ["cherry"]',
    ]);
  });

  test('VUE-115: with multiple, a null model is the empty array, and the root stays controlled', async () => {
    const log: string[] = [];
    await mountSelect({
      root: rootEvents(log, { multiple: true, modelValue: null, defaultOpen: true }),
    });
    await opened();
    await userEvent.click(item('apple'));
    expect(log).toEqual(['valueChange ["apple"] item-press', 'update ["apple"]']);
    expect(valueText()).toBe('');
    expect(item('apple')).toHaveAttribute('aria-selected', 'false');
  });

  test.each([
    { name: 'disabled', root: { disabled: true } },
    { name: 'readonly', root: { readonly: true } },
  ])('a $name root that the parent holds open changes no value', async ({ root }) => {
    await mountSelect({ root: { ...root, open: true, defaultValue: 'apple' } });
    await opened();
    item('cherry').click();
    await nextTick();
    expect(valueText()).toBe('apple');
  });

  test('isItemEqualToValue selects an object value that is another object', async () => {
    await mountSelect({
      root: {
        defaultValue: { id: 2 },
        defaultOpen: true,
        isItemEqualToValue: (a: { id: number }, b: { id: number }) => a.id === b.id,
        itemToStringLabel: (value: { id: number }) => `#${value.id}`,
      },
      items: [
        { value: { id: 1 }, text: 'One' },
        { value: { id: 2 }, text: 'Two' },
      ],
    });
    await opened();
    expect(valueText()).toBe('#2');
    const items = popup().querySelectorAll('[role="option"]');
    expect(items[1]).toHaveAttribute('aria-selected', 'true');
  });
});

describe('Select.Value', () => {
  test.each([
    {
      name: 'a record of items',
      root: { defaultValue: 'apple', items: { apple: 'Red apple' } },
      text: 'Red apple',
    },
    {
      name: 'an array of items',
      root: { defaultValue: 'apple', items: [{ value: 'apple', label: 'Green apple' }] },
      text: 'Green apple',
    },
    {
      name: 'groups of items',
      root: {
        defaultValue: 'apple',
        items: [{ items: [{ value: 'apple', label: 'In a group' }] }],
      },
      text: 'In a group',
    },
    {
      name: 'the label of an object',
      root: { defaultValue: { value: 1, label: 'One' } },
      text: 'One',
    },
    { name: 'the value as text', root: { defaultValue: 'plain' }, text: 'plain' },
    {
      name: 'labels of multiple',
      root: { multiple: true, defaultValue: ['a', 'b'] },
      text: 'a, b',
    },
    { name: 'the placeholder', root: {}, value: { placeholder: 'Pick' }, text: 'Pick' },
    {
      name: 'the label of null over the placeholder',
      root: { items: { null: 'None' } },
      value: { placeholder: 'Pick' },
      text: 'None',
    },
  ])('shows $name', async ({ root, value, text }) => {
    await mountSelect({ root, value });
    expect(valueText()).toBe(text);
  });

  test('a value with an empty form text is a placeholder', async () => {
    await mountSelect({ root: { defaultValue: { id: 1 }, itemToStringValue: () => '' } });
    expect(trigger()).toHaveAttribute('data-placeholder', '');
    expect(byTestId('value')).toHaveAttribute('data-placeholder', '');
  });

  test('VUE-52: follows a key that the parent adds in place to a reactive items record', async () => {
    const items = reactive<Record<string, string>>({});
    await mountSelect({ root: { defaultValue: 'kiwi', items } });
    expect(valueText()).toBe('kiwi');
    items.kiwi = 'Green kiwi';
    await nextTick();
    expect(valueText()).toBe('Green kiwi');
  });
});

describe('the trigger', () => {
  test('a mouse press opens the popup at pointerdown, and a second press closes it', async () => {
    await mountSelect();
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
    await opened();
    expect(trigger()).toHaveAttribute('data-pressed', '');
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[/MouseLeft]' });
    expect(shown(popup())).toBe(true);
    await userEvent.click(trigger());
    await closed();
  });

  test.each([
    { key: '{ArrowDown}', first: 'apple' },
    { key: '{ArrowUp}', first: 'cherry' },
    { key: '{Enter}', first: 'apple' },
    { key: ' ', first: 'apple' },
  ])('$key opens the popup and highlights the first or the last item', async ({ key, first }) => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    trigger().focus();
    await userEvent.keyboard(key);
    await opened();
    await focused(() => item(first));
    expect(item(first)).toHaveAttribute('data-highlighted', '');
  });

  test('a disabled select does not open; a read-only one opens', async () => {
    const props = reactive<Props>({ disabled: true });
    await mountSelect({ root: props });
    expect(trigger()).toBeDisabled();
    props.disabled = false;
    props.readonly = true;
    await nextTick();
    await userEvent.click(trigger());
    await opened();
  });

  test('a disabled trigger with another tag leaves the tab order', async () => {
    await mountSelect({ trigger: { as: 'div', disabled: true } });
    expect(trigger()).toHaveAttribute('tabindex', '-1');
    expect(trigger()).toHaveAttribute('aria-disabled', 'true');
  });

  test('has the state attributes of the value and the side of the popup', async () => {
    await mountSelect({ root: { required: true } });
    expect(trigger()).toHaveAttribute('aria-required', 'true');
    expect(trigger()).toHaveAttribute('data-placeholder', '');
    expect(trigger()).not.toHaveAttribute('data-popup-side');
    await userEvent.click(trigger());
    await opened();
    expect(trigger()).toHaveAttribute('data-popup-side', 'bottom');
  });

  test('closes an aligned popup when the focus comes to the trigger', async () => {
    const log: string[] = [];
    await mountSelect({ ...aligned, root: rootEvents(log, { defaultValue: 'banana' }) });
    await userEvent.click(trigger());
    await opened();
    trigger().focus();
    await closed();
    expect(log.at(-2)).toBe('openChange false none');
  });
});

describe('keys on the closed trigger', () => {
  test('select the next item whose text starts with the typed text, and skip a disabled item', async () => {
    await mountSelect({
      items: [
        { value: 'apple', text: 'Apple' },
        { value: 'avocado', text: 'Avocado', disabled: true },
        { value: 'apricot', text: 'Apricot' },
        { value: 'banana', text: 'Banana' },
      ],
    });
    trigger().focus();
    await waitFor(() => expect(item('apple')).not.toBe(null));
    await userEvent.keyboard('a');
    expect(valueText()).toBe('apple');
    await userEvent.keyboard('a');
    expect(valueText()).toBe('apricot');
  });

  test('do nothing with multiple, in a read-only select, or for the value that it has', async () => {
    const log: string[] = [];
    const props = reactive<Props>({ ...rootEvents(log), multiple: true });
    await mountSelect({ root: props });
    trigger().focus();
    await userEvent.keyboard('b');
    props.multiple = false;
    props.readonly = true;
    await nextTick();
    await wait(800);
    await userEvent.keyboard('b');
    props.readonly = false;
    await nextTick();
    await wait(800);
    await userEvent.keyboard('b');
    expect(log).toEqual(['valueChange "banana" none', 'update "banana"']);
    await wait(800);
    await userEvent.keyboard('b');
    expect(log).toHaveLength(2);
  });
});

describe('press, drag, release', () => {
  test('VUE-68: a release within 8 px of the press does nothing', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana' } });
    const point = centerOf(trigger());
    await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
    await opened();
    // After 400 ms, a release on an item gives it a click.
    await wait(450);
    const to = { x: point.x + 6, y: point.y + 6 };
    await userEvent.pointer({ coords: to });
    await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
    await wait(50);
    expect(shown(popup())).toBe(true);
    expect(valueText()).toBe('banana');
  });

  test('a release 9 px from the press on the selected item before 400 ms does nothing', async () => {
    await mountSelect({
      ...aligned,
      root: { defaultValue: 'banana' },
      popup: { style: 'line-height: 40px' },
    });
    const point = centerOf(trigger());
    await userEvent.pointer({ coords: point, keys: '[MouseLeft>]' });
    await opened();
    const to = { x: point.x, y: point.y + 9 };
    await userEvent.pointer({ coords: to });
    expect(document.elementFromPoint(to.x, to.y)?.closest('[role="option"]')).toBe(item('banana'));
    await userEvent.pointer({ coords: to, keys: '[/MouseLeft]' });
    expect(shown(popup())).toBe(true);
  });

  test('a drag from the trigger to an item that is not selected selects it', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    await userEvent.pointer({ coords: centerOf(trigger()), keys: '[MouseLeft>]' });
    await opened();
    await userEvent.pointer({ coords: centerOf(item('banana')) });
    await userEvent.pointer({ coords: centerOf(item('banana')), keys: '[/MouseLeft]' });
    await closed();
    expect(valueText()).toBe('banana');
    expect(log).toContain('valueChange "banana" item-press');
  });

  test('a release 3 px outside the edge of the trigger, 50 px from the press, keeps the popup open', async () => {
    await mountSelect({ trigger: { style: 'width: 200px' } });
    const rect = trigger().getBoundingClientRect();
    await pressAndRelease(
      { x: rect.left + 60, y: rect.top + rect.height / 2 },
      { x: rect.left + 10, y: rect.top - 3 },
    );
    await opened();
    await wait(50);
    expect(shown(popup())).toBe(true);
  });

  test('a release far from the trigger and the popup closes it with cancel-open', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    const outside = centerOf(document.getElementById('outside')!);
    await pressAndRelease(centerOf(trigger()), outside);
    await closed();
    expect(log).toContain('openChange false cancel-open');
  });

  test('VUE-84: a later press on the list element that ends on an item selects it', async () => {
    await mountSelect({ root: { defaultOpen: true }, popup: { style: 'padding: 20px' } });
    await opened();
    const rect = popup().getBoundingClientRect();
    await pressAndRelease({ x: rect.left + 5, y: rect.top + 5 }, centerOf(item('apricot')));
    await closed();
    expect(valueText()).toBe('apricot');
  });

  test.skipIf(server.browser !== 'chromium')(
    'a touch release on an item selects nothing',
    async () => {
      await mountSelect({ root: { defaultOpen: true } });
      await opened();
      await touchDrag(centerOf(item('apple')), centerOf(item('banana')), 4);
      expect(valueText()).toBe('');
    },
  );
});

describe('Select.Item', () => {
  test('gives its default slot the state: selected, highlighted and disabled', async () => {
    await mountSelect({
      root: { defaultValue: 'banana' },
      items: [
        { value: 'apple', text: 'Apple', disabled: true },
        { value: 'banana', text: 'Banana' },
      ],
    });
    const stateOf = (value: string) =>
      JSON.parse(item(value).querySelector('[data-state]')!.getAttribute('data-state')!);
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('banana'));
    expect(stateOf('banana')).toEqual({ selected: true, highlighted: true, disabled: false });
    expect(stateOf('apple')).toEqual({ selected: false, highlighted: false, disabled: true });
  });
});

describe('the open list', () => {
  test('the arrow keys, Home and End move the highlight and the focus; the ends stop', async () => {
    await mountSelect();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{ArrowUp}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{End}');
    await focused(() => item('cherry'));
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('cherry'));
    await userEvent.keyboard('{Home}{ArrowDown}');
    await focused(() => item('apricot'));
    expect(item('apricot')).toHaveAttribute('tabindex', '0');
    expect(item('apple')).toHaveAttribute('tabindex', '-1');
  });

  test('the typeahead highlights the item whose text starts with the typed text, and Space is a character while typing', async () => {
    await mountSelect({
      items: [
        { value: 'a', text: 'Apple' },
        { value: 'b', text: 'Blue sky' },
        { value: 'c', text: 'Blueberry' },
      ],
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('a'));
    await userEvent.keyboard('blue s');
    await focused(() => item('b'));
    expect(shown(popup())).toBe(true);
    expect(valueText()).toBe('');
  });

  test('Enter and Space select the highlighted item; a disabled item keeps the focus and selects nothing', async () => {
    await mountSelect({
      items: [
        { value: 'a', text: 'A', disabled: true },
        { value: 'b', text: 'B' },
      ],
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('a'));
    expect(item('a')).toHaveAttribute('aria-disabled', 'true');
    await userEvent.keyboard('{Enter}');
    expect(shown(popup())).toBe(true);
    await userEvent.keyboard('{ArrowDown} ');
    await closed();
    expect(valueText()).toBe('b');
  });

  test('a pointer move highlights the item under it; with highlightItemOnHover false it highlights nothing', async () => {
    const props = reactive<Props>({ defaultOpen: true });
    await mountSelect({ root: props });
    await opened();
    await userEvent.hover(item('banana'));
    await focused(() => item('banana'));
    expect(item('banana')).toHaveAttribute('data-highlighted', '');
    props.highlightItemOnHover = false;
    await nextTick();
    await userEvent.hover(item('cherry'));
    expect(item('cherry')).not.toHaveAttribute('data-highlighted');
  });

  test('the keys move the highlight while the list scrolls under a pointer that rests', async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      value: `i${index}`,
      text: `Item ${index}`,
    }));
    await mountSelect({ items, popup: { style: 'max-height: 120px; overflow-y: auto' } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.hover(item('i1'));
    await focused(() => item('i1'));
    await userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}{ArrowDown}');
    await focused(() => item('i7'));
    await wait(100);
    expect(document.activeElement).toBe(item('i7'));
    expect(popup().scrollTop).toBeGreaterThan(0);
  });

  test('a key on the trigger of an open popup is a key of the list', async () => {
    await mountSelect();
    await userEvent.click(trigger());
    await opened();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
  });

  test('Tab closes the popup, and the focus goes to the next tab stop after the trigger', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log) });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Tab}');
    await closed();
    expect(document.activeElement).toBe(document.getElementById('after'));
    expect(log).toContain('openChange false focus-out');
  });

  test('Shift+Tab closes the popup, and the focus goes to the trigger', async () => {
    await mountSelect();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await closed();
    expect(document.activeElement).toBe(trigger());
  });

  test('Escape closes the popup and the focus goes back to the trigger', async () => {
    await mountSelect();
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(document.activeElement).toBe(trigger());
  });

  test('the list element takes the focus when the focused item leaves', async () => {
    const items = reactive([
      { value: 'a', text: 'A' },
      { value: 'b', text: 'B' },
    ]);
    await mountSelect({ items });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}{ArrowDown}');
    await focused(() => item('b'));
    items.pop();
    await focused(() => popup());
    await userEvent.keyboard('{ArrowUp}');
    await focused(() => item('a'));
  });
});

describe('the first focus', () => {
  test('the item of the value gets the highlight and the focus', async () => {
    await mountSelect({ root: { defaultValue: 'banana' } });
    await userEvent.click(trigger());
    await focused(() => item('banana'));
    expect(item('banana')).toHaveAttribute('data-highlighted', '');
  });

  test('with multiple, the first selected item in the document', async () => {
    await mountSelect({ root: { multiple: true, defaultValue: ['cherry', 'apricot'] } });
    await userEvent.click(trigger());
    await focused(() => item('apricot'));
  });

  test('after a pointer open with no value, no item, and the list element takes the focus', async () => {
    await mountSelect();
    await userEvent.click(trigger());
    await focused(() => popup());
    expect(popup().querySelector('[data-highlighted]')).toBe(null);
  });

  test('in an aligned popup with no value, the first item', async () => {
    await mountSelect(aligned);
    await userEvent.click(trigger());
    await focused(() => item('apple'));
  });

  test('finalFocus gets the type of the close', async () => {
    const types: string[] = [];
    await mountSelect({
      popup: {
        finalFocus: (type: string) => {
          types.push(type);
          return true;
        },
      },
    });
    trigger().focus();
    await userEvent.keyboard('{ArrowDown}');
    await focused(() => item('apple'));
    await userEvent.keyboard('{Enter}');
    await closed();
    expect(types).toEqual(['keyboard']);
    expect(document.activeElement).toBe(trigger());
  });
});

describe('items that leave', () => {
  test('a value with no item becomes the first value when that has an item, else null', async () => {
    const log: string[] = [];
    const items = reactive([
      { value: 'apple', text: 'Apple' },
      { value: 'banana', text: 'Banana' },
      { value: 'cherry', text: 'Cherry' },
    ]);
    await mountSelect({ root: rootEvents(log, { defaultValue: 'apple' }), items });
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(item('banana'));
    items.splice(1, 1);
    await waitFor(() => expect(valueText()).toBe('apple'));
    items.splice(0, 1);
    await waitFor(() => expect(valueText()).toBe(''));
    expect(log.filter((entry) => entry.startsWith('valueChange'))).toEqual([
      'valueChange "banana" item-press',
      'valueChange "apple" none',
      'valueChange null none',
    ]);
  });

  test('with multiple, each value with no item goes', async () => {
    const items = reactive([
      { value: 'apple', text: 'Apple' },
      { value: 'banana', text: 'Banana' },
    ]);
    await mountSelect({ root: { multiple: true, defaultValue: ['apple', 'banana'] }, items });
    trigger().focus();
    await waitFor(() => expect(item('apple')).not.toBe(null));
    items.shift();
    await waitFor(() => expect(valueText()).toBe('banana'));
  });

  test('an item that leaves the list of a closed select changes the value; an added item keeps it', async () => {
    const items = reactive([{ value: 'cherry', text: 'Cherry' }]);
    await mountSelect({ root: { defaultValue: 'cherry' }, items });
    trigger().focus();
    await waitFor(() => expect(item('cherry')).not.toBe(null));
    items.push({ value: 'date', text: 'Date' });
    await wait(10);
    expect(valueText()).toBe('cherry');
    items.shift();
    await waitFor(() => expect(valueText()).toBe(''));
  });

  test('a list that mounts for the first time changes nothing', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log, { defaultValue: 'kiwi' }) });
    trigger().focus();
    await waitFor(() => expect(item('apple')).not.toBe(null));
    await wait(10);
    expect(log).toEqual([]);
    expect(valueText()).toBe('kiwi');
  });
});

describe('the layer', () => {
  test('a modal select locks the scroll of the page and blocks the page; modal false does neither', async () => {
    const props = reactive<Props>({});
    await mountSelect({ root: props });
    await userEvent.click(trigger());
    await opened();
    expect(isScrollLocked()).toBe(true);
    expect(document.querySelector('body > div[role="presentation"]:not([data-testid])')).not.toBe(
      null,
    );
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(isScrollLocked()).toBe(false);
    props.modal = false;
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    expect(isScrollLocked()).toBe(false);
  });

  test('an outside press closes the popup at pointerdown', async () => {
    const log: string[] = [];
    await mountSelect({ root: rootEvents(log, { modal: false }) });
    await userEvent.click(trigger());
    await opened();
    await userEvent.pointer({
      coords: centerOf(document.getElementById('outside')!),
      keys: '[MouseLeft>]',
    });
    await closed();
    await userEvent.pointer({ keys: '[/MouseLeft]' });
    expect(log).toContain('openChange false outside-press');
  });

  test('a select in a popover closes alone; a popover in the popup of a select stays inside it', async () => {
    mount(SelectInPopover);
    await nextTick();
    await userEvent.click(byTestId('popover-trigger'));
    await waitFor(() => expect(byTestId('popover-popup')).not.toBe(null));
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    expect(byTestId('popover-popup')).not.toBe(null);
    await userEvent.click(trigger());
    await opened();
    await userEvent.click(byTestId('inner-trigger'));
    await waitFor(() => expect(byTestId('inner-popup')).not.toBe(null));
    await userEvent.click(byTestId('inner-button'));
    expect(shown(popup())).toBe(true);
    expect(byTestId('popover-popup')).not.toBe(null);
  });
});

describe('item alignment', () => {
  function expectAligned(edge: 'left' | 'right') {
    const value = byTestId('value').getBoundingClientRect();
    const text = item('banana').firstElementChild!.getBoundingClientRect();
    expect(Math.abs(text.top + text.height / 2 - (value.top + value.height / 2))).toBeLessThan(1);
    expect(Math.abs(text[edge] - value[edge])).toBeLessThan(1);
  }

  test('puts the text of the selected item over the text of the value, with the side none', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana' }, arrow: {} });
    await userEvent.click(trigger());
    await opened();
    expectAligned('left');
    expect(byTestId('positioner')).toHaveAttribute('data-side', 'none');
    expect(byTestId('positioner').style.position).toBe('fixed');
    expect(byTestId('arrow')).toBe(null);
    expect(isScrollLocked()).toBe(true);
  });

  test('locks the scroll of the page also for a select that is not modal', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana', modal: false } });
    await userEvent.click(trigger());
    await opened();
    expect(isScrollLocked()).toBe(true);
  });

  test('aligns the inline end in a right-to-left popup', async () => {
    await mountSelect({
      ...aligned,
      root: { defaultValue: 'banana', dir: 'rtl' },
      positioner: { dir: 'rtl' },
      trigger: { style: 'margin-top: 200px; width: 160px' },
    });
    await userEvent.click(trigger());
    await opened();
    expectAligned('right');
  });

  test('with no Select.Value, puts the popup at the inline start of the trigger', async () => {
    const show = reactive({ value: true });
    await mountSelect({
      ...aligned,
      show,
      root: { defaultValue: 'banana' },
      trigger: { style: 'margin: 200px 0 0 100px' },
    });
    show.value = false;
    await nextTick();
    await userEvent.click(trigger());
    await opened();
    const left = byTestId('positioner').getBoundingClientRect().left;
    expect(Math.abs(left - trigger().getBoundingClientRect().left)).toBeLessThan(1);
  });

  test('goes to the anchored place for an open whose trigger is near the top of the view', async () => {
    await mountSelect({ root: { defaultValue: 'banana' }, positioner: {} });
    await userEvent.click(trigger());
    await opened();
    expect(byTestId('positioner')).toHaveAttribute('data-side', 'bottom');
  });

  test('grows toward the free edge when the user scrolls the list', async () => {
    const items = Array.from({ length: 40 }, (_, index) => ({
      value: `i${index}`,
      text: `Item ${index}`,
    }));
    await mountSelect({
      ...aligned,
      items,
      root: { defaultValue: 'i1' },
      trigger: { style: 'position: fixed; top: 400px; left: 20px' },
    });
    await userEvent.click(trigger());
    await opened();
    const positioner = byTestId('positioner');
    const before = positioner.getBoundingClientRect().height;
    popup().scrollTop = 40;
    await waitFor(() => expect(positioner.getBoundingClientRect().height).toBeGreaterThan(before));
  });

  test('a resize of the window closes the popup', async () => {
    const log: string[] = [];
    await mountSelect({ ...aligned, root: rootEvents(log, { defaultValue: 'banana' }) });
    await userEvent.click(trigger());
    await opened();
    window.dispatchEvent(new UIEvent('resize'));
    await closed();
    expect(log).toContain('openChange false window-resize');
  });

  test('a reopen puts the text over the value again', async () => {
    await mountSelect({ ...aligned, root: { defaultValue: 'banana' } });
    await userEvent.click(trigger());
    await opened();
    await userEvent.keyboard('{Escape}');
    await closed();
    trigger().style.marginTop = '260px';
    await userEvent.click(trigger());
    await opened();
    expectAligned('left');
  });
});

describe('scroll arrows', () => {
  test('show while the list can scroll in their direction; a pointer move on one scrolls the list', async () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      value: `i${index}`,
      text: `Item ${index}`,
    }));
    await mountSelect({
      items,
      popup: { style: 'max-height: 120px; overflow-y: auto' },
      arrows: {},
    });
    await userEvent.click(trigger());
    await opened();
    expect(byTestId('up')).toBe(null);
    await waitFor(() => expect(byTestId('down')).not.toBe(null));
    expect(byTestId('down')).toHaveAttribute('aria-hidden', 'true');
    expect(popup()).toHaveClass('vase-ui-disable-scrollbar');
    const down = centerOf(byTestId('down'));
    await userEvent.pointer({ coords: { x: down.x, y: down.y - 1 } });
    await userEvent.pointer({ coords: down });
    await waitFor(() => expect(popup().scrollTop).toBeGreaterThan(0));
    await waitFor(() => expect(byTestId('up')).not.toBe(null));
  });

  test('in a <Transition>, an arrow that comes back during its leave is one element at each moment, and the new one enters after the old one goes', async () => {
    const { root } = mount(SelectArrowsInTransition);
    const arrows = () => [...document.querySelectorAll('.down')];
    await waitFor(() => expect(arrows()).toHaveLength(1));
    await settle();
    const old = arrows();
    let most = 0;
    const observer = new MutationObserver(() => (most = Math.max(most, arrows().length)));
    observer.observe(document.body, { childList: true, subtree: true });
    popup().scrollTop = popup().scrollHeight;
    await waitFor(() => expect(old[0]).toHaveClass('v-leave-active'));
    popup().scrollTop = 0;
    await waitFor(() => {
      expect(arrows()).toHaveLength(1);
      expect(arrows()[0]).not.toBe(old[0]);
      expect(arrows()[0]!.className).toBe('down');
    });
    observer.disconnect();
    expect(most).toBe(1);
    expect(root).not.toBe(null);
  });

  test('a kept arrow stays with hidden while the list cannot scroll', async () => {
    await mountSelect({ arrows: { keepMounted: true } });
    await userEvent.click(trigger());
    await opened();
    expect(byTestId('up')).toHaveAttribute('hidden');
  });
});
