import userEvent from '@testing-library/user-event';
import { userEvent as browserUserEvent } from 'vitest/browser';
import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import type { VNode } from 'vue';
import { reset as resetWarnings } from '../../common/warn';
import * as Menu from '../index.parts';
import {
  createRenderer,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
  const { render } = createRenderer();

  function FilterableMenu(props: {
    filterProps?: Partial<Menu.FilterProvider.Props> & {
      onValueChange?: (value: string, eventDetails: Menu.FilterProvider.ChangeEventDetails) => void;
    };
    submenu?: VNode;
  }) {
    return (
      <Menu.FilterProvider {...props.filterProps}>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item>Rename</Menu.Item>
                  <Menu.Item>Delete</Menu.Item>
                  <Menu.Item>Duplicate</Menu.Item>
                  {props.submenu}
                </Menu.List>
                <Menu.Empty>No results</Menu.Empty>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>
    );
  }

  it('makes the menu filterable', async () => {
    await render(<FilterableMenu />);

    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    const popup = screen.getByRole('dialog', { name: 'Actions' });
    expect(popup).toContainElement(screen.getByRole('searchbox', { name: 'Filter actions' }));
    expect(popup).toContainElement(screen.getByRole('menu'));
    expect(screen.getAllByRole('menuitem')).toHaveLength(3);
  });

  it('filters items by text and shows the empty state', async () => {
    const { user } = await render(<FilterableMenu />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    input.focus();
    await flushMicrotasks();
    await user.type(input, 'del');

    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Delete' })).toBeVisible();
    expect(screen.queryByRole('status')).toBe(null);

    await user.clear(input);
    await user.type(input, 'zzz');

    await waitFor(() => {
      expect(screen.queryAllByRole('menuitem')).toHaveLength(0);
    });
    expect(screen.getByRole('status')).toHaveTextContent('No results');
  });

  it('navigates the list from the input with aria-activedescendant', async () => {
    const onClick = vi.fn();
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter actions" />
                <Menu.List>
                  <Menu.Item onClick={onClick}>Rename</Menu.Item>
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

    const rename = screen.getByRole('menuitem', { name: 'Rename' });
    expect(input).toHaveAttribute('aria-activedescendant', rename.id);
    expect(input).toHaveFocus();

    await user.keyboard('[Enter]');
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('supports a controlled query', async () => {
    const onValueChange = vi.fn();
    const { user } = await render(<FilterableMenu filterProps={{ value: 'dup', onValueChange }} />);
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });

    expect(input).toHaveValue('dup');
    expect(screen.getAllByRole('menuitem')).toHaveLength(1);
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Duplicate' })).toBeVisible();
    });

    input.focus();
    await flushMicrotasks();
    await user.type(input, 'x');
    expect(onValueChange).toHaveBeenCalledWith('dupx', expect.anything());
    // The consumer owns the value, so nothing changes until it updates the prop.
    expect(input).toHaveValue('dup');
  });

  it('leaves a plain menu untouched', async () => {
    await render(
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Delete</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    await waitFor(() => {
      expect(screen.getByRole('menu')).toBeVisible();
    });
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  it('does not extend to a plain submenu inside the filterable menu', async () => {
    const { user } = await render(
      <FilterableMenu
        submenu={
          <Menu.SubmenuRoot>
            <Menu.SubmenuTrigger>Move to</Menu.SubmenuTrigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Projects</Menu.Item>
                  <Menu.Item>Archive</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.SubmenuRoot>
        }
      />,
    );

    const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to' });
    expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'menu');

    await user.click(submenuTrigger);

    const submenu = await screen.findByRole('menu', { name: 'Move to' });
    await waitFor(() => {
      expect(submenu).toBeVisible();
    });
    expect(screen.getAllByRole('searchbox')).toHaveLength(1);

    // The trigger is still an item of the filterable parent list, so the parent query hides it.
    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    input.focus();
    await flushMicrotasks();
    await user.type(input, 'ren');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Move to' })).toBe(null);
    });
  });

  it('filters a submenu that uses FilterSubmenuRoot', async () => {
    const { user } = await render(
      <FilterableMenu
        submenu={
          <Menu.FilterProvider>
            <Menu.SubmenuRoot>
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
        }
      />,
    );

    const submenuTrigger = screen.getByRole('menuitem', { name: 'Move to' });
    expect(submenuTrigger).toHaveAttribute('aria-haspopup', 'dialog');

    const input = screen.getByRole('searchbox', { name: 'Filter actions' });
    input.focus();
    await flushMicrotasks();
    await user.keyboard('[ArrowDown][ArrowDown][ArrowDown][ArrowDown]');
    expect(input).toHaveAttribute('aria-activedescendant', submenuTrigger.id);

    await user.keyboard('[ArrowRight]');

    const submenuInput = await screen.findByRole('searchbox', { name: 'Filter folders' });
    await waitFor(() => {
      expect(submenuInput).toHaveFocus();
    });
    await user.type(submenuInput, 'arch');
    await waitFor(() => {
      expect(screen.queryByRole('menuitem', { name: 'Projects' })).toBe(null);
    });
    expect(screen.getByRole('menuitem', { name: 'Archive' })).toBeVisible();
    // The parent list is untouched by the submenu query.
    expect(screen.getByRole('menuitem', { name: 'Rename' })).toBeVisible();
  });

  it('filters a submenu of a plain menu', async () => {
    await render(
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Rename</Menu.Item>
              <Menu.FilterProvider>
                <Menu.SubmenuRoot open>
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

    expect(screen.getByRole('button', { name: 'Actions' })).toHaveAttribute(
      'aria-haspopup',
      'menu',
    );
    expect(screen.getByRole('menuitem', { name: 'Move to' })).toHaveAttribute(
      'aria-haspopup',
      'dialog',
    );
    expect(screen.getByRole('dialog', { name: 'Move to' })).toContainElement(
      screen.getByRole('searchbox', { name: 'Filter folders' }),
    );
  });

  it('enters and leaves a plain submenu with the cross-axis keys from the input', async () => {
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
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Email</Menu.Item>
                          <Menu.Item>Copy link</Menu.Item>
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
    await user.keyboard('[ArrowDown][ArrowDown]');
    const trigger = screen.getByRole('menuitem', { name: 'Share' });
    expect(input).toHaveAttribute('aria-activedescendant', trigger.id);

    // A plain submenu roves real focus, so entering it hands focus to its first item.
    await user.keyboard('[ArrowRight]');
    const email = await screen.findByRole('menuitem', { name: 'Email' });
    await waitFor(() => {
      expect(email).toHaveFocus();
    });
    // Only the focused submenu item is highlighted, as when a roving trigger blurs.
    expect(trigger).not.toHaveAttribute('data-highlighted');
    await user.keyboard('[ArrowDown]');
    expect(screen.getByRole('menuitem', { name: 'Copy link' })).toHaveFocus();

    // Leaving returns focus to the input and highlights the trigger again.
    await user.keyboard('[ArrowLeft]');
    await waitFor(() => {
      expect(screen.queryByTestId('submenu')).toBe(null);
    });
    expect(input).toHaveFocus();
    expect(input).toHaveAttribute('aria-activedescendant', trigger.id);
  });

  describe.skipIf(isJSDOM)('leaving a plain submenu while it animates out', () => {
    function PlainSubmenuMenu() {
      return (
        <>
          {/* The exit outlasts the case, so a closing popup stays in its exit while the case reads it. */}
          <style>
            {'.exiting { transition: opacity 100s; } .exiting[data-ending-style] { opacity: 0; }'}
          </style>
          <Menu.FilterProvider>
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup class="exiting">
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.SubmenuRoot>
                        <Menu.SubmenuTrigger>Share</Menu.SubmenuTrigger>
                        <Menu.Portal>
                          <Menu.Positioner>
                            <Menu.Popup class="exiting" data-testid="submenu">
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
          </Menu.FilterProvider>
        </>
      );
    }

    it.each(['ArrowLeft', 'Escape'])(
      'highlights the trigger as soon as %s closes the submenu',
      async (key) => {
        globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
        const { user } = await render(<PlainSubmenuMenu />);

        const input = screen.getByRole('searchbox', { name: 'Filter actions' });
        await waitFor(() => {
          expect(input).toHaveFocus();
        });
        await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Email' })).toHaveFocus();
        });

        await user.keyboard(`[${key}]`);

        expect(screen.getByTestId('submenu')).toHaveAttribute('data-ending-style');
        expect(input).toHaveFocus();
        expect(screen.getByRole('menuitem', { name: 'Share' })).toHaveAttribute('data-highlighted');
        expect(input).not.toHaveAttribute('data-highlighted');
      },
    );

    it('keeps focus off the input while an item press closes the whole menu', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      const { user } = await render(<PlainSubmenuMenu />);

      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');
      await waitFor(() => {
        expect(screen.getByRole('menuitem', { name: 'Email' })).toHaveFocus();
      });

      await user.keyboard('[Enter]');

      expect(screen.getByTestId('submenu')).toHaveAttribute('data-ending-style');
      expect(input).toBeInTheDocument();
      expect(input).not.toHaveFocus();
    });

    it('returns focus to the input as soon as the pointer closes the submenu', async () => {
      globalThis.VASE_UI_ANIMATIONS_DISABLED = false;
      await render(<PlainSubmenuMenu />);

      // The bare instance skips the pointer-events check of user-event, which a popup that a hover
      // opened fails while it transitions in.
      await userEvent.hover(screen.getByRole('menuitem', { name: 'Share' }));
      const email = await screen.findByRole('menuitem', { name: 'Email' });
      await userEvent.hover(email);
      await waitFor(() => {
        expect(email).toHaveFocus();
      });

      await userEvent.hover(screen.getByRole('menuitem', { name: 'Rename' }));
      await waitFor(() => {
        expect(screen.getByTestId('submenu')).toHaveAttribute('data-ending-style');
      });
      expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
    });
  });

  describe('trigger key relay', () => {
    function HoverMenu() {
      return (
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger openOnHover delay={0}>
              Actions
            </Menu.Trigger>
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
      );
    }

    async function openByHover(user: Awaited<ReturnType<typeof render>>['user']) {
      const trigger = screen.getByRole('button', { name: 'Actions' });
      trigger.focus();
      await flushMicrotasks();
      await user.hover(trigger);
      const input = await screen.findByRole('searchbox', { name: 'Filter actions' });
      // A hover open shows the popup without moving focus off the trigger.
      expect(trigger).toHaveFocus();
      return { trigger, input };
    }

    it('moves ArrowDown from the trigger into the input and highlights the first item', async () => {
      const { user } = await render(<HoverMenu />);
      const { input } = await openByHover(user);

      await user.keyboard('[ArrowDown]');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      await waitFor(() => {
        expect(input).toHaveAttribute(
          'aria-activedescendant',
          screen.getByRole('menuitem', { name: 'Rename' }).id,
        );
      });
    });

    it('moves a typed character from the trigger into the input', async () => {
      const { user } = await render(<HoverMenu />);
      const { input } = await openByHover(user);

      await user.keyboard('r');

      await waitFor(() => {
        expect(input).toHaveFocus();
      });
    });

    it('keeps focus on the trigger for modified keys and cross-axis arrows', async () => {
      const { user } = await render(<HoverMenu />);
      const { trigger, input } = await openByHover(user);

      await user.keyboard('{Control>}r{/Control}');
      expect(trigger).toHaveFocus();

      await user.keyboard('[ArrowRight]');
      expect(trigger).toHaveFocus();
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('lets a consumer onKeyDown cancel the relay', async () => {
      const { user } = await render(
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.Trigger
              openOnHover
              delay={0}
              onKeydown={(event) => {
                if (event.key === 'ArrowDown') {
                  event.preventVaseUIHandler();
                }
              }}
            >
              Actions
            </Menu.Trigger>
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
      const { trigger } = await openByHover(user);

      await user.keyboard('[ArrowDown]');
      expect(trigger).toHaveFocus();
    });
  });

  describe('development warnings', () => {
    it('warns when a filterable menu opens without an input', async () => {
      resetWarnings();
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      try {
        await render(
          <Menu.FilterProvider>
            <Menu.Root open>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>,
        );

        expect(warnSpy).toHaveBeenCalledTimes(1);
        expect(warnSpy.mock.calls[0]?.[0]).toContain('opened without a <Menu.Input>');
      } finally {
        warnSpy.mockRestore();
      }
    });

    it('does not warn for a filterable menu with an input and a detached trigger', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const Test = defineComponent(() => {
        const handle = Menu.createHandle();

        return () => (
          <Menu.FilterProvider>
            <Menu.Root handle={handle} open>
              <Menu.Trigger handle={handle}>Actions</Menu.Trigger>
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
        );
      });

      try {
        await render(<Test />);
        expect(warnSpy).not.toHaveBeenCalled();
      } finally {
        warnSpy.mockRestore();
      }
    });
  });

  describe('prop: onItemHighlighted', () => {
    type OnItemHighlighted = (
      highlightedItem: HTMLElement | undefined,
      eventDetails: Menu.Root.HighlightEventDetails,
    ) => void;

    const HighlightMenu = defineComponent(
      (props: { onItemHighlighted: OnItemHighlighted; autoHighlight?: boolean }) => () => (
        <Menu.FilterProvider autoHighlight={props.autoHighlight}>
          <Menu.Root open onItemHighlighted={props.onItemHighlighted}>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Input aria-label="Filter actions" />
                  <Menu.List>
                    <Menu.Item>Rename</Menu.Item>
                    <Menu.Item label="Remove">Delete</Menu.Item>
                    <Menu.Item>Duplicate</Menu.Item>
                  </Menu.List>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menu.FilterProvider>
      ),
      { props: ['onItemHighlighted', 'autoHighlight'] },
    );

    it('reports keyboard highlights while the input keeps focus', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(<HighlightMenu onItemHighlighted={onItemHighlighted} />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      input.focus();
      await flushMicrotasks();
      await user.keyboard('[ArrowDown][ArrowDown]');

      const remove = screen.getByRole('menuitem', { name: 'Delete' });
      expect(input).toHaveFocus();
      expect(onItemHighlighted).toHaveBeenCalledTimes(2);
      expect(onItemHighlighted).toHaveBeenLastCalledWith(remove, {
        reason: 'keyboard',
        label: 'Remove',
        event: expect.any(Event),
      });
    });

    it('reports the auto-highlighted item as a programmatic change', async () => {
      const onItemHighlighted = vi.fn();
      const { user } = await render(
        <HighlightMenu autoHighlight onItemHighlighted={onItemHighlighted} />,
      );
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      input.focus();
      await flushMicrotasks();
      await user.type(input, 'dup');

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledTimes(1);
      });
      expect(onItemHighlighted).toHaveBeenCalledWith(
        screen.getByRole('menuitem', { name: 'Duplicate' }),
        { reason: 'none', label: 'Duplicate', event: expect.any(Event) },
      );

      await user.type(input, 'zzz');

      await waitFor(() => {
        expect(onItemHighlighted).toHaveBeenCalledTimes(2);
      });
      expect(onItemHighlighted).toHaveBeenLastCalledWith(undefined, {
        reason: 'none',
        label: undefined,
        event: expect.any(Event),
      });
    });

    it('does not report the item that takes the highlighted index when an item is inserted', async () => {
      const InsertMenu = defineComponent(
        (props: { inserted: boolean; onItemHighlighted: OnItemHighlighted }) => () => (
          <Menu.FilterProvider>
            <Menu.Root open onItemHighlighted={props.onItemHighlighted}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      {props.inserted && <Menu.Item>Archive</Menu.Item>}
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                      <Menu.Item>Duplicate</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ),
        { props: ['inserted', 'onItemHighlighted'] },
      );

      const onItemHighlighted = vi.fn();
      const { user, setProps } = await render(
        <InsertMenu inserted={false} onItemHighlighted={onItemHighlighted} />,
      );
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });

      input.focus();
      await flushMicrotasks();
      await user.keyboard('[ArrowDown][ArrowDown]');
      expect(onItemHighlighted).toHaveBeenLastCalledWith(
        screen.getByRole('menuitem', { name: 'Delete' }),
        expect.anything(),
      );
      onItemHighlighted.mockClear();

      await setProps({ inserted: true, onItemHighlighted });

      expect(onItemHighlighted.mock.calls.map(([item]) => item?.textContent)).toEqual([undefined]);
      expect(input).not.toHaveAttribute('aria-activedescendant');
    });

    it('keeps the highlight when an item the query filters out is appended', async () => {
      const AppendMenu = defineComponent(
        (props: { appended: boolean; onItemHighlighted: OnItemHighlighted }) => () => (
          <Menu.FilterProvider>
            <Menu.Root open onItemHighlighted={props.onItemHighlighted}>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter reports" />
                    <Menu.List>
                      <Menu.Item>Report A</Menu.Item>
                      <Menu.Item>Report B</Menu.Item>
                      <Menu.Item>Other</Menu.Item>
                      {props.appended && <Menu.Item>Zebra</Menu.Item>}
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
        ),
        { props: ['appended', 'onItemHighlighted'] },
      );

      const onItemHighlighted = vi.fn();
      const { user, setProps } = await render(
        <AppendMenu appended={false} onItemHighlighted={onItemHighlighted} />,
      );
      const input = screen.getByRole('searchbox', { name: 'Filter reports' });

      await user.type(input, 'rep');
      await user.keyboard('[ArrowDown][ArrowDown]');
      const reportB = screen.getByRole('menuitem', { name: 'Report B' });
      await waitFor(() => {
        expect(input).toHaveAttribute('aria-activedescendant', reportB.id);
      });
      onItemHighlighted.mockClear();

      await setProps({ appended: true, onItemHighlighted });

      expect(screen.queryByRole('menuitem', { name: 'Zebra' })).toBe(null);
      expect(input).toHaveAttribute('aria-activedescendant', reportB.id);
      expect(onItemHighlighted).not.toHaveBeenCalled();
    });
  });
});

