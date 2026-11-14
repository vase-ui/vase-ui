import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, computed, defineComponent, onMounted, provide, shallowRef } from 'vue';
import * as Menu from '../index.parts';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import { ToolbarRootContext } from '../../toolbar/root/ToolbarRootContext';
import { useMenuRootContext } from '../root/MenuRootContext';
import MenuPopupReplace from './MenuPopupReplace.test.vue';

const ToolbarProvider = defineComponent((_, { slots }) => {
  provide(ToolbarRootContext, {
    disabled: computed(() => false),
    orientation: computed(() => 'horizontal' as const),
  });
  return () => slots.default?.();
});

describe('<Menu.Popup />', () => {
  const { render } = createRenderer();

  describeConformance(<Menu.Popup />, () => ({
    render: (node) => {
      return render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>{node}</Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
    },
    refInstanceof: window.HTMLDivElement,
  }));

  it('uses an aria-label instead of the trigger label', async () => {
    await render(
      <Menu.Root open>
        <Menu.Trigger>Actions</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup aria-label="Commands" />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const popup = screen.getByRole('menu', { name: 'Commands' });
    expect(popup).not.toHaveAttribute('aria-labelledby');
  });

  it('uses aria-labelledby from a render element', async () => {
    await render(
      <Menu.Root open>
        <span id="commands-label">Commands</span>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup
              v-slots={{
                render: ({ props }: { props: Record<string, unknown> }) => (
                  <section {...props} aria-labelledby="commands-label" />
                ),
              }}
            />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    expect(screen.getByRole('menu', { name: 'Commands' })).toHaveAttribute(
      'aria-labelledby',
      'commands-label',
    );
  });

  it('stops toolbar navigation keys without blocking ordinary key events', async () => {
    const onParentKeyDown = vi.fn();
    const container = shallowRef<HTMLElement | null>(null);
    const setContainer = (element: unknown) => {
      container.value = element as HTMLElement | null;
    };

    // The popup is in a container inside the element that listens, as in a toolbar. Vue sends an
    // event to the DOM parents only, so a popup in `<body>` would not reach the listener.
    await render(
      <ToolbarProvider>
        <div onKeydown={onParentKeyDown}>
          <div ref={setContainer} />
          <Menu.Root>
            <Menu.Portal keepMounted container={container}>
              <Menu.Positioner>
                <Menu.Popup data-testid="popup" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      </ToolbarProvider>,
    );

    const popup = screen.getByTestId('popup');
    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }),
    );
    expect(onParentKeyDown).not.toHaveBeenCalled();

    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F1' }),
    );
    expect(onParentKeyDown).toHaveBeenCalled();
    expect(onParentKeyDown.mock.calls.every(([event]) => event.key === 'F1')).toBe(true);
  });

  describe('attributes', () => {
    it('has the menu role and the name of the trigger', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const popup = screen.getByRole('menu', { name: 'Actions' });
      expect(popup).toHaveAttribute('aria-labelledby', screen.getByRole('button').id);
      expect(popup).not.toHaveAttribute('aria-orientation');
    });

    it('names the popup with the live id of the element of its trigger', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <button {...props} id="live-trigger">
                  Actions
                </button>
              ),
            }}
          />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByRole('menu')).toHaveAttribute('aria-labelledby', 'live-trigger');
    });

    it('gives an explicit aria-labelledby the place of the trigger label', async () => {
      await render(
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <span id="commands-label">Commands</span>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup aria-labelledby="commands-label" />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByRole('menu', { name: 'Commands' })).toHaveAttribute(
        'aria-labelledby',
        'commands-label',
      );
    });

    it('has the orientation of a horizontal menu', async () => {
      await render(
        <Menu.Root open orientation="horizontal">
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(screen.getByRole('menu')).toHaveAttribute('aria-orientation', 'horizontal');
    });

    it('has the state of the menu in its data attributes', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const popup = screen.getByRole('menu');
      expect(popup).toHaveAttribute('data-open');
      expect(popup).toHaveAttribute('data-side', 'bottom');
      expect(popup).toHaveAttribute('data-align', 'center');
      expect(popup).not.toHaveAttribute('data-nested');
    });

    it('names its root as the owner', async () => {
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      expect(probe.store.select('rootId')).toBeTruthy();
      expect(screen.getByRole('menu')).toHaveAttribute(
        'data-rootownerid',
        probe.store.select('rootId'),
      );
    });
  });

  describe('prop: id', () => {
    it('gives the id of the popup to the root and to the trigger, and gives the generated id back to the root', async () => {
      const id = shallowRef<string | undefined>('custom-popup');
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root open>
          <probe.Probe />
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup id={id.value} />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));

      const popup = screen.getByRole('menu');
      const trigger = screen.getByRole('button');
      expect(popup.id).toBe('custom-popup');
      expect(probe.store.select('popupId')).toBe('custom-popup');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup');

      id.value = undefined;
      await flushMicrotasks();

      expect(popup.id).toBe(probe.context.generatedPopupId);
      expect(probe.store.select('defaultPopupId')).toBe(probe.context.generatedPopupId);
    });

    it('takes back the id of a popup that unmounts', async () => {
      const mounted = shallowRef(true);
      const probe = createMenuStoreProbe();
      await render(() => (
        <Menu.Root open>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              {mounted.value ? <Menu.Popup id="custom-popup" /> : null}
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      expect(probe.store.select('defaultPopupId')).toBe('custom-popup');

      mounted.value = false;
      await flushMicrotasks();

      expect(probe.store.select('defaultPopupId')).toBe(probe.context.generatedPopupId);
    });
  });

  describe('events', () => {
    it('closes the menu for a close event of the tree', async () => {
      const onOpenChange = vi.fn();
      const probe = createMenuStoreProbe();
      await render(
        <Menu.Root defaultOpen onOpenChange={onOpenChange}>
          <probe.Probe />
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      const domEvent = new MouseEvent('click');

      probe.store.select('floatingTreeRoot').events.emit('close', {
        domEvent,
        reason: REASONS.itemPress,
      });

      expect(onOpenChange).toHaveBeenCalledTimes(1);
      expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
      expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.itemPress);
      expect(onOpenChange.mock.lastCall?.[1].event).toBe(domEvent);
    });

    it('reports the completion of the open one time', async () => {
      const onOpenChangeComplete = vi.fn();
      await render(
        <Menu.Root defaultOpen onOpenChangeComplete={onOpenChangeComplete}>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      await waitFor(() => {
        expect(onOpenChangeComplete).toHaveBeenCalledTimes(1);
      });
      expect(onOpenChangeComplete).toHaveBeenCalledWith(true);
    });
  });

  describe('focus', () => {
    // The menu is controlled, so a case opens it with no press of the trigger.
    async function renderMenu(popup: () => unknown, options: { before?: () => unknown } = {}) {
      const open = shallowRef(false);
      const result = await render(() => (
        <div>
          {options.before?.()}
          <Menu.Root
            modal={false}
            open={open.value}
            triggerId="trigger"
            onUpdate:open={(nextOpen) => {
              open.value = nextOpen;
            }}
          >
            <Menu.Trigger id="trigger">Toggle</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>{popup()}</Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      ));
      const trigger = screen.getByRole('button', { name: 'Toggle' });
      trigger.focus();
      open.value = true;
      return { ...result, trigger };
    }

    it('focuses the popup when the menu opens, and returns the focus when it closes', async () => {
      const { user, trigger } = await renderMenu(() => <Menu.Popup data-testid="popup" />);
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
    });

    it.each([
      { name: 'an element', finalFocus: (target: HTMLElement) => target },
      { name: 'a ref', finalFocus: (target: HTMLElement) => shallowRef(target) },
      { name: 'a function', finalFocus: (target: HTMLElement) => () => target },
    ])('focuses the finalFocus target of $name when the menu closes', async ({ finalFocus }) => {
      const target = shallowRef<HTMLElement | null>(null);
      const { user } = await renderMenu(
        () => (
          <Menu.Popup
            data-testid="popup"
            finalFocus={target.value ? finalFocus(target.value) : undefined}
          />
        ),
        {
          before: () => (
            <button
              ref={(element) => {
                target.value = element as HTMLElement | null;
              }}
            >
              Final
            </button>
          ),
        },
      );
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Final' })).toHaveFocus();
      });
    });

    it('gives the type of the interaction that closed the menu to a finalFocus function', async () => {
      const finalFocus = vi.fn(() => false);
      const { user } = await renderMenu(() => (
        <Menu.Popup data-testid="popup" finalFocus={finalFocus} />
      ));
      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(finalFocus).toHaveBeenCalledWith('keyboard');
      });
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(document.body).toHaveFocus();
    });

    it('focuses the trigger for Shift+Tab from the start of the popup', async () => {
      const { trigger } = await renderMenu(() => (
        <Menu.Popup data-testid="popup">
          <button data-testid="inside">Inside</button>
        </Menu.Popup>
      ));
      await waitFor(() => {
        expect(screen.getByTestId('inside')).toHaveFocus();
      });

      await userEvent.tab({ shift: true });

      expect(trigger).toHaveFocus();
      expect(screen.getByTestId('popup')).toBeVisible();
    });

    it('moves the focus to the popup when the focused element in the popup goes away', async () => {
      const shown = shallowRef(true);
      await renderMenu(() => (
        <Menu.Popup data-testid="popup">
          {shown.value && <button data-testid="inside">Inside</button>}
        </Menu.Popup>
      ));
      await waitFor(() => {
        expect(screen.getByTestId('inside')).toHaveFocus();
      });

      shown.value = false;

      await waitFor(() => {
        expect(screen.getByTestId('popup')).toHaveFocus();
      });
    });

    // `Menu.List` writes its element to the store. This mock does the same.
    const ListMock = defineComponent(() => {
      const { store } = useMenuRootContext();
      const list = shallowRef<HTMLElement | null>(null);
      onMounted(() => {
        store.set('listElement', list.value);
      });
      return () => <div ref={list} role="menu" tabindex={-1} data-testid="list" />;
    });

    it('focuses the list when the menu opens with no highlighted item', async () => {
      await renderMenu(() => (
        <Menu.Popup data-testid="popup">
          <ListMock />
        </Menu.Popup>
      ));

      await waitFor(() => {
        expect(screen.getByTestId('list')).toHaveFocus();
      });
    });

    it('moves no focus when the menu with a list opens with a highlighted item', async () => {
      const probe = createMenuStoreProbe();
      const { trigger } = await renderMenu(() => (
        <Menu.Popup data-testid="popup">
          <probe.Probe />
          <ListMock />
        </Menu.Popup>
      ));
      probe.store.set('activeIndex', 0);
      await waitFor(() => {
        expect(screen.getByTestId('list')).toBeVisible();
      });
      await waitSingleFrame();
      await waitSingleFrame();

      expect(trigger).toHaveFocus();
    });

    it('keeps the focus in a menu of a context menu', async () => {
      await render(
        <ContextMenuProvider context={createContextMenuContext()}>
          <Menu.Root defaultOpen>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <button data-testid="first">First</button>
                  <button data-testid="last">Last</button>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </ContextMenuProvider>,
      );
      await waitFor(() => {
        expect(screen.getByTestId('first')).toHaveFocus();
      });
      screen.getByTestId('last').focus();

      await userEvent.tab();

      expect(screen.getByTestId('first')).toHaveFocus();
    });

    // With an active trigger the focus always returns, so the menu of these cases has no trigger.
    describe('in a menubar', () => {
      async function renderOpenMenu() {
        const open = shallowRef(false);
        const result = await render(() => (
          <div>
            <button data-testid="before">Before</button>
            <div data-testid="outside">Outside</div>
            <MenubarProvider context={createMenubarContext()}>
              <Menu.Root
                open={open.value}
                onUpdate:open={(nextOpen) => {
                  open.value = nextOpen;
                }}
              >
                <Menu.Portal>
                  <Menu.Positioner anchor={() => screen.getByTestId('before')}>
                    <Menu.Popup data-testid="popup" />
                  </Menu.Positioner>
                </Menu.Portal>
              </Menu.Root>
            </MenubarProvider>
          </div>
        ));
        const before = screen.getByTestId('before');
        before.focus();
        open.value = true;
        await waitFor(() => {
          expect(screen.getByTestId('popup')).toHaveFocus();
        });
        return { ...result, before };
      }

      it('returns the focus after Escape', async () => {
        const { user, before } = await renderOpenMenu();

        await user.keyboard('{Escape}');

        await waitFor(() => {
          expect(before).toHaveFocus();
        });
      });

      it('returns no focus after a press outside', async () => {
        const { before } = await renderOpenMenu();

        await fireEvent.pointerDown(screen.getByTestId('outside'), { pointerType: 'mouse' });

        await waitFor(() => {
          expect(screen.queryByTestId('popup')).toBe(null);
        });
        await flushMicrotasks();
        expect(before).not.toHaveFocus();
      });
    });
  });

  it('keeps the element of a new popup that replaces the old popup, so a close completes', async () => {
    const swapped = shallowRef(false);
    const onOpenChangeComplete = vi.fn();
    const { user } = await render(() => (
      <Menu.Root defaultOpen onOpenChangeComplete={onOpenChangeComplete}>
        <Menu.Portal>
          <Menu.Positioner>
            <MenuPopupReplace swapped={swapped.value} />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await screen.findByTestId('old');

    swapped.value = true;
    await flushMicrotasks();
    expect(screen.queryByTestId('old')).toBe(null);

    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(onOpenChangeComplete).toHaveBeenLastCalledWith(false);
    });
    await flushMicrotasks();
    expect(screen.queryByTestId('new')).toBe(null);
  });

  it('VUE-5: takes the popup out of the document while KeepAlive holds the menu, and puts the same popup back', async () => {
    const Page = defineComponent({
      name: 'Page',
      setup: () => () => (
        <Menu.Root defaultOpen>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup">Popup</Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ),
    });
    const Other = defineComponent({ name: 'Other', setup: () => () => <p /> });
    const showPage = shallowRef(true);
    await render(() => (
      <KeepAlive>{showPage.value ? <Page key="page" /> : <Other key="other" />}</KeepAlive>
    ));
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('data-open');

    showPage.value = false;
    await flushMicrotasks();

    expect(popup.isConnected).toBe(false);

    showPage.value = true;
    await flushMicrotasks();

    expect(screen.getByTestId('popup')).toBe(popup);
    expect(popup.closest('[data-vase-ui-portal]')?.parentElement).toBe(document.body);
    expect(popup).toHaveAttribute('data-open');
  });

  it('BUG-5410: closes the menu for a press in a same-origin iframe', async () => {
    const frame = document.createElement('iframe');
    frame.srcdoc = '<button style="width: 80px; height: 40px">in the frame</button>';
    frame.style.cssText =
      'position: absolute; left: 20px; top: 300px; width: 200px; height: 100px; border: 0';
    const loaded = new Promise<void>((resolve) => {
      frame.addEventListener('load', () => resolve(), { once: true });
    });
    document.body.append(frame);
    onTestFinished(() => frame.remove());
    await loaded;
    const onOpenChange = vi.fn();
    // The backdrop of a modal menu covers the frame, so the press needs a menu that is not modal.
    await render(
      <Menu.Root defaultOpen modal={false} onOpenChange={onOpenChange}>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup />
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    await userEvent.click(frame, { position: { x: 20, y: 20 } });
    await flushMicrotasks();

    expect(onOpenChange).toHaveBeenCalledTimes(1);
    expect(onOpenChange.mock.lastCall?.[0]).toBe(false);
    expect(onOpenChange.mock.lastCall?.[1].reason).toBe(REASONS.outsidePress);
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws when rendered outside Menu.Positioner', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.Popup />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Popup> and <Menu.Arrow> must be inside <Menu.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Menu.Positioner>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
