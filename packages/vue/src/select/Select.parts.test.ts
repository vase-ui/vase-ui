import { describe, expect, test } from 'vitest';
import { nextTick, reactive } from 'vue';
import SelectAllParts from '../../test/fixtures/SelectAllParts.vue';
import SelectGroups from '../../test/fixtures/SelectGroups.vue';
import SelectInField from '../../test/fixtures/SelectInField.vue';
import SelectPartAlone from '../../test/fixtures/SelectPartAlone.vue';
import SelectParts from '../../test/fixtures/SelectParts.vue';
import { screen } from '../../test/queries';
import { mount, mountError } from '../../test/render';
import { takeReportedMessages } from '../../test/reportedMessages';
import { waitFor } from '../../test/waitFor';

const byTestId = (id: string) => document.querySelector<HTMLElement>(`[data-testid="${id}"]`);

// The element of each part with no `as`. Select.Portal renders no element.
const TAGS = {
  Root: 'div',
  Label: 'div',
  Trigger: 'button',
  Value: 'span',
  Icon: 'span',
  Backdrop: 'div',
  Positioner: 'div',
  Popup: 'div',
  Arrow: 'div',
  ScrollUpArrow: 'div',
  List: 'div',
  Group: 'div',
  GroupLabel: 'div',
  Item: 'div',
  ItemText: 'div',
  Separator: 'div',
  ScrollDownArrow: 'div',
};
const PARTS = Object.keys(TAGS) as (keyof typeof TAGS)[];
// The parts that render no other part, so their `element` slot holds all of their content.
const SLOT_PARTS = PARTS.filter(
  (part) => !['Root', 'Trigger', 'Positioner', 'Popup', 'List', 'Group'].includes(part),
);

const partOf = (name: string) => document.querySelector<HTMLElement>(`[data-part="${name}"]`)!;

async function mountParts(props: Record<string, unknown> = {}) {
  const { exposed } = mount(SelectAllParts, props);
  await waitFor(() => expect(partOf('Popup')?.checkVisibility()).toBe(true));
  return exposed.parts as Record<string, { element: Element | null }>;
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
  });

  test('with `as`, each part renders that tag with its content and its attributes', async () => {
    const as = Object.fromEntries(PARTS.map((part) => [part, 'section']));
    const parts = await mountParts({ as });
    for (const part of PARTS) {
      const element = partOf(part);
      expect(element.localName, part).toBe('section');
      expect(parts[part]!.element, part).toBe(element);
    }
    expect(partOf('Trigger')).toHaveAttribute('role', 'combobox');
    expect(partOf('Trigger')).toHaveAttribute('tabindex', '0');
    expect(partOf('Popup')).toHaveAttribute('role', 'presentation');
    expect(partOf('List')).toHaveAttribute('role', 'listbox');
    expect(partOf('Item')).toHaveAttribute('role', 'option');
    expect(partOf('Item')).toHaveAttribute('aria-selected', 'true');
    expect(partOf('Group')).toHaveAttribute('role', 'group');
    expect(partOf('Item').contains(partOf('ItemText'))).toBe(true);
  });

  test('the `element` slot renders the element of the part with its props, and a template ref gives it', async () => {
    const parts = await mountParts({ withSlot: true });
    for (const part of SLOT_PARTS) {
      const element = partOf(part);
      expect(element.localName, part).toBe('section');
      expect(element, part).toHaveClass('part');
      expect(parts[part]!.element, part).toBe(element);
    }
    expect(partOf('Icon')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('Arrow')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('GroupLabel')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('Group')).toHaveAttribute('aria-labelledby', partOf('GroupLabel').id);
    expect(partOf('Item')).toHaveAttribute('role', 'option');
    expect(partOf('Item')).toHaveAttribute('aria-selected', 'true');
    expect(partOf('Separator')).toHaveAttribute('role', 'presentation');
    expect(partOf('Trigger')).toHaveAttribute('aria-labelledby', partOf('Label').id);
  });

  test('Select.Icon is a hidden <span> with ▼, and has `data-popup-open` while the popup is open', async () => {
    await mountParts();
    expect(partOf('Icon')).toHaveAttribute('aria-hidden', 'true');
    expect(partOf('Icon')).toHaveTextContent('▼');
    expect(partOf('Icon')).toHaveAttribute('data-popup-open', '');
  });
});

