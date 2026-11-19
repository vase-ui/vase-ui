import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
  within,
} from '#test-utils';

// Another file covers the VoiceOver branch of the submenu trigger. This file keeps the main path
// the same on each platform.
vi.mock('../../common/platform', async () => {
  const actual =
    await vi.importActual<typeof import('../../common/platform')>('../../common/platform');

  return {
    ...actual,
    platform: {
      ...actual.platform,
      screenReader: { ...actual.platform.screenReader, voiceOver: false },
    },
  };
});

describe('<Menu.FilterProvider><Menu.SubmenuRoot/></Menu.FilterProvider>', () => {
  const { render } = createRenderer();

  /** A filterable submenu whose parent is a plain menu that moves the focus across its items. */
  function PlainParentMenu() {
    return (
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Rename</Menu.Item>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger data-testid="submenu-trigger">Move to</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter folders" />
                        <Menu.List data-testid="submenu-list">
                          <Menu.Item>Projects</Menu.Item>
                          <Menu.Item>Archive</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    );
  }

  describe('prop: value', () => {
    it('renders the controlled query and reports changes', async () => {
      const onValueChange = vi.fn();

      const ControlledSubmenu = defineComponent(() => {
        const inputValue = shallowRef('pro');

        return () => (
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.FilterProvider
                        modelValue={inputValue.value}
                        onValueChange={(nextValue, eventDetails) => {
                          onValueChange(nextValue, eventDetails.reason);
                          inputValue.value = nextValue;
                        }}
                      >
                        <Menu.SubmenuRoot defaultOpen>
                          <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                          <Menu.Portal>
                            <Menu.Positioner>
                              <Menu.Popup>
                                <Menu.Input aria-label="Filter folders" />
                                <Menu.List>
                                  <Menu.Item>Projects</Menu.Item>
                                  <Menu.Item>Archive</Menu.Item>
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
        );
      });

      const { user } = await render(<ControlledSubmenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter folders' });
      expect(input).toHaveValue('pro');
      expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBe(null);

      await user.clear(input);

      expect(onValueChange).toHaveBeenCalledWith('', 'input-clear');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Archive' })).not.toBe(null);
      });
    });

    it('keeps the uncontrolled query when the change is canceled', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.FilterProvider
                      defaultValue="pro"
                      onValueChange={(_, eventDetails) => eventDetails.cancel()}
                    >
                      <Menu.SubmenuRoot defaultOpen>
                        <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup>
                              <Menu.Input aria-label="Filter folders" />
                              <Menu.List>
                                <Menu.Item>Projects</Menu.Item>
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

      const input = screen.getByRole('searchbox', { name: 'Filter folders' });
      await user.type(input, 'x');

      expect(input).toHaveValue('pro');
    });

    it('resets the controlled query when an item press closes the whole menu', async () => {
      const onValueChange = vi.fn();

      const ControlledSubmenu = defineComponent(() => {
        const inputValue = shallowRef('');

        return () => (
          <Menu.Root defaultOpen>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="parent-popup">
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.FilterProvider
                    modelValue={inputValue.value}
                    onValueChange={(nextValue, eventDetails) => {
                      onValueChange(nextValue, eventDetails.reason);
                      inputValue.value = nextValue;
                    }}
                  >
                    <Menu.SubmenuRoot defaultOpen>
                      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter folders" />
                            <Menu.List>
                              <Menu.Item>Projects</Menu.Item>
                              <Menu.Item>Archive</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      });

      const { user } = await render(<ControlledSubmenu />);

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await user.type(input, 'p');
      expect(screen.queryByRole('menuitem', { name: 'Archive' })).toBe(null);
      expect(onValueChange.mock.calls).toEqual([['p', 'input-change']]);

      await user.click(screen.getByRole('menuitem', { name: 'Projects' }));

      expect(screen.queryByTestId('parent-popup')).toBe(null);
      expect(onValueChange.mock.calls).toEqual([
        ['p', 'input-change'],
        ['', 'popup-close'],
      ]);
    });
  });

  describe('prop: filter', () => {
    it.skipIf(isJSDOM)(
      'keeps externally filtered items while the submenu animates out',
      async () => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;

        const folders = ['Projects', 'Photos', 'Archive'];
        const onValueChange = vi.fn();
        let endExit = () => {};
        // A busy machine can stall the page for some seconds, so the wait for the end of the exit
        // has no time limit.
        const exitEnded = new Promise<void>((resolve) => {
          endExit = resolve;
        });

        const ExternalFilterSubmenu = defineComponent(() => {
          const { contains } = Menu.useFilter();
          const query = shallowRef('');

          return () => {
            const results = folders.filter((folder) => contains(folder, query.value));

            return (
              <>
                <style>{`
                @keyframes filter-submenu-external-exit-test {
                  to { opacity: 0; }
                }
                .filter-submenu-external-exit-test[data-ending-style] {
                  animation: filter-submenu-external-exit-test 100s linear;
                }
              `}</style>
                <Menu.Root open>
                  <Menu.Trigger>Actions</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Rename</Menu.Item>
                        <Menu.FilterProvider
                          filter={null}
                          modelValue={query.value}
                          onValueChange={(value, eventDetails) => {
                            onValueChange(value, eventDetails.reason);
                            query.value = value;
                          }}
                        >
                          <Menu.SubmenuRoot
                            defaultOpen
                            onOpenChangeComplete={(nextOpen: boolean) => {
                              if (!nextOpen) {
                                endExit();
                              }
                            }}
                          >
                            <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                            <Menu.Portal>
                              <Menu.Positioner>
                                <Menu.Popup
                                  data-testid="submenu-popup"
                                  class="filter-submenu-external-exit-test"
                                >
                                  <Menu.Input aria-label="Filter folders" />
                                  <Menu.List data-testid="submenu-list">
                                    {results.map((folder) => (
                                      <Menu.Item key={folder}>{folder}</Menu.Item>
                                    ))}
                                  </Menu.List>
                                </Menu.Popup>
                              </Menu.Positioner>
                            </Menu.Portal>
                          </Menu.SubmenuRoot>
                        </Menu.FilterProvider>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </>
            );
          };
        });

        function getFolderNames() {
          return within(screen.getByTestId('submenu-list'))
            .getAllByRole('menuitem')
            .map((item) => item.textContent);
        }

        const { user } = await render(<ExternalFilterSubmenu />);

        const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
        await user.click(input);
        await user.type(input, 'p');
        await waitFor(() => {
          expect(getFolderNames()).toEqual(['Projects', 'Photos']);
        });

        await user.keyboard('[Escape]');
        await flushMicrotasks();

        const popup = screen.getByTestId('submenu-popup');
        expect(popup).toHaveAttribute('data-ending-style');
        expect(getFolderNames()).toEqual(['Projects', 'Photos']);
        expect(input).toHaveValue('p');
        expect(onValueChange).not.toHaveBeenCalledWith('', 'popup-close');

        popup.getAnimations().forEach((animation) => animation.finish());
        await exitEnded;
        await flushMicrotasks();
        expect(screen.queryByTestId('submenu-popup')).toBe(null);
        expect(onValueChange).toHaveBeenLastCalledWith('', 'popup-close');
      },
    );
  });

  describe.skipIf(isJSDOM)('inside a plain parent menu', () => {
    it('closes with Escape and returns focus to the highlighted trigger', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();
      const input = await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowRight}');
        return screen.findByRole('searchbox', { name: 'Filter folders' });
      });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      expect(screen.queryByTestId('submenu-list')).toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(trigger).toHaveAttribute('data-highlighted');
      expect(screen.getByRole('menuitem', { name: 'Rename' })).not.toBe(null);
    });

    it('opens with the cross-axis key and focuses the submenu input', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      const input = await screen.findByRole('searchbox', { name: 'Filter folders' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('closes with the cross-axis close key and returns focus to the trigger', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();
      const input = await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowRight}');
        return screen.findByRole('searchbox', { name: 'Filter folders' });
      });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('{ArrowLeft}');

      expect(screen.queryByTestId('submenu-list')).toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it('hands the cursor back to the submenu input when the open key repeats', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();
      const input = await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowRight}');
        return screen.findByRole('searchbox', { name: 'Filter folders' });
      });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      // Move real focus back onto the trigger, then press the open key again while the submenu
      // is still open: it must re-enter rather than reopen.
      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(screen.getByTestId('submenu-list')).not.toBe(null);
    });

    it('keeps the automatic highlight when the keyboard enters a hover-opened submenu', async () => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Rename</Menu.Item>
                <Menu.FilterProvider autoHighlight="always">
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0} data-testid="submenu-trigger">
                      Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter folders" />
                          <Menu.List>
                            <Menu.Item>Projects</Menu.Item>
                            <Menu.Item>Archive</Menu.Item>
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.FilterProvider>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByTestId('submenu-trigger');
      const input = await waitForLaterMillisecond(async () => {
        await user.hover(trigger);
        return screen.findByRole('searchbox', { name: 'Filter folders' });
      });
      const projects = screen.getByRole('menuitem', { name: 'Projects' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', projects.id);
      });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });

      await user.keyboard('{ArrowRight}');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(input).toHaveAttribute('aria-activedescendant', projects.id);
    });

    it('moves along the parent list with the main-axis keys', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{ArrowDown}');

      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Delete' })).toHaveFocus();
      });
    });

    it('closes when the close key arrives while the trigger holds focus', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();
      await waitForLaterMillisecond(async () => {
        await user.keyboard('{ArrowRight}');
        await screen.findByRole('searchbox', { name: 'Filter folders' });
      });

      // Put real focus back on the trigger, then press the close key there rather than in the
      // submenu popup.
      trigger.focus();
      await flushMicrotasks();
      await user.keyboard('{ArrowLeft}');

      expect(screen.queryByTestId('submenu-list')).toBe(null);
    });

    it('keeps focus in the submenu input when the pointer crosses the trigger again', async () => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>Rename</Menu.Item>
                <Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger delay={0} data-testid="submenu-trigger">
                      Move to
                    </Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Input aria-label="Filter folders" />
                          <Menu.List>
                            <Menu.Item>Projects</Menu.Item>
                            <Menu.Item>Archive</Menu.Item>
                          </Menu.List>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.FilterProvider>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByTestId('submenu-trigger');
      const input = await waitForLaterMillisecond(async () => {
        await user.hover(trigger);
        return screen.findByRole('searchbox', { name: 'Filter folders' });
      });

      // The pointer enters the submenu and typing starts.
      await fireEvent.mouseMove(input);
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('ar');
      expect(input).toHaveValue('ar');

      // Crossing the trigger must not interrupt the typing in the submenu. In WebKit, a list
      // ignores a pointer move with no movement.
      await fireEvent.mouseMove(trigger, { movementX: 1 });
      await waitSingleFrame();
      await waitSingleFrame();
      expect(input).toHaveFocus();
      await user.keyboard('c');
      expect(input).toHaveValue('arc');
      expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
    });

    it('leaves a key that is neither an axis nor an activation key to the parent', async () => {
      const { user } = await render(<PlainParentMenu />);

      const trigger = screen.getByTestId('submenu-trigger');
      trigger.focus();
      await flushMicrotasks();

      await user.keyboard('{Home}');

      // The submenu must not open, and the parent's own Home handling still runs.
      expect(screen.queryByTestId('submenu-list')).toBe(null);
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Rename' })).toHaveFocus();
      });
    });
  });
});

