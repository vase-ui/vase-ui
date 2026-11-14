import { describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted } from 'vue';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  flushMicrotasks,
  screen,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import * as Popover from '../../popover/index.parts';
import * as Dialog from '../index.parts';

const DETACHED_WARNING = 'no root that uses this handle is mounted';

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

    async function expectClosed(trigger: HTMLElement) {
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    it('when the popup opens and closes', async () => {
      const { user, bystander, trigger1 } = await renderDialog();

      async function openAndClose() {
        await user.click(trigger1);
        await expectOpenedBy(trigger1);
        await user.keyboard('[Escape]');
        await expectClosed(trigger1);
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
      await expectClosed(trigger2);

      expect(bystander.renders).toBe(0);
    });
  });

  it('closes a nonmodal dialog on Escape from an inactive trigger inside a popover on every open', async () => {
    const dialog = Dialog.createHandle();
    const { user } = await render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Popover trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup data-testid="popover">
              <Dialog.Root handle={dialog} modal={false}>
                <Dialog.Trigger handle={dialog}>Dialog trigger 1</Dialog.Trigger>
                <Dialog.Trigger handle={dialog}>Dialog trigger 2</Dialog.Trigger>
                <Dialog.Portal>
                  <Dialog.Popup data-testid="dialog">Dialog</Dialog.Popup>
                </Dialog.Portal>
              </Dialog.Root>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );

    async function openThenEscapeFromInactiveTrigger() {
      await user.click(screen.getByRole('button', { name: 'Dialog trigger 1' }));
      expect(await screen.findByTestId('dialog')).not.toBe(null);

      screen.getByRole('button', { name: 'Dialog trigger 2' }).focus();
      await flushMicrotasks();
      await user.keyboard('[Escape]');

      await waitFor(() => {
        expect(screen.queryByTestId('dialog')).toBe(null);
      });
      expect(screen.queryByTestId('popover')).not.toBe(null);
    }

    await openThenEscapeFromInactiveTrigger();
    await openThenEscapeFromInactiveTrigger();
    await openThenEscapeFromInactiveTrigger();
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
      await user.click(screen.getByRole('button', { name: 'Open help' }));
      expect(await screen.findByTestId('help')).not.toBe(null);
      expect(screen.getByTestId('help')).not.toHaveAttribute('data-nested-dialog-open');
      expect(screen.getByTestId('help').style.getPropertyValue('--nested-dialogs')).toBe('0');
      await waitForLaterMillisecond();
    }

    await user.click(screen.getByRole('button', { name: 'Open section' }));
    expect(await screen.findByTestId('section')).not.toBe(null);
    await waitForLaterMillisecond();

    await openHelp();
    await user.keyboard('[Escape]');
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
    expect(screen.queryByTestId('section')).not.toBe(null);

    await openHelp();
    await user.click(screen.getByTestId('help-backdrop'));
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
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
    await waitFor(() => {
      expect(screen.queryByTestId('help')).toBe(null);
    });
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
      await user.click(screen.getByRole('button', { name: 'Open child' }));
      expect(await screen.findByTestId('child')).not.toBe(null);
      await waitFor(() => {
        expect(parent).toHaveAttribute('data-nested-dialog-open');
      });
      expect(parent.style.getPropertyValue('--nested-dialogs')).toBe('1');

      await waitForLaterMillisecond();
      await user.click(screen.getByRole('button', { name: 'Close child' }));
      await waitFor(() => {
        expect(screen.queryByTestId('child')).toBe(null);
      });
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

  describe('handle-backed root ownership', () => {
    type NumberPayload = { payload: number | undefined };

    it('opens from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

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

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
    });

    it('opens with a payload from a descendant layout effect on initial mount', async () => {
      const handle = Dialog.createHandle<number>();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

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

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
      expect(handle.isOpen).toBe(true);
      expect(screen.getByTestId('payload').textContent).toBe('8');
    });

    it('closes from a descendant layout effect on an initially open root', async () => {
      const handle = Dialog.createHandle();
      const consoleWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});

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

      const detachedWarned = consoleWarn.mock.calls.some(
        ([message]) => typeof message === 'string' && message.includes(DETACHED_WARNING),
      );
      consoleWarn.mockRestore();

      expect(detachedWarned).toBe(false);
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
        expect(
          consoleWarn.mock.calls.filter(
            ([message]) =>
              typeof message === 'string' &&
              message.includes('openWithPayload() was called while no root that uses this handle'),
          ),
        ).toHaveLength(1);
      } finally {
        consoleWarn.mockRestore();
      }
      expect(handle.isOpen).toBe(false);

      await setProps({ mounted: true });
      expect(handle.isOpen).toBe(false);
      expect(screen.getByTestId('payload').textContent).toBe('No payload');
    });
  });
});
