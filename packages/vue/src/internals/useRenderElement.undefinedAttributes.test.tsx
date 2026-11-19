import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';
import type { ButtonHTMLAttributes, HTMLAttributes, ImgHTMLAttributes, VNode } from 'vue';
import { createRenderer, screen, waitFor } from '#test-utils';
import { Accordion } from '@vase-ui/vue/accordion';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Autocomplete } from '@vase-ui/vue/autocomplete';
import { Avatar } from '@vase-ui/vue/avatar';
import { Button } from '@vase-ui/vue/button';
import { Collapsible } from '@vase-ui/vue/collapsible';
import { Combobox } from '@vase-ui/vue/combobox';
import { ContextMenu } from '@vase-ui/vue/context-menu';
import { DateField } from '@vase-ui/vue/date-field';
import { Dialog } from '@vase-ui/vue/dialog';
import { Drawer } from '@vase-ui/vue/drawer';
import { Menu } from '@vase-ui/vue/menu';
import { Menubar } from '@vase-ui/vue/menubar';
import { Meter } from '@vase-ui/vue/meter';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Popover } from '@vase-ui/vue/popover';
import { PreviewCard } from '@vase-ui/vue/preview-card';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { Tabs } from '@vase-ui/vue/tabs';
import { TimeClock } from '@vase-ui/vue/time-clock';
import { TimeField } from '@vase-ui/vue/time-field';
import { Toast } from '@vase-ui/vue/toast';
import { Toggle } from '@vase-ui/vue/toggle';
import { ToggleGroup } from '@vase-ui/vue/toggle-group';
import { Toolbar } from '@vase-ui/vue/toolbar';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { useRender } from '@vase-ui/vue/use-render';
import * as FilterDropdown from '../../test/filterDropdown';
import * as Calendar from '../calendar/index.parts';
import CalendarAncestors from '../calendar/root/CalendarAncestors.test.vue';
import { NOOP } from '../common/empty';
import * as Resizable from '../resizable/index.parts';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

// 1x1 transparent PNG
const TRANSPARENT_IMAGE_DATA_URI =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

