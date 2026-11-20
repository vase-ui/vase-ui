import { describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { KeepAlive, defineComponent, h, onMounted, shallowRef } from 'vue';
import { Menubar } from '@vase-ui/vue/menubar';
import * as Menu from '../index.parts';
import {
  clientCenter,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  nextEvent,
  popupFocusPropsTests,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
  waitForLaterMillisecond,
  waitSingleFrame,
} from '#test-utils';
import { Dialog } from '@vase-ui/vue/dialog';
import {
  ContextMenuProvider,
  MenubarProvider,
  createContextMenuContext,
  createMenubarContext,
} from '../../../test/fixtures/MenuParentFixture';
import { createSlotHost } from '../../../test/fixtures/slotHost';
import { createMenuStoreProbe } from '../../../test/fixtures/MenuStoreProbe';
import { REASONS } from '../../internals/reasons';
import { Toolbar } from '../../toolbar';
import { createAttribute } from '../../utils/popups/createAttribute';
import MenuPopupReplace from './MenuPopupReplace.test.vue';

// Each render of the popup reads the id of the trigger, and the popup renders again after the
// open. A case that changes the id of the trigger waits for these renders first. Only the change
// of the id can then give the popup its new name.
async function waitForRendersOfOpen() {
  await waitSingleFrame();
  await waitSingleFrame();
  await flushMicrotasks();
}

describe('<Menu.Popup />', () => {
  const { render } = createRenderer();

  it('VUE-138: closes the menu on Shift+Tab from a button in the popup slot', async () => {
    const button = document.createElement('button');
    const root = createSlotHost(button);
    await render(
      <Menu.Root defaultOpen defaultTriggerId="trigger" modal={false}>
        <Menu.Trigger id="trigger">Open</Menu.Trigger>
        <Menu.Portal to={root}>
          <Menu.Positioner>
            <Menu.Popup>{h('slot')}</Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    const trigger = screen.getByRole('button', { name: 'Open' });
    const popup = root.querySelector('[role="menu"]')!;
    expect(popup.contains(button.assignedSlot)).toBe(true);
    button.focus();
    expect(button).toHaveFocus();
    expect(await fireEvent.keyDown(button, { key: 'Tab', shiftKey: true })).toBe(false);
    await waitFor(() => expect(trigger).toHaveAttribute('aria-expanded', 'false'));
    expect(trigger).toHaveFocus();
  });

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

  it('VUE-109: follows a new id that the #render slot gives the trigger', async () => {
    const id = shallowRef('first');
    await render(
      <Menu.Root defaultOpen>
        <Menu.Trigger
          v-slots={{
            render: ({ props }: { props: Record<string, unknown> }) => (
              <button type="button" {...props} id={id.value}>
                Actions
              </button>
            ),
          }}
        />
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Rename</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );
    await waitForRendersOfOpen();
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('aria-labelledby', 'first');

    id.value = 'second';

    await waitFor(() => {
      expect(popup).toHaveAttribute('aria-labelledby', 'second');
    });
    expect(screen.getByRole('menu', { name: 'Actions' })).toBe(popup);
  });

  it('takes the registered id of the trigger until the trigger element exists', async () => {
    const showTrigger = shallowRef(false);
    await render(() => (
      <Menu.Root defaultOpen defaultTriggerId="actions">
        {showTrigger.value && (
          <Menu.Trigger
            id="actions"
            v-slots={{
              render: ({ props }: { props: Record<string, unknown> }) => (
                <button type="button" {...props} id="rendered">
                  Actions
                </button>
              ),
            }}
          />
        )}
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup data-testid="popup">
              <Menu.Item>Rename</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ));
    await waitForRendersOfOpen();
    const popup = screen.getByTestId('popup');
    expect(popup).toHaveAttribute('aria-labelledby', 'actions');

    showTrigger.value = true;

    await waitFor(() => {
      expect(popup).toHaveAttribute('aria-labelledby', 'rendered');
    });
    expect(screen.getByRole('menu', { name: 'Actions' })).toBe(popup);
  });

  it('stops toolbar navigation keys without blocking ordinary key events', async () => {
    const onToolbarKeyDown = vi.fn();
    const container = shallowRef<HTMLElement | null>(null);
    const setContainer = (element: unknown) => {
      container.value = element as HTMLElement | null;
    };

    // The popup is in a container inside the toolbar. The toolbar acts only on a key of its items.
    await render(
      <Toolbar.Root onKeydown={onToolbarKeyDown}>
        <Toolbar.Button>First</Toolbar.Button>
        <div ref={setContainer} />
        <Menu.Root>
          <Menu.Portal keepMounted to={container.value}>
            <Menu.Positioner>
              <Menu.Popup data-testid="popup" />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
        <Toolbar.Button>Last</Toolbar.Button>
      </Toolbar.Root>,
    );

    const popup = screen.getByTestId('popup');
    const first = screen.getByRole('button', { name: 'First' });
    first.focus();
    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'ArrowRight' }),
    );
    expect(first).toHaveFocus();

    await fireEvent(
      popup,
      new KeyboardEvent('keydown', { bubbles: true, cancelable: true, key: 'F1' }),
    );
    expect(onToolbarKeyDown.mock.calls.map(([event]) => event.key)).toEqual(['ArrowRight', 'F1']);
  });

  it('enters the items at the list boundary when an arrow key leaves custom popup content', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <button type="button">Custom</button>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    const one = await waitForLaterMillisecond(async () => {
      await user.click(screen.getByRole('button', { name: 'Open' }));
      return screen.findByRole('menuitem', { name: 'One' });
    });
    // The open gives the focus to the first tabbable element in an animation frame. That frame
    // would take the focus back from the item.
    await waitFor(() => expect(screen.getByRole('button', { name: 'Custom' })).toHaveFocus());
    one.focus();
    await flushMicrotasks();
    await user.keyboard('[ArrowDown]');
    // Mid-list, so continuing from the highlight would reach Three instead.
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());

    screen.getByRole('button', { name: 'Custom' }).focus();
    await flushMicrotasks();
    await user.keyboard('[ArrowDown]');

    await waitFor(() => expect(one).toHaveFocus());
  });

  it('moves focus into the items when the boundary item is already highlighted', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    screen.getByRole('button', { name: 'Open' }).focus();
    await flushMicrotasks();
    const one = await waitForLaterMillisecond(async () => {
      await user.keyboard('[Enter]');
      return screen.findByRole('menuitem', { name: 'One' });
    });
    await waitFor(() => expect(one).toHaveAttribute('data-highlighted'));
    // The open gives the focus to the item in an animation frame. That frame would take the focus
    // back from the link.
    await waitFor(() => expect(one).toHaveFocus());
    screen.getByRole('link', { name: 'Profile' }).focus();
    await flushMicrotasks();
    expect(one).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(one).toHaveFocus());

    await user.keyboard('[ArrowDown]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  it('moves focus into the items when the last item is already highlighted', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <a href="#profile">Profile</a>
              <Menu.Item>One</Menu.Item>
              <Menu.Item>Two</Menu.Item>
              <Menu.Item>Three</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    screen.getByRole('button', { name: 'Open' }).focus();
    await flushMicrotasks();
    const three = await waitForLaterMillisecond(async () => {
      await user.keyboard('[ArrowUp]');
      return screen.findByRole('menuitem', { name: 'Three' });
    });
    await waitFor(() => expect(three).toHaveAttribute('data-highlighted'));
    // The open gives the focus to the item in an animation frame. That frame would take the focus
    // back from the link.
    await waitFor(() => expect(three).toHaveFocus());
    screen.getByRole('link', { name: 'Profile' }).focus();
    await flushMicrotasks();
    expect(three).toHaveAttribute('data-highlighted');

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(three).toHaveFocus());

    await user.keyboard('[ArrowUp]');
    await waitFor(() => expect(screen.getByRole('menuitem', { name: 'Two' })).toHaveFocus());
  });

  it.each([
    { name: 'its trigger', live: false },
    // Live regions outside a modal stay exposed to assistive tech.
    { name: 'its trigger in a live region', live: true },
  ])(
    'does not move focus behind a modal dialog to $name when an item hides the menu trigger',
    async ({ live }) => {
      const App = defineComponent(() => {
        const step = shallowRef(1);
        return () => {
          const dialogTrigger = <Dialog.Trigger>Create</Dialog.Trigger>;
          return (
            <Dialog.Root>
              {live ? <div aria-live="polite">{dialogTrigger}</div> : dialogTrigger}
              <Dialog.Portal>
                <Dialog.Popup>
                  <div hidden={step.value !== 1}>
                    <Menu.Root>
                      <Menu.Trigger>Template</Menu.Trigger>
                      <Menu.Portal>
                        <Menu.Positioner>
                          <Menu.Popup>
                            <Menu.Item
                              onClick={() => {
                                step.value = 2;
                              }}
                            >
                              Blank
                            </Menu.Item>
                          </Menu.Popup>
                        </Menu.Positioner>
                      </Menu.Portal>
                    </Menu.Root>
                  </div>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          );
        };
      });

      const { user } = await render(<App />);
      const dialogTrigger = screen.getByRole('button', { name: 'Create' });
      const menuTrigger = await waitForLaterMillisecond(async () => {
        await user.click(dialogTrigger);
        return screen.findByRole('button', { name: 'Template' });
      });
      const blank = await waitForLaterMillisecond(async () => {
        await user.click(menuTrigger);
        return screen.findByRole('menuitem', { name: 'Blank' });
      });
      await user.click(blank);

      expect(screen.queryByRole('menuitem', { name: 'Blank' })).toBe(null);
      await flushMicrotasks();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(dialogTrigger).not.toHaveFocus();
    },
  );

  it('keeps focus on an input that autofocuses when the trigger is hidden as the menu closes', async () => {
    // A `ref` callback can run before the input is in the document.
    const FocusedInput = defineComponent(() => {
      const input = shallowRef<HTMLInputElement | null>(null);
      onMounted(() => input.value?.focus());
      return () => <input ref={input} aria-label="Name" />;
    });
    const App = defineComponent(() => {
      const renaming = shallowRef(false);
      let renameRequested = false;
      return () => (
        <div>
          <Menu.Root>
            <Menu.Trigger>Other</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item>Item</Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          {renaming.value && <FocusedInput />}
          <Menu.Root
            onOpenChangeComplete={(open: boolean) => {
              if (!open && renameRequested) {
                renameRequested = false;
                renaming.value = true;
              }
            }}
          >
            <Menu.Trigger hidden={renaming.value}>Actions</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup>
                  <Menu.Item
                    onClick={() => {
                      renameRequested = true;
                    }}
                  >
                    Rename
                  </Menu.Item>
                </Menu.Popup>
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </div>
      );
    });

    const { user } = await render(<App />);
    // Leaves the other trigger in the return-focus history.
    await waitForLaterMillisecond(async () => {
      await user.click(screen.getByRole('button', { name: 'Other' }));
      await screen.findByRole('menuitem', { name: 'Item' });
    });
    await user.keyboard('[Escape]');
    expect(screen.queryByRole('menuitem', { name: 'Item' })).toBe(null);

    const rename = await waitForLaterMillisecond(async () => {
      await user.click(screen.getByRole('button', { name: 'Actions' }));
      return screen.findByRole('menuitem', { name: 'Rename' });
    });
    await user.click(rename);

    const input = await screen.findByRole('textbox', { name: 'Name' });
    expect(screen.queryByRole('menuitem', { name: 'Rename' })).toBe(null);
    await flushMicrotasks();
    expect(input).toHaveFocus();
  });

  popupFocusPropsTests({
    render,
    initialFocus: false,
    createComponent: ({ children, finalFocus }) => (
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup finalFocus={finalFocus}>
              {children}
              <Menu.Item>Close</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>
    ),
  });

  describe('prop: finalFocus', () => {
    it('receives the interaction type of the item press that closed the menu', async () => {
      const finalFocus = vi.fn(() => true);

      const { user } = await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByText('Open');

      // The item mounts with the menu. Vue skips its listener for an event of that millisecond.
      const item = await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        return screen.findByText('Close');
      });
      await fireEvent.pointerDown(item, { pointerType: 'mouse' });
      await fireEvent.click(item, { detail: 1 });
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');

      await waitForLaterMillisecond(async () => {
        await user.keyboard('{Enter}');
        await screen.findByText('Close');
      });
      await user.keyboard('{Enter}');
      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(finalFocus).toHaveBeenLastCalledWith('keyboard');
    });

    it('receives the mouse interaction type after a drag-release item selection', async () => {
      const finalFocus = vi.fn(() => true);

      await render(
        <Menu.Root>
          <Menu.Trigger>Open</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup finalFocus={finalFocus}>
                <Menu.Item>Close</Menu.Item>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );

      const trigger = screen.getByText('Open');
      const item = await waitForLaterMillisecond(async () => {
        await fireEvent.mouseDown(trigger, clientCenter(trigger));
        return screen.findByText('Close');
      });

      // Drag-release selection is only armed 200ms after the trigger press.
      await wait(200);
      await fireEvent.mouseUp(item);

      expect(screen.queryByText('Close')).toBe(null);
      expect(finalFocus).toHaveBeenLastCalledWith('mouse');
    });
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
      expect(popup).toHaveAttribute(
        'aria-labelledby',
        screen.getByRole('button', { name: 'Actions' }).id,
      );
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
    it('gives the id to the popup element and to the trigger, and the default id after a removal', async () => {
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
      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(popup.id).toBe('custom-popup');
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup');

      id.value = undefined;
      await flushMicrotasks();

      expect(popup.id).toBe(probe.store.select('defaultPopupId'));
      expect(trigger).toHaveAttribute('aria-controls', popup.id);
    });

    it('names in aria-controls the id that the #render slot gives the popup element', async () => {
      const id = shallowRef('slot-popup');
      await render(() => (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup
                id="custom-popup"
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <div {...props} id={id.value} />
                  ),
                }}
              />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-controls', 'slot-popup');

      id.value = '';
      await flushMicrotasks();

      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('names no popup in aria-controls after the popup unmounts', async () => {
      const mounted = shallowRef(true);
      await render(() => (
        <Menu.Root open>
          <Menu.Trigger>Actions</Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner>
              {mounted.value ? <Menu.Popup id="custom-popup" /> : null}
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      const trigger = screen.getByRole('button', { name: 'Actions' });
      expect(trigger).toHaveAttribute('aria-controls', 'custom-popup');

      mounted.value = false;
      await flushMicrotasks();

      expect(trigger).not.toHaveAttribute('aria-controls');
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

  describe('hover', () => {
    async function hover(element: HTMLElement) {
      await fireEvent.mouseEnter(element);
      await fireEvent.mouseMove(element);
    }

    async function leaveAndWait(positioner: HTMLElement) {
      await fireEvent.mouseEnter(positioner);
      await fireEvent.mouseLeave(positioner, { relatedTarget: document.body });
      await new Promise((resolve) => requestAnimationFrame(resolve));
      await flushMicrotasks();
    }

    it('keeps a submenu open when the pointer leaves it after a move in it', async () => {
      await render(
        <Menu.Root open>
          <Menu.Portal>
            <Menu.Positioner>
              <Menu.Popup>
                <Menu.SubmenuRoot>
                  <Menu.SubmenuTrigger delay={0}>More</Menu.SubmenuTrigger>
                  <Menu.Portal>
                    <Menu.Positioner data-testid="submenu-positioner">
                      <Menu.Popup data-testid="submenu" />
                    </Menu.Positioner>
                  </Menu.Portal>
                </Menu.SubmenuRoot>
              </Menu.Popup>
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>,
      );
      await hover(screen.getByRole('menuitem', { name: 'More' }));
      await fireEvent.mouseMove(await screen.findByTestId('submenu'));

      await leaveAndWait(screen.getByTestId('submenu-positioner'));

      expect(screen.queryByTestId('submenu')).not.toBe(null);
    });

    it('keeps a menu of a menubar that hover opened open when the pointer leaves its popup', async () => {
      await render(
        <Menubar>
          <Menu.Root defaultOpen>
            <Menu.Trigger>File</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner>
                <Menu.Popup />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
          <Menu.Root>
            <Menu.Trigger>Edit</Menu.Trigger>
            <Menu.Portal>
              <Menu.Positioner data-testid="positioner">
                <Menu.Popup data-testid="popup" />
              </Menu.Positioner>
            </Menu.Portal>
          </Menu.Root>
        </Menubar>,
      );
      await hover(screen.getByRole('menuitem', { name: 'Edit' }));
      await screen.findByTestId('popup');

      await leaveAndWait(screen.getByTestId('positioner'));
      // The focus out of the trigger into the popup starts a 0 ms timer that must not close
      // the menu.
      await wait(0);

      expect(screen.queryByTestId('popup')).not.toBe(null);
    });

    it('keeps a disabled menu that hover opened open when the pointer leaves its popup', async () => {
      const disabled = shallowRef(false);
      const Test = defineComponent(() => () => (
        <Menu.Root disabled={disabled.value}>
          <Menu.Trigger openOnHover delay={0}>
            Open
          </Menu.Trigger>
          <Menu.Portal>
            <Menu.Positioner data-testid="positioner">
              <Menu.Popup data-testid="popup" />
            </Menu.Positioner>
          </Menu.Portal>
        </Menu.Root>
      ));
      await render(<Test />);
      await hover(screen.getByRole('button', { name: 'Open' }));
      await screen.findByTestId('popup');
      disabled.value = true;
      await flushMicrotasks();

      await leaveAndWait(screen.getByTestId('positioner'));

      expect(screen.queryByTestId('popup')).not.toBe(null);
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
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(document.body).toHaveFocus();
    });

    it('closes the menu and focuses the trigger for Shift+Tab in the popup', async () => {
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
      expect(screen.queryByTestId('popup')).toBe(null);
    });

    it('focuses the trigger when the focus goes to the focus guard before the popup', async () => {
      const { trigger } = await waitForLaterMillisecond(async () => {
        const result = await renderMenu(() => (
          <Menu.Popup data-testid="popup">
            <button data-testid="inside">Inside</button>
          </Menu.Popup>
        ));
        await screen.findByTestId('popup');
        return result;
      });
      await waitFor(() => {
        expect(screen.getByTestId('inside')).toHaveFocus();
      });
      const popup = screen.getByTestId('popup');
      // Shift+Tab closes the menu before the focus gets to the guard, so the case focuses the guard.
      const guard = popup.previousElementSibling as HTMLElement;
      expect(guard).toHaveAttribute(createAttribute('focus-guard'));

      guard.focus();

      await waitFor(() => {
        expect(trigger).toHaveFocus();
      });
      expect(popup).toBeVisible();
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

    it('focuses the list when the menu opens with no highlighted item', async () => {
      await renderMenu(() => (
        <Menu.Popup data-testid="popup">
          <Menu.List data-testid="list" />
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
          <Menu.List data-testid="list" />
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
      const first = screen.getByTestId('first');
      await waitFor(() => {
        expect(first).toHaveFocus();
      });
      const last = screen.getByTestId('last');
      last.focus();
      // Tab closes a context menu before the focus gets to the guard, so the case focuses the guard.
      const guard = last.parentElement!.nextElementSibling as HTMLElement;
      expect(guard).toHaveAttribute(createAttribute('focus-guard'));

      guard.focus();

      await waitFor(() => {
        expect(first).toHaveFocus();
      });
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
        await waitForLaterMillisecond(async () => {
          open.value = true;
          await screen.findByTestId('popup');
        });
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

        expect(screen.queryByTestId('popup')).toBe(null);
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

  it('VUE-82: keeps the focus on an item whose keydown listener calls preventVaseUIHandler()', async () => {
    const { user } = await render(
      <Menu.Root>
        <Menu.Trigger>Open</Menu.Trigger>
        <Menu.Portal>
          <Menu.Positioner>
            <Menu.Popup>
              <Menu.Item
                onKeydown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventVaseUIHandler();
                  }
                }}
              >
                One
              </Menu.Item>
              <Menu.Item>Two</Menu.Item>
            </Menu.Popup>
          </Menu.Positioner>
        </Menu.Portal>
      </Menu.Root>,
    );

    screen.getByRole('button', { name: 'Open' }).focus();
    await flushMicrotasks();
    // The item takes the focus in an animation frame after the open.
    await waitForLaterMillisecond(() =>
      nextEvent(document, 'focusin', { action: () => user.keyboard('[ArrowDown]') }),
    );
    const one = screen.getByRole('menuitem', { name: 'One' });
    expect(one).toHaveFocus();

    await user.keyboard('[ArrowDown]');
    await waitSingleFrame();

    expect(one).toHaveFocus();
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
  // instance set, and a later case of the file can then get a warning about a slot.
  it('throws when rendered outside Menu.Positioner', async () => {
    await expect(
      render(
        <Menu.Root open>
          <Menu.Popup />
        </Menu.Root>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Menu.Popup>, <Menu.Arrow> and <Menu.Viewport> must be inside <Menu.Positioner>. Without a positioner the part has no side and no alignment. Put the part inside <Menu.Positioner>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