describe('a part outside the part that it needs', () => {
  test.each([
    { part: 'GroupLabel', message: '<Select.GroupLabel> must be inside <Select.Group>' },
    { part: 'ItemText', message: '<Select.ItemText> must be inside <Select.Item>' },
    { part: 'Popup', message: '<Select.Popup> must be inside <Select.Positioner>' },
  ])('Select.$part throws an error that names it', ({ part, message }) => {
    expect(String(mountError(SelectPartAlone, { part }))).toContain(message);
    // After the error, Vapor renders the part with no setup, and warns about each binding.
    takeReportedMessages();
  });
});

describe('groups', () => {
  test('a group has the role `group` and the id of its label in `aria-labelledby`; the label is hidden', async () => {
    mount(SelectGroups, { root: { defaultOpen: true } });
    await waitFor(() => expect(byTestId('popup')?.checkVisibility()).toBe(true));
    const group = byTestId('group-fruits')!;
    const label = byTestId('label-fruits')!;
    expect(group).toHaveAttribute('role', 'group');
    expect(label.id).not.toBe('');
    expect(group).toHaveAttribute('aria-labelledby', label.id);
    expect(label).toHaveAttribute('aria-hidden', 'true');
    expect(label.checkVisibility()).toBe(true);
  });

  test('the `aria-hidden` of the developer wins on the label', async () => {
    mount(SelectGroups, {
      root: { defaultOpen: true },
      groups: [
        {
          name: 'fruits',
          labels: [{ key: 'fruits', text: 'Fruits', attrs: { 'aria-hidden': 'false' } }],
          items: ['apple'],
        },
      ],
    });
    await waitFor(() => expect(byTestId('label-fruits')).not.toBe(null));
    expect(byTestId('label-fruits')).toHaveAttribute('aria-hidden', 'false');
  });

  test('the group follows the `id` of its label, a label that leaves, and the newest of two labels', async () => {
    const label = reactive<{ key: string; text: string; attrs: Record<string, unknown> }>({
      key: 'old',
      text: 'Old',
      attrs: {},
    });
    const groups = reactive([{ name: 'fruits', labels: [label], items: ['apple'] }]);
    mount(SelectGroups, { root: { defaultOpen: true }, groups });
    await waitFor(() => expect(byTestId('label-old')).not.toBe(null));
    const group = byTestId('group-fruits')!;
    const generated = byTestId('label-old')!.id;
    expect(group).toHaveAttribute('aria-labelledby', generated);
    label.attrs = { id: 'custom-label' };
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', 'custom-label');
    label.attrs = {};
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', generated);
    groups[0]!.labels.push({ key: 'new', text: 'New', attrs: { id: 'new-label' } });
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    groups[0]!.labels.shift();
    await nextTick();
    expect(group).toHaveAttribute('aria-labelledby', 'new-label');
    groups[0]!.labels.shift();
    await nextTick();
    expect(byTestId('label-new')).toBe(null);
    expect(group).not.toHaveAttribute('aria-labelledby');
  });
});