const Note = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps, tag } = useRender(props, {
      props: (attrs) => [{ role: 'note' }, attrs],
    });
    return () => h(tag.value, elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

interface Row {
  name: string;
  attribute: string;
  createNode: () => VNode;
  // The value that the part gives with no attribute of the consumer.
  expected: () => unknown;
}

const targetId = () => screen.getByTestId('target').id;

const rows: Row[] = [
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
    name: 'AlertDialog.Trigger aria-haspopup',
    attribute: 'aria-haspopup',
    createNode: () => (
      <AlertDialog.Root>
        <AlertDialog.Trigger aria-haspopup={undefined} data-testid="part">
          Open
        </AlertDialog.Trigger>
      </AlertDialog.Root>
    ),
    expected: () => 'dialog',
  },
  {
    name: 'Autocomplete.Input role',
    attribute: 'role',
    createNode: () => (
      <Autocomplete.Root>
        <Autocomplete.Input role={undefined} data-testid="part" />
      </Autocomplete.Root>
    ),
    expected: () => 'combobox',
  },
  {
    name: 'Avatar.Image alt',
    attribute: 'alt',
    createNode: () => (
      <Avatar.Root>
        <Avatar.Image src={TRANSPARENT_IMAGE_DATA_URI} alt={undefined} data-testid="part" />
      </Avatar.Root>
    ),
    expected: () => '',
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
    name: 'Calendar.Grid role',
    attribute: 'role',
    createNode: () => (
      <CalendarAncestors level="month">
        <Calendar.Grid role={undefined} data-testid="part" />
      </CalendarAncestors>
    ),
    expected: () => 'grid',
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
    expected: targetId,
  },
  {
    name: 'Combobox.Trigger aria-haspopup',
    attribute: 'aria-haspopup',
    createNode: () => (
      <Combobox.Root>
        <Combobox.Trigger aria-haspopup={undefined} data-testid="part" />
      </Combobox.Root>
    ),
    // With no input, the trigger opens a popup that holds the input.
    expected: () => 'dialog',
  },
  {
    name: 'ContextMenu.Trigger data-popup-open',
    attribute: 'data-popup-open',
    createNode: () => (
      <ContextMenu.Root defaultOpen>
        <ContextMenu.Trigger data-popup-open={undefined} data-testid="part">
          Area
        </ContextMenu.Trigger>
      </ContextMenu.Root>
    ),
    expected: () => '',
  },
  {
    name: 'DateField.Clear aria-label',
    attribute: 'aria-label',
    createNode: () => (
      <DateField.Root>
        <DateField.Input />
        <DateField.Clear aria-label={undefined} data-testid="part" />
      </DateField.Root>
    ),
    expected: () => 'Clear',
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
    expected: targetId,
  },
  {
    name: 'Dialog.Portal id',
    attribute: 'id',
    createNode: () => (
      <Dialog.Root defaultOpen>
        <Dialog.Portal id={undefined} data-testid="part">
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ),
    expected: () => expect.stringMatching(/./),
  },
  {
    name: 'Drawer.Popup role',
    attribute: 'role',
    createNode: () => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup role={undefined} data-testid="part" />
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ),
    expected: () => 'dialog',
  },
  {
    name: 'FilterDropdown.Input role',
    attribute: 'role',
    createNode: () => (
      <FilterDropdown.Root
        open
        value=""
        listRef={shallowRef([])}
        getActiveIndex={() => null}
        setActiveIndex={NOOP}
      >
        <FilterDropdown.Input role={undefined} data-testid="part" />
      </FilterDropdown.Root>
    ),
    expected: () => 'searchbox',
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
    name: 'Menubar role',
    attribute: 'role',
    createNode: () => <Menubar role={undefined} data-testid="part" />,
    expected: () => 'menubar',
  },
  {
    name: 'Meter.Root role',
    attribute: 'role',
    createNode: () => <Meter.Root value={30} role={undefined} data-testid="part" />,
    expected: () => 'meter',
  },
  {
    name: 'NavigationMenu.Trigger aria-expanded',
    attribute: 'aria-expanded',
    createNode: () => (
      <NavigationMenu.Root>
        <NavigationMenu.List>
          <NavigationMenu.Item value="one">
            <NavigationMenu.Trigger aria-expanded={undefined} data-testid="part">
              One
            </NavigationMenu.Trigger>
            <NavigationMenu.Content />
          </NavigationMenu.Item>
        </NavigationMenu.List>
      </NavigationMenu.Root>
    ),
    expected: () => 'false',
  },
  {
    name: 'NumberField.Group role',
    attribute: 'role',
    createNode: () => (
      <NumberField.Root>
        <NumberField.Group role={undefined} data-testid="part" />
      </NumberField.Root>
    ),
    expected: () => 'group',
  },
  {
    name: 'OTPField.Root role',
    attribute: 'role',
    createNode: () => <OTPField.Root length={4} role={undefined} data-testid="part" />,
    expected: () => 'group',
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
    name: 'PreviewCard.Popup data-open',
    attribute: 'data-open',
    createNode: () => (
      <PreviewCard.Root defaultOpen>
        <PreviewCard.Trigger href="#card">Card</PreviewCard.Trigger>
        <PreviewCard.Portal>
          <PreviewCard.Positioner>
            <PreviewCard.Popup data-open={undefined} data-testid="part" />
          </PreviewCard.Positioner>
        </PreviewCard.Portal>
      </PreviewCard.Root>
    ),
    expected: () => '',
  },
  {
    name: 'Resizable.Handle role',
    attribute: 'role',
    createNode: () => (
      <Resizable.Root>
        <Resizable.Panel id="a" />
        <Resizable.Handle role={undefined} aria-label="Resize" data-testid="part" />
        <Resizable.Panel id="b" />
      </Resizable.Root>
    ),
    expected: () => 'separator',
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
    name: 'Select.Separator role',
    attribute: 'role',
    createNode: () => <Select.Separator role={undefined} data-testid="part" />,
    expected: () => 'presentation',
  },
  {
    name: 'Slider.Root role',
    attribute: 'role',
    createNode: () => <Slider.Root role={undefined} data-testid="part" />,
    expected: () => 'group',
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
    expected: targetId,
  },
  {
    name: 'TimeClock.Root role',
    attribute: 'role',
    createNode: () => <TimeClock.Root aria-label="Start" role={undefined} data-testid="part" />,
    expected: () => 'group',
  },
  {
    name: 'TimeField.Clear aria-label',
    attribute: 'aria-label',
    createNode: () => (
      <TimeField.Root>
        <TimeField.Input />
        <TimeField.Clear aria-label={undefined} data-testid="part" />
      </TimeField.Root>
    ),
    expected: () => 'Clear',
  },
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
    expected: targetId,
  },
  {
    name: 'Toggle aria-pressed',
    attribute: 'aria-pressed',
    createNode: () => <Toggle aria-pressed={undefined} data-testid="part" />,
    expected: () => 'false',
  },
  {
    name: 'ToggleGroup role',
    attribute: 'role',
    createNode: () => <ToggleGroup role={undefined} data-testid="part" />,
    expected: () => 'group',
  },
  {
    name: 'Toolbar.Root role',
    attribute: 'role',
    createNode: () => <Toolbar.Root role={undefined} data-testid="part" />,
    expected: () => 'toolbar',
  },
  {
    name: 'Tooltip.Popup data-open',
    attribute: 'data-open',
    createNode: () => (
      <Tooltip.Root defaultOpen>
        <Tooltip.Trigger>Tip</Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Positioner>
            <Tooltip.Popup data-open={undefined} data-testid="part" />
          </Tooltip.Positioner>
        </Tooltip.Portal>
      </Tooltip.Root>
    ),
    expected: () => '',
  },
  {
    name: 'useRender role',
    attribute: 'role',
    createNode: () => <Note role={undefined} data-testid="part" />,
    expected: () => 'note',
  },
];

