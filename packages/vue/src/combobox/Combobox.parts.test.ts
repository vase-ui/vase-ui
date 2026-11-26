import { describe, expect, test } from 'vitest';
import { userEvent } from 'vitest/browser';
import { nextTick, reactive } from 'vue';
import AutocompleteParts from '../../test/fixtures/AutocompleteParts.vue';
import ComboboxAllParts from '../../test/fixtures/ComboboxAllParts.vue';
import ComboboxGrid from '../../test/fixtures/ComboboxGrid.vue';
import ComboboxInField from '../../test/fixtures/ComboboxInField.vue';
import ComboboxParts from '../../test/fixtures/ComboboxParts.vue';
import ComboboxPieces from '../../test/fixtures/ComboboxPieces.vue';
import { isScrollLocked } from '../../test/fixtures/scrollDocument';
import { fireEvent } from '../../test/fireEvent';
import { screen } from '../../test/queries';
import { mount, mountError, settle } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

type Props = Record<string, unknown>;

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
const input = () => byTestId('input') as HTMLInputElement;
const trigger = () => byTestId('trigger')!;
const popup = () => byTestId('popup');

// The element of each part with no `as`. Combobox.Portal renders no element, and Combobox.Input is
// a native input, which takes no `as`.
const TAGS = {
  Root: 'div',
  Label: 'div',
  InputGroup: 'div',
  Chips: 'div',
  Chip: 'div',
  ChipRemove: 'button',
  Input: 'input',
  Clear: 'button',
  Trigger: 'button',
  Backdrop: 'div',
  Positioner: 'div',
  Popup: 'div',
  Arrow: 'div',
  Status: 'div',
  Empty: 'div',
  List: 'div',
  Group: 'div',
  GroupLabel: 'div',
  Item: 'div',
};
const PARTS = Object.keys(TAGS) as (keyof typeof TAGS)[];
const AS_PARTS = PARTS.filter((part) => part !== 'Input');
// The parts that render no other part, so their `element` slot holds all of their content.
const SLOT_PARTS = PARTS.filter(
  (part) => !['Root', 'InputGroup', 'Chips', 'Positioner', 'Popup', 'List', 'Group'].includes(part),
);

const partOf = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

async function mountParts(props: Props = {}) {
  const { exposed } = mount(ComboboxAllParts, props);
  await waitFor(() => expect(partOf('Popup')?.checkVisibility()).toBe(true));
  return exposed.parts as Record<string, { element: Element | null }>;
}

async function mountCombobox(props: Props = {}) {
  const result = mount(ComboboxParts, props);
  await nextTick();
  return result;
}

