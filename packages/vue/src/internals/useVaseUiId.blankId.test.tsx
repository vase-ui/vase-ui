import { describe, expect, it } from 'vitest';
import { createRenderer, screen, waitFor } from '#test-utils';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Combobox } from '@vase-ui/vue/combobox';
import { Dialog } from '@vase-ui/vue/dialog';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
import { Toast } from '@vase-ui/vue/toast';

interface BlankId {
  id: string;
}

const blankIdIf = (when: boolean, blankId: BlankId) => (when ? blankId : {});

interface Row {
  name: string;
  tree: (k: string, blankId: BlankId) => unknown;
  // Two copies reveal ids that both parts derive from the same blank override.
  twice?: boolean;
  // The element whose name and description each copy must keep.
  named?: (k: string) => {
    testId: string;
    name: string;
    description?: string;
    nativeLabel?: boolean;
  };
  // The test id of a part that mounts after the first render. The row waits for it first.
  ready?: string;
}

const REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-labelledby',
  'aria-owns',
  'for',
];

function blankIds() {
  return [...document.querySelectorAll('[id]')]
    .filter((element) => element.id.trim() === '')
    .map((element) => element.outerHTML.slice(0, 80));
}

function duplicateIds() {
  const counts = new Map<string, number>();
  for (const element of document.querySelectorAll('[id]')) {
    counts.set(element.id, (counts.get(element.id) ?? 0) + 1);
  }
  return [...counts].filter(([, count]) => count > 1).map(([id]) => id);
}

// Each ID reference must name at least one id, and each id that it names must be on an element.
function unresolvedReferences() {
  const unresolved: string[] = [];
  for (const element of document.querySelectorAll('*')) {
    for (const attribute of REFERENCE_ATTRIBUTES) {
      const value = element.getAttribute(attribute);
      if (value === null) {
        continue;
      }
      const ids = value.split(/\s+/).filter(Boolean);
      if (ids.length === 0 || ids.some((id) => document.getElementById(id) === null)) {
        unresolved.push(`${attribute}="${value}" on ${element.tagName.toLowerCase()}`);
      }
    }
  }
  return unresolved;
}