describe('filtered submenu trigger navigation', () => {
  const { render } = createRenderer();

  it('prevents native scrolling when moving along the parent menu', async () => {
    await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter child actions" />
                        <Menu.List>
                          <Menu.Item>Child</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
              <Menu.Item>Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    trigger.focus();
    await flushMicrotasks();
    expect(await fireEvent.keyDown(trigger, { key: 'ArrowDown' })).toBe(false);
    expect(screen.getByRole('menuitem', { name: 'Next' })).toHaveFocus();
  });
});

describe('closing a filtered submenu from the keyboard', () => {
  const { render } = createRenderer();

  it('ignores a close key that composes text in the submenu input', async () => {
    const { user } = await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger openOnHover={false}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter child actions" />
                        <Menu.List>
                          <Menu.Item>Child</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    screen.getByRole('menuitem', { name: 'More' }).focus();
    await flushMicrotasks();
    const input = await waitForLaterMillisecond(async () => {
      await user.keyboard('[ArrowRight]');
      return screen.findByRole('searchbox', { name: 'Filter child actions' });
    });
    await waitFor(() => {
      expect(input).toHaveFocus();
    });

    // The handler reads `which`. A constructed event takes it from `keyCode` in Chromium only.
    await fireEvent.keyDown(input, { key: 'ArrowLeft', keyCode: 229, which: 229 });

    // The popup can stay mounted through an exit animation, so check the open state itself.
    expect(screen.getByRole('menuitem', { name: 'More' })).toHaveAttribute('data-popup-open');
    expect(input).toHaveFocus();
  });

  function Submenu(props: { filterable: boolean; container?: ShadowRoot }) {
    const submenu = (
      <Menu.SubmenuRoot>
        <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
        <Menu.Portal to={props.container}>
          <Menu.Positioner>
            <Menu.Popup data-testid="submenu">
              {props.filterable && <Menu.Input aria-label="Filter child actions" />}
              <Menu.List>
                <Menu.Item>Child</Menu.Item>
              </Menu.List>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.SubmenuRoot>
    );
    return props.filterable ? <Menu.FilterProvider>{submenu}</Menu.FilterProvider> : submenu;
  }

  it.each([
    { parentFilterable: false, submenuFilterable: true },
    { parentFilterable: true, submenuFilterable: false },
    { parentFilterable: true, submenuFilterable: true },
  ])(
    'moves a horizontal parent on when a vertical submenu closes on its main-axis key (filterable parent: $parentFilterable, filterable submenu: $submenuFilterable)',
    async ({ parentFilterable, submenuFilterable }) => {
      const menu = (
        <Menu.Root orientation="horizontal">
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                {parentFilterable && <Menu.Input aria-label="Filter actions" />}
                <Menu.List>
                  <Menu.Item>First</Menu.Item>
                  <Submenu filterable={submenuFilterable} />
                  <Menu.Item>Last</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      );
      const { user } = await render(
        parentFilterable ? <Menu.FilterProvider>{menu}</Menu.FilterProvider> : menu,
      );

      screen.getByRole('button', { name: 'Actions' }).focus();
      await flushMicrotasks();
      const initialFocus = await waitForLaterMillisecond(async () => {
        await user.keyboard('[Enter]');
        return parentFilterable
          ? screen.findByRole('searchbox', { name: 'Filter actions' })
          : screen.findByRole('menuitem', { name: 'First' });
      });
      await waitFor(() => expect(initialFocus).toHaveFocus());
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-highlighted');
      });

      const submenu = await waitForLaterMillisecond(async () => {
        await user.keyboard('[ArrowDown]');
        return screen.findByTestId('submenu');
      });
      await waitFor(() => {
        expect(submenu.contains(document.activeElement)).toBe(true);
      });
      await user.keyboard('[ArrowLeft]');

      expect(screen.queryByTestId('submenu')).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('data-highlighted');
      expect(trigger).not.toHaveAttribute('data-highlighted');
    },
  );

  it.each([false, true])(
    'does not wrap a filterable parent when closing from its first item (filterable submenu: %s)',
    async (submenuFilterable) => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Submenu filterable={submenuFilterable} />
                    <Menu.Item>Middle</Menu.Item>
                    <Menu.Item>Last</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      screen.getByRole('button', { name: 'Actions' }).focus();
      await flushMicrotasks();
      const input = await waitForLaterMillisecond(async () => {
        await user.keyboard('[Enter]');
        return screen.findByRole('searchbox', { name: 'Filter actions' });
      });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
      });

      const submenu = await waitForLaterMillisecond(async () => {
        await user.keyboard('[ArrowDown]');
        return screen.findByTestId('submenu');
      });
      await waitFor(() => {
        expect(submenu.contains(document.activeElement)).toBe(true);
      });
      await user.keyboard('[ArrowLeft]');

      expect(screen.queryByTestId('submenu')).toBe(null);
      expect(input).toHaveFocus();
      expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
      expect(screen.getByRole('menuitem', { name: 'Last' })).not.toHaveAttribute(
        'data-highlighted',
      );
    },
  );

  it('moves a filterable parent on when a submenu portaled into a shadow root closes', async () => {
    const host = document.createElement('div');
    document.body.append(host);
    const shadowRoot = host.attachShadow({ mode: 'open' });

    try {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root orientation="horizontal">
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>First</Menu.Item>
                    <Submenu filterable={false} container={shadowRoot} />
                    <Menu.Item>Last</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>,
      );

      screen.getByRole('button', { name: 'Actions' }).focus();
      await flushMicrotasks();
      await waitForLaterMillisecond(() => user.keyboard('[Enter]'));
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });
      await user.keyboard('[ArrowRight]');
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await waitFor(() => {
        expect(trigger).toHaveAttribute('data-highlighted');
      });

      await waitForLaterMillisecond(async () => {
        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(shadowRoot.querySelector('[data-testid="submenu"]')).not.toBe(null);
        });
      });
      await waitFor(() => {
        expect(shadowRoot.activeElement).not.toBe(null);
      });
      await user.keyboard('[ArrowLeft]');

      expect(shadowRoot.querySelector('[data-testid="submenu"]')).toBe(null);
      expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('data-highlighted');
    } finally {
      host.remove();
    }
  });
});