interface PartState {
  active: boolean;
}

const getAttributes = vi.fn<(attrs: Record<string, any>) => void>();

const Part = defineComponent(
  (props: VaseUIComponentProps<PartState> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      state: { active: true },
      props: (attrs) => {
        getAttributes(attrs);
        return [{ role: 'note', title: 'Note' }, attrs];
      },
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

function createTagComponent<Attributes extends object>(tag: string) {
  return defineComponent(
    (props: VaseUIComponentProps<Record<string, never>> & WithVaseUIEvent<Attributes>) => {
      const { elementProps } = useRenderElement(tag, props);
      return () => h(tag, elementProps());
    },
    { props: ['as'], inheritAttrs: false },
  );
}

const ButtonPart = createTagComponent<ButtonHTMLAttributes>('button');
const ImagePart = createTagComponent<ImgHTMLAttributes>('img');

describe('VUE-103: an attribute of the consumer that is undefined', () => {
  const { render } = createRenderer();

  it.each(rows)('keeps $name of the part', async ({ attribute, createNode, expected }) => {
    await render(createNode());

    await waitFor(() => {
      expect(screen.getByTestId('part')).toHaveAttribute(attribute, expected());
    });
  });

  it('gives the props function no key for the attribute', async () => {
    await render(<Part title={undefined} data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('title', 'Note');
    expect(getAttributes.mock.lastCall?.[0]).toStrictEqual({ 'data-testid': 'part' });
  });

  it('keeps a state attribute of the part', async () => {
    await render(<Part data-active={undefined} data-testid="part" />);

    expect(screen.getByTestId('part')).toHaveAttribute('data-active', '');
  });

  it('keeps type="button" and alt="" of the tag', async () => {
    const { container } = await render(
      <div>
        <ButtonPart type={undefined} />
        <ImagePart alt={undefined} />
      </div>,
    );

    expect(container.querySelector('button')).toHaveAttribute('type', 'button');
    expect(container.querySelector('img')).toHaveAttribute('alt', '');
  });

  it('removes the value of the part for null', async () => {
    await render(<Part role={null} data-active={null} data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).not.toHaveAttribute('role');
    expect(part).not.toHaveAttribute('data-active');
    expect(part).toHaveAttribute('title', 'Note');
  });
});
