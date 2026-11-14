import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { defineComponent } from 'vue';
import { DirectionProvider } from '@vase-ui/vue/direction-provider';
import type { TextDirection } from '@vase-ui/vue/direction-provider';
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
import { createAttribute } from '../../utils/popups/createAttribute';
import { useMenuRootContext } from '../root/MenuRootContext';
import type { MenuStore } from '../store/MenuStore';

async function waitForAnimationFrame() {
  await new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve());
  });
  await flushMicrotasks();
}

describe('<Menu.SubmenuTrigger /> on hover and on a press', () => {
  const { render } = createRenderer();

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

  // A case that asserts the state before a delay ends runs the delay with a fake clock.
  function useFakeClock() {
    vi.useFakeTimers();
    onTestFinished(() => {
      vi.useRealTimers();
    });
    return async (ms: number) => {
      vi.advanceTimersByTime(ms);
      await flushMicrotasks();
    };
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
    const tick = useFakeClock();
    const onOpenChange = vi.fn();
    await renderSubmenu({ trigger: { delay: 0, closeDelay: 40 }, submenuRoot: { onOpenChange } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    const alpha = screen.getByRole('menuitem', { name: 'Alpha' });
    await hover(trigger);
    await tick(0);
    expect(trigger).toHaveAttribute('data-popup-open');

    await fireEvent.mouseMove(alpha);
    await tick(39);
    await fireEvent.mouseMove(trigger);
    await tick(80);

    expect(trigger).toHaveAttribute('data-popup-open');
    expect(onOpenChange.mock.calls.map(([open]) => open)).toEqual([true]);
  });

  it('closes after the close delay when the pointer moves over another item of the parent menu', async () => {
    const tick = useFakeClock();
    await renderSubmenu({ trigger: { delay: 0, closeDelay: 40 } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await hover(trigger);
    await tick(0);
    expect(trigger).toHaveAttribute('data-popup-open');

    await fireEvent.mouseMove(screen.getByRole('menuitem', { name: 'Alpha' }));
    await tick(39);
    expect(trigger).toHaveAttribute('data-popup-open');

    await tick(1);
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('closes a submenu that hover opened when the pointer leaves the submenu, after the close delay', async () => {
    const tick = useFakeClock();
    await renderSubmenu({ trigger: { delay: 0, closeDelay: 40 } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await hover(trigger);
    await tick(0);
    const positioner = screen.getByTestId('submenu-positioner');

    await fireEvent.mouseEnter(positioner);
    await fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
    await tick(39);
    expect(trigger).toHaveAttribute('data-popup-open');

    await tick(1);
    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('opens the submenu on the first move over the trigger, with no enter event', async () => {
    await renderSubmenu({ trigger: { delay: 0 } });

    await fireEvent.mouseMove(screen.getByRole('menuitem', { name: 'More' }));

    expect(await screen.findByTestId('submenu')).not.toBe(null);
  });

  it('cancels a hover open that waits for its delay at a mouseout with no mouseleave', async () => {
    const tick = useFakeClock();
    await renderSubmenu({ trigger: { delay: 20 } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });

    await hover(trigger);
    await tick(19);
    await fireEvent.mouseOut(trigger, {
      relatedTarget: screen.getByRole('menuitem', { name: 'Alpha' }),
    });
    await tick(60);

    expect(trigger).not.toHaveAttribute('data-popup-open');
  });

  it('keeps a submenu that hover opened open for a keyboard click of its trigger', async () => {
    await renderSubmenu({ trigger: { delay: 0 } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await hover(trigger);
    await screen.findByTestId('submenu');

    await fireEvent.click(trigger, { detail: 0 });
    await waitForAnimationFrame();

    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it('stays open after a move in the submenu, when the pointer leaves its trigger', async () => {
    await renderSubmenu({ trigger: { delay: 0 } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await hover(trigger);
    await fireEvent.mouseMove(await screen.findByTestId('submenu'));

    await fireEvent.mouseEnter(trigger);
    await fireEvent.mouseLeave(trigger, { clientX: 1000, clientY: 1000 });
    await waitForAnimationFrame();

    expect(screen.queryByTestId('submenu')).not.toBe(null);
  });

  it.each([
    { name: 'a disabled submenu root', props: { submenuRoot: { disabled: true } } },
    { name: 'a disabled parent menu', props: { root: { disabled: true } } },
  ])('is disabled by $name', async ({ props }) => {
    await renderSubmenu(props);

    const trigger = screen.getByRole('menuitem', { name: 'More' });
    expect(trigger).toHaveAttribute('data-disabled');
    expect(trigger).toHaveAttribute('aria-disabled', 'true');
  });

  it.each([
    { name: 'by default', highlightItemOnHover: true },
    { name: 'with highlightItemOnHover false', highlightItemOnHover: false },
  ])(
    'highlights the trigger when the pointer enters it $name',
    async ({ highlightItemOnHover }) => {
      await renderSubmenu({ root: { highlightItemOnHover }, trigger: { openOnHover: false } });
      const trigger = screen.getByRole('menuitem', { name: 'More' });
      expect(trigger).not.toHaveAttribute('data-highlighted');

      await fireEvent.mouseEnter(trigger);

      expect(trigger.hasAttribute('data-highlighted')).toBe(highlightItemOnHover);
    },
  );

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

  it('has the tab stop while it is highlighted', async () => {
    await renderSubmenu({ trigger: { openOnHover: false } });
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    expect(trigger).toHaveAttribute('tabindex', '-1');

    await fireEvent.mouseEnter(trigger);

    expect(trigger).toHaveAttribute('tabindex', '0');
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

describe('<Menu.SubmenuTrigger />', () => {
  const { render } = createRenderer();

  beforeEach(() => {
    globalThis.VASE_UI_ANIMATIONS_DISABLED = true;
  });

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

  it('keeps a submenu open on direct trigger focus but closes it on guard return', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Actions</Menu.Trigger>
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
              <Menu.Item>Play Next</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await user.keyboard('[Tab][Enter]');
    const trigger = screen.getByRole('menuitem', { name: 'More' });
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });
    await user.keyboard('[ArrowRight]');
    const item = screen.getByRole('menuitem', { name: 'Alpha' });
    await waitFor(() => {
      expect(item).toHaveFocus();
    });

    trigger.focus();
    await flushMicrotasks();
    expect(screen.getByTestId('submenu')).not.toBe(null);

    item.focus();
    await flushMicrotasks();

    const submenu = screen.getByTestId('submenu');
    const guard = submenu.parentElement?.querySelector<HTMLElement>(
      `[${createAttribute('focus-guard')}][data-type="inside"]`,
    );
    expect(guard).toBeTruthy();

    guard?.focus();
    await flushMicrotasks();
    await waitFor(() => {
      expect(trigger).toHaveFocus();
    });

    await waitFor(() => {
      expect(screen.queryByTestId('submenu')).toBe(null);
    });
    expect(screen.getByTestId('parent-menu')).not.toBe(null);

    await user.keyboard('[ArrowDown]');
    await waitFor(() => {
      expect(screen.getByRole('menuitem', { name: 'Play Next' })).toHaveFocus();
    });
  });

  it.skipIf(isJSDOM)(
    'closes a submenu when its focus guard is in a shadow-root portal',
    async () => {
      const host = document.createElement('div');
      document.body.append(host);
      const shadowRoot = host.attachShadow({ mode: 'open' });

      try {
        const { user } = await render(
          <Menu.Root>
            <Menu.Trigger>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup data-testid="parent-menu">
                  <Menu.SubmenuRoot>
                    <Menu.SubmenuTrigger>More</Menu.SubmenuTrigger>
                    <Menu.Portal container={shadowRoot}>
                      <Menu.Positioner>
                        <Menu.Popup data-testid="submenu">
                          <Menu.Item>Alpha</Menu.Item>
                        </Menu.Popup>
                      </Menu.Positioner>
                    </Menu.Portal>
                  </Menu.SubmenuRoot>
                  <Menu.Item>Play Next</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>,
        );

        await user.keyboard('[Tab][Enter]');
        const trigger = screen.getByRole('menuitem', { name: 'More' });
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
        await user.keyboard('[ArrowRight]');
        await waitFor(() => {
          expect(shadowRoot.activeElement?.textContent).toBe('Alpha');
        });

        const submenu = shadowRoot.querySelector<HTMLElement>('[data-testid="submenu"]');
        const guard = submenu?.parentElement?.querySelector<HTMLElement>(
          `[${createAttribute('focus-guard')}][data-type="inside"]`,
        );
        expect(guard).toBeTruthy();

        const item = shadowRoot.querySelector<HTMLElement>('[role="menuitem"]');
        trigger.focus();
        await flushMicrotasks();
        expect(shadowRoot.querySelector('[data-testid="submenu"]')).not.toBe(null);

        item?.focus();
        await flushMicrotasks();
        guard?.focus();
        await flushMicrotasks();
        await waitFor(() => {
          expect(trigger).toHaveFocus();
        });
        await waitFor(() => {
          expect(shadowRoot.querySelector('[data-testid="submenu"]')).toBe(null);
        });
        expect(screen.getByTestId('parent-menu')).not.toBe(null);

        await user.keyboard('[ArrowDown]');
        await waitFor(() => {
          expect(screen.getByRole('menuitem', { name: 'Play Next' })).toHaveFocus();
        });
      } finally {
        host.remove();
      }
    },
  );

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

  function TestComponent({ direction }: { direction: TextDirection }) {
    return (
      <DirectionProvider direction={direction}>
        <Menu.Root open>
          <Menu.Trigger>Open menu</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.Item>1</Menu.Item>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger>2</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner>
                      <Menu.Popup>
                        <Menu.Item>2.1</Menu.Item>
                        <Menu.Item>2.2</Menu.Item>
                      </Menu.Popup>
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      </DirectionProvider>
    );
  }

  it.each([
    { direction: 'ltr', openKey: 'ArrowRight' },
    { direction: 'rtl', openKey: 'ArrowLeft' },
  ] as const)(
    'opens the submenu with $openKey and highlights a single item in $direction direction',
    async ({ direction, openKey }) => {
      await render(<TestComponent direction={direction} />);
      const submenuTrigger = screen.getByText('2');

      await fireEvent.focus(submenuTrigger);
      await fireEvent.keyDown(submenuTrigger, { key: openKey });

      const submenuItems = await screen.findAllByRole('menuitem');
      const submenuItem1 = submenuItems.find((item) => item.textContent === '2.1');

      await waitFor(() => {
        expect(submenuItem1).toHaveFocus();
      });

      // Only the first submenu item is highlighted; no other submenu or parent menu item is.
      const highlightedItems = screen
        .getAllByRole('menuitem')
        .filter((item) => item.hasAttribute('data-highlighted'));
      expect(highlightedItems).toEqual([submenuItem1]);
    },
  );

  it('sets tabIndex to 0 on the submenu trigger after opening the submenu with a keydown event', async () => {
    await render(<TestComponent direction="ltr" />);
    const submenuTrigger = screen.getByText('2');

    await fireEvent.focus(submenuTrigger);
    await fireEvent.keyDown(submenuTrigger, { key: 'ArrowRight' });

    await waitFor(() => {
      expect(submenuTrigger).toHaveAttribute('tabIndex', '0');
    });
  });

  it('uses the label prop for text navigation', async () => {
    const { user } = await render(
      <Menu.Root open>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item>Alpha</Menu.Item>
              <Menu.SubmenuRoot>
                <Menu.SubmenuTrigger data-testid="submenu-trigger" label="Reports">
                  More
                </Menu.SubmenuTrigger>
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
      </Menu.Root>,
    );

    // The open gives the focus to the popup in an animation frame. The key goes to the element that
    // has the focus.
    await waitFor(() => {
      expect(screen.getAllByRole('menu')[0]).toHaveFocus();
    });
    await fireEvent.focus(screen.getByText('Alpha'));
    await user.keyboard('r');

    await waitFor(() => {
      expect(screen.getByTestId('submenu-trigger')).toHaveFocus();
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

  // These cases are the last ones of the file. In Vue 3.5.12, a `setup` that throws leaves the
  // current instance set, and a later case that renders a slot gets a warning about that slot. So
  // the case with slots comes first.
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

  it('throws when rendered outside Menu.SubmenuRoot', async () => {
    await expect(render(<Menu.SubmenuTrigger />)).rejects.toThrow(
      'Vase UI: <Menu.SubmenuTrigger> must be inside <Menu.SubmenuRoot>. Without a submenu root the trigger has no submenu to open. Put the trigger inside <Menu.SubmenuRoot>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
