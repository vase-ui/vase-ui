import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';

describe('<Menu.SubmenuTrigger />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

  async function waitForAnimationFrame() {
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve());
    });
    await flushMicrotasks();
  }

  afterEach(waitForAnimationFrame);

  it.skipIf(isJSDOM)('closes a touch-opened submenu on a second tap', async () => {
    const { user } = await render(
      <Menu.Root defaultOpen>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="parent-menu">
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                <Menu.Portal>
                  <Menu.Positioner>
                    <Menu.Popup data-testid="submenu">
                      <Menu.Item>Alpha</Menu.Item>
                    </Menu.Popup>
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.SubmenuRoot>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await user.pointer({ target: trigger, keys: '[TouchA]' });
    await screen.findByTestId('submenu');
    await waitForAnimationFrame();

    await user.pointer({ target: trigger, keys: '[TouchA]' });

    await waitFor(() => {
      expect(screen.queryByTestId('submenu')).toBe(null);
    });
    expect(screen.getByTestId('parent-menu')).not.toBe(null);
  });

  describeConformance(<Menu.SubmenuTrigger />, () => ({
    refInstanceof: window.HTMLDivElement,
    button: true,
    render(node) {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>{node}</Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
  }));

  it('follows a submenu trigger id change', async () => {
    const storeRef: { current: MenuStore<unknown> | null } = { current: null };

    const StoreProbe = defineComponent({
      setup() {
        storeRef.current = useMenuRootContext().store;
        return () => null;
      },
    });

    const App = defineComponent({
      props: { id: { type: String, required: true } },
      setup(props) {
        return () => (
          <Menu.Root open>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.SubmenuRoot>
                    <StoreProbe />
                    <Menu.SubmenuTrigger id={props.id}>More</Menu.SubmenuTrigger>
                    <Menu.Portal>
                      <Menu.Positioner>
                        <Menu.Popup>
                          <Menu.Item>Monthly</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        );
      },
    });

    const { setProps } = await render(<App id="first" />);

    const submenuTrigger = screen.getByText('More');
    expect(storeRef.current!.context.triggerElements.getById('first')).toBe(submenuTrigger);

    await setProps({ id: 'second' });

    expect(storeRef.current!.context.triggerElements.getById('first')).toBeUndefined();
    expect(storeRef.current!.context.triggerElements.getById('second')).toBe(submenuTrigger);
    expect(storeRef.current!.context.triggerElements.size).toBe(1);
  });

  describe('hover and press', () => {
    function renderSubmenu(
      props: {
        root?: Record<string, unknown>;
        submenuRoot?: Record<string, unknown>;
        trigger?: Record<string, unknown>;
      } = {},
    ) {
      return render(
        <Menu.Root open {...props.root}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="parent-menu">
                <Menu.Item>Alpha</Menu.Item>
                <Menu.SubmenuRoot {...props.submenuRoot}>
                  <Menu.SubmenuTrigger {...props.trigger}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu-positioner">
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
    }

    async function hover(element: HTMLElement) {
      await fireEvent.mouseEnter(element);
      await fireEvent.mouseMove(element);
    }

    function wait(ms: number) {
      return new Promise<void>((resolve) => {
        setTimeout(resolve, ms);
      });
    }

    it('opens the submenu on hover, and names the submenu in its attributes', async () => {
      await renderSubmenu({ trigger: { delay: 0 } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      expect(trigger).toHaveAttribute('aria-haspopup', 'menu');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      await hover(trigger);

      const submenu = await screen.findByTestId('submenu');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger).toHaveAttribute('aria-controls', submenu.id);
      expect(trigger).toHaveAttribute('data-popup-open');
    });

    it('opens on a hover with a delay only after the pointer moved in the parent menu', async () => {
      await renderSubmenu({ trigger: { delay: 20 } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });

      await fireEvent.mouseEnter(trigger);
      await wait(60);
      await flushMicrotasks();
      expect(screen.queryByTestId('submenu')).toBe(null);

      await fireEvent.mouseMove(trigger);

      expect(await screen.findByTestId('submenu')).not.toBe(null);
    });

    it('closes the submenu when the pointer moves over another item of the parent menu', async () => {
      const onOpenChange = vi.fn();
      await renderSubmenu({ trigger: { delay: 0 }, submenuRoot: { onOpenChange } });
      await hover(screen.getByRole('menuitem', { name: 'More' }));
      await screen.findByTestId('submenu');

      await fireEvent.mouseMove(screen.getByRole('menuitem', { name: 'Alpha' }));

      expect(screen.queryByTestId('submenu')).toBe(null);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe('sibling-open');
    });

    it('stays open when the pointer comes back to its trigger before the close delay ends', async () => {
      await renderSubmenu({ trigger: { delay: 0, closeDelay: 40 } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      const alpha = screen.getByRole('menuitem', { name: 'Alpha' });
      await hover(trigger);
      await screen.findByTestId('submenu');

      await fireEvent.mouseMove(alpha);
      await fireEvent.mouseMove(trigger);
      await wait(80);
      await flushMicrotasks();
      expect(screen.queryByTestId('submenu')).not.toBe(null);

      await fireEvent.mouseMove(alpha);
      await wait(80);
      await flushMicrotasks();
      expect(screen.queryByTestId('submenu')).toBe(null);
    });

    it('closes a submenu that hover opened when the pointer leaves the submenu, after the close delay', async () => {
      await renderSubmenu({ trigger: { delay: 0, closeDelay: 40 } });
      await hover(screen.getByRole('menuitem', { name: 'More' }));
      const positioner = await screen.findByTestId('submenu-positioner');

      await fireEvent.mouseEnter(positioner);
      await fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
      expect(screen.queryByTestId('submenu')).not.toBe(null);

      await waitFor(() => {
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
    });

    it.each([
      { name: 'by default', highlightItemOnHover: true },
      { name: 'with highlightItemOnHover false', highlightItemOnHover: false },
    ])('highlights the trigger when the pointer enters it $name', async ({ highlightItemOnHover }) => {
      await renderSubmenu({ root: { highlightItemOnHover }, trigger: { openOnHover: false } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      expect(trigger).not.toHaveAttribute('data-highlighted');

      await fireEvent.mouseEnter(trigger);

      expect(trigger.hasAttribute('data-highlighted')).toBe(highlightItemOnHover);
    });

    it('clears the highlight of the trigger when the focus leaves it', async () => {
      await renderSubmenu({ trigger: { openOnHover: false } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      await fireEvent.mouseEnter(trigger);
      expect(trigger).toHaveAttribute('data-highlighted');

      await fireEvent.focusOut(trigger);

      expect(trigger).not.toHaveAttribute('data-highlighted');
    });

    it.each([
      { name: 'while its submenu is open', defaultOpen: true, tabindex: '0' },
      { name: 'while its submenu is closed', defaultOpen: false, tabindex: '-1' },
    ])('has the tab stop $name', async ({ defaultOpen, tabindex }) => {
      await renderSubmenu({ submenuRoot: { defaultOpen } });

      expect(screen.getByRole('menuitem', { name: 'More' })).toHaveAttribute('tabindex', tabindex);
    });

    it('opens the submenu with a mouse press when openOnHover is false, and a second press closes it', async () => {
      const { user } = await renderSubmenu({ trigger: { openOnHover: false } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });

      await user.click(trigger);
      expect(await screen.findByTestId('submenu')).not.toBe(null);

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.queryByTestId('submenu')).toBe(null);
      });
    });

    it('ignores a mouse press while openOnHover is set', async () => {
      await renderSubmenu();
      const trigger = screen.getByRole('menuitem', { name: 'More' });

      await fireEvent.pointerDown(trigger, { pointerType: 'mouse', buttons: 1 });
      await fireEvent.mouseDown(trigger);
      await fireEvent.click(trigger, { detail: 1 });
      await waitForAnimationFrame();

      expect(screen.queryByTestId('submenu')).toBe(null);
    });
  });

  describe('prop: disabled', () => {
    it('should render with disabled attributes when disabled prop is set', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled>Open submenu</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      expect(submenuTrigger).toHaveAttribute('data-disabled');
      expect(submenuTrigger).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not open on hover when disabled', async () => {
      const { user } = await render(
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger disabled delay={0}>
                    Open submenu
                  </Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup data-testid="submenu-popup">
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const submenuTrigger = screen.getByRole('menuitem', { name: 'Open submenu' });

      await user.hover(submenuTrigger);

      expect(screen.queryByTestId('submenu-popup')).toBe(null);
    });

    it('should warn when a disabled element is detected via render prop with JSX element', async () => {
      const warnSpy = vi
        .spyOn(console, 'warn')
        .mockName('console.warn')
        .mockImplementation(() => {});
      await render(
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger
                    nativeButton
                    v-slots={{
                      render: ({ props }: { props: HTMLProps }) => (
                        <button {...props} type="button" disabled={true}>
                          Open submenu
                        </button>
                      ),
                    }}
                  />
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(warnSpy).toHaveBeenCalledTimes(1);
      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining(
          'Vase UI: A disabled element was detected on <Menu.SubmenuTrigger>. To properly disable the trigger, use the `disabled` prop on the component instead of setting it on the rendered element.',
        ),
      );
      expect(warnSpy.mock.lastCall?.[0]).not.toContain('undefined');
    });
  });

  // A part that throws in `setup` leaves Vue in a state that can break a later case, so these two
  // cases are the last of the file.
  it('throws when rendered outside Menu.SubmenuRoot', async () => {
    await expect(render(<Menu.SubmenuTrigger />)).rejects.toThrow(
      'Vase UI: <Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>. Without a submenu root the trigger has no submenu to open. Put the trigger inside <Menu.SubmenuRoot>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });

  it('throws when Menu.SubmenuRoot is rendered outside a menu', async () => {
    await expect(
      render(
        <Menu.SubmenuRoot>
          <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
        </Menu.SubmenuRoot>,
      ),
    ).rejects.toThrow(
      'Vase UI: A part of Menu must be inside <Menu.Root>. Without a root the part has no menu state. Put the part inside <Menu.Root>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
