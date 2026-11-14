import { describe, expect, it, vi } from 'vitest';
import type userEvent from '@testing-library/user-event';
import { defineComponent, onMounted, shallowRef } from 'vue';
import type { PropType } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  isJSDOM,
  nextAnimationsRead,
  renderOnServer,
  screen,
  wait,
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

  it.skipIf(isJSDOM)('keeps input focus after selecting an item by drag release', async () => {
    await render(
      <Menu.FilterProvider>
        <Menu.Root highlightItemOnHover={false}>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>One</Menu.Item>
                  <Menu.CheckboxItem>Two</Menu.CheckboxItem>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await fireEvent.mouseDown(screen.getByRole('button', { name: 'Actions' }));

    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    const checkbox = screen.getByRole('menuitemcheckbox', { name: 'Two' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    await wait(200);
    await fireEvent.mouseUp(checkbox);

    await waitFor(() => {
      expect(checkbox).toHaveAttribute('aria-checked', 'true');
    });
    expect(input).toHaveFocus();
  });

  describe('opening with a query', () => {
    it('keeps the matching items mounted', async () => {
      // Only a real remount creates new nodes.
      const nodes = { Rename: new Set<Element>(), Copy: new Set<Element>() };
      function Tracked(props: { label: 'Rename' | 'Copy' }) {
        return (
          <span
            ref={(node) => {
              if (node) {
                nodes[props.label].add(node as Element);
              }
            }}
          >
            {props.label}
          </span>
        );
      }

      const { user } = await render(
        <Menu.FilterProvider defaultValue="e">
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>
                      <Tracked label="Rename" />
                    </Menu.Item>
                    <Menu.Item>
                      <Tracked label="Copy" />
                    </Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      const rename = await screen.findByRole('menuitem', { name: 'Rename' });
      await waitFor(() => {
        expect(screen.getAllByRole('menuitem')).toHaveLength(1);
      });
      // A non-matching item renders once so its text can be read; a match is never remounted.
      expect(nodes.Copy.size).toBe(1);
      expect(nodes.Rename.size).toBe(1);
      expect(rename).toContainElement([...nodes.Rename][0] as HTMLElement);
    });
  });

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

    const KeyboardNavigationMenu = defineComponent(() => () => (
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Duplicate</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    ));

    async function openWithKeyboard(user: ReturnType<typeof userEvent.setup>) {
      const trigger = screen.getByRole('button', { name: 'Actions' });
      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('[Enter]');
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      // The popup hands focus to the input asynchronously, so keys pressed before it lands
      // reach the body instead.
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      return input;
    }

    it('walks the list with the arrow keys and releases the highlight at the end', async () => {
      const { user } = await render(<KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );

      await user.keyboard('[ArrowDown][ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      // Past the last item the highlight is released back to the input, matching Combobox.
      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
    });

    it('starts navigation from the top again after closing and reopening', async () => {
      const { user } = await render(<KeyboardNavigationMenu />);
      await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      await user.keyboard('[Escape]');
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });

      const reopenedInput = await openWithKeyboard(user);
      expect(reopenedInput).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).not.toHaveAttribute(
        'data-highlighted',
      );
    });

    it('keeps the highlight index in step with the highlighted item after the input is refocused', async () => {
      const { user } = await render(<KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      // Refocusing the input keeps the highlight, and list navigation must keep its cursor on
      // the same item. If the two drift apart, the next arrow key moves from the wrong position.
      input.blur();
      input.focus();
      await flushMicrotasks();

      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Duplicate' }).id,
      );

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveAttribute(
          'data-highlighted',
        );
      });
    });

    it('resets the highlight when the query changes and rebuilds it from the first match', async () => {
      const { user } = await render(<KeyboardNavigationMenu />);
      const input = await openWithKeyboard(user);

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toHaveAttribute(
          'data-highlighted',
        );
      });

      await user.type(input, 'e');
      await waitFor(() => {
        expect(input).not.toHaveAttribute('aria-activedescendant');
      });

      await user.keyboard('[ArrowDown]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveAttribute(
          'data-highlighted',
        );
      });
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

  it('calls onOpenChangeComplete when the menu opens and closes', async () => {
    const onOpenChangeComplete = vi.fn();
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root onOpenChangeComplete={onOpenChangeComplete}>
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

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenCalledWith(false);
    });
  });

  it('does not seed a highlight when the trigger regains focus while open', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root>
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
    await user.click(trigger);
    const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // Safari focuses the trigger on mousedown before the closing click lands.
    trigger.focus();
    await flushMicrotasks();

    expect(input).not.toHaveAttribute('aria-activedescendant');
    expect(trigger).not.toHaveAttribute('aria-activedescendant');
    expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveAttribute(
      'data-highlighted',
    );
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

    it.skipIf(isJSDOM).each([
      {
        name: 'Escape',
        close: (user: ReturnType<typeof userEvent.setup>) => user.keyboard('[Escape]'),
      },
      {
        name: 'an item press',
        close: (user: ReturnType<typeof userEvent.setup>) =>
          user.click(screen.getByRole('menuitem', { name: 'Apricot' })),
      },
      {
        name: 'an outside press',
        close: (user: ReturnType<typeof userEvent.setup>) => user.click(document.body),
      },
    ])(
      'keeps externally filtered items while the popup animates out after $name',
      async ({ close }) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const fruits = ['Apple', 'Apricot', 'Banana'];
        const onValueChange = vi.fn();

        const ExternalFilterMenu = defineComponent(() => {
          const { contains } = Menu.useFilter();
          const query = shallowRef('');

          return () => {
            const results = fruits.filter((fruit) => contains(fruit, query.value));

            return (
              <>
                <style>{`
                  @keyframes filter-menu-external-exit-test {
                    to { opacity: 0; }
                  }
                  .filter-menu-external-exit-test[data-ending-style] {
                    animation: filter-menu-external-exit-test 100s linear;
                  }
                `}</style>
                <Menu.FilterProvider
                  filter={null}
                  value={query.value}
                  onValueChange={(value, eventDetails) => {
                    onValueChange(value, eventDetails.reason);
                    query.value = value;
                  }}
                >
                  <Menu.Root>
                    <Menu.Trigger>Fruit</Menu.Trigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="popup" class="filter-menu-external-exit-test">
                          <Menu.Input aria-label="Filter fruit" />
                          <Menu.List>
                            {results.map((fruit) => (
                              <Menu.Item key={fruit}>{fruit}</Menu.Item>
                            ))}
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.Root>
                </Menu.FilterProvider>
              </>
            );
          };
        });

        function getItemNames() {
          return screen.getAllByRole('menuitem').map((item) => item.textContent);
        }

        const { user } = await render(<ExternalFilterMenu />);

        await user.click(screen.getByRole('button', { name: 'Fruit' }));
        const input = await screen.findByRole('searchbox', { name: 'Filter fruit' });
        await user.type(input, 'ap');
        await waitFor(() => {
          expect(getItemNames()).toEqual(['Apple', 'Apricot']);
        });

        const popup = screen.getByTestId('popup');
        // The popup reads its animations in a frame after the open. That read must not be the
        // read that the close takes.
        await waitSingleFrame();
        await waitSingleFrame();
        const animations = await nextAnimationsRead(popup, { action: () => close(user) });

        expect(popup).toHaveAttribute('data-ending-style');
        expect(getItemNames()).toEqual(['Apple', 'Apricot']);
        expect(input).toHaveValue('ap');
        expect(onValueChange).not.toHaveBeenCalledWith('', 'popup-close');

        animations.forEach((animation) => animation.finish());
        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        await waitFor(() => {
          expect(onValueChange).toHaveBeenLastCalledWith('', 'popup-close');
        });
      },
    );
  });

  describe('closing with a query', () => {
    const ControlledQueryMenu = defineComponent(
      (props: {
        onValueChange: (value: string, reason: string) => void;
        rootProps?: Record<string, unknown>;
      }) => {
        const query = shallowRef('');

        return () => (
          <>
            <style>{`
              @keyframes filter-menu-query-exit-test {
                to { opacity: 0; }
              }
              .filter-menu-query-exit-test[data-ending-style] {
                animation: filter-menu-query-exit-test 100s linear;
              }
            `}</style>
            <Menu.FilterProvider
              value={query.value}
              onValueChange={(value, eventDetails) => {
                props.onValueChange(value, eventDetails.reason);
                query.value = value;
              }}
            >
              <Menu.Root {...props.rootProps}>
                <Menu.Trigger>Fruit</Menu.Trigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="popup" class="filter-menu-query-exit-test">
                      <Menu.Input aria-label="Filter fruit" />
                      <Menu.List>
                        <Menu.Item>Apple</Menu.Item>
                        <Menu.Item>Apricot</Menu.Item>
                        <Menu.Item>Banana</Menu.Item>
                        {query.value !== '' && (
                          <Menu.Item label={query.value}>{`Create "${query.value}"`}</Menu.Item>
                        )}
                      </Menu.List>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </Menu.FilterProvider>
          </>
        );
      },
      { props: ['onValueChange', 'rootProps'] },
    );

    function getItemNames() {
      return screen.getAllByRole('menuitem').map((item) => item.textContent);
    }

    async function openAndType(user: ReturnType<typeof userEvent.setup>, text: string) {
      await user.click(screen.getByRole('button', { name: 'Fruit' }));
      const input = await screen.findByRole('searchbox', { name: 'Filter fruit' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await fireEvent.input(input, { target: { value: text } });
      await waitFor(() => {
        expect(getItemNames()).toEqual(['Apple', 'Apricot', `Create "${text}"`]);
      });
      return input;
    }

    // The popup reads its animations in a frame after the open. That read must not be the read
    // that the close takes.
    async function pressEscapeAndReadAnimations(user: ReturnType<typeof userEvent.setup>) {
      const popup = screen.getByTestId('popup');
      await waitSingleFrame();
      await waitSingleFrame();
      return nextAnimationsRead(popup, { action: () => user.keyboard('[Escape]') });
    }

    it.skipIf(isJSDOM)(
      'keeps an item rendered from the controlled query while the popup animates out',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const { user } = await render(<ControlledQueryMenu onValueChange={vi.fn()} />);
        await openAndType(user, 'ap');

        await pressEscapeAndReadAnimations(user);

        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
        expect(getItemNames()).toEqual(['Apple', 'Apricot', 'Create "ap"']);
      },
    );

    it.skipIf(isJSDOM)(
      'resets the query when the popup reopens before its exit transition completes',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const onValueChange = vi.fn();

        const { user } = await render(<ControlledQueryMenu onValueChange={onValueChange} />);
        const input = await openAndType(user, 'ap');
        onValueChange.mockClear();

        await pressEscapeAndReadAnimations(user);

        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
        expect(input).toHaveValue('ap');

        await user.click(screen.getByRole('button', { name: 'Fruit' }));

        await waitFor(() => {
          expect(screen.getByRole('searchbox', { name: 'Filter fruit' })).toHaveValue('');
        });
        expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
        expect(getItemNames()).toEqual(['Apple', 'Apricot', 'Banana']);
        expect(onValueChange).toHaveBeenCalledTimes(1);
        expect(onValueChange).toHaveBeenCalledWith('', 'popup-close');
      },
    );

    it('keeps the query until a popup that prevented unmounting is unmounted', async () => {
      const onValueChange = vi.fn();
      let root!: Menu.Root.Actions;

      const { user } = await render(
        <ControlledQueryMenu
          onValueChange={onValueChange}
          rootProps={{
            ref: (instance: unknown) => {
              root = instance as Menu.Root.Actions;
            },
            onOpenChange(_open: boolean, eventDetails: Menu.Root.ChangeEventDetails) {
              eventDetails.preventUnmountOnClose();
            },
          }}
        />,
      );
      const input = await openAndType(user, 'ap');

      await user.keyboard('[Escape]');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Fruit' })).toHaveAttribute(
          'aria-expanded',
          'false',
        );
      });
      expect(input).toHaveValue('ap');
      expect(getItemNames()).toEqual(['Apple', 'Apricot', 'Create "ap"']);
      expect(onValueChange).not.toHaveBeenCalledWith('', 'popup-close');

      root.unmount();
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(onValueChange).toHaveBeenLastCalledWith('', 'popup-close');
    });

    it.skipIf(isJSDOM)(
      'resets the query when the menu is removed as its exit transition completes',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const onValueChange = vi.fn();

        const RemovedOnCloseMenu = defineComponent(() => {
          const rendered = shallowRef(true);

          return () =>
            rendered.value ? (
              <ControlledQueryMenu
                onValueChange={onValueChange}
                rootProps={{
                  onOpenChangeComplete(open: boolean) {
                    if (!open) {
                      rendered.value = false;
                    }
                  },
                }}
              />
            ) : null;
        });

        const { user } = await render(<RemovedOnCloseMenu />);
        await openAndType(user, 'ap');

        const animations = await pressEscapeAndReadAnimations(user);

        expect(screen.getByTestId('popup')).toHaveAttribute('data-ending-style');
        expect(onValueChange).not.toHaveBeenCalledWith('', 'popup-close');

        animations.forEach((animation) => animation.finish());

        await waitFor(() => {
          expect(screen.queryByRole('button', { name: 'Fruit' })).toBe(null);
        });
        expect(onValueChange).toHaveBeenLastCalledWith('', 'popup-close');
      },
    );
  });

  describe('canceling changes', () => {
    it('stays closed when onOpenChange is canceled', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root onOpenChange={(_open, eventDetails) => eventDetails.cancel()}>
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

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      // The trigger opens the menu in the frame after the press.
      await waitSingleFrame();
      await flushMicrotasks();

      expect(screen.queryByRole('menu')).toBe(null);
    });

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

  it('never mounts the Empty children while items match', async () => {
    const onEmptyMount = vi.fn();
    const NoResults = defineComponent(() => {
      onMounted(onEmptyMount);
      return () => 'No results';
    });

    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.Empty>
                  <NoResults />
                </Menu.Empty>
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

    await user.click(screen.getByRole('button', { name: 'Actions' }));
    await screen.findByRole('menuitem', { name: 'Rename' });

    expect(onEmptyMount).not.toHaveBeenCalled();
    expect(screen.queryByText('No results')).toBe(null);
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

  describe('handle', () => {
    it('opens from a trigger rendered outside the root', async () => {
      const DetachedTriggerMenu = defineComponent(() => {
        const handle = Menu.createHandle();

        return () => (
          <>
            <Menu.FilterProvider>
              <Menu.Root handle={handle}>
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
            <Menu.Trigger handle={handle}>Actions</Menu.Trigger>
          </>
        );
      });

      const { user } = await render(<DetachedTriggerMenu />);

      expect(screen.queryByRole('menu')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Actions' }));

      await waitFor(() => {
        expect(screen.getByRole('menu')).not.toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });
      expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    });

    it('does not highlight an item when another detached trigger receives focus', async () => {
      const onItemHighlighted = vi.fn();

      const DetachedTriggersMenu = defineComponent(() => {
        const handle = Menu.createHandle();

        return () => (
          <>
            <Menu.Trigger handle={handle}>First trigger</Menu.Trigger>
            <Menu.Trigger handle={handle}>Second trigger</Menu.Trigger>
            <Menu.FilterProvider>
              <Menu.Root handle={handle} onItemHighlighted={onItemHighlighted}>
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

      const { user } = await render(<DetachedTriggersMenu />);
      await user.click(screen.getByRole('button', { name: 'First trigger' }));
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      onItemHighlighted.mockClear();

      screen.getByRole('button', { name: 'Second trigger' }).focus();
      await flushMicrotasks();

      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toHaveAttribute(
        'data-highlighted',
      );
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });
  });

  describe('consumer props', () => {
    // `Menu.Input` and `Menu.Popup` wrap an inner part, and `Menu.Trigger` merges the props the
    // filter publishes. Consumer props must be applied once, or every handler fires twice.
    it('runs a consumer handler once per interaction on each composed part', async () => {
      const onTriggerClick = vi.fn();
      const onInputKeyDown = vi.fn();
      const onPopupKeyDown = vi.fn();

      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger onClick={onTriggerClick}>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup onKeydown={onPopupKeyDown}>
                  <Menu.Input aria-label="Filter actions" onKeydown={onInputKeyDown} />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      await user.click(screen.getByRole('button', { name: 'Actions' }));
      expect(onTriggerClick).toHaveBeenCalledTimes(1);

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      // Dispatched directly: this counts handler invocations.
      await fireEvent.keyDown(input, { key: 'r' });

      // A printable key stays on the input: it must not reach the handler of the popup.
      expect(onInputKeyDown).toHaveBeenCalledTimes(1);
      expect(onPopupKeyDown).toHaveBeenCalledTimes(0);

      // Escape is not consumed by the input, so it reaches the popup exactly once.
      await fireEvent.keyDown(input, { key: 'Escape' });
      expect(onPopupKeyDown).toHaveBeenCalledTimes(1);
    });

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

  describe('prop: keepMounted', () => {
    it('resets the query and highlight across a close and reopen', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal keepMounted>
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

      const trigger = screen.getByRole('button', { name: 'Actions' });
      await user.click(trigger);

      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      await user.type(input, 'ren');
      await waitFor(() => {
        expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBe(null);
      });

      await user.keyboard('[ArrowDown]');
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );

      await user.keyboard('[Escape]');
      await user.click(trigger);

      // The parts stay mounted, so the query has to be cleared explicitly on close.
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveValue('');
      });
      // The reopened popup has `opacity: 0` until it has its position.
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
      });
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).not.toHaveAttribute(
        'aria-activedescendant',
      );
    });
  });

  describe('with a Viewport', () => {
    it('keeps real focus on the input while the cursor moves through the list', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.Viewport>
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Viewport>
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

      expect(input).toHaveFocus();
      expect(input).toHaveAttribute(
        'aria-activedescendant',
        screen.getByRole('menuitem', { name: 'Rename' }).id,
      );
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
