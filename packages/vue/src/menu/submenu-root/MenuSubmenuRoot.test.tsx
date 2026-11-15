import { describe, expect, it, vi } from 'vitest';
import { userEvent as browserUserEvent } from 'vitest/browser';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import type { MenuRootActions } from '../root/MenuRoot.vue';

describe('<Menu.SubmenuRoot />', () => {
  const { render } = createRenderer();

  function renderMenu(
    props: {
      root?: Record<string, unknown>;
      submenuRoot?: Record<string, unknown>;
      probe?: ReturnType<typeof createMenuStoreProbe>;
    } = {},
  ) {
    const Probe = props.probe?.Probe;
    return render(
      <div>
        <button data-testid="outside">Outside</button>
        <Menu.Root defaultOpen {...props.root}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="parent-menu">
                <Menu.Item>Alpha</Menu.Item>
                <Menu.SubmenuRoot defaultOpen {...props.submenuRoot}>
                  {Probe ? <Probe /> : null}
                  <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu">
                        <Menu.Item>Beta</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </div>,
    );
  }

  it('makes a menu that the menu above it owns', async () => {
    const probe = createMenuStoreProbe();
    await renderMenu({ probe });

    const parent = probe.context.parent;
    expect(parent.type).toBe('menu');
    expect(probe.store.select('rootId')).toBe(
      parent.type === 'menu' ? parent.store.select('rootId') : undefined,
    );
    expect(probe.store.select('modal')).toBe(false);
  });

  it('makes its trigger the active trigger of a submenu that is open at the mount', async () => {
    const probe = createMenuStoreProbe();
    await renderMenu({ probe });
    const trigger = screen.getByRole('menuitem', { name: 'More' });

    await waitFor(() => {
      expect(probe.store.select('activeTriggerElement')).toBe(trigger);
    });
    expect(probe.store.select('activeTriggerId')).toBe(trigger.id);
  });

  it('closes only the submenu for a press in the parent menu', async () => {
    await renderMenu();

    await fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Alpha' }));
    await flushMicrotasks();

    expect(screen.queryByTestId('submenu')).toBe(null);
    expect(screen.queryByTestId('parent-menu')).not.toBe(null);
  });

  it('VUE-4: keeps each menu open for a press in the submenu, and closes each menu for a press outside', async () => {
    // A press outside a modal menu is a press on its backdrop. The root is not modal here, so the
    // press on the element outside closes the menus.
    await renderMenu({ root: { modal: false } });

    await fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Beta' }));
    await flushMicrotasks();
    expect(screen.queryByTestId('submenu')).not.toBe(null);
    expect(screen.queryByTestId('parent-menu')).not.toBe(null);

    await fireEvent.pointerDown(screen.getByTestId('outside'));
    await flushMicrotasks();
    expect(screen.queryByTestId('submenu')).toBe(null);
    expect(screen.queryByTestId('parent-menu')).toBe(null);
  });

  it('emits openChange, update:open and openChangeComplete', async () => {
    const onOpenChange = vi.fn();
    const onUpdateOpen = vi.fn();
    const onOpenChangeComplete = vi.fn();
    await renderMenu({
      submenuRoot: {
        onOpenChange,
        'onUpdate:open': onUpdateOpen,
        onOpenChangeComplete,
      },
    });

    await fireEvent.keyDown(screen.getByTestId('submenu'), { key: 'Escape' });

    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
    expect(onOpenChange.mock.lastCall?.[1].reason).toBe('escape-key');
    expect(onUpdateOpen).toHaveBeenLastCalledWith(false);
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
  });

  it('does not emit update:open after cancel()', async () => {
    const onUpdateOpen = vi.fn();
    await renderMenu({
      submenuRoot: {
        onOpenChange: (_open: boolean, details: { cancel: () => void }) => details.cancel(),
        'onUpdate:open': onUpdateOpen,
      },
    });

    await fireEvent.keyDown(screen.getByTestId('submenu'), { key: 'Escape' });

    expect(onUpdateOpen).not.toHaveBeenCalled();
    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it('VUE-69: moves the focus to the submenu trigger for Shift+Tab when the submenu root cancels the close', async () => {
    const rootCloseReasons: string[] = [];
    const submenuCloseReasons: string[] = [];
    await render(
      <Menu.Root
        onOpenChange={(open: boolean, details: Menu.Root.ChangeEventDetails) => {
          if (!open) {
            rootCloseReasons.push(details.reason);
          }
        }}
      >
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.Item>Alpha</Menu.Item>
              <Menu.SubmenuRoot
                onOpenChange={(open: boolean, details: Menu.SubmenuRoot.ChangeEventDetails) => {
                  if (!open) {
                    submenuCloseReasons.push(details.reason);
                    details.cancel();
                  }
                }}
              >
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Beta</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    screen.getByRole('button', { name: 'Open' }).focus();
    await waitForLaterMillisecond(() => browserUserEvent.keyboard('[ArrowDown]'));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Alpha' })).toHaveFocus();
    });
    await browserUserEvent.keyboard('[ArrowDown]');
    const submenuTrigger = screen.getByRole('menuitem', { name: 'More' });
    await waitFor(() => {
      expect(submenuTrigger).toHaveFocus();
    });
    await waitForLaterMillisecond(() => browserUserEvent.keyboard('[ArrowRight]'));
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Beta' })).toHaveFocus();
    });

    await browserUserEvent.keyboard('{Shift>}[Tab]{/Shift}');

    expect(submenuTrigger).toHaveFocus();
    expect(screen.getByTestId('submenu')).toBeInTheDocument();
    expect(screen.getByTestId('parent-menu')).toBeInTheDocument();
    expect(submenuCloseReasons).toEqual([REASONS.focusOut]);
    expect(rootCloseReasons).toEqual([]);
  });

  it('emits itemHighlighted for an item of the submenu', async () => {
    const probe = createMenuStoreProbe();
    const onItemHighlighted = vi.fn();
    await renderMenu({ probe, submenuRoot: { onItemHighlighted } });

    probe.store.setActiveIndex(0, 'keyboard');
    await flushMicrotasks();

    expect(onItemHighlighted.mock.lastCall?.[0]).toBe(
      screen.getByRole('menuitem', { name: 'Beta' }),
    );
    expect(onItemHighlighted.mock.lastCall?.[1].reason).toBe('keyboard');
  });

  it('exposes close and unmount', async () => {
    const actions = shallowRef<MenuRootActions | null>(null);
    const onOpenChange = vi.fn();
    const Test = defineComponent({
      setup() {
        return () => (
          <Menu.Root defaultOpen>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot
                    defaultOpen
                    onOpenChange={onOpenChange}
                    ref={(instance) => {
                      actions.value = instance as MenuRootActions | null;
                    }}
                  >
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });
    await render(<Test />);

    expect(Object.keys(actions.value!).sort()).toEqual(['close', 'unmount']);
    actions.value!.close();

    expect(onOpenChange.mock.lastCall?.[1].reason).toBe('imperative-action');
  });
});