const dialogParts = (part: string) => (k: string, blankId: BlankId) => (
  <Dialog.Root defaultOpen modal={false}>
    <Dialog.Trigger {...blankIdIf(part === 'Trigger', blankId)}>Open {k}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup {...blankIdIf(part === 'Popup', blankId)} data-testid={`popup${k}`}>
        <Dialog.Title {...blankIdIf(part === 'Title', blankId)}>Title {k}</Dialog.Title>
        <Dialog.Description {...blankIdIf(part === 'Description', blankId)}>
          Description {k}
        </Dialog.Description>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

const popoverParts = (part: string) => (k: string, blankId: BlankId) => (
  <Popover.Root defaultOpen>
    <Popover.Trigger {...blankIdIf(part === 'Trigger', blankId)}>Open {k}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup {...blankIdIf(part === 'Popup', blankId)} data-testid={`popup${k}`}>
          <Popover.Title {...blankIdIf(part === 'Title', blankId)}>Title {k}</Popover.Title>
          <Popover.Description {...blankIdIf(part === 'Description', blankId)}>
            Description {k}
          </Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

const selectParts = (part: string) => (k: string, blankId: BlankId) => (
  <Field.Root>
    <Field.Label>Fruit {k}</Field.Label>
    <Select.Root defaultOpen {...blankIdIf(part === 'Root', blankId)}>
      <Select.Trigger {...blankIdIf(part === 'Trigger', blankId)} data-testid={`trigger${k}`}>
        <Select.Value placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup {...blankIdIf(part === 'Popup', blankId)}>
            <Select.List {...blankIdIf(part === 'List', blankId)}>
              <Select.Group data-testid={`group${k}`}>
                <Select.GroupLabel {...blankIdIf(part === 'GroupLabel', blankId)}>
                  Group {k}
                </Select.GroupLabel>
                <Select.Item value="a">A</Select.Item>
              </Select.Group>
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  </Field.Root>
);

const comboboxParts = (part: string) => (k: string, blankId: BlankId) => (
  <Field.Root>
    <Field.Label>Fruit {k}</Field.Label>
    <Combobox.Root defaultOpen items={['a', 'b']} {...blankIdIf(part === 'Root', blankId)}>
      <Combobox.Input {...blankIdIf(part === 'Input', blankId)} data-testid={`input${k}`} />
      <Combobox.Trigger {...blankIdIf(part === 'Trigger', blankId)} />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup {...blankIdIf(part === 'Popup', blankId)}>
            <Combobox.List {...blankIdIf(part === 'List', blankId)}>
              <Combobox.Group data-testid={`group${k}`}>
                <Combobox.GroupLabel {...blankIdIf(part === 'GroupLabel', blankId)}>
                  Group {k}
                </Combobox.GroupLabel>
                <Combobox.Item value="a">A</Combobox.Item>
              </Combobox.Group>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  </Field.Root>
);

const fieldParts = (part: string) => (k: string, blankId: BlankId) => (
  <Field.Root invalid>
    <Field.Label {...blankIdIf(part === 'Label', blankId)}>Name {k}</Field.Label>
    <Input {...blankIdIf(part === 'Input', blankId)} data-testid={`control${k}`} />
    <Field.Description {...blankIdIf(part === 'Description', blankId)}>Hint {k}</Field.Description>
    <Field.Error {...blankIdIf(part === 'Error', blankId)}>Wrong {k}</Field.Error>
  </Field.Root>
);

const toastParts = (part: string) => (k: string, blankId: BlankId) => (
  <Toast.Provider>
    <Toast.Viewport>
      <Toast.Root
        toast={{ id: `toast${k}`, title: `Saved ${k}`, description: `Copied ${k}` }}
        data-testid={`toast${k}`}
      >
        <Toast.Title {...blankIdIf(part === 'Title', blankId)} />
        <Toast.Description {...blankIdIf(part === 'Description', blankId)} />
      </Toast.Root>
    </Toast.Viewport>
  </Toast.Provider>
);

// An element and the text of its label. The label names the element with `for` or `aria-labelledby`.
const labelled = (testId: string, label: string) => (k: string) => ({
  testId: `${testId}${k}`,
  name: `${label} ${k}`,
});

const rows: Row[] = [
  ...(['Title', 'Description', 'Trigger', 'Popup'] as const).map((part): Row => ({
    name: `Dialog.${part}`,
    tree: dialogParts(part),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}`, description: `Description ${k}` }),
  })),
  {
    name: 'AlertDialog.Title',
    tree: (k, blankId) => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid={`popup${k}`}>
            <AlertDialog.Title {...blankId}>Title {k}</AlertDialog.Title>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}` }),
  },
  ...(['Title', 'Description', 'Trigger', 'Popup'] as const).map((part): Row => ({
    name: `Popover.${part}`,
    tree: popoverParts(part),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}`, description: `Description ${k}` }),
  })),
  {
    name: 'PreviewCard.Trigger',
    ready: 'ready',
    tree: (_k, blankId) => (
      <PreviewCard.Root defaultOpen>
        <PreviewCard.Trigger href="#" {...blankId}>
          Link
        </PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-testid="ready">Card</PreviewCard.Popup>
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
  },
  ...(['Root', 'Trigger', 'Popup', 'List'] as const).map((part): Row => ({
    name: `Select.${part}`,
    tree: selectParts(part),
    twice: part === 'Root' || part === 'Trigger',
    named: labelled('trigger', 'Fruit'),
  })),
  {
    name: 'Select.GroupLabel',
    tree: selectParts('GroupLabel'),
    named: (k) => ({ testId: `group${k}`, name: `Group ${k}` }),
  },
  ...(['Root', 'Trigger', 'Input', 'Popup', 'List'] as const).map((part): Row => ({
    name: `Combobox.${part}`,
    tree: comboboxParts(part),
    twice: part === 'Root' || part === 'Input',
    named: labelled('input', 'Fruit'),
  })),
  {
    name: 'Combobox.GroupLabel',
    tree: comboboxParts('GroupLabel'),
    named: (k) => ({ testId: `group${k}`, name: `Group ${k}` }),
  },
  ...(['Input', 'Label', 'Description', 'Error'] as const).map((part): Row => ({
    name: part === 'Input' ? part : `Field.${part}`,
    tree: fieldParts(part),
    twice: true,
    named: (k) => ({
      testId: `control${k}`,
      name: `Name ${k}`,
      description: `Hint ${k} Wrong ${k}`,
      nativeLabel: true,
    }),
  })),
  ...(['Title', 'Description'] as const).map((part): Row => ({
    name: `Toast.${part}`,
    tree: toastParts(part),
    named: (k) => ({ testId: `toast${k}`, name: `Saved ${k}`, description: `Copied ${k}` }),
  })),
];

describe.each([
  { blank: 'an empty id', id: '' },
  { blank: 'an id of white space only', id: '\n\t ' },
])('VUE-93: $blank counts as no id', ({ id }) => {
  const { render } = createRenderer();

  it.each(rows)('$name', async ({ tree, twice, named, ready }) => {
    const copies = twice ? ['1', '2'] : ['1'];
    await render(() => <div>{copies.map((k) => tree(k, { id }))}</div>);
    if (ready) {
      await screen.findByTestId(ready);
    }

    for (const k of copies) {
      const expected = named?.(k);
      if (!expected) {
        continue;
      }
      const element = screen.getByTestId(expected.testId);
      await waitFor(() => expect(element).toHaveAccessibleName(expected.name));
      if (expected.description !== undefined) {
        expect(element).toHaveAccessibleDescription(expected.description);
      }
      if (expected.nativeLabel) {
        const label = screen.getByText<HTMLLabelElement>(expected.name, { selector: 'label' });
        expect(label.control).toBe(element);
      }
    }

    expect(blankIds()).toEqual([]);
    expect(duplicateIds()).toEqual([]);
    expect(unresolvedReferences()).toEqual([]);
  });
});
