import { describe, expect, it } from 'vitest';
import { createRenderer, screen, waitFor } from '#test-utils';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Dialog } from '@vase-ui/vue/dialog';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';

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

const fieldParts = (part: string) => (k: string, blankId: BlankId) => (
  <Field.Root invalid>
    <Field.Label {...blankIdIf(part === 'Label', blankId)}>Name {k}</Field.Label>
    <Input {...blankIdIf(part === 'Input', blankId)} data-testid={`control${k}`} />
    <Field.Description {...blankIdIf(part === 'Description', blankId)}>Hint {k}</Field.Description>
    <Field.Error {...blankIdIf(part === 'Error', blankId)}>Wrong {k}</Field.Error>
  </Field.Root>
);

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
