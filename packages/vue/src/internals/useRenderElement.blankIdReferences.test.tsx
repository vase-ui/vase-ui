import type { UserEvent } from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { HTMLAttributes, VNode } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { Accordion } from '@vase-ui/vue/accordion';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { Combobox } from '@vase-ui/vue/combobox';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { NumberField } from '@vase-ui/vue/number-field';
import { Popover } from '@vase-ui/vue/popover';
import { Resizable } from '@vase-ui/vue/resizable';
import { Select } from '@vase-ui/vue/select';
import { Tabs } from '@vase-ui/vue/tabs';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { Toast } from '@vase-ui/vue/toast';
import { useRender } from '@vase-ui/vue/use-render';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

const ID_REFERENCE_ATTRIBUTES = [
  'aria-activedescendant',
  'aria-controls',
  'aria-describedby',
  'aria-details',
  'aria-errormessage',
  'aria-flowto',
  'aria-owns',
  'for',
] as const;

type IdReferenceAttribute = (typeof ID_REFERENCE_ATTRIBUTES)[number];

const partReferences = Object.fromEntries(
  ID_REFERENCE_ATTRIBUTES.map((attribute) => [attribute, `part-${attribute}`]),
);

const getAttributes = vi.fn<(attrs: Record<string, any>) => void>();

const Part = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      props: (attrs) => {
        getAttributes(attrs);
        return [partReferences, attrs];
      },
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

