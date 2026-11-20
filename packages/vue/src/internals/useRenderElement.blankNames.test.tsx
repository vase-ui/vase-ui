import { describe, expect, it, vi } from 'vitest';
import { defineComponent, h } from 'vue';
import type { HTMLAttributes, VNode } from 'vue';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { Menu } from '@vase-ui/vue/menu';
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { useRender } from '@vase-ui/vue/use-render';
import { Drawer } from '@vase-ui/vue/drawer';
import type { VaseUIComponentProps, WithVaseUIEvent } from './types';
import { useRenderElement } from './useRenderElement';

const getAttributes = vi.fn<(attrs: Record<string, any>) => void>();

const Part = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps } = useRenderElement('div', props, {
      props: (attrs) => {
        getAttributes(attrs);
        return [{ role: 'group', 'aria-label': 'Part', 'aria-labelledby': 'part-name' }, attrs];
      },
    });
    return () => h('div', elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

const Note = defineComponent(
  (props: VaseUIComponentProps<object> & WithVaseUIEvent<HTMLAttributes>) => {
    const { elementProps, tag } = useRender(props, {
      props: (attrs) => [{ role: 'note', 'aria-label': 'Note' }, attrs],
    });
    return () => h(tag.value, elementProps());
  },
  { props: ['as'], inheritAttrs: false },
);

interface Row {
  name: string;
  // The attribute of the consumer that would replace the name of the part.
  attribute: 'aria-label' | 'aria-labelledby';
  // The node gives `attrs`, the attributes of the consumer, to the part under test.
  createNode: (attrs: Record<string, string>) => VNode;
  // The name that the part has with no attribute of the consumer.
  expected: string;
  // The default is each blank value.
  blanks?: Blank[];
  // The step that shows the part, for a part that the render does not show.
  show?: () => Promise<void>;
}

interface Blank {
  name: string;
  value: string;
}

const EMPTY: Blank = { name: 'an empty value', value: '' };
const WHITE_SPACE: Blank = { name: 'white space', value: '\n\t ' };

function createNavigationMenu(attrs: Record<string, string>) {
  return (
    <NavigationMenu.Root>
      <NavigationMenu.List>
        <NavigationMenu.Item value="products">
          <NavigationMenu.Trigger data-testid="trigger">Products</NavigationMenu.Trigger>
          <NavigationMenu.Content>
            <NavigationMenu.Link href="#products">All products</NavigationMenu.Link>
          </NavigationMenu.Content>
        </NavigationMenu.Item>
      </NavigationMenu.List>
      <NavigationMenu.Portal>
        <NavigationMenu.Positioner>
          <NavigationMenu.Popup data-testid="part" {...attrs}>
            <NavigationMenu.Viewport />
          </NavigationMenu.Popup>
        </NavigationMenu.Positioner>
      </NavigationMenu.Portal>
    </NavigationMenu.Root>
  );
}

async function showNavigationMenu() {
  await fireEvent.click(screen.getByTestId('trigger'));
  await flushMicrotasks();
}

const rows: Row[] = [
  {
    name: 'Drawer.Popup',
    attribute: 'aria-labelledby',
    createNode: (attrs) => (
      <Drawer.Root defaultOpen>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup data-testid="part" {...attrs}>
              <Drawer.Title>Settings</Drawer.Title>
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ),
    expected: 'Settings',
  },
  {
    name: 'Menu.Popup aria-label',
    attribute: 'aria-label',
    // An empty string is falsy, and `resolvePopupLabel` reads the `aria-label` by its truth.
    blanks: [WHITE_SPACE],
    createNode: (attrs) => (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="part" {...attrs} />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    expected: 'Actions',
  },
  {
    name: 'Menu.Popup aria-labelledby',
    attribute: 'aria-labelledby',
    createNode: (attrs) => (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="part" {...attrs} />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
    expected: 'Actions',
  },
  {
    name: 'NavigationMenu.Popup aria-label',
    attribute: 'aria-label',
    // An empty string is falsy, and `resolvePopupLabel` reads the `aria-label` by its truth.
    blanks: [WHITE_SPACE],
    createNode: createNavigationMenu,
    show: showNavigationMenu,
    expected: 'Products',
  },
  {
    name: 'NavigationMenu.Popup aria-labelledby',
    attribute: 'aria-labelledby',
    createNode: createNavigationMenu,
    show: showNavigationMenu,
    expected: 'Products',
  },
  {
    name: 'useRender',
    attribute: 'aria-label',
    createNode: (attrs) => <Note data-testid="part" {...attrs} />,
    expected: 'Note',
  },
];

const cases = rows.flatMap((row) =>
  (row.blanks ?? [EMPTY, WHITE_SPACE]).map((blank) => ({
    ...row,
    blank: blank.name,
    value: blank.value,
  })),
);

describe('VUE-106: a blank aria-label or aria-labelledby of the consumer', () => {
  const { render } = createRenderer();

  it.each(cases)(
    'keeps the name of $name for $blank',
    async ({ attribute, createNode, expected, show, value }) => {
      await render(createNode({ [attribute]: value }));
      await show?.();

      await waitFor(() => {
        expect(screen.getByTestId('part')).toHaveAccessibleName(expected);
      });
    },
  );

  it.each([
    { name: 'an empty aria-label', attrs: { 'aria-label': '' } },
    { name: 'an aria-label of white space', attrs: { 'aria-label': '\n\t ' } },
    { name: 'an empty aria-labelledby', attrs: { 'aria-labelledby': '' } },
    { name: 'an aria-labelledby of white space', attrs: { 'aria-labelledby': '\n\t ' } },
  ])('gives the props function no key for $name', async ({ attrs }) => {
    await render(<Part data-testid="part" {...attrs} />);

    const part = screen.getByTestId('part');
    expect(part).toHaveAttribute('aria-label', 'Part');
    expect(part).toHaveAttribute('aria-labelledby', 'part-name');
    expect(getAttributes.mock.lastCall?.[0]).toStrictEqual({ 'data-testid': 'part' });
  });

  it('gives a name that is not blank the place of the name of the part', async () => {
    await render(<Part aria-label="Own" aria-labelledby="own-name" data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).toHaveAttribute('aria-label', 'Own');
    expect(part).toHaveAttribute('aria-labelledby', 'own-name');
  });

  it('keeps another attribute that is blank', async () => {
    await render(<Part title="" aria-description="" data-testid="part" />);

    const part = screen.getByTestId('part');
    expect(part).toHaveAttribute('title', '');
    expect(part).toHaveAttribute('aria-description', '');
  });
});
