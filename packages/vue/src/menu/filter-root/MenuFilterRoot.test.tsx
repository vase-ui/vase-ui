import { userEvent as browserUserEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { DirectionProvider } from '../../direction-provider';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  firePointer,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  renderOnServer,
  screen,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import MenuFilterRootHydration from './MenuFilterRootHydration.test.vue';
import MenuFilterRootRenderCount from './MenuFilterRootRenderCount.test.vue';

// Mainline tests assert the non-WebKit path; MenuFilterRoot.webkit.test.tsx covers its compatibility state.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      engine: { ...actual.platform.engine, webkit: false },
      screenReader: { ...actual.platform.screenReader, voiceOver: false },
    },
  };
});

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
  const { render } = createRenderer();

  describe('keyboard navigation', () => {
    it('does not rerender unaffected items when the highlight moves', async () => {
      const firstRender = vi.fn();
      const secondRender = vi.fn();

      // A fixture holds the parts. In TSX, each render of the popup gives each item new slots, and
      // Vue renders the items again.
      const { user } = await render(
        <MenuFilterRootRenderCount firstRender={firstRender} secondRender={secondRender} />,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.click(input);
      firstRender.mockClear();
      secondRender.mockClear();

      await user.keyboard('[ArrowDown]');

      expect(firstRender).toHaveBeenCalled();
      expect(secondRender).not.toHaveBeenCalled();
    });
  });

  describe('typeahead', () => {
    it('does not move the highlight while typing into the input', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item>Duplicate</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('d');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
  });

  it('keeps component-rendered item text after the item is filtered out', async () => {
    const Label = defineComponent((props: { text: string }) => () => <span>{props.text}</span>, {
      props: ['text'],
    });

    const App = defineComponent(() => {
      const query = shallowRef('');

      return () => (
        <Menu.FilterProvider
          value={query.value}
          onValueChange={(nextQuery: string) => {
            query.value = nextQuery;
          }}
        >
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      <Label text="Rename" />
                    </Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    });

    const { user } = await render(<App />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    await user.type(input, 'del');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    });

    await fireEvent.input(input, { target: { value: 'ren' } });

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
  });

  it('preserves input focus on item presses', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const item = screen.getByRole('menuitem', { name: 'Rename' });
    const itemMouseDown = new MouseEvent('mousedown', { bubbles: true, cancelable: true });

    item.dispatchEvent(itemMouseDown);
    await flushMicrotasks();

    expect(itemMouseDown.defaultPrevented).toBe(true);
  });

  it('returns focus to the input with the RTL submenu close key', async () => {
    await render(
      <DirectionProvider direction="rtl">
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <button type="button">Auxiliary action</button>
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      </DirectionProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    const auxiliaryAction = screen.getByRole('button', { name: 'Auxiliary action' });
    // The popup gives the focus to the input one frame after it opens. A focus that comes earlier
    // does not stay.
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    auxiliaryAction.focus();
    await flushMicrotasks();
    expect(auxiliaryAction).toHaveFocus();

    await fireEvent.keyDown(auxiliaryAction, { key: 'ArrowRight' });

    expect(input).toHaveFocus();
  });

  it('releases the highlight when the query is cleared', async () => {
    const onClick = vi.fn();
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Clear aria-label="Clear filter" />
                <Menu.List>
                  <Menu.Item onClick={onClick}>Apple</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.type(input, 'ban');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Apple' })).toBe(null);
    });

    // Banana is now index 0.
    await user.keyboard('[ArrowDown]');
    expect(input).toHaveAttribute(
      'aria-activedescendant',
      screen.getByRole('menuitem', { name: 'Banana' }).id,
    );

    await user.click(screen.getByLabelText('Clear filter'));

    // Apple takes index 0 back, so a kept highlight would activate the wrong item.
    await waitFor(() => {
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });
    await user.keyboard('[Enter]');
    expect(onClick).toHaveBeenCalledTimes(0);
  });

  it('keeps the query when the popup-close reset is canceled', async () => {
    const App = defineComponent(() => {
      const open = shallowRef(true);
      const inputValue = shallowRef('');

      return () => (
        <>
          <button
            type="button"
            onClick={() => {
              open.value = !open.value;
            }}
          >
            toggle
          </button>
          <Menu.FilterProvider
            value={inputValue.value}
            onValueChange={(value: string, details: Menu.FilterProvider.ChangeEventDetails) => {
              if (details.reason === 'popup-close') {
                details.cancel();
                return;
              }
              inputValue.value = value;
            }}
          >
            <Menu.Root
              open={open.value}
              onOpenChange={(nextOpen: boolean) => {
                open.value = nextOpen;
              }}
              modal={false}
            >
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        </>
      );
    });

    const { user } = await render(<App />);

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'ren');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });

    const toggle = screen.getByRole('button', { name: 'toggle' });
    toggle.click();
    await waitFor(() => {
      expect(screen.queryByRole('menu')).toBe(null);
    });

    toggle.click();

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    expect(input).toHaveValue('ren');
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  });

  it('renders Empty when no items are registered at all', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>No actions found</Menu.Empty>
                <Menu.List />
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByText('No actions found')).toBeInTheDocument();
    });
  });

  it('keeps a group with no registered items visible while filtering', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Group>
                    <Menu.GroupLabel>Empty section</Menu.GroupLabel>
                  </Menu.Group>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'ren');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
    expect(screen.getByText('Empty section')).toBeVisible();
  });

  it('re-filters an item whose rendered text changes while it is hidden', async () => {
    const App = defineComponent(() => {
      const label = shallowRef('Archive');

      // The button is inside the popup, so a press on it does not dismiss the menu.
      return () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <button
                    type="button"
                    onClick={() => {
                      label.value = 'Rename';
                    }}
                  >
                    rename
                  </button>
                  <Menu.List>
                    <Menu.Item>{label.value}</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      );
    });

    const { user } = await render(<App />);

    await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'rename');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBe(null);
    });

    // The item is unmounted, so its text can only come from the rendered children.
    await user.click(screen.getByRole('button', { name: 'rename' }));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
  });

  it('preserves modifiers when the input activates a link item', async () => {
    const onClick = vi.fn((event: MouseEvent) => event.preventDefault());
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.LinkItem href="#docs" onClick={onClick}>
                    Docs
                  </Menu.LinkItem>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]{Control>}[Enter]{/Control}');

    expect(onClick).toHaveBeenCalledTimes(1);
    expect(onClick.mock.calls[0]?.[0]).toHaveProperty('ctrlKey', true);
  });

  it('leaves modified editing keys to the input while an item is highlighted', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Duplicate</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    });

    // `fireEvent` returns `false` when a handler called `preventDefault`, which would break the
    // browser-native selection and word/boundary movement these shortcuts perform.
    expect(await fireEvent.keyDown(input, { key: 'ArrowDown', shiftKey: true })).toBe(true);
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);

    expect(await fireEvent.keyDown(input, { key: 'ArrowLeft', shiftKey: true })).toBe(true);
    expect(await fireEvent.keyDown(input, { key: 'ArrowRight', altKey: true })).toBe(true);
    expect(await fireEvent.keyDown(input, { key: 'Home', metaKey: true })).toBe(true);
    expect(await fireEvent.keyDown(input, { key: 'End', shiftKey: true })).toBe(true);
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);
  });

  it('does not open a highlighted submenu with a modified cross-axis key from the input', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0}>Share</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu-list">
                          <Menu.Item>Email</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveAttribute('data-highlighted');
    });

    await fireEvent.keyDown(input, { key: 'ArrowRight', metaKey: true });
    expect(screen.queryByTestId('submenu-list')).toBe(null);

    await user.keyboard('[ArrowRight]');
    await screen.findByTestId('submenu-list');
  });

  it('renders the trigger as often as a plain menu on mount', async () => {
    let plainPasses = 0;
    let filterPasses = 0;

    await render(
      <>
        <Menu.Root>
          <Menu.Trigger
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                plainPasses += 1;
                return <button {...props}>Plain</button>;
              },
            }}
          />
        </Menu.Root>
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => {
                  filterPasses += 1;
                  return <button {...props}>Filterable</button>;
                },
              }}
            />
          </Menu.Root>
        </Menu.FilterProvider>
      </>,
    );

    expect(screen.getByRole('button', { name: 'Filterable' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(filterPasses).toBe(plainPasses);
  });

  it('uses the id passed to Menu.Input', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <label for="action-filter">Filter actions</label>
                <Menu.Input id="action-filter" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveAttribute(
      'id',
      'action-filter',
    );
  });

  it('prefers the label prop over rendered text for matching', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item label="Apple">Fruit one</Menu.Item>
                  <Menu.Item>Banana</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await user.type(input, 'app');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Banana' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Fruit one' })).toBeVisible();

    await user.clear(input);
    await user.type(input, 'fruit');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Fruit one' })).toBe(null);
    });
  });

  it('removes Empty once the query matches again', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>No actions found</Menu.Empty>
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    expect(screen.queryByText('No actions found')).toBe(null);

    await user.type(input, 'zzz');
    await waitFor(() => {
      expect(screen.getByText('No actions found')).toBeInTheDocument();
    });

    await user.clear(input);
    await user.type(input, 'ren');
    await waitFor(() => {
      expect(screen.queryByText('No actions found')).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  });

  describe('server-side rendering', () => {
    it('shows the empty state after hydration when no items are rendered', async () => {
      const serverHtml = await renderOnServer(
        'src/menu/filter-root/MenuFilterRootHydration.test.vue',
        {},
      );
      const template = document.createElement('template');
      template.innerHTML = serverHtml;

      expect(template.content.querySelector('[data-testid="empty"]')).toBe(null);

      await hydrate(MenuFilterRootHydration, { serverHtml });

      await waitFor(() => {
        expect(screen.getByTestId('empty')).toHaveTextContent('No actions found');
      });
    });
  });

  it('does not set aria-selected on highlighted items outside WebKit', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });
    await user.keyboard('[ArrowDown]');

    const item = screen.getByRole('menuitem', { name: 'Rename' });
    await waitFor(() => {
      expect(item).toHaveAttribute('data-highlighted');
    });
    expect(item).not.toHaveAttribute('aria-selected');
  });

  describe('prop: filter', () => {
    const CustomFilterMenu = defineComponent({
      props: {
        filter: {
          type: Function as PropType<Menu.FilterProvider.Props['filter']>,
          default: undefined,
        },
      },
      setup: (props) => () => (
        <Menu.FilterProvider filter={props.filter}>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Delete</Menu.Item>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
    });

    it('applies a custom filter to item text', async () => {
      const filter = vi.fn((text: string, query: string) => text.toLowerCase().startsWith(query));

      const { user } = await render(<CustomFilterMenu filter={filter} />);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'de');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      });
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      expect(filter).toHaveBeenCalledWith('Delete', 'de');
      expect(filter).toHaveBeenCalledWith('Rename', 'de');
      expect(filter.mock.calls.every((args) => args.length === 2)).toBe(true);
    });

    it('keeps every item visible when filtering is turned off with null', async () => {
      const { user } = await render(<CustomFilterMenu filter={null} />);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'zzz');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });
  });

  describe('canceling changes', () => {
    it('leaves a checkbox item unchecked when onCheckedChange is canceled', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.CheckboxItem
                      closeOnClick={false}
                      onCheckedChange={(_checked: boolean, eventDetails) => eventDetails.cancel()}
                    >
                      Show hidden
                    </Menu.CheckboxItem>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const item = screen.getByRole('menuitemcheckbox', { name: 'Show hidden' });
      await user.click(item);

      expect(item).toHaveAttribute('aria-checked', 'false');
    });

    it('tracks a controlled checkbox item', async () => {
      const ControlledCheckbox = defineComponent(() => {
        const checked = shallowRef(false);

        return () => (
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.CheckboxItem
                        closeOnClick={false}
                        checked={checked.value}
                        onCheckedChange={(nextChecked: boolean) => {
                          checked.value = nextChecked;
                        }}
                      >
                        Show hidden
                      </Menu.CheckboxItem>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        );
      });

      const { user } = await render(<ControlledCheckbox />);

      const item = screen.getByRole('menuitemcheckbox', { name: 'Show hidden' });
      expect(item).toHaveAttribute('aria-checked', 'false');

      await user.click(item);

      await waitFor(() => {
        expect(item).toHaveAttribute('aria-checked', 'true');
      });
    });
  });

  describe('IME composition', () => {
    it('filters on the committed text, not the composition in progress', async () => {
      const onValueChange = vi.fn();
      // A positioner shows only after its first position, and it needs an anchor for that.
      await render(
        <Menu.FilterProvider onValueChange={onValueChange}>
          <Menu.Root open>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Empty>No actions found.</Menu.Empty>
                  <Menu.List>
                    <Menu.Item>日本語</Menu.Item>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await fireEvent.compositionStart(input);
      await fireEvent.input(input, { target: { value: 'にほ' } });

      expect(input).toHaveValue('にほ');
      expect(onValueChange).not.toHaveBeenCalled();
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      });
      expect(screen.queryByText('No actions found.')).toBe(null);

      await fireEvent.input(input, { target: { value: '日本' } });
      await fireEvent.compositionEnd(input);

      expect(onValueChange).toHaveBeenCalledTimes(1);
      expect(onValueChange.mock.calls[0][0]).toBe('日本');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
      });
      expect(screen.getByRole('menuitem', { name: '日本語' })).toBeVisible();
    });
  });

  describe('input value change reasons', () => {
    async function renderReasonMenu(onValueChange: (value: string, reason: string) => void) {
      return render(
        <Menu.FilterProvider
          onValueChange={(value: string, eventDetails: Menu.FilterProvider.ChangeEventDetails) =>
            onValueChange(value, eventDetails.reason)
          }
        >
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Clear aria-label="Clear filter" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );
    }

    it('reports input-change while typing', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderReasonMenu(onValueChange);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'r');

      expect(onValueChange).toHaveBeenCalledWith('r', 'input-change');
    });

    it('reports input-clear when the field is emptied', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderReasonMenu(onValueChange);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'r');
      await user.clear(input);

      expect(onValueChange).toHaveBeenLastCalledWith('', 'input-clear');
    });

    it('reports clear-press when the clear button is used', async () => {
      const onValueChange = vi.fn();
      const { user } = await renderReasonMenu(onValueChange);

      await user.type(screen.getByRole('searchbox', { name: 'Filter actions' }), 'r');
      await user.click(screen.getByLabelText('Clear filter'));

      expect(onValueChange).toHaveBeenLastCalledWith('', 'clear-press');
    });

    it('reports popup-close when a controlled close discards the query', async () => {
      const onValueChange = vi.fn();

      const ControlledOpen = defineComponent({
        props: { open: { type: Boolean, required: true } },
        setup: (props) => () => (
          <Menu.FilterProvider
            defaultValue="ren"
            onValueChange={(value: string, eventDetails: Menu.FilterProvider.ChangeEventDetails) =>
              onValueChange(value, eventDetails.reason)
            }
          >
            <Menu.Root open={props.open}>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ),
      });

      const { setProps } = await render(<ControlledOpen open />);
      await setProps({ open: false });
      await flushMicrotasks();

      expect(onValueChange).toHaveBeenCalledWith('', 'popup-close');
    });
  });

  describe('accessible names', () => {
    it('does not point the popup or list at a trigger that never rendered', async () => {
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('menu')).not.toHaveAttribute('aria-labelledby');
    });

    it('labels the list with the trigger when no label is given', async () => {
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', trigger.id);
    });

    it('omits aria-controls when the list has an explicitly empty id', async () => {
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List id="">
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-controls');
      });
      expect(screen.getByRole('menu').id).toBe('');
    });

    it('omits the list label when the trigger renders with an explicitly empty id', async () => {
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger
              v-slots={{
                render: ({ props }: { props: HTMLProps }) => (
                  <button {...props} id="">
                    Actions
                  </button>
                ),
              }}
            />
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const list = screen.getByRole('menu');
      await flushMicrotasks();
      expect(list).not.toHaveAttribute('aria-labelledby');
      expect(screen.getByRole('dialog')).not.toHaveAttribute('aria-labelledby');
    });
  });

  describe('consumer props', () => {
    it('lets a consumer key handler on the input opt out of list navigation and activation', async () => {
      const onPress = vi.fn();
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input
                    aria-label="Filter actions"
                    onKeydown={(event) => {
                      if (event.key === 'ArrowUp' || event.key === 'Enter') {
                        event.preventVaseUIHandler();
                      }
                    }}
                  />
                  <Menu.List>
                    <Menu.Item onClick={onPress}>Rename</Menu.Item>
                    <Menu.Item>Delete</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await fireEvent.keyDown(input, { key: 'ArrowDown' });
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );
      });

      await fireEvent.keyDown(input, { key: 'ArrowUp' });
      await fireEvent.keyDown(input, { key: 'Enter' });

      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
      expect(onPress).not.toHaveBeenCalled();
    });
  });

  describe('focus ownership inside the popup', () => {
    it('leaves focus on another control in the popup when the pointer moves', async () => {
      await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup">
                  <Menu.Input aria-label="Filter actions" />
                  <button type="button">Auxiliary action</button>
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      const auxiliary = screen.getByRole('button', { name: 'Auxiliary action' });
      // The popup gives the focus to the input one frame after it opens. A focus that comes earlier
      // does not stay.
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      auxiliary.focus();
      await flushMicrotasks();
      expect(auxiliary).toHaveFocus();

      await fireEvent.mouseMove(screen.getByTestId('popup'), { movementX: 1 });

      expect(auxiliary).toHaveFocus();
    });

    it('returns focus to the parent input when the pointer moves back over the parent popup', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger delay={0} closeDelay={1000}>
                          Move to folder
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter folders" />
                              <Menu.List>
                                <Menu.Item>Documents</Menu.Item>
                              </Menu.List>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.FilterProvider>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      // Let the root popup's initial focus land first so it can't steal focus from the click below.
      await waitSingleFrame();
      await fireEvent.mouseMove(submenuInput, { movementX: 1 });
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('data-highlighted');
      });
      await user.click(submenuInput);
      expect(submenuInput).toHaveFocus();

      // Back over the still-open submenu's trigger.
      await fireEvent.mouseMove(submenuTrigger, { movementX: 1 });

      expect(rootInput).toHaveFocus();
      await waitFor(() => {
        expect(rootInput).toHaveAttribute('data-highlighted');
      });
      expect(submenuInput).not.toHaveAttribute('data-highlighted');
      expect(submenuInput).toBeVisible();
    });

    it.skipIf(isJSDOM)(
      'returns focus to the parent input when a mouse enters the trigger after a tap',
      async () => {
        const { user } = await render(
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.FilterProvider>
                        <Menu.SubmenuRoot>
                          <Menu.SubmenuTrigger delay={0} closeDelay={1000}>
                            Move to folder
                          </Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup>
                                <Menu.Input aria-label="Filter folders" />
                                <Menu.List>
                                  <Menu.Item>Documents</Menu.Item>
                                </Menu.List>
                              </Menu.Popup>
                            </Menu.Positioner>
                          </Menu.Portal>
                        </Menu.SubmenuRoot>
                      </Menu.FilterProvider>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>,
        );

        const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
        const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
        await user.hover(submenuTrigger);
        const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
        // The root popup's initial focus runs a frame after mounting. Let it land so it can't
        // steal focus from the tap below.
        await waitSingleFrame();

        await firePointer.down(submenuInput, { pointerType: 'touch', timeStamp: 10 });
        submenuInput.focus();
        await flushMicrotasks();
        expect(submenuInput).toHaveFocus();

        // A mouse entering fires `pointerover` and `mouseover` before any `pointermove`.
        await fireEvent.pointerOver(submenuTrigger, { pointerType: 'mouse' });
        await fireEvent.mouseOver(submenuTrigger);

        expect(rootInput).toHaveFocus();
      },
    );

    it('restores the parent input highlight when the pointer returns from a plain submenu', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger delay={0}>Share</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.List>
                              <Menu.Item>Email</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      const trigger = screen.getByRole('menuitem', { name: 'Share' });
      await user.hover(trigger);
      const item = await screen.findByRole('menuitem', { name: 'Email' });
      await fireEvent.mouseMove(item, { movementX: 1 });
      expect(item).toHaveFocus();
      await waitFor(() => {
        expect(input).not.toHaveAttribute('data-highlighted');
      });

      await fireEvent.mouseOver(trigger);
      expect(input).toHaveFocus();
      await waitFor(() => {
        expect(input).toHaveAttribute('data-highlighted');
      });
    });

    it('returns focus to the parent input once a pointer-opened submenu unmounts', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.FilterProvider>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger delay={0} closeDelay={0}>
                          Move to folder
                        </Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter folders" />
                              <Menu.List>
                                <Menu.Item>Documents</Menu.Item>
                              </Menu.List>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.FilterProvider>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await fireEvent.mouseMove(submenuInput, { movementX: 1 });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      await user.hover(screen.getByRole('menuitem', { name: 'Rename' }));
      await waitFor(() => {
        expect(submenuInput).not.toBeInTheDocument();
      });

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });
      await waitFor(() => {
        expect(rootInput).toHaveAttribute('data-highlighted');
      });
    });

    const SiblingSubmenu = defineComponent(
      (props: { label: string; delay: number }) => () => (
        <Menu.FilterProvider>
          <Menu.SubmenuRoot>
            {/* The close waits until the pointer has highlighted the next trigger. */}
            <Menu.SubmenuTrigger delay={props.delay} closeDelay={10}>
              {props.label}
            </Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label={`Filter ${props.label}`} />
                  <Menu.List>
                    <Menu.Item>Option</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        </Menu.FilterProvider>
      ),
      { props: ['label', 'delay'] },
    );

    const SiblingSubmenus = defineComponent(
      (props: { onRootInputFocus: () => void }) => () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" onFocus={props.onRootInputFocus} />
                  <Menu.List>
                    <SiblingSubmenu label="Move to folder" delay={0} />
                    {/* Opens only after the first submenu has unmounted. */}
                    <SiblingSubmenu label="Share" delay={50} />
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
      { props: ['onRootInputFocus'] },
    );

    it('opens a hovered submenu without moving focus until the pointer enters it', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger delay={0}>Move to folder</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup data-testid="submenu-popup">
                              <Menu.Input aria-label="Filter folders" />
                              <Menu.List>
                                <Menu.Item>Documents</Menu.Item>
                              </Menu.List>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.FilterProvider>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to folder' });
      await user.hover(submenuTrigger);
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitSingleFrame();
      expect(rootInput).toHaveFocus();
      expect(rootInput).toHaveAttribute('data-highlighted');

      await fireEvent.mouseMove(screen.getByTestId('submenu-popup'), { movementX: 1 });
      expect(submenuInput).toHaveFocus();
      await waitFor(() => {
        expect(submenuInput).toHaveAttribute('data-highlighted');
      });
    });

    it('moves focus back to the parent input while the pointer moves between submenu triggers', async () => {
      const { user } = await render(<SiblingSubmenus onRootInputFocus={() => {}} />);
      const rootInput = screen.getByRole('searchbox', { name: 'Filter actions' });

      await user.hover(screen.getByRole('menuitem', { name: 'Move to folder' }));
      const firstInput = await screen.findByRole('searchbox', { name: 'Filter Move to folder' });
      await fireEvent.mouseMove(firstInput, { movementX: 1 });
      await waitFor(() => {
        expect(firstInput).toHaveFocus();
      });

      await user.hover(screen.getByRole('menuitem', { name: 'Share' }));
      await waitFor(() => {
        expect(rootInput).toHaveFocus();
      });
      const secondInput = await screen.findByRole('searchbox', { name: 'Filter Share' });
      // Let the second submenu's open settle without moving focus.
      await waitSingleFrame();
      expect(rootInput).toHaveFocus();

      await fireEvent.mouseMove(secondInput, { movementX: 1 });
      expect(secondInput).toHaveFocus();
    });
  });

  describe('leaving the menu', () => {
    const QueryMenu = defineComponent(
      (props: { modal?: boolean }) => () => (
        <Menu.FilterProvider>
          <Menu.Root defaultOpen modal={props.modal}>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
      { props: ['modal'] },
    );

    it('closes on Escape even with a query typed', async () => {
      const { user } = await render(<QueryMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await fireEvent.input(input, { target: { value: 'ren' } });
      expect(input).toHaveValue('ren');
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[Escape]');

      // Escape closes outright; it does not clear the query first.
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
      });
    });

    it('closes and returns focus to the trigger on Shift+Tab from the input', async () => {
      await render(<QueryMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await browserUserEvent.keyboard('{Shift>}[Tab]{/Shift}');

      // Backward tabbing mirrors a plain menu: the popup closes and the trigger regains focus.
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
      });
    });

    it('keeps input focus when a Shift+Tab close is canceled', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root
            defaultOpen
            onOpenChange={(open: boolean, details: Menu.Root.ChangeEventDetails) => {
              if (!open) {
                details.cancel();
              }
            }}
          >
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await browserUserEvent.keyboard('{Shift>}[Tab]{/Shift}');

      expect(input).toHaveFocus();
      expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
        'aria-expanded',
        'true',
      );
      await user.type(input, 'r');
      expect(input).toHaveValue('r');
    });
  });

  describe('prop: autoHighlight', () => {
    it('clears a pointer highlight on pointer leave by default', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const item = screen.getByRole('menuitem', { name: 'Rename' });
      await user.hover(item);
      await fireEvent.mouseMove(item, { movementX: 1 });
      await waitFor(() => {
        expect(item).toHaveAttribute('data-highlighted');
      });

      await fireEvent.pointerMove(item, { pointerType: 'mouse', movementX: 1 });
      await user.unhover(item);

      // The mirror of the `autoHighlight="always"` case, which retains the highlight.
      await waitFor(() => {
        expect(item).not.toHaveAttribute('data-highlighted');
      });
    });
  });

  describe('prop: onItemHighlighted', () => {
    type OnItemHighlighted = (
      highlightedItem: HTMLElement | undefined,
      eventDetails: Menu.Root.HighlightEventDetails,
    ) => void;

    it.each(['vertical', 'horizontal'] as const)(
      'passes the keydown event to onItemHighlighted in a %s menu',
      async (orientation) => {
        const onItemHighlighted = vi.fn();
        const { user } = await render(
          <Menu.FilterProvider>
            <Menu.Root open orientation={orientation} onItemHighlighted={onItemHighlighted}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>,
        );

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        input.focus();
        await flushMicrotasks();
        await user.keyboard('[ArrowDown]');

        await waitFor(() => {
          expect(onItemHighlighted).toHaveBeenLastCalledWith(
            screen.getByRole('menuitem', { name: 'Rename' }),
            expect.anything(),
          );
        });
        const details = onItemHighlighted.mock.lastCall?.[1];
        expect(details.reason).toBe('keyboard');
        expect(details.event).toBeInstanceOf(KeyboardEvent);
        expect(details.event.key).toBe('ArrowDown');
      },
    );

    const SubmenuHighlightMenu = defineComponent(
      (props: { onItemHighlighted: OnItemHighlighted }) => () => (
        <Menu.FilterProvider>
          <Menu.Root open onItemHighlighted={props.onItemHighlighted}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter sharing options" />
                              <Menu.List>
                                <Menu.Item>Email</Menu.Item>
                              </Menu.List>
                            </Menu.Popup>
                          </Menu.Positioner>
                        </Menu.Portal>
                      </Menu.SubmenuRoot>
                    </Menu.FilterProvider>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
      { props: ['onItemHighlighted'] },
    );

    it('passes the keydown events when entering and leaving a filterable submenu', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<SubmenuHighlightMenu onItemHighlighted={onItemHighlighted} />);

      screen.getByRole('searchbox', { name: 'Filter actions' }).focus();
      await flushMicrotasks();
      await user.keyboard('[ArrowDown][ArrowRight]');
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      const enterDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(undefined);
      expect(enterDetails.reason).toBe('keyboard');
      expect(enterDetails.event.key).toBe('ArrowRight');

      await user.keyboard('[ArrowLeft]');
      const trigger = screen.getByRole('menuitem', { name: 'Share' });
      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenLastCalledWith(trigger, expect.anything());
      });

      const exitDetails = onItemHighlighted.mock.lastCall?.[1];
      expect(exitDetails.reason).toBe('keyboard');
      expect(exitDetails.event.key).toBe('ArrowLeft');
    });

    it('reports no keyboard reason when Enter opens a filterable submenu', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<SubmenuHighlightMenu onItemHighlighted={onItemHighlighted} />);

      screen.getByRole('searchbox', { name: 'Filter actions' }).focus();
      await flushMicrotasks();
      await user.keyboard('[ArrowDown][Enter]');
      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter sharing options' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });

      expect(onItemHighlighted.mock.lastCall?.[0]).toBe(undefined);
      expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('none');
    });
  });
});