describe('listbox name', () => {
  const shown = () => byTestId('popup')?.checkVisibility({ opacityProperty: true });

  test('VUE-235: the listbox has the name of the trigger: Select.Label, Field.Label, or the aria-label of the trigger; Select.Popup has it when it is the listbox', async () => {
    const first = mount(SelectParts, { label: {}, list: {}, root: { defaultOpen: true } });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('list'));
    expect(byTestId('popup')).toHaveAttribute('role', 'presentation');
    expect(byTestId('popup')).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('popup')).not.toHaveAttribute('aria-label');
    first.unmount();

    const popupListbox = mount(SelectParts, { label: {}, root: { defaultOpen: true } });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('popup'));
    popupListbox.unmount();

    const inFieldTrigger = reactive<Record<string, unknown>>({});
    const inField = mount(SelectInField, {
      root: { defaultOpen: true },
      trigger: inFieldTrigger,
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Letter' })).toBe(byTestId('popup'));
    inFieldTrigger['aria-labelledby'] = '';
    inFieldTrigger['aria-label'] = 'Region';
    await nextTick();
    expect(screen.getByRole('combobox', { name: 'Region' })).toBe(byTestId('trigger'));
    expect(screen.getByRole('listbox', { name: 'Region' })).toBe(byTestId('popup'));
    delete inFieldTrigger['aria-label'];
    await nextTick();
    expect(screen.getByRole('combobox', { name: 'Letter' })).toBe(byTestId('trigger'));
    expect(screen.getByRole('listbox', { name: 'Letter' })).toBe(byTestId('popup'));
    inField.unmount();

    const labeledTrigger = reactive<Record<string, unknown>>({ 'aria-label': 'Region' });
    const withLabelAndTrigger = mount(SelectParts, {
      label: {},
      list: {},
      trigger: labeledTrigger,
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruit' })).toBe(byTestId('list'));
    labeledTrigger['aria-labelledby'] = '';
    await nextTick();
    expect(screen.getByRole('combobox', { name: 'Region' })).toBe(byTestId('trigger'));
    expect(screen.getByRole('listbox', { name: 'Region' })).toBe(byTestId('list'));
    delete labeledTrigger['aria-label'];
    await nextTick();
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    withLabelAndTrigger.unmount();

    const show = reactive({ trigger: true });
    const triggerProps = reactive<Record<string, unknown>>({
      'aria-labelledby': '   ',
      'aria-label': 'Region',
    });
    const byTrigger = mount(SelectParts, {
      list: {},
      show,
      trigger: triggerProps,
      heading: { id: 'custom-heading' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Region' })).toBe(byTestId('list'));
    triggerProps['aria-labelledby'] = 'custom-heading';
    await nextTick();
    expect(screen.getByRole('listbox', { name: 'Fruits' })).toBe(byTestId('list'));
    show.trigger = false;
    await nextTick();
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    byTrigger.unmount();
  });

  test('an aria-label or an aria-labelledby on the list wins, and the part then writes neither attribute: an aria-labelledby on the list leaves no aria-label from the trigger', async () => {
    const withLabel = mount(SelectParts, {
      label: {},
      list: { 'aria-label': 'Custom list' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Custom list' })).toBe(byTestId('list'));
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    withLabel.unmount();

    const withLabelledBy = mount(SelectParts, {
      list: { 'aria-labelledby': 'custom-heading' },
      heading: { id: 'custom-heading' },
      trigger: { 'aria-label': 'Region' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(screen.getByRole('listbox', { name: 'Fruits' })).toBe(byTestId('list'));
    expect(byTestId('list')).not.toHaveAttribute('aria-label');
    withLabelledBy.unmount();

    const blankLabel = mount(SelectParts, {
      label: {},
      list: { 'aria-label': '' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('list')).toHaveAttribute('aria-label', '');
    expect(byTestId('list')).not.toHaveAttribute('aria-labelledby');
    blankLabel.unmount();

    const blankOnPopup = mount(SelectParts, {
      popup: { 'aria-labelledby': '' },
      trigger: { 'aria-label': 'Region' },
      root: { defaultOpen: true },
    });
    await waitFor(() => expect(shown()).toBe(true));
    expect(byTestId('popup')).toHaveAttribute('aria-labelledby', '');
    expect(byTestId('popup')).not.toHaveAttribute('aria-label');
    blankOnPopup.unmount();
  });
});