describe('nested popups of a filterable menu', () => {
  const { render } = createRenderer();

  function FilterableMenuWithFilterableSubmenu() {
    return (
      <Menu.FilterProvider>
        <Menu.Root defaultOpen>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="parent-popup">
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.FilterProvider>
                    <Menu.SubmenuRoot>
                      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter folders" />
                            <Menu.List>
                              <Menu.Item>Projects</Menu.Item>
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
    );
  }

  // A popup that `Teleport` moved sends no event to the popup of its parent. The popups of a
  // filterable menu give each other these events through the popup tree.
  it('keeps the focus in the submenu input while the pointer moves over the popup of the parent', async () => {
    const { user } = await render(<FilterableMenuWithFilterableSubmenu />);

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
    const submenuInput = await waitForLaterMillisecond(async () => {
      await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');
      return screen.findByRole('searchbox', { name: 'Filter folders' });
    });
    await waitFor(() => {
      expect(submenuInput).toHaveFocus();
    });

    await fireEvent.mouseMove(screen.getByTestId('parent-popup'));

    expect(submenuInput).toHaveFocus();
  });

  it('returns the focus and the highlight to the parent input when Escape closes the submenu', async () => {
    const { user } = await render(<FilterableMenuWithFilterableSubmenu />);

    const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(parentInput).toHaveFocus();
    });
    await waitForLaterMillisecond(() => user.keyboard('[ArrowDown][ArrowDown][ArrowRight]'));
    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter folders' })).toHaveFocus();
    });

    await user.keyboard('[Escape]');

    await waitFor(() => {
      expect(parentInput).toHaveFocus();
    });
    const trigger = screen.getByRole('menuitem', { name: 'Move to' });
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(parentInput).toHaveAttribute('aria-activedescendant', trigger.id);
  });

  it('moves the highlight of a horizontal parent on when a plain submenu closes with the main-axis key', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root defaultOpen orientation="horizontal">
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>First</Menu.Item>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Child</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <Menu.Item>Last</Menu.Item>
                </Menu.List>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );

    await waitFor(() => {
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
    await user.keyboard('[ArrowRight][ArrowRight]');
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-highlighted');
    });
    const submenu = await waitForLaterMillisecond(async () => {
      await user.keyboard('[ArrowDown]');
      return screen.findByTestId('submenu');
    });
    await waitFor(() => {
      expect(submenu.contains(document.activeElement)).toBe(true);
    });

    await user.keyboard('[ArrowLeft]');

    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'First' })).toHaveAttribute('data-highlighted');
    });
    expect(trigger).not.toHaveAttribute('data-highlighted');
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('closes the submenu when the query filters out its trigger', async () => {
    const onOpenChange = vi.fn();
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
                    <Menu.SubmenuRoot defaultOpen onOpenChange={onOpenChange}>
                      <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Input aria-label="Filter folders" />
                            <Menu.List>
                              <Menu.Item>Projects</Menu.Item>
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
    await screen.findByRole('searchbox', { name: 'Filter folders' });

    // A press in the popup of the parent closes the submenu, so the query comes from the keyboard.
    const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
    parentInput.focus();
    await flushMicrotasks();
    await user.keyboard('rename');

    // The reason tells this close from a close that the focus or a press starts.
    await waitFor(() => {
      expect(onOpenChange).toHaveBeenCalledTimes(1);
    });
    expect(onOpenChange.mock.calls[0]?.[0]).toBe(false);
    expect(onOpenChange.mock.calls[0]?.[1].reason).toBe('none');
    // The trigger and the item of the submenu go when the submenu unmounts.
    await waitFor(() => {
      expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    });
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
    expect(screen.queryByRole('searchbox', { name: 'Filter folders' })).toBe(null);
  });

  // The tree gives an event to each popup in it. A popup takes only the events of the popups below
  // it, as React gives an event only to the popups above its target.
  it('gives the focus to a kept-mounted submenu input after another submenu had the focus', async () => {
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
                      <Menu.SubmenuTrigger delay={0}>Move to</Menu.SubmenuTrigger>
                      <Menu.Portal keepMounted>
                        <Menu.Positioner>
                          <Menu.Popup data-testid="kept-mounted-submenu">
                            <Menu.Input aria-label="Filter folders" />
                            <Menu.List>
                              <Menu.Item>Projects</Menu.Item>
                            </Menu.List>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.SubmenuRoot>
                  </Menu.FilterProvider>
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
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

    const parentInput = screen.getByRole('searchbox', { name: 'Filter actions' });
    await waitFor(() => {
      expect(parentInput).toHaveFocus();
    });
    await waitForLaterMillisecond(() => user.keyboard('[ArrowDown][ArrowDown][ArrowRight]'));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Email' })).toHaveFocus();
    });
    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(parentInput).toHaveFocus();
    });

    const trigger = screen.getByRole('menuitem', { name: 'Move to' });
    await user.hover(trigger);
    await waitFor(() => {
      expect(trigger).toHaveAttribute('data-popup-open');
    });
    await fireEvent.mouseMove(screen.getByTestId('kept-mounted-submenu'));

    expect(screen.getByRole('searchbox', { name: 'Filter folders' })).toHaveFocus();
  });

  it('disables the submenu input while the parent menu is disabled', async () => {
    await render(
      <Menu.Root open disabled>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot defaultOpen>
                  <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Input aria-label="Filter folders" />
                        <Menu.List>
                          <Menu.Item>Projects</Menu.Item>
                        </Menu.List>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.FilterProvider>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(screen.getByRole('searchbox', { name: 'Filter folders' })).toBeDisabled();
  });
});