describe('filterable menu navigation regressions', () => {
  const { render } = createRenderer();

  describe.each([false, true])('with a filtered submenu: %s', (filterSubmenu) => {
    it.each([
      ['[ArrowRight]', '[ArrowLeft]'],
      ['[ArrowRight]', '{Shift>}[Tab]{/Shift}'],
      ['[Enter]', '[Escape]'],
    ])(
      'restores input focus after opening with %s and closing with %s',
      async (openKey, closeKey) => {
        const submenu = (
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  {filterSubmenu ? (
                    <>
                      <Menu.Input aria-label="Filter child actions" />
                      <Menu.List>
                        <Menu.Item>Child action</Menu.Item>
                      </Menu.List>
                    </>
                  ) : (
                    <Menu.Item>Child action</Menu.Item>
                  )}
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        );
        const { user } = await render(
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      {filterSubmenu ? (
                        <Menu.FilterProvider>{submenu}</Menu.FilterProvider>
                      ) : (
                        submenu
                      )}
                      <Menu.Item>Rename</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>,
        );
        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard(`[ArrowDown]${openKey}`);
        const child = filterSubmenu
          ? await screen.findByRole('searchbox', { name: 'Filter child actions' })
          : await screen.findByRole('menuitem', { name: 'Child action' });
        await waitFor(() => expect(child).toHaveFocus());
        await user.keyboard(closeKey);
        await waitFor(() =>
          expect(screen.queryByRole('menuitem', { name: 'Child action' })).toBe(null),
        );
        await waitFor(() => expect(input).toHaveFocus());
        await user.keyboard('ren');
        expect(input).toHaveValue('ren');
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
      },
    );
  });

  it('does not repeat matching when navigating past hidden component labels', async () => {
    const Label = defineComponent((props: { text: string }) => () => <span>{props.text}</span>, {
      props: ['text'],
    });
    const filter = vi.fn((text: string, query: string) => text.includes(query));
    const { user } = await render(
      <Menu.FilterProvider filter={filter} autoHighlight="always" defaultValue="Match">
        <Menu.Root
          defaultOpen
          v-slots={{
            default: () => (
              <>
                <Menu.Trigger>Actions</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup>
                      <Menu.Input aria-label="Filter actions" />
                      <Menu.List>
                        {Array.from({ length: 20 }, (_, index) => (
                          <Menu.Item key={index}>
                            <Label text={index < 2 ? `Match ${index}` : `Hidden ${index}`} />
                          </Menu.Item>
                        ))}
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </>
            ),
          }}
        />
      </Menu.FilterProvider>,
    );
    const input = screen.getByRole('searchbox');
    await waitFor(() => expect(screen.getAllByRole('menuitem')).toHaveLength(2));
    await waitFor(() => expect(input).toHaveFocus());
    filter.mockClear();
    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('menuitem', { name: 'Match 1' })).toHaveAttribute('data-highlighted');
    expect(filter).not.toHaveBeenCalled();
  });
});