const Note = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps, tag } = useRender(props, {
      props: (attrs) => [{ role: 'note', 'aria-describedby': 'note-text' }, attrs],
    });
    return () => h(tag.value, elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

interface Row {
  // The part that gets the blank attribute of the consumer.
  part: string;
  // The attribute of the consumer that would replace the value of the part.
  attribute: IdReferenceAttribute;
  // The node gives `attrs`, the attributes of the consumer, to the part under test.
  createNode: (attrs: Record<string, string>) => VNode;
  // The element that the part refers to. The default is the element with the test id `target`.
  getTarget?: () => HTMLElement;
  // The step that makes the part write the attribute, for a part that the render does not show.
  show?: (user: UserEvent) => Promise<void>;
}

const BLANKS = [
  { blank: 'an empty value', value: '' },
  { blank: 'white space', value: '\n\t ' },
];

// `Dialog`, `AlertDialog` and `Drawer` have the same parts.
function createDialog(
  parts: typeof Dialog | typeof AlertDialog | typeof Drawer,
  tested: 'popup' | 'trigger',
  attrs: Record<string, string>,
) {
  const { Root, Trigger, Portal, Popup, Title, Description } = parts as typeof Dialog;
  const popup = (
    <Popup
      data-testid={tested === 'popup' ? 'part' : 'target'}
      {...(tested === 'popup' ? attrs : undefined)}
    >
      <Title>Settings</Title>
      <Description data-testid={tested === 'popup' ? 'target' : undefined}>Change them</Description>
    </Popup>
  );
  return (
    <Root defaultOpen>
      <Trigger
        data-testid={tested === 'trigger' ? 'part' : undefined}
        {...(tested === 'trigger' ? attrs : undefined)}
      >
        Open
      </Trigger>
      <Portal>{parts === Drawer ? <Drawer.Viewport>{popup}</Drawer.Viewport> : popup}</Portal>
    </Root>
  );
}

function createCombobox(tested: 'input' | 'trigger', attrs: Record<string, string>) {
  return (
    <Combobox.Root defaultOpen>
      <Combobox.Input
        data-testid={tested === 'input' ? 'part' : undefined}
        {...(tested === 'input' ? attrs : undefined)}
      />
      <Combobox.Trigger
        data-testid={tested === 'trigger' ? 'part' : undefined}
        {...(tested === 'trigger' ? attrs : undefined)}
      >
        Open
      </Combobox.Trigger>
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup>
            <Combobox.List data-testid="target">
              <Combobox.Item value="Apple">Apple</Combobox.Item>
              <Combobox.Item value="Banana">Banana</Combobox.Item>
            </Combobox.List>
          </Combobox.Popup>
        </Combobox.Positioner>
      </Combobox.Portal>
    </Combobox.Root>
  );
}

function createAutocomplete(attrs: Record<string, string>) {
  return (
    <Autocomplete.Root defaultOpen>
      <Autocomplete.Input data-testid="part" {...attrs} />
      <Autocomplete.Portal>
        <Autocomplete.Positioner>
          <Autocomplete.Popup>
            <Autocomplete.List data-testid="target">
              <Autocomplete.Item value="Apple">Apple</Autocomplete.Item>
              <Autocomplete.Item value="Banana">Banana</Autocomplete.Item>
            </Autocomplete.List>
          </Autocomplete.Popup>
        </Autocomplete.Positioner>
      </Autocomplete.Portal>
    </Autocomplete.Root>
  );
}

function createMenuWithInput(attrs: Record<string, string>) {
  return (
    <Menu.FilterProvider>
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Input aria-label="Filter actions" data-testid="part" {...attrs} />
              <Menu.List data-testid="target">
                <Menu.Item>Rename</Menu.Item>
                <Menu.Item>Delete</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    </Menu.FilterProvider>
  );
}

// The input then has virtual focus on the first item.
async function highlightFirstItem(user: UserEvent) {
  screen.getByTestId('part').focus();
  await flushMicrotasks();
  await user.keyboard('[ArrowDown]');
  await flushMicrotasks();
}

const rows: Row[] = [
  {
    part: 'Toast.Root',
    attribute: 'aria-describedby',
    createNode: (attrs) => (
      <Toast.Provider>
        <Toast.Viewport>
          <Toast.Root
            toast={{ id: 'test', title: 'Saved', description: 'Copied' }}
            data-testid="part"
            {...attrs}
          >
            <Toast.Title />
            <Toast.Description data-testid="target" />
          </Toast.Root>
        </Toast.Viewport>
      </Toast.Provider>
    ),
  },
  {
    part: 'Dialog.Popup',
    attribute: 'aria-describedby',
    createNode: (attrs) => createDialog(Dialog, 'popup', attrs),
  },
  {
    part: 'AlertDialog.Popup',
    attribute: 'aria-describedby',
    createNode: (attrs) => createDialog(AlertDialog, 'popup', attrs),
  },
  {
    part: 'Drawer.Popup',
    attribute: 'aria-describedby',
    createNode: (attrs) => createDialog(Drawer, 'popup', attrs),
  },
  {
    part: 'Popover.Popup',
    attribute: 'aria-describedby',
    createNode: (attrs) => (
      <Popover.Root defaultOpen>
        <Popover.Trigger>Open</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="part" {...attrs}>
              <Popover.Title>Title</Popover.Title>
              <Popover.Description data-testid="target">Text</Popover.Description>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  },
  {
    part: 'Accordion.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Accordion.Root defaultValue={['a']}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger data-testid="part" {...attrs}>
              Section
            </Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel data-testid="target">Text</Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ),
  },
  {
    part: 'Collapsible.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger data-testid="part" {...attrs}>
          Section
        </Collapsible.Trigger>
        <Collapsible.Panel data-testid="target">Text</Collapsible.Panel>
      </Collapsible.Root>
    ),
  },
  {
    part: 'Dialog.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => createDialog(Dialog, 'trigger', attrs),
  },
  {
    part: 'AlertDialog.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => createDialog(AlertDialog, 'trigger', attrs),
  },
  {
    part: 'Drawer.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => createDialog(Drawer, 'trigger', attrs),
  },
  {
    part: 'Popover.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Popover.Root defaultOpen>
        <Popover.Trigger data-testid="part" {...attrs}>
          Open
        </Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="target">Text</Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ),
  },
  {
    part: 'Menu.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger data-testid="part" {...attrs}>
          Actions
        </Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="target">
              <Menu.Item>Rename</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  {
    part: 'Menu.SubmenuTrigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.SubmenuRoot defaultOpen>
                <Menu.SubmenuTrigger data-testid="part" {...attrs}>
                  More
                </Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="target">
                      <Menu.Item>Archive</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  },
  {
    part: 'NavigationMenu.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="products">
            <NavigationMenu.Trigger data-testid="part" {...attrs}>
              Products
            </NavigationMenu.Trigger>
            <NavigationMenu.Content>
              <NavigationMenu.Link href="#products">All products</NavigationMenu.Link>
            </NavigationMenu.Content>
          </NavigationMenu.Item>
        </NavigationMenu.List>
        <NavigationMenu.Portal>
          <NavigationMenu.Positioner>
            <NavigationMenu.Popup data-testid="target">
              <NavigationMenu.Viewport />
            </NavigationMenu.Popup>
          </NavigationMenu.Positioner>
        </NavigationMenu.Portal>
      </NavigationMenu.Root>
    ),
    show: async () => {
      await fireEvent.click(screen.getByTestId('part'));
      await flushMicrotasks();
    },
  },
  {
    part: 'Select.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Select.Root defaultOpen>
        <Select.Trigger data-testid="part" {...attrs}>
          <Select.Value />
        </Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item value="a">A</Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
    ),
    getTarget: () => screen.getByRole('listbox'),
  },
  {
    part: 'Combobox.Trigger',
    attribute: 'aria-controls',
    createNode: (attrs) => createCombobox('trigger', attrs),
  },
  {
    part: 'Combobox.Input',
    attribute: 'aria-controls',
    createNode: (attrs) => createCombobox('input', attrs),
  },
  {
    part: 'Autocomplete.Input',
    attribute: 'aria-controls',
    createNode: createAutocomplete,
  },
  {
    part: 'Menu.Input',
    attribute: 'aria-controls',
    createNode: createMenuWithInput,
  },
  {
    part: 'NumberField.Increment',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <NumberField.Root>
        <NumberField.Input data-testid="target" />
        <NumberField.Increment data-testid="part" {...attrs} />
      </NumberField.Root>
    ),
  },
  {
    part: 'NumberField.Decrement',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <NumberField.Root>
        <NumberField.Input data-testid="target" />
        <NumberField.Decrement data-testid="part" {...attrs} />
      </NumberField.Root>
    ),
  },
  {
    part: 'Resizable.Handle',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <div style={{ width: '1000px', height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel id="a" data-testid="target" />
          <Resizable.Handle data-testid="part" {...attrs} />
          <Resizable.Panel id="b" />
        </Resizable.Root>
      </div>
    ),
  },
  {
    part: 'Tabs.Tab',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a" data-testid="part" {...attrs}>
            Overview
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" data-testid="target">
          Text
        </Tabs.Panel>
      </Tabs.Root>
    ),
  },
  {
    part: 'Combobox.Input',
    attribute: 'aria-controls',
    createNode: (attrs) => createCombobox('input', attrs),
  },
  {
    part: 'Autocomplete.Input',
    attribute: 'aria-controls',
    createNode: createAutocomplete,
  },
  {
    part: 'Menu.Input',
    attribute: 'aria-controls',
    createNode: createMenuWithInput,
  },
  {
    part: 'NumberField.Increment',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <NumberField.Root>
        <NumberField.Input data-testid="target" />
        <NumberField.Increment data-testid="part" {...attrs} />
      </NumberField.Root>
    ),
  },
  {
    part: 'NumberField.Decrement',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <NumberField.Root>
        <NumberField.Input data-testid="target" />
        <NumberField.Decrement data-testid="part" {...attrs} />
      </NumberField.Root>
    ),
  },
  {
    part: 'Resizable.Handle',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <div style={{ width: '1000px', height: '400px' }}>
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel id="a" data-testid="target" />
          <Resizable.Handle data-testid="part" {...attrs} />
          <Resizable.Panel id="b" />
        </Resizable.Root>
      </div>
    ),
  },
  {
    part: 'Tabs.Tab',
    attribute: 'aria-controls',
    createNode: (attrs) => (
      <Tabs.Root defaultValue="a">
        <Tabs.List>
          <Tabs.Tab value="a" data-testid="part" {...attrs}>
            Overview
          </Tabs.Tab>
        </Tabs.List>
        <Tabs.Panel value="a" data-testid="target">
          Text
        </Tabs.Panel>
      </Tabs.Root>
    ),
  },
  {
    part: 'Combobox.Input',
    attribute: 'aria-activedescendant',
    createNode: (attrs) => createCombobox('input', attrs),
    show: highlightFirstItem,
    getTarget: () => screen.getByRole('option', { name: 'Apple' }),
  },
  {
    part: 'Autocomplete.Input',
    attribute: 'aria-activedescendant',
    createNode: createAutocomplete,
    show: highlightFirstItem,
    getTarget: () => screen.getByRole('option', { name: 'Apple' }),
  },
  {
    part: 'Menu.Input',
    attribute: 'aria-activedescendant',
    createNode: createMenuWithInput,
    show: highlightFirstItem,
    getTarget: () => screen.getByRole('menuitem', { name: 'Rename' }),
  },
];

