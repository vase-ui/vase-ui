import { describe, expect, it } from 'vitest';
import { createRenderer, screen, waitFor } from '#test-utils';
import { Accordion } from '@vase-ui/vue/accordion';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { Combobox } from '@vase-ui/vue/combobox';
import { DateField } from '@vase-ui/vue/date-field';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Field } from '@vase-ui/vue/field';
import { Fieldset } from '@vase-ui/vue/fieldset';
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
import { Meter } from '@vase-ui/vue/meter';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Progress } from '@vase-ui/vue/progress';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { Switch } from '@vase-ui/vue/switch';
import { Tabs } from '@vase-ui/vue/tabs';
import { TimeField } from '@vase-ui/vue/time-field';
import { Toast } from '@vase-ui/vue/toast';
import { Tooltip } from '@vase-ui/vue/tooltip';
import * as Calendar from '../calendar/index.parts';
import CalendarAncestors from '../calendar/root/CalendarAncestors.test.vue';
import * as Resizable from '../resizable/index.parts';

// `id=""` goes on the part under test. A row with `twice` renders two copies, and `k` tells them
// apart in the test ids and the texts.
const emptyId = { id: '' };
const emptyIdIf = (when: boolean) => (when ? emptyId : {});

interface Row {
  name: string;
  tree: (k: string) => unknown;
  twice?: boolean;
  // The element whose name and description each copy must keep.
  named?: (k: string) => { testId: string; name: string; description?: string };
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

function emptyIds() {
  return [...document.querySelectorAll('[id=""]')].map((element) => element.outerHTML.slice(0, 80));
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

const dialogParts = (part: string) => (k: string) => (
  <Dialog.Root defaultOpen modal={false}>
    <Dialog.Trigger {...emptyIdIf(part === 'Trigger')}>Open {k}</Dialog.Trigger>
    <Dialog.Portal>
      <Dialog.Popup {...emptyIdIf(part === 'Popup')} data-testid={`popup${k}`}>
        <Dialog.Title {...emptyIdIf(part === 'Title')}>Title {k}</Dialog.Title>
        <Dialog.Description {...emptyIdIf(part === 'Description')}>
          Description {k}
        </Dialog.Description>
      </Dialog.Popup>
    </Dialog.Portal>
  </Dialog.Root>
);

const popoverParts = (part: string) => (k: string) => (
  <Popover.Root defaultOpen>
    <Popover.Trigger {...emptyIdIf(part === 'Trigger')}>Open {k}</Popover.Trigger>
    <Popover.Portal>
      <Popover.Positioner>
        <Popover.Popup {...emptyIdIf(part === 'Popup')} data-testid={`popup${k}`}>
          <Popover.Title {...emptyIdIf(part === 'Title')}>Title {k}</Popover.Title>
          <Popover.Description {...emptyIdIf(part === 'Description')}>
            Description {k}
          </Popover.Description>
        </Popover.Popup>
      </Popover.Positioner>
    </Popover.Portal>
  </Popover.Root>
);

const menuParts = (part: string) => (k: string) => (
  <Menu.Root defaultOpen>
    <Menu.Trigger {...emptyIdIf(part === 'Trigger')}>Actions {k}</Menu.Trigger>
    <Menu.Portal>
      <Menu.Positioner>
        <Menu.Popup {...emptyIdIf(part === 'Popup')} data-testid={`popup${k}`}>
          <Menu.Item {...emptyIdIf(part === 'Item')}>Rename</Menu.Item>
          <Menu.CheckboxItem {...emptyIdIf(part === 'CheckboxItem')}>Bold</Menu.CheckboxItem>
          <Menu.RadioGroup defaultValue="a">
            <Menu.RadioItem value="a" {...emptyIdIf(part === 'RadioItem')}>
              A
            </Menu.RadioItem>
          </Menu.RadioGroup>
          <Menu.LinkItem href="#" {...emptyIdIf(part === 'LinkItem')}>
            Link
          </Menu.LinkItem>
          <Menu.Group data-testid={`group${k}`}>
            <Menu.GroupLabel {...emptyIdIf(part === 'GroupLabel')}>Group {k}</Menu.GroupLabel>
            <Menu.Item>In group</Menu.Item>
          </Menu.Group>
        </Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  </Menu.Root>
);

const menuFilterParts = (part: string) => (k: string) => (
  <Menu.FilterProvider>
    <Menu.Root defaultOpen>
      <Menu.Trigger>Actions {k}</Menu.Trigger>
      <Menu.Portal>
        <Menu.Positioner>
          <Menu.Popup>
            <Menu.Input aria-label="Filter actions" {...emptyIdIf(part === 'Input')} />
            <Menu.List {...emptyIdIf(part === 'List')} data-testid={`list${k}`}>
              <Menu.Item>Rename</Menu.Item>
            </Menu.List>
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  </Menu.FilterProvider>
);

const navigationMenuParts = (part: string) => (k: string) => (
  <NavigationMenu.Root defaultValue="one">
    <NavigationMenu.List>
      <NavigationMenu.Item value="one">
        <NavigationMenu.Trigger {...emptyIdIf(part === 'Trigger')}>One {k}</NavigationMenu.Trigger>
        <NavigationMenu.Content>Content</NavigationMenu.Content>
      </NavigationMenu.Item>
    </NavigationMenu.List>
    <NavigationMenu.Portal>
      <NavigationMenu.Positioner>
        <NavigationMenu.Popup {...emptyIdIf(part === 'Popup')} data-testid={`popup${k}`}>
          <NavigationMenu.Viewport {...emptyIdIf(part === 'Viewport')} data-testid="ready" />
        </NavigationMenu.Popup>
      </NavigationMenu.Positioner>
    </NavigationMenu.Portal>
  </NavigationMenu.Root>
);

const selectParts = (part: string) => (k: string) => (
  <Field.Root>
    <Field.Label>Fruit {k}</Field.Label>
    <Select.Root defaultOpen {...emptyIdIf(part === 'Root')}>
      <Select.Trigger {...emptyIdIf(part === 'Trigger')} data-testid={`trigger${k}`}>
        <Select.Value placeholder="Pick" />
      </Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup {...emptyIdIf(part === 'Popup')}>
            <Select.List {...emptyIdIf(part === 'List')}>
              <Select.Group data-testid={`group${k}`}>
                <Select.GroupLabel {...emptyIdIf(part === 'GroupLabel')}>
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

const comboboxParts = (part: string) => (k: string) => (
  <Field.Root>
    <Field.Label>Fruit {k}</Field.Label>
    <Combobox.Root defaultOpen items={['a', 'b']} {...emptyIdIf(part === 'Root')}>
      <Combobox.Input {...emptyIdIf(part === 'Input')} data-testid={`input${k}`} />
      <Combobox.Trigger {...emptyIdIf(part === 'Trigger')} />
      <Combobox.Portal>
        <Combobox.Positioner>
          <Combobox.Popup {...emptyIdIf(part === 'Popup')}>
            <Combobox.List {...emptyIdIf(part === 'List')}>
              <Combobox.Group data-testid={`group${k}`}>
                <Combobox.GroupLabel {...emptyIdIf(part === 'GroupLabel')}>
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

const fieldParts = (part: string) => (k: string) => (
  <Field.Root invalid>
    <Field.Label {...emptyIdIf(part === 'Label')}>Name {k}</Field.Label>
    <Field.Control {...emptyIdIf(part === 'Control')} data-testid={`control${k}`} />
    <Field.Description {...emptyIdIf(part === 'Description')}>Hint {k}</Field.Description>
    <Field.Error {...emptyIdIf(part === 'Error')} match>
      Wrong {k}
    </Field.Error>
  </Field.Root>
);

const tabsParts = (part: string) => (k: string) => (
  <Tabs.Root defaultValue="a">
    <Tabs.List>
      <Tabs.Tab value="a" {...emptyIdIf(part === 'Tab')}>
        Tab {k}
      </Tabs.Tab>
    </Tabs.List>
    <Tabs.Panel value="a" {...emptyIdIf(part === 'Panel')} data-testid={`panel${k}`}>
      Panel
    </Tabs.Panel>
  </Tabs.Root>
);

const toastParts = (part: string) => (k: string) => (
  <Toast.Provider>
    <Toast.Viewport>
      <Toast.Root
        toast={{ id: `toast${k}`, title: `Saved ${k}`, description: `Copied ${k}` }}
        data-testid={`toast${k}`}
      >
        <Toast.Title {...emptyIdIf(part === 'Title')} />
        <Toast.Description {...emptyIdIf(part === 'Description')} />
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
  {
    name: 'Collapsible.Panel',
    tree: () => (
      <Collapsible.Root defaultOpen>
        <Collapsible.Trigger>Toggle</Collapsible.Trigger>
        <Collapsible.Panel {...emptyId}>Content</Collapsible.Panel>
      </Collapsible.Root>
    ),
  },
  ...(['Trigger', 'Panel'] as const).map((part): Row => ({
    name: `Accordion.${part}`,
    tree: (k) => (
      <Accordion.Root defaultValue={['a']}>
        <Accordion.Item value="a">
          <Accordion.Header>
            <Accordion.Trigger {...emptyIdIf(part === 'Trigger')}>Trigger {k}</Accordion.Trigger>
          </Accordion.Header>
          <Accordion.Panel {...emptyIdIf(part === 'Panel')} data-testid={`panel${k}`}>
            Content
          </Accordion.Panel>
        </Accordion.Item>
      </Accordion.Root>
    ),
    named: (k) => ({ testId: `panel${k}`, name: `Trigger ${k}` }),
  })),
  ...(['Title', 'Description', 'Trigger', 'Popup'] as const).map((part): Row => ({
    name: `Dialog.${part}`,
    tree: dialogParts(part),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}`, description: `Description ${k}` }),
  })),
  {
    name: 'AlertDialog.Title',
    tree: (k) => (
      <AlertDialog.Root defaultOpen>
        <AlertDialog.Portal>
          <AlertDialog.Popup data-testid={`popup${k}`}>
            <AlertDialog.Title {...emptyId}>Title {k}</AlertDialog.Title>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}` }),
  },
  {
    name: 'Drawer.SwipeArea',
    tree: () => (
      <Drawer.Root>
        <Drawer.SwipeArea {...emptyId} />
      </Drawer.Root>
    ),
  },
  ...(['Title', 'Description', 'Trigger', 'Popup'] as const).map((part): Row => ({
    name: `Popover.${part}`,
    tree: popoverParts(part),
    named: (k) => ({ testId: `popup${k}`, name: `Title ${k}`, description: `Description ${k}` }),
  })),
  {
    name: 'PreviewCard.Trigger',
    ready: 'ready',
    tree: () => (
      <PreviewCard.Root defaultOpen>
        <PreviewCard.Trigger href="#" {...emptyId}>
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
  {
    name: 'Tooltip.Trigger',
    ready: 'ready',
    tree: () => (
      <Tooltip.Root defaultOpen>
        <Tooltip.Trigger {...emptyId}>Hover</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-testid="ready">Tip</Tooltip.Popup>
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
  },
  ...(['Trigger', 'Popup', 'Item', 'CheckboxItem', 'RadioItem', 'LinkItem'] as const).map(
    (part): Row => ({
      name: `Menu.${part}`,
      tree: menuParts(part),
      named: (k) => ({ testId: `popup${k}`, name: `Actions ${k}` }),
    }),
  ),
  {
    name: 'Menu.GroupLabel',
    tree: menuParts('GroupLabel'),
    named: (k) => ({ testId: `group${k}`, name: `Group ${k}` }),
  },
  ...(['List', 'Input'] as const).map((part): Row => ({
    name: `Menu.${part} with a filter`,
    tree: menuFilterParts(part),
    named: (k) => ({ testId: `list${k}`, name: `Actions ${k}` }),
  })),
  {
    name: 'Menubar',
    ready: 'ready',
    tree: () => (
      <Menubar {...emptyId}>
        <Menu.Root defaultOpen>
          <Menu.Trigger>File</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="ready">
                <Menu.Item>New</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menubar>
    ),
  },
  ...(['Trigger', 'Popup', 'Viewport'] as const).map((part): Row => ({
    name: `NavigationMenu.${part}`,
    tree: navigationMenuParts(part),
    ready: 'ready',
    named: (k) => ({ testId: `popup${k}`, name: `One ${k}` }),
  })),
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
  {
    name: 'Autocomplete.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Search {k}</Field.Label>
        <Autocomplete.Root defaultOpen items={['a', 'b']} {...emptyId}>
          <Autocomplete.Input data-testid={`input${k}`} />
          <Autocomplete.Portal>
            <Autocomplete.Positioner>
              <Autocomplete.Popup>
                <Autocomplete.List>
                  <Autocomplete.Item value="a">A</Autocomplete.Item>
                </Autocomplete.List>
              </Autocomplete.Popup>
            </Autocomplete.Positioner>
          </Autocomplete.Portal>
        </Autocomplete.Root>
      </Field.Root>
    ),
    named: labelled('input', 'Search'),
  },
  ...(['Control', 'Label', 'Description', 'Error'] as const).map((part): Row => ({
    name: `Field.${part}`,
    tree: fieldParts(part),
    twice: true,
    named: (k) => ({
      testId: `control${k}`,
      name: `Name ${k}`,
      description: `Hint ${k} Wrong ${k}`,
    }),
  })),
  {
    name: 'Fieldset.Legend',
    tree: (k) => (
      <Fieldset.Root data-testid={`fieldset${k}`}>
        <Fieldset.Legend {...emptyId}>Address {k}</Fieldset.Legend>
      </Fieldset.Root>
    ),
    named: (k) => ({ testId: `fieldset${k}`, name: `Address ${k}` }),
  },
  {
    name: 'Checkbox.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Terms {k}</Field.Label>
        <Checkbox.Root {...emptyId} data-testid={`control${k}`} />
      </Field.Root>
    ),
    named: labelled('control', 'Terms'),
  },
  {
    name: 'CheckboxGroup',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Fruits {k}</Field.Label>
        <CheckboxGroup {...emptyId} data-testid={`control${k}`}>
          <Checkbox.Root value="a" />
        </CheckboxGroup>
      </Field.Root>
    ),
    named: labelled('control', 'Fruits'),
  },
  {
    name: 'Radio.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Small {k}</Field.Label>
        <Radio.Root value="a" {...emptyId} data-testid={`control${k}`} />
      </Field.Root>
    ),
    named: labelled('control', 'Small'),
  },
  {
    name: 'RadioGroup',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Size {k}</Field.Label>
        <RadioGroup {...emptyId} data-testid={`control${k}`}>
          <Radio.Root value="a" />
        </RadioGroup>
      </Field.Root>
    ),
    named: labelled('control', 'Size'),
  },
  {
    name: 'Switch.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Wifi {k}</Field.Label>
        <Switch.Root {...emptyId} data-testid={`control${k}`} />
      </Field.Root>
    ),
    named: labelled('control', 'Wifi'),
  },
  {
    name: 'NumberField.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Amount {k}</Field.Label>
        <NumberField.Root {...emptyId}>
          <NumberField.Input data-testid={`control${k}`} />
        </NumberField.Root>
      </Field.Root>
    ),
    named: labelled('control', 'Amount'),
  },
  {
    name: 'OTPField.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Code {k}</Field.Label>
        <OTPField.Root length={2} {...emptyId}>
          <OTPField.Input data-testid={`control${k}`} />
          <OTPField.Input />
        </OTPField.Root>
      </Field.Root>
    ),
    named: labelled('control', 'Code'),
  },
  {
    name: 'DateField.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Arrival {k}</Field.Label>
        <DateField.Root {...emptyId} data-testid={`control${k}`}>
          <DateField.Input />
        </DateField.Root>
      </Field.Root>
    ),
    named: labelled('control', 'Arrival'),
  },
  {
    name: 'TimeField.Root',
    twice: true,
    tree: (k) => (
      <Field.Root>
        <Field.Label>Start {k}</Field.Label>
        <TimeField.Root {...emptyId} data-testid={`control${k}`}>
          <TimeField.Input />
        </TimeField.Root>
      </Field.Root>
    ),
    named: labelled('control', 'Start'),
  },
  {
    name: 'Slider.Root',
    twice: true,
    tree: (k) => (
      <Slider.Root defaultValue={50} {...emptyId} data-testid={`slider${k}`}>
        <Slider.Label>Volume {k}</Slider.Label>
        <Slider.Control>
          <Slider.Thumb />
        </Slider.Control>
      </Slider.Root>
    ),
    named: labelled('slider', 'Volume'),
  },
  {
    name: 'Meter.Label',
    tree: (k) => (
      <Meter.Root value={50} data-testid={`meter${k}`}>
        <Meter.Label {...emptyId}>Storage {k}</Meter.Label>
      </Meter.Root>
    ),
    named: labelled('meter', 'Storage'),
  },
  {
    name: 'Progress.Label',
    tree: (k) => (
      <Progress.Root value={50} data-testid={`progress${k}`}>
        <Progress.Label {...emptyId}>Upload {k}</Progress.Label>
      </Progress.Root>
    ),
    named: labelled('progress', 'Upload'),
  },
  ...(['Tab', 'Panel'] as const).map((part): Row => ({
    name: `Tabs.${part}`,
    tree: tabsParts(part),
    named: (k) => ({ testId: `panel${k}`, name: `Tab ${k}` }),
  })),
  ...(['Title', 'Description'] as const).map((part): Row => ({
    name: `Toast.${part}`,
    tree: toastParts(part),
    named: (k) => ({ testId: `toast${k}`, name: `Saved ${k}`, description: `Copied ${k}` }),
  })),
  {
    name: 'Calendar.Caption',
    tree: () => (
      <CalendarAncestors level="month">
        <Calendar.Caption {...emptyId} />
        <Calendar.Grid data-testid="grid" />
      </CalendarAncestors>
    ),
    named: () => ({ testId: 'grid', name: 'November 2026' }),
  },
  {
    // Two panels with one id would share one size of the layout.
    name: 'Resizable.Panel',
    tree: () => (
      <div style={{ width: '600px', height: '100px' }}>
        <Resizable.Root style={{ height: '100%' }}>
          <Resizable.Panel {...emptyId} />
          <Resizable.Handle />
          <Resizable.Panel {...emptyId} />
        </Resizable.Root>
      </div>
    ),
  },
];

describe('VUE-93: an empty id counts as no id', () => {
  const { render } = createRenderer();

  it.each(rows)('$name', async ({ tree, twice, named, ready }) => {
    const copies = twice ? ['1', '2'] : ['1'];
    await render(() => <div>{copies.map((k) => tree(k))}</div>);
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
    }

    expect(emptyIds()).toEqual([]);
    expect(duplicateIds()).toEqual([]);
    expect(unresolvedReferences()).toEqual([]);
  });
});