describe('independent menu focus inside a filterable menu', () => {
  const { render } = createRenderer();

  it('returns to its own trigger on Shift+Tab', async () => {
    const { user } = await render(
      <Menu.FilterProvider>
        <Menu.Root open>
          <Menu.Trigger>Parent</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Input aria-label="Filter parent" />
                <Menu.List>
                  <Menu.Item>Parent action</Menu.Item>
                </Menu.List>
                <Menu.Root defaultOpen>
                  <Menu.Trigger>Independent</Menu.Trigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>Independent action</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.Root>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </Menu.FilterProvider>,
    );
    screen.getByRole('menuitem', { name: 'Independent action' }).focus();
    await flushMicrotasks();
    await user.keyboard('{Shift>}[Tab]{/Shift}');
    await waitFor(() =>
      expect(screen.queryByRole('menuitem', { name: 'Independent action' })).toBe(null),
    );
    await waitFor(() => expect(screen.getByRole('button', { name: 'Independent' })).toHaveFocus());
  });

  describe('focus navigation', () => {
    // A real Tab keypress in the browser exercises the focus guards the way a user does.
    async function pressTab(shift: boolean) {
      await browserUserEvent.keyboard(shift ? '{Shift>}[Tab]{/Shift}' : '[Tab]');
    }

    // Modal focus management hides everything outside the popup from assistive technology, the
    // same way `Dialog` does, with no modal attribute on the popup itself.
    function isHiddenFromAssistiveTechnology(element: Element) {
      return element.closest('[aria-hidden="true"], [inert]') !== null;
    }

    function FocusMenu(props: { modal?: boolean; submenu?: boolean }) {
      return (
        <div>
          <Menu.FilterProvider>
            <Menu.Root defaultOpen modal={props.modal}>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      {props.submenu && (
                        <Menu.FilterProvider>
                          <Menu.SubmenuRoot>
                            <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                            <Menu.Portal>
                              <Menu.Positioner>
                                <Menu.Popup data-testid="submenu-popup">
                                  <Menu.Input aria-label="Filter more" />
                                  <Menu.List>
                                    <Menu.Item>Share</Menu.Item>
                                  </Menu.List>
                                </Menu.Popup>
                              </Menu.Positioner>
                            </Menu.Portal>
                          </Menu.SubmenuRoot>
                        </Menu.FilterProvider>
                      )}
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
          <input data-testid="after" />
        </div>
      );
    }

    function OpenMethodMenu(props: { triggerProps?: Menu.Trigger.Props }) {
      return (
        <div>
          <Menu.FilterProvider>
            <Menu.Root>
              <Menu.Trigger {...props.triggerProps}>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup data-testid="popup">
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
          <input data-testid="after" />
        </div>
      );
    }

    it('does not trap a hover-opened popup', async () => {
      const { user } = await render(<OpenMethodMenu triggerProps={{ openOnHover: true }} />);

      await user.hover(screen.getByRole('button', { name: 'Actions' }));
      await screen.findByTestId('popup');

      expect(isHiddenFromAssistiveTechnology(screen.getByTestId('after'))).toBe(false);
    });

    it('lets Tab leave a modal filterable popup and closes it', async () => {
      await render(<FocusMenu />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      expect(isHiddenFromAssistiveTechnology(screen.getByTestId('after'))).toBe(false);

      await pressTab(false);
      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    it('skips Clear when tabbing out of the popup', async () => {
      await render(
        <div>
          <Menu.FilterProvider defaultValue="re">
            <Menu.Root defaultOpen>
              <Menu.Trigger>Actions</Menu.Trigger>
              <Menu.Portal>
                <Menu.Positioner>
                  <Menu.Popup>
                    <Menu.Input aria-label="Filter actions" />
                    <Menu.Clear aria-label="Clear query" />
                    <Menu.List>
                      <Menu.Item>Rename</Menu.Item>
                      <Menu.Item>Delete</Menu.Item>
                    </Menu.List>
                  </Menu.Popup>
                </Menu.Positioner>
              </Menu.Portal>
            </Menu.Root>
          </Menu.FilterProvider>
          <input data-testid="after" />
        </div>,
      );
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });
      expect(screen.getByLabelText('Clear query')).toHaveAttribute('tabindex', '-1');

      await pressTab(false);
      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
    });

    it('closes the popup with Escape and returns focus to the trigger', async () => {
      const { user } = await render(<FocusMenu />);
      await waitFor(() => {
        expect(screen.getByRole('searchbox', { name: 'Filter actions' })).toHaveFocus();
      });

      await user.keyboard('[Escape]');

      await waitFor(() => {
        expect(screen.queryByRole('menu')).toBe(null);
      });
      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Actions' })).toHaveFocus();
      });
    });

    it('lets Tab leave the popup with modal={false}', async () => {
      const { user } = await render(<FocusMenu modal={false} />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      expect(isHiddenFromAssistiveTechnology(screen.getByTestId('after'))).toBe(false);

      await user.tab();
      await waitFor(() => {
        expect(screen.getByTestId('after')).toHaveFocus();
      });
    });

    it('leaves a filterable submenu accessible inside its parent', async () => {
      const { user } = await render(<FocusMenu submenu />);
      const input = screen.getByRole('searchbox', { name: 'Filter actions' });
      await waitFor(() => {
        expect(input).toHaveFocus();
      });

      await user.keyboard('[ArrowDown][ArrowDown][ArrowRight]');

      const submenuInput = await screen.findByRole('searchbox', { name: 'Filter more' });
      await waitFor(() => {
        expect(submenuInput).toHaveFocus();
      });
      // The submenu runs no modal focus management of its own.
      expect(isHiddenFromAssistiveTechnology(screen.getByTestId('submenu-popup'))).toBe(false);
    });
  });
});

describe('<Menu.FilterProvider><Menu.Root/></Menu.FilterProvider>', () => {
  const { render } = createRenderer();

  // These cases are the last of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot. Each case
  // renders the part in the root, not in a portal: Vue renders a portal after the mount, so an
  // error of the part then comes in an update, and Vue cannot unmount the tree that it aborted.
  it('throws when a filter part is rendered in a plain menu', async () => {
    await expect(
      render(
        <Menu.Root>
          <Menu.Input />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Input> must be placed in a menu wrapped in <Menu.FilterProvider>.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });

  it('throws when a filter part is rendered in a plain submenu of a filterable menu', async () => {
    await expect(
      render(
        <Menu.FilterProvider>
          <Menu.Root>
            <Menu.SubmenuRoot>
              <Menu.Input />
            </Menu.SubmenuRoot>
          </Menu.Root>
        </Menu.FilterProvider>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Input> must be placed in a menu wrapped in <Menu.FilterProvider>.',
    );
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