describe('VUE-110: a blank ID reference attribute of the consumer', () => {
  const { render } = createRenderer();

  it.each(rows)(
    'keeps the $attribute of $part for an empty value',
    async ({ attribute, createNode, getTarget, show }) => {
      const { user } = await render(createNode({ [attribute]: '' }));
      await show?.(user);

      // The id of the element can come one render after the mount.
      const id = await waitFor(() => {
        const { id: targetId } = (getTarget ?? (() => screen.getByTestId('target')))();
        expect(targetId).toMatch(/\S/);
        return targetId;
      });
      await waitFor(() => {
        expect(screen.getByTestId('part')).toHaveAttribute(attribute, id);
      });
    },
  );

  it.each(
    ID_REFERENCE_ATTRIBUTES.flatMap((attribute) =>
      BLANKS.map(({ blank, value }) => ({ attribute, blank, value })),
    ),
  )('gives the props function no $attribute key for $blank', async ({ attribute, value }) => {
    await render(<Part data-testid="part" {...{ [attribute]: value }} />);

    expect(screen.getByTestId('part')).toHaveAttribute(attribute, `part-${attribute}`);
    expect(getAttributes.mock.lastCall?.[0]).toStrictEqual({ 'data-testid': 'part' });
  });

  it('keeps the description of a useRender component', async () => {
    await render(<Note aria-describedby="" data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('aria-describedby', 'note-text');
  });

  it('gives a reference that is not blank the place of the value of the part', async () => {
    await render(<Part aria-describedby="own-text" aria-controls="own-panel" data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).toHaveAttribute('aria-describedby', 'own-text');
    expect(part).toHaveAttribute('aria-controls', 'own-panel');
  });

  describe('declared prop ariaDescribedby', () => {
    it.each(BLANKS)(
      'gives the input of TimeClock.Face no attribute for $blank',
      async ({ value }) => {
        await render(
          <TimeClock.Root locale="en-US">
            <TimeClock.Face aria-describedby={value} />
          </TimeClock.Root>,
        );
        await flushMicrotasks();

        expect(screen.getByRole('slider')).not.toHaveAttribute('aria-describedby');
      },
    );
  });
});
