import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
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
});