describe('the element of each part', () => {
  test('each part renders its element, with the attributes and the class of the developer, and a template ref gives it', async () => {
    const parts = await mountParts();
    for (const part of PARTS) {
      const element = partOf(part);
      expect(element?.localName, part).toBe(TAGS[part]);
      expect(element, part).toHaveClass('part');
      expect(parts[part]!.element, part).toBe(element);
    }
    // The portal puts the positioner in <body>.
    expect(partOf('Positioner').parentElement).toBe(document.body);
  });

  test('with `as`, each part renders that tag with its content and its attributes', async () => {
    const as = Object.fromEntries(AS_PARTS.map((part) => [part, 'section']));
    const parts = await mountParts({ as });
    for (const part of AS_PARTS) {
      const element = partOf(part);
      expect(element.localName, part).toBe('section');
      expect(parts[part]!.element, part).toBe(element);
    }
    expect(partOf('Trigger')).toHaveAttribute('aria-haspopup', 'listbox');
    expect(partOf('Trigger')).toHaveAttribute('tabindex', '-1');
    expect(partOf('List')).toHaveAttribute('role', 'listbox');
    expect(partOf('Item')).toHaveAttribute('role', 'option');
    expect(partOf('Item')).toHaveAttribute('aria-selected', 'true');
    expect(partOf('Group')).toHaveAttribute('role', 'group');
    expect(partOf('Chips')).toHaveAttribute('role', 'toolbar');
    expect(partOf('Status')).toHaveAttribute('role', 'status');
    expect(partOf('Empty')).toHaveAttribute('role', 'status');
    expect(partOf('Arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('Chip')).toHaveTextContent('a');
  });

  test('the `element` slot renders the element of the part with its props, and a template ref gives it', async () => {
    const parts = await mountParts({ withSlot: true });
    for (const part of SLOT_PARTS) {
      const element = partOf(part);
      expect(element.localName, part).toBe(part === 'Input' ? 'input' : 'section');
      expect(element, part).toHaveClass('part');
      expect(parts[part]!.element, part).toBe(element);
    }
    expect(partOf('Input')).toHaveAttribute('role', 'combobox');
    expect(partOf('Input')).toHaveAttribute('aria-labelledby', partOf('Label').id);
    expect(partOf('Arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('GroupLabel')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('Group')).toHaveAttribute('aria-labelledby', partOf('GroupLabel').id);
    expect(partOf('Item')).toHaveAttribute('role', 'option');
    expect(partOf('Status')).toHaveAttribute('role', 'status');
    expect(partOf('Empty')).toHaveAttribute('role', 'status');
    expect(partOf('Chip')).toHaveAttribute('tabindex', '-1');
    expect(partOf('ChipRemove')).toHaveAttribute('tabindex', '-1');
    expect(partOf('Clear')).toHaveAttribute('tabindex', '-1');
  });

  test('the portal renders no element, and `to` puts the content in another element', async () => {
    await mountParts({ to: '#portal-target' });
    expect(partOf('Positioner').parentElement).toBe(document.getElementById('portal-target'));
  });

  test('a part that needs its chip throws an error that names it', () => {
    expect(String(mountError(ComboboxPieces, { scene: 'ChipRemove' }))).toContain(
      '<Combobox.ChipRemove> must be inside <Combobox.Chip>',
    );
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});

describe('groups', () => {
  test('a group has the role `group` and the id of its label; the label is visible and hidden from the accessibility tree', async () => {
    await mountCombobox({ root: { defaultOpen: true }, grouped: true, items: GROUPS });
    await waitFor(() => expect(popup()).not.toBe(null));
    const group = byTestId('group-Fruits')!;
    const label = group.querySelector<HTMLElement>('div:first-child')!;
    expect(group).toHaveAttribute('role', 'group');
    expect(label).toHaveTextContent('Fruits');
    expect(label.id).not.toBe('');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(label).toHaveAttribute('aria-hidden', 'true');
    expect(label.checkVisibility()).toBe(true);
  });

  test('the `aria-hidden` and the `id` of the developer win on the label; the group follows the newest of two labels', async () => {
    const labels = reactive<{ key: string; attrs: Props }[]>([
      { key: 'old', attrs: { id: 'old-label', 'aria-hidden': 'false' } },
    ]);
    mount(ComboboxPieces, { scene: 'GroupLabels', labels });
    await nextTick();
    const group = byTestId('group')!;
    expect(group).toHaveAttribute('aria-labelledby', 'old-label');
    expect(byTestId('label-old')).toHaveAttribute('aria-hidden', 'false');
    labels.push({ key: 'new', attrs: { id: 'new-label' } });
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    labels.shift();
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
  });
});

const GROUPS = [
  { name: 'Fruits', items: ['Apple', 'Banana'] },
  { name: 'Vegetables', items: ['Carrot', 'Lettuce'] },
];

describe('the live regions', () => {
  test('Status is in the popup, so it renders only while the popup is open', async () => {
    await mountCombobox({ status: true });
    expect(byTestId('status')).toBe(null);
    await userEvent.click(input());
    await waitFor(() => expect(byTestId('status')).not.toBe(null));
    expect(byTestId('status')).toHaveAttribute('role', 'status');
  });

  test('the text of Status comes one task after the mount; a later change shows at once; an early unmount is clean', async () => {
    const text = reactive({ status: 'Ten fruits.' });
    const { unmount } = mount(ComboboxPieces, { scene: 'Status', text });
    await nextTick();
    const status = byTestId('status')!;
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('');
    await settle();
    expect(status).toHaveTextContent('Ten fruits.');
    text.status = 'Two fruits.';
    await nextTick();
    expect(status).toHaveTextContent('Two fruits.');
    unmount();
    mount(ComboboxPieces, { scene: 'Status', text }).unmount();
    await settle();
  });

  test('with `as`, Status and Empty render that tag with the role and the text one task after the mount', async () => {
    mount(ComboboxPieces, { scene: 'Status', text: { status: 'Searching' }, as: 'p' });
    await nextTick();
    const status = byTestId('status')!;
    expect(status.localName).toBe('p');
    expect(status).toHaveAttribute('role', 'status');
    expect(status).toHaveTextContent('');
    await settle();
    expect(status).toHaveTextContent('Searching');
  });

  test('Empty shows its text at once when the list empties after the mount', async () => {
    const root = reactive<Props>({ defaultOpen: true });
    const items = reactive(['Apple']);
    await mountCombobox({ root, items, empty: true });
    await waitFor(() => expect(byTestId('empty')).not.toBe(null));
    await settle();
    const empty = byTestId('empty')!;
    expect(empty).toHaveAttribute('role', 'status');
    expect(empty).toHaveTextContent('');
    items.splice(0);
    await nextTick();
    expect(empty).toHaveTextContent('No fruit.');
  });
});

describe('the list', () => {
  test('the grid of a read-only root has no `aria-readonly`; the input has it', async () => {
    mount(ComboboxGrid, { root: { readonly: true } });
    await nextTick();
    // `aria-readonly` on a grid tells that its cells cannot change, so the input tells the state
    // with its native `readonly`.
    expect(document.querySelector('[role="grid"]')).not.toHaveAttribute('aria-readonly');
    expect(input()).toHaveAttribute('readonly');
  });

  test('the listbox has no `aria-orientation`', async () => {
    await mountCombobox({ root: { defaultOpen: true } });
    await waitFor(() => expect(popup()).not.toBe(null));
    expect(byTestId('list')).toHaveAttribute('role', 'listbox');
    expect(byTestId('list')).not.toHaveAttribute('aria-orientation');
  });

  test('the list of a read-only Autocomplete has `aria-readonly`', async () => {
    mount(AutocompleteParts, { root: { readonly: true, defaultOpen: true } });
    await waitFor(() => expect(byTestId('list')).not.toBe(null));
    expect(byTestId('list')).toHaveAttribute('role', 'listbox');
    expect(byTestId('list')).toHaveAttribute('aria-readonly', 'true');
  });

  test.each([{ disabled: true }, { readonly: true }])(
    'Enter on the list of a root with $0 selects nothing',
    async (lock) => {
      const changes: unknown[] = [];
      await mountCombobox({
        root: {
          ...lock,
          defaultOpen: true,
          onValueChange: (value: unknown) => changes.push(value),
        },
      });
      await waitFor(() => expect(popup()).not.toBe(null));
      const event = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      byTestId('list')!.dispatchEvent(event);
      await settle();
      expect(changes).toEqual([]);
    },
  );

  test('the listbox has the name of its control: Combobox.Label, Field.Label, or the aria-label or aria-labelledby of the input, and for the grid role', async () => {
    const shown = () => popup()?.checkVisibility({ opacityProperty: true });

    const labelInput = reactive<Props>({ 'aria-label': 'Search fruit' });
    const byLabel = await mountCombobox({
      label: true,
      input: labelInput,
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('list'));
    labelInput['aria-labelledby'] = '';
    await nextTick();
    expect(screen.getByRole('combobox', { name: 'Search fruit' })).toBe(byTestId('input'));
    expect(screen.getByRole('listbox', { name: 'Search fruit' })).toBe(byTestId('list'));
    byLabel.unmount();

    const byNativeField = mount(ComboboxInField, { root: { defaultOpen: true } });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('list'));
    byNativeField.unmount();

    const fieldInput = reactive<Props>({ 'aria-label': 'Search fruit' });
    const byFieldAndAriaLabel = mount(ComboboxInField, {
      root: { defaultOpen: true },
      input: fieldInput,
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Search fruit' })).toBe(byTestId('list'));
    fieldInput['aria-label'] = '   ';
    await nextTick();
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('list'));
    byFieldAndAriaLabel.unmount();

    const nonNativeInput = reactive<Props>({ 'aria-label': 'Search fruit' });
    const byNonNativeField = mount(ComboboxInField, {
      root: { defaultOpen: true },
      comboboxLabel: true,
      nonNativeFieldLabel: true,
      input: nonNativeInput,
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('list')).toHaveAttribute(
      'aria-labelledby',
      `${byTestId('combobox-label')!.id} ${byTestId('field-label')!.id}`,
    );
    nonNativeInput['aria-labelledby'] = '';
    delete nonNativeInput['aria-label'];
    await nextTick();
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    byNonNativeField.unmount();

    const inputProps = reactive<Props>({ 'aria-label': 'Search fruit' });
    const byInput = await mountCombobox({ root: { defaultOpen: true }, input: inputProps });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Search fruit' })).toBe(byTestId('list'));
    inputProps['aria-labelledby'] = 'outside';
    await nextTick();
    expect(screen.getByRole('listbox', { name: 'Outside' })).toBe(byTestId('list'));
    byInput.unmount();

    const grid = mount(ComboboxGrid, { input: { 'aria-label': 'Cells' } });
    await nextTick();
    expect(screen.getByRole('grid', { name: 'Cells' })).toBe(
      document.querySelector('[role="grid"]'),
    );
    grid.unmount();
  });

  test('an aria-label or an aria-labelledby on the list wins, and the part then writes neither attribute', async () => {
    const shown = () => popup()?.checkVisibility({ opacityProperty: true });

    const withLabel = await mountCombobox({
      label: true,
      list: { 'aria-label': 'Choices' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Choices' })).toBe(byTestId('list'));
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    withLabel.unmount();

    const withLabelledBy = await mountCombobox({
      input: { 'aria-label': 'Search fruit' },
      list: { 'aria-labelledby': 'outside' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Outside' })).toBe(byTestId('list'));
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    withLabelledBy.unmount();

    const withBlank = await mountCombobox({
      label: true,
      list: { 'aria-label': '' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('list')).toHaveAttribute('aria-label', '');
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    withBlank.unmount();

    const withBlankLabelledBy = await mountCombobox({
      input: { 'aria-label': 'Search fruit' },
      list: { 'aria-labelledby': '' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('list')).toHaveAttribute('aria-labelledby', '');
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    withBlankLabelledBy.unmount();
  });

  test('a trigger beside the input with an aria-label of its own does not name the list; with the input in the popup, the list has the name of the trigger', async () => {
    const shown = () => popup()?.checkVisibility({ opacityProperty: true });

    const beside = await mountCombobox({
      root: { defaultOpen: true },
      trigger: true,
      triggerAttrs: { 'aria-label': 'Open popup' },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    beside.unmount();

    const scene = reactive({ trigger: true });
    const triggerAttrs = reactive<Props>({ 'aria-label': 'Choose fruit' });
    const inPopup = await mountCombobox({
      root: { defaultOpen: true },
      inputInPopup: true,
      scene,
      triggerAttrs,
      input: { 'aria-label': 'Filter fruit' },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Choose fruit' })).toBe(byTestId('list'));
    triggerAttrs['aria-labelledby'] = 'outside';
    await nextTick();
    expect(screen.getByRole('listbox', { name: 'Outside' })).toBe(byTestId('list'));
    scene.trigger = false;
    await nextTick();
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    inPopup.unmount();
  });
});

describe('the popup', () => {
  test('an open popup has no `hidden`; a closed popup that stays in the DOM has it', async () => {
    // CSS selects a closed popup with `[hidden]`, so the popup has no `data-open`.
    const root = reactive<Props>({ open: true });
    await mountCombobox({ root, portal: { keepMounted: true } });
    await waitFor(() => expect(popup()).not.toBe(null));
    expect(popup()).not.toHaveAttribute('hidden');
    expect(popup()).not.toHaveAttribute('data-open');
    root.open = false;
    await waitFor(() => expect(popup()).toHaveAttribute('hidden'));
  });

  test('a touch on the trigger that is the control gives the focus to the popup, not to its input', async () => {
    await mountCombobox({ inputInPopup: true });
    await fireEvent.pointerDown(trigger(), { pointerType: 'touch' });
    await fireEvent.mouseDown(trigger());
    await fireEvent.click(trigger(), { detail: 1 });
    await waitFor(() => expect(document.activeElement).toBe(popup()));
    expect(document.activeElement).not.toBe(input());
  });

  test('`initialFocus` false: a press gives the focus to the trigger, as to a button', async () => {
    await mountCombobox({ inputInPopup: true, popup: { initialFocus: false } });
    document.getElementById('before')!.focus();
    await userEvent.click(trigger());
    await waitFor(() => expect(popup()).not.toBe(null));
    await settle();
    expect(document.activeElement).toBe(trigger());
  });

  test('`finalFocus` gets the type of the close, and an element of `finalFocus` gets the focus', async () => {
    const types: string[] = [];
    const popupProps = reactive<Props>({
      finalFocus: (type: string) => {
        types.push(type);
        return false;
      },
    });
    await mountCombobox({ popup: popupProps });
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.click(byTestId('item-Apple')!);
    await waitFor(() => expect(popup()).toBe(null));
    expect(types.at(-1)).toBe('mouse');
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.keyboard('{ArrowDown}{Enter}');
    await waitFor(() => expect(popup()).toBe(null));
    expect(types.at(-1)).toBe('keyboard');
    popupProps.finalFocus = document.getElementById('outside');
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(document.getElementById('outside')));
  });

  test('an element of `finalFocus` gets no focus at a close by a focus that leaves or by a press outside', async () => {
    const popupProps = reactive<Props>({});
    await mountCombobox({ popup: popupProps });
    const outside = document.getElementById('outside')!;
    popupProps.finalFocus = document.getElementById('before');
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toBe(null));
    outside.focus();
    await waitFor(() => expect(popup()).toBe(null));
    expect(document.activeElement).toBe(outside);
    // A press that moves no focus, as on a button of a toolbar.
    outside.addEventListener('mousedown', (event) => event.preventDefault());
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.click(outside);
    await waitFor(() => expect(popup()).toBe(null));
    expect(document.activeElement).toBe(input());
  });

  test('a press on an item gives the element of `finalFocus` no ring after a key, and Enter gives it the ring', async () => {
    await mountCombobox({ popup: { finalFocus: () => document.getElementById('outside') } });
    const outside = document.getElementById('outside')!;
    for (const pick of ['press', 'Enter']) {
      input().focus();
      await userEvent.keyboard('{ArrowDown}');
      await waitFor(() => expect(popup()).not.toBe(null));
      if (pick === 'press') await userEvent.click(byTestId('item-Apple')!);
      else await userEvent.keyboard('{ArrowDown}{Enter}');
      await waitFor(() => expect(document.activeElement).toBe(outside));
      expect(outside.matches(':focus-visible'), pick).toBe(pick === 'Enter');
    }
  });

  test('Escape after a Tab into the popup gives the focus back to the input', async () => {
    await mountCombobox({ button: true });
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.keyboard('{Tab}');
    await waitFor(() => expect(byTestId('popup-button')).toHaveFocus());
    await userEvent.keyboard('{Escape}');
    await waitFor(() => expect(popup()).toBe(null));
    await waitFor(() => expect(input()).toHaveFocus());
  });

  test('the focus stays on an element that code focuses after the close', async () => {
    const outside = () => document.getElementById('outside')!;
    await mountCombobox({
      root: { onValueChange: () => void Promise.resolve().then(() => outside().focus()) },
      popup: { finalFocus: () => document.getElementById('before') },
    });
    await userEvent.click(input());
    await waitFor(() => expect(popup()).not.toBe(null));
    await userEvent.click(byTestId('item-Apple')!);
    await waitFor(() => expect(popup()).toBe(null));
    await settle();
    expect(document.activeElement).toBe(outside());
  });

  test('a combobox that closes and opens again in one task moves no focus to `finalFocus`', async () => {
    const changes: boolean[] = [];
    await mountCombobox({
      root: { onOpenChange: (open: boolean) => changes.push(open) },
      popup: { finalFocus: () => document.getElementById('outside') },
    });
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(popup()).not.toBe(null));
    for (const key of ['Escape', 'ArrowDown']) {
      input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    expect(changes).toEqual([true, false, true]);
    await settle();
    expect(document.activeElement).toBe(input());
    expect(popup()).not.toBe(null);
  });

  test('a combobox that closes, opens again, and closes by an outside press in one task moves no focus to `finalFocus`', async () => {
    await mountCombobox({
      popup: { finalFocus: () => document.getElementById('outside') },
    });
    const outside = document.getElementById('outside')!;
    outside.addEventListener('mousedown', (event) => event.preventDefault());
    input().focus();
    await userEvent.keyboard('{ArrowDown}');
    await waitFor(() => expect(popup()).not.toBe(null));
    for (const key of ['Escape', 'ArrowDown']) {
      input().dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));
    }
    outside.dispatchEvent(
      new PointerEvent('pointerdown', { bubbles: true, pointerType: 'mouse', button: 0 }),
    );
    await waitFor(() => expect(popup()).toBe(null));
    await settle();
    expect(document.activeElement).toBe(input());
  });
});

describe('the positioner', () => {
  const positioner = () => byTestId('positioner')!;

  test('the positioner rests at `sideOffset`, a number or a function of the sizes, and at `alignOffset`', async () => {
    const place = reactive<Props>({ sideOffset: 7, align: 'center' });
    await mountCombobox({
      root: { defaultOpen: true },
      input: { style: 'width: 72px; height: 36px; box-sizing: border-box; margin: 0' },
      popup: { style: 'width: 52px; height: 24px; overflow: hidden' },
      positioner: place,
    });
    await waitFor(() => expect(popup()).not.toBe(null));
    const at = () => {
      const anchor = byTestId('group')!.getBoundingClientRect();
      const rect = positioner().getBoundingClientRect();
      return { x: Math.round(rect.left - anchor.left), y: Math.round(rect.top - anchor.bottom) };
    };
    const width = byTestId('group')!.getBoundingClientRect().width;
    const centered = Math.round((width - 52) / 2);
    await waitFor(() => expect(at()).toEqual({ x: centered, y: 7 }));
    place.sideOffset = (data: { positioner: { height: number }; anchor: { height: number } }) =>
      data.positioner.height + data.anchor.height;
    const anchorHeight = Math.round(byTestId('group')!.getBoundingClientRect().height);
    await waitFor(() => expect(at()).toEqual({ x: centered, y: 24 + anchorHeight }));
    place.sideOffset = 0;
    place.alignOffset = 5;
    await waitFor(() => expect(at()).toEqual({ x: centered + 5, y: 0 }));
  });

  test('a popup with no room below flips to the top and rests at `collisionPadding` from the edge', async () => {
    const place = reactive<Props>({
      side: 'bottom',
      sideOffset: 8,
      collisionPadding: 12,
      collisionAvoidance: { fallbackAxisSide: 'none' },
    });
    await mountCombobox({
      root: { defaultOpen: true, style: 'position: fixed; bottom: 8px; left: 16px' },
      positioner: place,
      popup: { style: 'width: 200px; height: 1000px; max-height: var(--available-height)' },
    });
    await waitFor(() => expect(popup()).not.toBe(null));
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'top'));
    await waitFor(() => expect(Math.round(positioner().getBoundingClientRect().top)).toBe(12));
  });

  test.each([
    { collisionAvoidance: undefined, side: /^(top|bottom)$/ },
    { collisionAvoidance: { fallbackAxisSide: 'end' }, side: /^right$/ },
  ])(
    'a popup that fits neither above nor below stays there by default; `collisionAvoidance` $collisionAvoidance wins',
    async ({ collisionAvoidance, side }) => {
      await mountCombobox({
        root: { defaultOpen: true, style: 'position: fixed; top: 50%; left: 16px' },
        positioner: { side: 'bottom', collisionAvoidance },
        popup: { style: 'width: 100px; height: 75vh' },
      });
      await waitFor(() => expect(positioner()?.getAttribute('data-side')).toMatch(side));
    },
  );

  test('a popup that fits rests on the default side, at the bottom', async () => {
    await mountCombobox({ root: { defaultOpen: true } });
    await waitFor(() => expect(popup()).not.toBe(null));
    await waitFor(() => expect(positioner()).toHaveAttribute('data-side', 'bottom'));
    expect(positioner().style.transform).not.toBe('');
  });

  test('anchors to the input when there is no input group', async () => {
    let anchorWidth = 0;
    mount(ComboboxPieces, {
      scene: 'InputAnchor',
      positioner: {
        sideOffset: (data: { anchor: { width: number } }) => {
          anchorWidth = data.anchor.width;
          return 0;
        },
      },
    });
    await waitFor(() => expect(anchorWidth).toBe(120));
  });

  test('a controlled empty multiple value with a render after the mount locks no scroll', async () => {
    const root = reactive<Props>({ multiple: true, modelValue: [] });
    await mountCombobox({ root });
    root.modelValue = [];
    await settle();
    await new Promise((resolve) => setTimeout(resolve, 50));
    expect(isScrollLocked()).toBe(false);
    expect(byTestId('positioner')).toBe(null);
  });
});
