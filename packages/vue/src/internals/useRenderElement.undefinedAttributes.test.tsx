import { describe, expect, it } from 'vitest';
import type { VNode } from 'vue';
import { createRenderer, screen, waitFor } from '#test-utils';
import { Accordion } from '@vase-ui/vue/accordion';
import { Button } from '@vase-ui/vue/button';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { Dialog } from '@vase-ui/vue/dialog';
import { Field } from '@vase-ui/vue/field';
import { Menu } from '@vase-ui/vue/menu';
import { Popover } from '@vase-ui/vue/popover';
import { Progress } from '@vase-ui/vue/progress';
import { Select } from '@vase-ui/vue/select';
import { Separator } from '@vase-ui/vue/separator';
import { Switch } from '@vase-ui/vue/switch';
import { Tabs } from '@vase-ui/vue/tabs';
import { Toast } from '@vase-ui/vue/toast';

interface Row {
  name: string;
  attribute: string;
  createNode: () => VNode;
  // The value that the part gives with no attribute of the consumer.
  expected: () => string;
}

const rows: Row[] = [
  {
    name: 'Toast.Root aria-labelledby',
    attribute: 'aria-labelledby',
    createNode: () => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root
            toast={{ id: 't', title: 'Saved' }}
            aria-labelledby={undefined}
            data-testid="part"
          >
            <Toast.Title data-testid="target" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ),
    expected: () => screen.getByTestId('target').id,
  },
  {
    name: 'Dialog.Popup aria-labelledby',
    attribute: 'aria-labelledby',
    createNode: () => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup aria-labelledby={undefined} data-testid="part">
            <Dialog.Title data-testid="target">Title</Dialog.Title>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>
    ),
    expected: () => screen.getByTestId('target').id,
  },
  {
    name: 'Popover.Popup role',
    attribute: 'role',
    createNode: () => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup role={undefined} data-testid="part" />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
    expected: () => 'dialog',
  },
  {
    name: 'Menu.Trigger aria-haspopup',
    attribute: 'aria-haspopup',
    createNode: () => (
      <Menu.Root>
        <Menu.Trigger aria-haspopup={undefined} data-testid="part">
          Open
        </Menu.Trigger>
      </Menu.Root>
    ),
    expected: () => 'menu',
  },
  {
    name: 'Select.Trigger aria-haspopup',
    attribute: 'aria-haspopup',
    createNode: () => (
      <Select.Root>
        <Select.Trigger aria-haspopup={undefined} data-testid="part" />
      </Select.Root>
    ),
    expected: () => 'listbox',
  },
  {
    name: 'Field.Label for',
    attribute: 'for',
    createNode: () => (
      <Field.Root>
        <Field.Label for={undefined} data-testid="part">
          Name
        </Field.Label>
        <Field.Control data-testid="target" />
      </Field.Root>
    ),
    expected: () => screen.getByTestId('target').id,
  },
  {
    name: 'Tabs.Tab aria-controls',
    attribute: 'aria-controls',
    createNode: () => (
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a" aria-controls={undefined} data-testid="part">
            A
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" data-testid="target" />
      </Tabs.Root>
    ),
    expected: () => screen.getByTestId('target').id,
  },
  {
    name: 'Accordion.Trigger aria-expanded',
    attribute: 'aria-expanded',
    createNode: () => (
      <Accordion.Root>
        <Accordion.Item>
          <Accordion.Header>
            <Accordion.Trigger aria-expanded={undefined} data-testid="part">
              A
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel />
        </Accordion.Item>
      </Accordion.Root>
    ),
    expected: () => 'false',
  },
  {
    name: 'Button type',
    attribute: 'type',
    createNode: () => (
      <form>
        <Button type={undefined} data-testid="part">
          Save
        </Button>
      </form>
    ),
    expected: () => 'button',
  },
  {
    name: 'Checkbox.Root role',
    attribute: 'role',
    createNode: () => <Checkbox.Root role={undefined} data-testid="part" />,
    expected: () => 'checkbox',
  },
  {
    name: 'Progress.Root aria-valuenow',
    attribute: 'aria-valuenow',
    createNode: () => <Progress.Root value={30} aria-valuenow={undefined} data-testid="part" />,
    expected: () => '30',
  },
  {
    name: 'Separator role',
    attribute: 'role',
    createNode: () => <Separator role={undefined} data-testid="part" />,
    expected: () => 'separator',
  },
  {
    name: 'Switch.Root data-checked',
    attribute: 'data-checked',
    createNode: () => <Switch.Root defaultChecked data-checked={undefined} data-testid="part" />,
    expected: () => '',
  },
  {
    name: 'Collapsible.Trigger aria-controls',
    attribute: 'aria-controls',
    createNode: () => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger aria-controls={undefined} data-testid="part">
          A
        </Collapsible.Trigger>
        <Collapsible.Panel data-testid="target" />
      </Collapsible.Root>
    ),
    expected: () => screen.getByTestId('target').id,
  },
];

describe('VUE-103: an attribute of the consumer that is undefined', () => {
  const { render } = createRenderer();

  it.each(rows)('keeps $name of the part', async ({ attribute, createNode, expected }) => {
    await render(createNode());

    await waitFor(() => {
      expect(screen.getByTestId('part')).toHaveAttribute(attribute, expected());
    });
  });
});
