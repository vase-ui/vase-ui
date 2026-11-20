import { afterEach, beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { Suspense, createSSRApp, defineComponent, nextTick, onMounted, shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  fireEvent,
  flushMicrotasks,
  hydrateAfter,
  isJSDOM,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  waitForLaterMillisecond,
  within,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import DialogDelayedTriggerHydration from './DialogDelayedTriggerHydration.test.vue';
import DialogDetachedTriggerHydration from './DialogDetachedTriggerHydration.test.vue';

const DETACHED_WARNING = 'no root that uses this handle is mounted';

async function insertServerHtml(file: string) {
  const container = document.createElement('div');
  container.innerHTML = await renderOnServer(file, {});
  document.body.append(container);
  return container;
}

describe('<Dialog.Root />', () => {
  const { render } = createRenderer();

  detachedTriggersConformanceTests({
    render,
    createHandle: Dialog.createHandle,
    Root: Dialog.Root,
    Trigger: Dialog.Trigger,
    Portal: Dialog.Portal,
    Popup: Dialog.Popup,
    Close: Dialog.Close,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: false,
    outsideElementsInert: true,
  });

  describe('does not re-render inactive triggers', () => {
    async function renderDialog() {
      const handle = Dialog.createHandle();
      const bystander = { renders: 0 };

      const { user } = await render(
        <div>
          <Dialog.Trigger handle={handle} id="trigger-1">
            Trigger 1
          </Dialog.Trigger>
          <Dialog.Trigger handle={handle} id="trigger-2">
            Trigger 2
          </Dialog.Trigger>
          <Dialog.Trigger
            handle={handle}
            id="trigger-3"
            v-slots={{
              render: ({ props }: { props: HTMLProps }) => {
                bystander.renders += 1;
                return <button {...props}>Trigger 3</button>;
              },
            }}
          />
          <Dialog.Root handle={handle}>
            <Dialog.Portal>
              <Dialog.Popup data-testid="popup">Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </div>,
      );

      bystander.renders = 0;
      return {
        user,
        handle,
        bystander,
        trigger1: screen.getByRole('button', { name: 'Trigger 1' }),
        trigger2: screen.getByRole('button', { name: 'Trigger 2' }),
      };
    }

    async function expectOpenedBy(trigger: HTMLElement) {
      expect(await screen.findByTestId('popup')).not.toBe(null);
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
    }

    function expectClosed(trigger: HTMLElement) {
      expect(screen.queryByTestId('popup')).toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    it('when the popup opens and closes', async () => {
      const { user, bystander, trigger1 } = await renderDialog();

      async function openAndClose() {
        await user.click(trigger1);
        await expectOpenedBy(trigger1);
        await user.keyboard('[Escape]');
        expectClosed(trigger1);
      }

      await openAndClose();
      await openAndClose();
      expect(bystander.renders).toBe(0);
    });

    it('when the popup moves to another trigger', async () => {
      const { handle, bystander, trigger1, trigger2 } = await renderDialog();

      handle.open('trigger-1');
      await flushMicrotasks();
      await expectOpenedBy(trigger1);
      handle.open('trigger-2');
      await flushMicrotasks();
      await expectOpenedBy(trigger2);
      expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      handle.close();
      await flushMicrotasks();
      expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  it('opens a handle-backed dialog as topmost over a dialog that opened while it was closed', async () => {
    const help = Dialog.createHandle();

    const { user } = await render(
      <Dialog.Root handle={help}>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="help-backdrop" />
          <Dialog.Popup data-testid="help">Help</Dialog.Popup>
        </Dialog.Portal>
        <Dialog.Root>
          <Dialog.Trigger>Open section</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup data-testid="section">
              <Dialog.Trigger handle={help}>Open help</Dialog.Trigger>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Root>,
    );

    async function openHelp() {
      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByRole('button', { name: 'Open help' }));
        expect(await screen.findByTestId('help')).not.toBe(null);
        expect(screen.getByTestId('help')).not.toHaveAttribute('data-nested-dialog-open');
        expect(screen.getByTestId('help').style.getPropertyValue('--nested-dialogs')).toBe('0');
      });
    }

    await waitForLaterMillisecond(async () => {
      await user.click(screen.getByRole('button', { name: 'Open section' }));
      expect(await screen.findByTestId('section')).not.toBe(null);
    });

    await openHelp();
    await user.keyboard('[Escape]');
    expect(screen.queryByTestId('help')).toBe(null);
    expect(screen.queryByTestId('section')).not.toBe(null);

    await openHelp();
    await user.click(screen.getByTestId('help-backdrop'));
    expect(screen.queryByTestId('help')).toBe(null);
    expect(screen.queryByTestId('section')).not.toBe(null);
  });

  it('resets nested state recorded while open when a handle-backed dialog closes', async () => {
    const help = Dialog.createHandle();
    const section = Dialog.createHandle();

    await render(
      <Dialog.Root handle={help}>
        <Dialog.Portal>
          <Dialog.Popup data-testid="help">Help</Dialog.Popup>
        </Dialog.Portal>
        <Dialog.Root handle={section}>
          <Dialog.Portal>
            <Dialog.Popup data-testid="section">Section</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
      </Dialog.Root>,
    );

    help.open(null);
    await flushMicrotasks();
    section.open(null);
    await flushMicrotasks();
    expect(await screen.findByTestId('section')).not.toBe(null);
    await waitFor(() => {
      expect(screen.getByTestId('help')).toHaveAttribute('data-nested-dialog-open');
    });

    // The section dialog stays open, so it never sends a zeroed count.
    help.close();
    await flushMicrotasks();
    expect(screen.queryByTestId('help')).toBe(null);
    expect(screen.queryByTestId('section')).not.toBe(null);

    help.open(null);
    await flushMicrotasks();
    expect(await screen.findByTestId('help')).not.toHaveAttribute('data-nested-dialog-open');
    expect(screen.getByTestId('help').style.getPropertyValue('--nested-dialogs')).toBe('0');
  });

  it('updates the parent nested state each time a handle-backed nested dialog opens and closes', async () => {
    const child = Dialog.createHandle();

    const { user } = await render(
      <Dialog.Root defaultOpen>
        <Dialog.Portal>
          <Dialog.Popup data-testid="parent">
            <Dialog.Trigger handle={child}>Open child</Dialog.Trigger>
            <Dialog.Root handle={child}>
              <Dialog.Portal>
                <Dialog.Popup data-testid="child">
                  <Dialog.Close>Close child</Dialog.Close>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    const parent = await screen.findByTestId('parent');

    async function openAndCloseChild() {
      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByRole('button', { name: 'Open child' }));
        expect(await screen.findByTestId('child')).not.toBe(null);
        await waitFor(() => {
          expect(parent).toHaveAttribute('data-nested-dialog-open');
        });
        expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('1');
      });
      await user.click(screen.getByRole('button', { name: 'Close child' }));
      expect(screen.queryByTestId('child')).toBe(null);
      expect(parent).not.toHaveAttribute('data-nested-dialog-open');
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('0');
    }

    await openAndCloseChild();
    await openAndCloseChild();
  });

  it('keeps the parent nested state when a closed handle-backed nested dialog mounts', async () => {
    const handle = Dialog.createHandle();
    const handleParentOpenChange = vi.fn();

    const { user } = await render(
      <Dialog.Root defaultOpen onOpenChange={handleParentOpenChange}>
        <Dialog.Portal>
          <Dialog.Backdrop data-testid="parent-backdrop" />
          <Dialog.Popup data-testid="parent">
            <Dialog.Root defaultOpen>
              <Dialog.Portal>
                <Dialog.Popup data-testid="nested">Nested</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            {/* Must come after the open sibling so its report runs last. */}
            <Dialog.Root handle={handle}>
              <Dialog.Portal>
                <Dialog.Popup>Closed</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Popup>
        </Dialog.Portal>
      </Dialog.Root>,
    );

    await screen.findByTestId('nested');
    expect(screen.getByTestId('parent')).toHaveAttribute('data-nested-dialog-open');

    // The parent isn't topmost while the nested dialog is open, so its backdrop doesn't dismiss it.
    await user.click(screen.getByTestId('parent-backdrop'));
    expect(handleParentOpenChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('parent')).toBeVisible();
  });

  it('BUG-4678: returns the focus to the active trigger after a trigger change in the task of the open', async () => {
    const open = shallowRef(false);
    const triggerId = shallowRef<string | null>(null);
    const { user } = await render(() => (
      <div>
        <Dialog.Root
          open={open.value}
          triggerId={triggerId.value}
          onOpenChange={(nextOpen: boolean) => {
            open.value = nextOpen;
          }}
        >
          <Dialog.Trigger id="trigger-1">Trigger 1</Dialog.Trigger>
          <Dialog.Trigger id="trigger-2">Trigger 2</Dialog.Trigger>
          <Dialog.Portal>
            <Dialog.Popup>
              <Dialog.Close>Close</Dialog.Close>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>
        <button type="button">Outside</button>
      </div>
    ));
    const outside = screen.getByRole('button', { name: 'Outside' });
    const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

    outside.focus();
    await waitForLaterMillisecond(async () => {
      open.value = true;
      triggerId.value = 'trigger-1';
      await nextTick();
      // The open makes the outside button inert. The browser moves the focus off it only at the
      // next rendering update, so the trigger changes while the inert button has the focus.
      expect(outside).toHaveFocus();
      triggerId.value = 'trigger-2';
      await nextTick();
    });

    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => {
      expect(trigger2).toHaveFocus();
    });
  });

  describe('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('hydrates a detached trigger from the stable fallback store', async () => {
      const handle = Dialog.createHandle();
      const serverHtml = await renderOnServer(
        'src/dialog/root/DialogDetachedTriggerHydration.test.vue',
        {},
      );
      let trigger: HTMLElement | undefined;

      const { container } = await hydrateAfter(DialogDetachedTriggerHydration, {
        serverHtml,
        props: { handle },
        before(serverContainer) {
          trigger = within(serverContainer).getByRole('button', { name: 'Trigger' });
          expect(trigger).toHaveAttribute('aria-expanded', 'false');
          expect(trigger).not.toHaveAttribute('data-popup-open');
        },
      });

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
      });
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(within(container).getByRole('button', { name: 'Trigger' })).toBe(trigger);
    });

    it('keeps the server snapshot stable when the root closes before a delayed trigger hydrates', async () => {
      const handle = Dialog.createHandle();
      let resume: (() => void) | undefined;
      const hydrationGate = new Promise<void>((resolve) => {
        resume = resolve;
      });

      const container = await insertServerHtml(
        'src/dialog/root/DialogDelayedTriggerHydration.test.vue',
      );
      const trigger = within(container).getByRole('button', { name: 'Trigger' });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      const app = createSSRApp(DialogDelayedTriggerHydration, { handle, hydrationGate });
      onTestFinished(() => {
        app.unmount();
        container.remove();
      });
      app.mount(container);

      await waitFor(() => {
        expect(handle.isOpen).toBe(true);
      });

      handle.close();
      await flushMicrotasks();
      expect(trigger).toHaveAttribute('aria-expanded', 'false');

      resume?.();
      await hydrationGate;
      await flushMicrotasks();

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(within(container).getByRole('button', { name: 'Trigger' })).toBe(trigger);
      expect(takeReportedMessages()).toEqual([]);
    });

    it('opens from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle();

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.open(null);
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle}>
          <OpenOnMount />
        </Dialog.Root>
      ));

      expect(takeReportedMessages()).toEqual([]);
      expect(handle.isOpen).toBe(true);
    });

    it('opens with a payload from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle<number>();

      const OpenOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.openWithPayload(8);
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle}>
          {{
            default: ({ payload }: NumberPayload) => (
              <>
                <span data-testid="payload">{payload ?? 'No payload'}</span>
                <OpenOnMount />
              </>
            ),
          }}
        </Dialog.Root>
      ));

      expect(takeReportedMessages()).toEqual([]);
      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('payload').textContent).toBe('8');
    });

    it('closes from a descendant layout effect on an initially open root', async () => {
      const handle = Dialog.createHandle();

      const CloseOnMount = defineComponent({
        setup() {
          onMounted(() => {
            handle.close();
          });
          return () => null;
        },
      });

      await render(() => (
        <Dialog.Root handle={handle} defaultOpen>
          <CloseOnMount />
        </Dialog.Root>
      ));

      expect(takeReportedMessages()).toEqual([]);
      expect(handle.isOpen).toBe(false);
    });

    it('ignores openWithPayload() after the root unmounts and keeps the remounted root without payload', async () => {
      const handle = Dialog.createHandle<number>();

      const App = defineComponent(
        (props: { mounted: boolean }) => () =>
          props.mounted ? (
            <Dialog.Root handle={handle}>
              {{
                default: ({ payload }: NumberPayload) => (
                  <span data-testid="payload">{payload ?? 'No payload'}</span>
                ),
              }}
            </Dialog.Root>
          ) : null,
        { props: ['mounted'] },
      );

      const { setProps } = await render(<App mounted />);
      await setProps({ mounted: false });

      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      try {
        handle.openWithPayload(8);
        expect(consoleWarn.mock.calls).toEqual([
          [
            expect.stringContaining(
              'openWithPayload() was called while no root that uses this handle',
            ),
          ],
        ]);
      } finally {
        consoleWarn.mockRestore();
      }
      expect(handle.isOpen).toBe(false);

      await setProps({ mounted: true });
      expect(handle.isOpen).toBe(false);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });

    it('does not attach a replacement root store from an abandoned transition render', async () => {
      const handle = Dialog.createHandle<number>();
      const replacementRender = vi.fn();
      const never = new Promise<void>(() => {});
      const showReplacement = shallowRef(false);

      const SuspendingReplacement = defineComponent({
        async setup() {
          replacementRender();
          await never;
          return () => null;
        },
      });

      const App = defineComponent(() => () => (
        <>
          <Dialog.Trigger handle={handle} id="trigger" payload={5}>
            Trigger
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => {
              showReplacement.value = true;
            }}
          >
            Start replacement
          </button>
          <button
            type="button"
            onClick={() => {
              showReplacement.value = false;
            }}
          >
            Cancel replacement
          </button>

          <Dialog.Root handle={handle} modal={false} disablePointerDismissal>
            {{
              default: ({ payload }: NumberPayload) => (
                <Dialog.Portal>
                  <Dialog.Popup>
                    Current dialog
                    <span data-testid="payload">{payload ?? 'No payload'}</span>
                  </Dialog.Popup>
                </Dialog.Portal>
              ),
            }}
          </Dialog.Root>

          <Suspense>
            {{
              default: () =>
                showReplacement.value ? (
                  <Dialog.Root handle={handle} modal={false} disablePointerDismissal>
                    <SuspendingReplacement />
                    <Dialog.Portal>
                      <Dialog.Popup>Replacement dialog</Dialog.Popup>
                    </Dialog.Portal>
                  </Dialog.Root>
                ) : null,
              fallback: () => <div>Loading</div>,
            }}
          </Suspense>
        </>
      ));

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Current dialog')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).toBe('5');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(handle.isOpen).toBe(true);

      await fireEvent.click(screen.getByRole('button', { name: 'Start replacement' }));
      expect(replacementRender).toHaveBeenCalled();

      expect(screen.queryByText('Replacement dialog')).toBe(null);
      expect(screen.getByText('Current dialog')).toBeVisible();
      expect(screen.getByTestId('payload').textContent).toBe('5');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(handle.isOpen).toBe(true);

      await fireEvent.click(screen.getByRole('button', { name: 'Cancel replacement' }));

      expect(screen.queryByText('Replacement dialog')).toBe(null);
      expect(screen.getByText('Current dialog')).toBeVisible();
      expect(screen.getByTestId('payload').textContent).toBe('5');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(handle.isOpen).toBe(true);
    });

    it('attaches a fresh root store when the handle prop changes to a previously dirtied handle', async () => {
      const handleA = Dialog.createHandle<number>();
      const handleB = Dialog.createHandle<number>();
      const phase = shallowRef<'dirty' | 'main'>('dirty');
      const handle = shallowRef(handleA);

      const App = defineComponent(() => () => {
        if (phase.value === 'dirty') {
          return (
            <Dialog.Root handle={handleB}>
              {{
                default: ({ payload }: NumberPayload) => (
                  <>
                    <span data-testid="dirty-payload">{payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dirty dialog
                        <button
                          type="button"
                          onClick={() => {
                            phase.value = 'main';
                          }}
                        >
                          Unmount dirty root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                ),
              }}
            </Dialog.Root>
          );
        }

        return (
          <>
            <Dialog.Trigger handle={handle.value} id="trigger" payload={1}>
              Trigger
            </Dialog.Trigger>
            <button
              type="button"
              onClick={() => {
                handle.value = handleB;
              }}
            >
              Switch to handle B
            </button>
            <Dialog.Root handle={handle.value}>
              {{
                default: ({ payload }: NumberPayload) => (
                  <>
                    <span data-testid="payload">{payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>Dialog Content</Dialog.Popup>
                    </Dialog.Portal>
                  </>
                ),
              }}
            </Dialog.Root>
          </>
        );
      });

      const { user } = await render(<App />);

      await waitForLaterMillisecond(async () => {
        handleB.openWithPayload(8);
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByText('Dirty dialog')).toBeVisible();
        });
        expect(screen.getByTestId('dirty-payload').textContent).toBe('8');
      });
      await user.click(screen.getByRole('button', { name: 'Unmount dirty root' }));
      await flushMicrotasks();
      expect(handleB.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      await user.click(screen.getByRole('button', { name: 'Switch to handle B' }));
      await flushMicrotasks();
      expect(handleB.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      const trigger = screen.getByRole('button', { name: 'Trigger' });
      await user.click(trigger);

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(screen.getByTestId('payload').textContent).toBe('1');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
    });

    it('keeps a handle-backed dialog open and controllable across handle swaps on a live root', async () => {
      const handleA = Dialog.createHandle();
      const handleB = Dialog.createHandle();
      const handle = shallowRef(handleA);

      const App = defineComponent(() => () => (
        <>
          <Dialog.Trigger handle={handle.value} id="trigger">
            Trigger
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => {
              handle.value = handleA;
            }}
          >
            Use handle A
          </button>
          <button
            type="button"
            onClick={() => {
              handle.value = handleB;
            }}
          >
            Use handle B
          </button>
          <Dialog.Root handle={handle.value} modal={false} disablePointerDismissal>
            <Dialog.Portal>
              <Dialog.Popup>Dialog Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      // The store is owned by the Root, so swapping the handle re-attaches it without resetting state.
      await user.click(screen.getByRole('button', { name: 'Use handle B' }));
      await flushMicrotasks();
      expect(screen.getByText('Dialog Content')).toBeVisible();
      expect(handleB.isOpen).toBe(true);
      expect(handleA.isOpen).toBe(false);
      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(
          screen.getByRole('dialog').getAttribute('id'),
        );
      });

      // Swapping back to a previously-attached handle keeps working (no stale registrations).
      await user.click(screen.getByRole('button', { name: 'Use handle A' }));
      await flushMicrotasks();
      expect(screen.getByText('Dialog Content')).toBeVisible();
      expect(handleA.isOpen).toBe(true);
      expect(handleB.isOpen).toBe(false);

      // The currently-attached handle controls the live dialog.
      handleA.close();
      await flushMicrotasks();
      expect(screen.queryByText('Dialog Content')).toBe(null);
    });

    it('attaches and detaches a handle when the prop toggles on a live root', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const attached = shallowRef(false);

      const App = defineComponent(() => () => (
        <>
          <Dialog.Trigger handle={handle} id="trigger">
            Trigger
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => {
              attached.value = !attached.value;
            }}
          >
            Toggle handle
          </button>
          <Dialog.Root
            handle={attached.value ? handle : undefined}
            modal={false}
            disablePointerDismissal
          >
            <Dialog.Portal>
              <Dialog.Popup>Dialog Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>
      ));

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      handle.open('trigger');
      await flushMicrotasks();
      expect(handle.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle handle' }));
      await flushMicrotasks();
      handle.open('trigger');
      await flushMicrotasks();

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );

      handle.close();
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Toggle handle' }));
      await flushMicrotasks();
      handle.open('trigger');
      await flushMicrotasks();
      expect(handle.isOpen).toBe(false);
      expect(screen.queryByRole('dialog')).toBe(null);

      const messages = consoleWarn.mock.calls.map(([message]) => String(message));
      consoleWarn.mockRestore();
      expect(messages).toEqual([
        expect.stringContaining(DETACHED_WARNING),
        expect.stringContaining(DETACHED_WARNING),
      ]);
    });

    it('associates the requested trigger when opened by id in the same commit a root attaches', async () => {
      const handle = Dialog.createHandle<number>();

      const OpenOnMount = defineComponent({
        setup() {
          // This `onMounted` hook runs after the root attached its store, but before the detached
          // triggers registered again in the store of the root.
          onMounted(() => {
            handle.open('trigger');
          });
          return () => null;
        },
      });

      await render(
        <>
          <Dialog.Trigger handle={handle} id="other" payload={9}>
            Other
          </Dialog.Trigger>
          <Dialog.Trigger handle={handle} id="trigger" payload={5}>
            Trigger
          </Dialog.Trigger>
          <Dialog.Root handle={handle}>
            {{
              default: ({ payload }: NumberPayload) => (
                <>
                  <span data-testid="payload">{payload ?? 'No payload'}</span>
                  <Dialog.Portal>
                    <Dialog.Popup>Dialog Content</Dialog.Popup>
                  </Dialog.Portal>
                </>
              ),
            }}
          </Dialog.Root>
          <OpenOnMount />
        </>,
      );

      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      // The requested trigger is associated (ARIA + its own payload), not the other detached trigger.
      const requestedTrigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      const otherTrigger = screen.getByRole('button', { name: 'Other', hidden: true });
      expect(requestedTrigger).toHaveAttribute('aria-expanded', 'true');
      expect(requestedTrigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(otherTrigger).not.toHaveAttribute('aria-controls');
      expect(screen.getByTestId('payload').textContent).toBe('5');
    });

    describe('multiple roots sharing one handle', () => {
      // Fake timers so the deferred overlap check only runs when ticked, after the handoff settles.
      beforeEach(() => {
        vi.useFakeTimers();
      });

      afterEach(() => {
        vi.useRealTimers();
      });

      type Phase = 'outgoing' | 'overlap' | 'incoming';

      function createTransitioningRoots(handle: Dialog.Handle<unknown>) {
        return defineComponent(
          (props: { phase: Phase }) => () => (
            <>
              {(props.phase === 'outgoing' || props.phase === 'overlap') && (
                <Dialog.Root key="outgoing" handle={handle}>
                  <Dialog.Portal>
                    <Dialog.Popup>Outgoing</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              )}
              {(props.phase === 'overlap' || props.phase === 'incoming') && (
                <Dialog.Root key="incoming" handle={handle}>
                  <Dialog.Portal>
                    <Dialog.Popup>Incoming</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              )}
            </>
          ),
          { props: ['phase'] },
        );
      }

      it('does not warn when one root replaces another during a route transition', async () => {
        const handle = Dialog.createHandle();
        const TransitioningRoots = createTransitioningRoots(handle);

        const { setProps } = await render(<TransitioningRoots phase="outgoing" />);
        // The incoming root mounts while the outgoing one is still mounted (overlap)...
        await setProps({ phase: 'overlap' });
        // ...then the outgoing root unmounts, completing a clean handoff, all before the deferred
        // check runs.
        await setProps({ phase: 'incoming' });

        vi.advanceTimersByTime(20);
        await flushMicrotasks();

        expect(takeReportedMessages()).toEqual([]);
      });

      it('keeps the newer root attached after the older root unmounts', async () => {
        const handle = Dialog.createHandle();
        const TransitioningRoots = createTransitioningRoots(handle);

        const { setProps } = await render(<TransitioningRoots phase="outgoing" />);
        await setProps({ phase: 'overlap' });
        await setProps({ phase: 'incoming' });

        vi.advanceTimersByTime(20);
        await flushMicrotasks();

        handle.open(null);
        await flushMicrotasks();

        expect(screen.getByText('Incoming')).toBeVisible();
        expect(screen.queryByText('Outgoing')).toBe(null);
        expect(handle.isOpen).toBe(true);
      });

      it('restores control to the previous root when a newer overlapping root detaches', async () => {
        const handle = Dialog.createHandle();
        const TransitioningRoots = createTransitioningRoots(handle);

        const { setProps } = await render(<TransitioningRoots phase="outgoing" />);
        // The incoming root mounts while the outgoing one is still mounted (overlap)...
        await setProps({ phase: 'overlap' });
        // ...then the transition is canceled: the newer (incoming) root unmounts first while the
        // older (outgoing) root stays mounted.
        await setProps({ phase: 'outgoing' });

        vi.advanceTimersByTime(20);
        await flushMicrotasks();

        // The still-mounted outgoing root regains control of the handle instead of being left inert.
        handle.open(null);
        await flushMicrotasks();

        expect(screen.getByText('Outgoing')).toBeVisible();
        expect(screen.queryByText('Incoming')).toBe(null);
        expect(handle.isOpen).toBe(true);
        // A canceled transient overlap should not warn.
        expect(takeReportedMessages()).toEqual([]);
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple triggers within Root', () => {
    type NumberPayload = { payload: number | undefined };

    it('keeps the payload reactive', async () => {
      const payloads = shallowRef([1, 2]);

      const App = defineComponent(() => () => (
        <div>
          <Dialog.Root>
            {{
              default: ({ payload }: NumberPayload) => (
                <>
                  <Dialog.Trigger id="trigger-1" payload={payloads.value[0]}>
                    Dialog 1
                  </Dialog.Trigger>
                  <Dialog.Trigger id="trigger-2" payload={payloads.value[1]}>
                    Dialog 2
                  </Dialog.Trigger>

                  <Dialog.Portal>
                    <Dialog.Popup>
                      <span data-testid="content">{payload}</span>
                      <button
                        type="button"
                        onClick={() => {
                          payloads.value = [8, 16];
                        }}
                      >
                        Update payloads
                      </button>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </>
              ),
            }}
          </Dialog.Root>
        </div>
      ));

      const { user } = await render(<App />);

      const trigger1 = screen.getByRole('button', { name: 'Dialog 1' });
      await waitForLaterMillisecond(async () => {
        await user.click(trigger1);
        await waitFor(() => {
          expect(screen.getByTestId('content').textContent).toBe('1');
        });
      });

      const updateButton = screen.getByRole('button', { name: 'Update payloads' });
      await user.click(updateButton);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('8');
      });
    });
  });

  describe.skipIf(isJSDOM)('multiple detached triggers', () => {
    type NumberPayload = { payload: number | undefined };

    it('attaches fresh root state when the root remounts after being unmounted while open', async () => {
      const testDialog = Dialog.createHandle();
      const mounted = shallowRef(true);

      const App = defineComponent(() => () => (
        <div>
          <Dialog.Trigger handle={testDialog} id="trigger-1">
            Trigger 1
          </Dialog.Trigger>
          <Dialog.Trigger handle={testDialog} id="trigger-2">
            Trigger 2
          </Dialog.Trigger>
          {!mounted.value && (
            <button
              type="button"
              onClick={() => {
                mounted.value = true;
              }}
            >
              Remount root
            </button>
          )}

          {mounted.value && (
            <Dialog.Root handle={testDialog}>
              <Dialog.Portal>
                <Dialog.Popup>
                  Dialog Content
                  <button
                    type="button"
                    onClick={() => {
                      mounted.value = false;
                    }}
                  >
                    Unmount root
                  </button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      ));

      const { user } = await render(<App />);
      const trigger1 = screen.getByRole('button', { name: 'Trigger 1' });
      const trigger2 = screen.getByRole('button', { name: 'Trigger 2' });

      await waitForLaterMillisecond(async () => {
        await user.click(trigger1);
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
      });

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByRole('button', { name: 'Unmount root' }));
        await flushMicrotasks();
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      await flushMicrotasks();
      expect(screen.queryByText('Dialog Content')).toBe(null);
      await waitFor(() => {
        expect(trigger1).toHaveAttribute('aria-expanded', 'false');
      });

      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      expect(trigger1).toHaveAttribute('aria-expanded', 'true');
      expect(trigger1.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(trigger2).toHaveAttribute('aria-expanded', 'false');
    });

    it('resets stale payload when a handle-backed root remounts', async () => {
      const testDialog = Dialog.createHandle<number>();
      const mounted = shallowRef(true);

      const App = defineComponent(() => () => (
        <div>
          {!mounted.value && (
            <button
              type="button"
              onClick={() => {
                mounted.value = true;
              }}
            >
              Remount root
            </button>
          )}

          {mounted.value && (
            <Dialog.Root handle={testDialog}>
              {{
                default: ({ payload }: NumberPayload) => (
                  <>
                    <span data-testid="payload">{payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dialog Content
                        <button
                          type="button"
                          onClick={() => {
                            mounted.value = false;
                          }}
                        >
                          Unmount root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                ),
              }}
            </Dialog.Root>
          )}
        </div>
      ));

      const { user } = await render(<App />);

      expect(screen.getByTestId('payload').textContent).toBe('No payload');

      await waitForLaterMillisecond(async () => {
        testDialog.openWithPayload(8);
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(screen.getByTestId('payload').textContent).toBe('8');
      });

      await waitForLaterMillisecond(async () => {
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
        );
        await flushMicrotasks();
        expect(screen.queryByTestId('payload')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });

    it('notifies persistent detached triggers after attaching fresh root state on remount', async () => {
      const testDialog = Dialog.createHandle();

      // A component with no reactive input does not render again when the root remounts.
      const HeaderTrigger = defineComponent(() => () => (
        <Dialog.Trigger handle={testDialog} id="trigger">
          Trigger
        </Dialog.Trigger>
      ));

      const RouteRoot = defineComponent(() => {
        const mounted = shallowRef(true);
        return () => (
          <>
            {!mounted.value && (
              <button
                type="button"
                onClick={() => {
                  mounted.value = true;
                }}
              >
                Remount root
              </button>
            )}

            {mounted.value && (
              <Dialog.Root handle={testDialog}>
                <Dialog.Portal>
                  <Dialog.Popup>
                    Dialog Content
                    <button
                      type="button"
                      onClick={() => {
                        mounted.value = false;
                      }}
                    >
                      Unmount root
                    </button>
                  </Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            )}
          </>
        );
      });

      const { user } = await render(
        <>
          <HeaderTrigger />
          <RouteRoot />
        </>,
      );
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await waitForLaterMillisecond(async () => {
        await user.click(trigger);
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });

        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger.getAttribute('aria-controls')).toBe(
          screen.getByRole('dialog').getAttribute('id'),
        );
      });

      await waitForLaterMillisecond(async () => {
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
        );
        await flushMicrotasks();
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      await flushMicrotasks();
      expect(screen.queryByText('Dialog Content')).toBe(null);

      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('resets stale controlled open state when a handle-backed root remounts uncontrolled', async () => {
      const testDialog = Dialog.createHandle();
      const mode = shallowRef<'controlled' | 'unmounted' | 'uncontrolled'>('controlled');

      const App = defineComponent(() => () => (
        <div>
          <Dialog.Trigger handle={testDialog} id="trigger">
            Trigger
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => {
              mode.value = 'unmounted';
            }}
          >
            Unmount root
          </button>
          {mode.value === 'unmounted' && (
            <button
              type="button"
              onClick={() => {
                mode.value = 'uncontrolled';
              }}
            >
              Remount uncontrolled root
            </button>
          )}

          {mode.value === 'controlled' && (
            <Dialog.Root handle={testDialog} open triggerId="trigger">
              <Dialog.Portal>
                <Dialog.Popup>
                  Dialog Content
                  <button
                    type="button"
                    onClick={() => {
                      mode.value = 'unmounted';
                    }}
                  >
                    Unmount root
                  </button>
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}

          {mode.value === 'uncontrolled' && (
            <Dialog.Root handle={testDialog}>
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      ));

      const { user } = await render(<App />);

      await waitForLaterMillisecond(() =>
        waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        }),
      );

      await waitForLaterMillisecond(async () => {
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
        );
        await flushMicrotasks();
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount uncontrolled root' }));
      await flushMicrotasks();
      expect(screen.queryByText('Dialog Content')).toBe(null);
    });

    it('does not warn when a handle-backed root remounts controlled after being uncontrolled', async () => {
      const testDialog = Dialog.createHandle();
      const mode = shallowRef<'uncontrolled' | 'unmounted' | 'controlled'>('uncontrolled');

      const App = defineComponent(() => () => (
        <div>
          <Dialog.Trigger handle={testDialog} id="trigger">
            Trigger
          </Dialog.Trigger>
          <button
            type="button"
            onClick={() => {
              mode.value = 'unmounted';
            }}
          >
            Unmount root
          </button>
          {mode.value === 'unmounted' && (
            <button
              type="button"
              onClick={() => {
                mode.value = 'controlled';
              }}
            >
              Remount controlled root
            </button>
          )}

          {mode.value === 'uncontrolled' && (
            <Dialog.Root handle={testDialog}>
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}

          {mode.value === 'controlled' && (
            <Dialog.Root handle={testDialog} open triggerId="trigger">
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          )}
        </div>
      ));

      const { user } = await render(<App />);

      await waitForLaterMillisecond(async () => {
        await user.click(screen.getByRole('button', { name: 'Unmount root' }));
        await flushMicrotasks();
        expect(screen.queryByText('Dialog Content')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount controlled root' }));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      expect(takeReportedMessages()).toEqual([]);
    });

    it('keeps ARIA controls in sync when a detached handle is recreated while open', async () => {
      const DetachedTriggerTest = defineComponent(
        (props: { handle: Dialog.Handle<unknown> }) => () => (
          <>
            <Dialog.Trigger id="trigger" handle={props.handle}>
              Trigger
            </Dialog.Trigger>
            <Dialog.Root handle={props.handle} open triggerId="trigger" modal={false}>
              <Dialog.Portal>
                <Dialog.Popup data-testid="popup">Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </>
        ),
        { props: ['handle'] },
      );

      const { setProps } = await render(<DetachedTriggerTest handle={Dialog.createHandle()} />);

      let trigger = screen.getByRole('button', { name: 'Trigger' });
      let popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
      });

      await setProps({ handle: Dialog.createHandle() });

      trigger = screen.getByRole('button', { name: 'Trigger' });
      popup = await screen.findByTestId('popup');

      await waitFor(() => {
        expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
      });
    });

    it('keeps the payload reactive', async () => {
      type NumberAccessorPayload = { payload: (() => number) | undefined };
      const testDialog = Dialog.createHandle<() => number>();

      // The triggers are in their own component, so a change of their payloads does not render
      // the root again. Each accessor returns a constant of one render of the triggers, so the
      // slot of the root does not depend on the reactive payloads either. The case thus proves
      // that the trigger forwards a new payload to the root.
      const Triggers = defineComponent(() => {
        const payloads = shallowRef([1, 2]);
        return () => {
          const [first, second] = payloads.value;
          return (
            <div>
              <Dialog.Trigger id="trigger-1" payload={() => first} handle={testDialog}>
                Dialog 1
              </Dialog.Trigger>
              <Dialog.Trigger id="trigger-2" payload={() => second} handle={testDialog}>
                Dialog 2
              </Dialog.Trigger>
              <button
                type="button"
                onClick={() => {
                  payloads.value = [8, 16];
                }}
              >
                Update payloads
              </button>
            </div>
          );
        };
      });

      const { user } = await render(
        <div>
          <Triggers />
          <Dialog.Root modal={false} disablePointerDismissal={true} handle={testDialog}>
            {{
              default: ({ payload }: NumberAccessorPayload) => (
                <Dialog.Portal>
                  <Dialog.Popup>
                    <span data-testid="content">{payload?.()}</span>
                  </Dialog.Popup>
                </Dialog.Portal>
              ),
            }}
          </Dialog.Root>
        </div>,
      );

      const trigger1 = screen.getByRole('button', { name: 'Dialog 1' });
      await user.click(trigger1);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('1');
      });

      const updateButton = screen.getByRole('button', { name: 'Update payloads' });
      await user.click(updateButton);
      await waitFor(() => {
        expect(screen.getByTestId('content').textContent).toBe('8');
      });
    });

    it('closes a non-modal dialog with Escape from an inactive detached trigger', async () => {
      const testDialog = Dialog.createHandle();
      const { user } = await render(
        <>
          <Dialog.Trigger handle={testDialog}>Trigger 1</Dialog.Trigger>
          <Dialog.Trigger handle={testDialog}>Trigger 2</Dialog.Trigger>
          <Dialog.Root handle={testDialog} modal={false}>
            <Dialog.Portal>
              <Dialog.Popup>Dialog Content</Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        </>,
      );

      await user.click(screen.getByRole('button', { name: 'Trigger 1' }));
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });

      const inactiveTrigger = screen.getByRole('button', { name: 'Trigger 2' });
      inactiveTrigger.focus();
      await flushMicrotasks();
      await user.keyboard('{Escape}');

      expect(screen.queryByText('Dialog Content')).toBe(null);
    });
  });

  describe('imperative actions on the handle', () => {
    it('associates an imperative open-by-id with a persistent detached trigger after the root remounts', async () => {
      const dialog = Dialog.createHandle<number>();
      const mounted = shallowRef(true);

      const App = defineComponent(() => () => (
        <div>
          <Dialog.Trigger handle={dialog} id="trigger" payload={7}>
            Trigger
          </Dialog.Trigger>
          {!mounted.value && (
            <button
              type="button"
              onClick={() => {
                mounted.value = true;
              }}
            >
              Remount root
            </button>
          )}
          {mounted.value && (
            <Dialog.Root handle={dialog}>
              {{
                default: ({ payload }: { payload: number | undefined }) => (
                  <>
                    <span data-testid="payload">{payload ?? 'No payload'}</span>
                    <Dialog.Portal>
                      <Dialog.Popup>
                        Dialog Content
                        <button
                          type="button"
                          onClick={() => {
                            mounted.value = false;
                          }}
                        >
                          Unmount root
                        </button>
                      </Dialog.Popup>
                    </Dialog.Portal>
                  </>
                ),
              }}
            </Dialog.Root>
          )}
        </div>
      ));

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await waitForLaterMillisecond(async () => {
        dialog.open('trigger');
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(trigger).toHaveAttribute('aria-expanded', 'true');
        expect(trigger.getAttribute('aria-controls')).toBe(
          screen.getByRole('dialog').getAttribute('id'),
        );
        expect(screen.getByTestId('payload').textContent).toBe('7');
      });

      await waitForLaterMillisecond(async () => {
        await user.click(
          within(screen.getByRole('dialog')).getByRole('button', { name: 'Unmount root' }),
        );
        await flushMicrotasks();
        expect(screen.queryByRole('dialog')).toBe(null);
      });

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      await waitFor(() => {
        expect(trigger).toHaveAttribute('aria-expanded', 'false');
      });

      // The trigger stayed mounted across the remount, so an imperative open-by-id must still
      // associate it (ARIA + payload), not open unassociated.
      dialog.open('trigger');
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByText('Dialog Content')).toBeVisible();
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
      expect(screen.getByTestId('payload').textContent).toBe('7');
    });

    it('stops resolving a handle-A trigger after the root switches to handle B', async () => {
      const handleA = Dialog.createHandle<number>();
      const handleB = Dialog.createHandle<number>();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handle = shallowRef(handleA);

      try {
        const App = defineComponent(() => () => (
          <div>
            <Dialog.Trigger handle={handleA} id="a" payload={1}>
              A trigger
            </Dialog.Trigger>
            <button
              type="button"
              onClick={() => {
                handle.value = handleB;
              }}
            >
              Switch root to B
            </button>
            <Dialog.Root handle={handle.value} modal={false} disablePointerDismissal>
              <Dialog.Portal>
                <Dialog.Popup>Dialog Content</Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
          </div>
        ));

        const { user } = await render(<App />);
        const aTrigger = screen.getByRole('button', { name: 'A trigger' });

        // Positive control: while the root is on handle A, opening by the A-trigger's id associates it.
        handleA.open('a');
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(aTrigger).toHaveAttribute('aria-expanded', 'true');
        handleA.close();
        await flushMicrotasks();
        expect(screen.queryByText('Dialog Content')).toBe(null);

        // The A-trigger stays mounted on handle A; only the root moves to handle B.
        await user.click(screen.getByRole('button', { name: 'Switch root to B' }));
        await flushMicrotasks();

        // Handle B's root must no longer resolve the handle-A trigger: the trigger followed its own
        // handle's store off the root's store, so open-by-id finds nothing and warns.
        handleB.open('a');
        await flushMicrotasks();
        await waitFor(() => {
          expect(screen.getByText('Dialog Content')).toBeVisible();
        });
        expect(aTrigger).toHaveAttribute('aria-expanded', 'false');
        expect(consoleWarn.mock.calls).toEqual([
          [expect.stringContaining('No trigger found with id "a"')],
        ]);
      } finally {
        consoleWarn.mockRestore();
      }
    });

    it('does not associate the only rendered trigger when opened with a payload', async () => {
      const dialog = Dialog.createHandle<string>();
      const { user } = await render(
        <div>
          <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
            Trigger
          </Dialog.Trigger>
          <Dialog.Root handle={dialog}>
            {{
              default: ({ payload }: { payload: string | undefined }) => (
                <Dialog.Portal>
                  <Dialog.Popup data-testid="content">{payload}</Dialog.Popup>
                </Dialog.Portal>
              ),
            }}
          </Dialog.Root>
        </div>,
      );

      const trigger = screen.getByRole('button', { name: 'Trigger' });

      dialog.openWithPayload('from openWithPayload');
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
      expect(trigger).not.toHaveAttribute('data-popup-open');

      dialog.close();
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).toBe(null);

      // Opening through the trigger afterwards still associates it and forwards its payload.
      await user.click(trigger);
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });
      expect(screen.getByTestId('content').textContent).toBe('from trigger');
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      expect(trigger.getAttribute('aria-controls')).toBe(
        screen.getByRole('dialog').getAttribute('id'),
      );
    });

    it('does not let a trigger that mounts while open replace the programmatic payload', async () => {
      const dialog = Dialog.createHandle<string>();

      const App = defineComponent(
        (props: { showTrigger: boolean }) => () => (
          <div>
            {props.showTrigger && (
              <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
                Trigger
              </Dialog.Trigger>
            )}
            <Dialog.Root handle={dialog}>
              {{
                default: ({ payload }: { payload: string | undefined }) => (
                  <Dialog.Portal>
                    <Dialog.Popup data-testid="content">{payload}</Dialog.Popup>
                  </Dialog.Portal>
                ),
              }}
            </Dialog.Root>
          </div>
        ),
        { props: ['showTrigger'] },
      );

      const { setProps } = await render(<App showTrigger={false} />);

      dialog.openWithPayload('from openWithPayload');
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });
      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');

      await setProps({ showTrigger: true });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      // The modal dialog hides the rest of the page from the accessibility tree.
      const trigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });

    it('keeps the programmatic payload when a controlled dialog declines a close request', async () => {
      const dialog = Dialog.createHandle<string>();

      const App = defineComponent(
        (props: { showTrigger: boolean }) => {
          const open = shallowRef(false);
          return () => (
            <div>
              {props.showTrigger && (
                <Dialog.Trigger handle={dialog} id="trigger" payload="from trigger">
                  Trigger
                </Dialog.Trigger>
              )}
              <Dialog.Root
                handle={dialog}
                open={open.value}
                onOpenChange={(nextOpen: boolean) => {
                  // Accept opens, but keep the dialog open on close requests.
                  if (nextOpen) {
                    open.value = true;
                  }
                }}
              >
                {{
                  default: ({ payload }: { payload: string | undefined }) => (
                    <Dialog.Portal>
                      <Dialog.Popup data-testid="content">{payload}</Dialog.Popup>
                    </Dialog.Portal>
                  ),
                }}
              </Dialog.Root>
            </div>
          );
        },
        { props: ['showTrigger'] },
      );

      const { setProps } = await render(<App showTrigger={false} />);

      dialog.openWithPayload('from openWithPayload');
      await flushMicrotasks();
      await waitFor(() => {
        expect(screen.getByRole('dialog')).not.toBe(null);
      });

      // The close request is declined, so the dialog stays open without a trigger.
      dialog.close();
      await flushMicrotasks();
      expect(screen.queryByRole('dialog')).not.toBe(null);
      expect(dialog.isOpen).toBe(true);

      await setProps({ showTrigger: true });

      expect(screen.getByTestId('content').textContent).toBe('from openWithPayload');
      const trigger = screen.getByRole('button', { name: 'Trigger', hidden: true });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
      expect(trigger).not.toHaveAttribute('aria-controls');
    });
  });
});
