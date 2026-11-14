import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { REASONS } from '../../internals/reasons';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';
import DialogPortalHydration from './DialogPortalHydration.test.vue';

const INTERNAL_BACKDROP_SELECTOR = '[data-vase-ui-inert]';

describe('<Dialog.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Dialog.Root open>{node}</Dialog.Root>);
    },
  }));

  it('renders only while the dialog is mounted, or always with keepMounted', async () => {
    const open = shallowRef(false);
    const keepMounted = shallowRef(false);
    await render(() => (
      <Dialog.Root open={open.value} modal={false}>
        <Dialog.Portal keepMounted={keepMounted.value} data-testid="portal">
          <Dialog.Viewport data-testid="viewport">
            <DialogPopupPart />
          </Dialog.Viewport>
        </Dialog.Portal>
      </Dialog.Root>
    ));
    expect(screen.queryByTestId('portal')).toBe(null);

    open.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('portal').parentElement).toBe(document.body);
    expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('viewport'));

    open.value = false;
    await flushMicrotasks();
    expect(screen.queryByTestId('portal')).toBe(null);

    keepMounted.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('portal')).toContainElement(screen.getByTestId('viewport'));
    expect(screen.getByTestId('viewport')).toHaveAttribute('hidden');
  });

  describe('internal backdrop', () => {
    it.each([
      { name: 'modal true', modal: true, hasBackdrop: true },
      { name: 'modal false', modal: false, hasBackdrop: false },
      { name: "modal 'trap-focus'", modal: 'trap-focus' as const, hasBackdrop: false },
    ])('renders it only for a modal dialog: $name', async ({ modal, hasBackdrop }) => {
      let store!: DialogStore<unknown>;
      await render(
        <Dialog.Root defaultOpen modal={modal}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <Dialog.Portal data-testid="portal">
            <DialogPopupPart />
          </Dialog.Portal>
        </Dialog.Root>,
      );

      const backdrop = screen.getByTestId('portal').querySelector(INTERNAL_BACKDROP_SELECTOR);
      expect(backdrop !== null).toBe(hasBackdrop);
      expect(store.context.internalBackdropRef.value).toBe(backdrop);
    });

    it('is inert while the dialog closes, and leaves the store when it unmounts', async () => {
      let root!: Dialog.Root.Actions;
      let store!: DialogStore<unknown>;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.preventUnmountOnClose()}
        >
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <Dialog.Portal data-testid="portal">
            <DialogPopupPart />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const backdrop = screen
        .getByTestId('portal')
        .querySelector<HTMLElement>(INTERNAL_BACKDROP_SELECTOR)!;
      expect(backdrop.inert).toBe(false);

      root.close();
      await flushMicrotasks();
      expect(store.select('mounted')).toBe(true);
      expect(backdrop.inert).toBe(true);

      root.unmount();
      await flushMicrotasks();
      expect(backdrop.isConnected).toBe(false);
      expect(store.context.internalBackdropRef.value).toBe(null);
    });

    it('closes a modal dialog on a press on it', async () => {
      const handleOpenChange = vi.fn();
      await render(
        <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <Dialog.Portal data-testid="portal">
            <DialogPopupPart />
          </Dialog.Portal>
        </Dialog.Root>,
      );
      const backdrop = screen.getByTestId('portal').querySelector(INTERNAL_BACKDROP_SELECTOR)!;

      await fireEvent.pointerDown(backdrop, { pointerType: 'mouse', button: 0 });
      await fireEvent.click(backdrop, { detail: 1 });

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  it('hydrates an open dialog, and renders the portal after the mount, with no message', async () => {
    const serverHtml = await renderOnServer('src/dialog/portal/DialogPortalHydration.test.vue', {});
    expect(serverHtml).not.toContain('role="dialog"');

    await hydrate(DialogPortalHydration, { serverHtml });

    expect(screen.getAllByRole('dialog').length).toBeGreaterThan(0);
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when a portaled part is rendered without <Dialog.Portal>', async () => {
    await expect(
      render(
        <Dialog.Root open>
          <Dialog.Viewport />
        </Dialog.Root>,
      ),
    ).rejects.toThrow('Vase UI: <Dialog.Portal> is missing.');

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
