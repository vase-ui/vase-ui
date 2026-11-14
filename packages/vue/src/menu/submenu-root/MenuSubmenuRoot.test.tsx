import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import { createRenderer, fireEvent, flushMicrotasks, screen, waitFor } from '#test-utils';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
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

  it.each([
    { name: 'by default', closeParentOnEsc: false, parentOpen: true },
    { name: 'with closeParentOnEsc', closeParentOnEsc: true, parentOpen: false },
  ])('closes for Escape in the submenu $name', async ({ closeParentOnEsc, parentOpen }) => {
    await renderMenu({ submenuRoot: { closeParentOnEsc } });
    const submenu = screen.getByTestId('submenu');

    await fireEvent.keyDown(submenu, { key: 'Escape' });
    await flushMicrotasks();

    expect(screen.queryByTestId('submenu')).toBe(null);
    expect(screen.queryByTestId('parent-menu') !== null).toBe(parentOpen);
  });

  it('closes only the submenu for a press in the parent menu', async () => {
    await renderMenu();

    await fireEvent.pointerDown(screen.getByRole('menuitem', { name: 'Alpha' }));
    await flushMicrotasks();

    expect(screen.queryByTestId('submenu')).toBe(null);
    expect(screen.queryByTestId('parent-menu')).not.toBe(null);
  });

  it('keeps each menu open for a press in the submenu, and closes each menu for a press outside', async () => {
    await renderMenu();

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
