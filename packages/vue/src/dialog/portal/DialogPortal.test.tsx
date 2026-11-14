import { describe, expect, it, vi } from 'vitest';
import { h, shallowRef } from 'vue';
import type { Component } from 'vue';
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

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

describe('<Dialog.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Portal />, () => ({
    refInstanceof: window.HTMLDivElement,
    childrenSelector: INTERNAL_BACKDROP_SELECTOR,
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
    ])(
      'renders it before the content, only for a modal dialog: $name',
      async ({ modal, hasBackdrop }) => {
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
        expect(screen.getByRole('dialog').previousElementSibling).toBe(backdrop);
        expect(store.context.internalBackdropRef.value).toBe(backdrop);
      },
    );

    it.each([
      { name: 'modal true', modal: true, hasBackdrop: true },
      { name: 'modal false', modal: false, hasBackdrop: false },
    ])(
      'renders it before the content in the element of the #render slot, only for a modal dialog: $name',
      async ({ modal, hasBackdrop }) => {
        let store!: DialogStore<unknown>;
        await render(
          <Dialog.Root defaultOpen modal={modal}>
            <DialogStoreProbe onStore={(value) => (store = value)} />
            <Dialog.Portal
              v-slots={{
                render: ({ props, children }: RenderSlotProps) => (
                  <section {...props} data-testid="portal">
                    {h(children, null, () => (
                      <DialogPopupPart />
                    ))}
                  </section>
                ),
              }}
            />
          </Dialog.Root>,
        );

        const portal = screen.getByTestId('portal');
        const backdrop = portal.querySelector(INTERNAL_BACKDROP_SELECTOR);
        expect(portal.localName).toBe('section');
        expect(backdrop !== null).toBe(hasBackdrop);
        expect(screen.getByRole('dialog').previousElementSibling).toBe(backdrop);
        expect(store.context.internalBackdropRef.value).toBe(backdrop);
      },
    );

    it.each([
      { name: 'with the portal', keepMounted: false },
      { name: 'from a kept portal', keepMounted: true },
    ])(
      'is inert while the dialog closes, and leaves the store when it unmounts $name',
      async ({ keepMounted }) => {
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
            <Dialog.Portal keepMounted={keepMounted} data-testid="portal">
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
        expect(screen.queryByTestId('portal') !== null).toBe(keepMounted);
        expect(store.context.internalBackdropRef.value).toBe(null);
      },
    );

    it('leaves the store when the portal unmounts while the dialog is open', async () => {
      const showPortal = shallowRef(true);
      let store!: DialogStore<unknown>;
      await render(() => (
        <Dialog.Root defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          {showPortal.value ? (
            <Dialog.Portal>
              <DialogPopupPart />
            </Dialog.Portal>
          ) : null}
        </Dialog.Root>
      ));
      expect(store.context.internalBackdropRef.value).not.toBe(null);

      showPortal.value = false;
      await flushMicrotasks();

      expect(store.context.internalBackdropRef.value).toBe(null);
    });

    it('stays in the store when another portal of the dialog unmounts', async () => {
      const showOther = shallowRef(true);
      let store!: DialogStore<unknown>;
      await render(() => (
        <Dialog.Root defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          {showOther.value ? <Dialog.Portal key="other" /> : null}
          <Dialog.Portal key="portal" data-testid="portal">
            <DialogPopupPart />
          </Dialog.Portal>
        </Dialog.Root>
      ));
      const backdrop = screen.getByTestId('portal').querySelector(INTERNAL_BACKDROP_SELECTOR);
      expect(store.context.internalBackdropRef.value).toBe(backdrop);

      showOther.value = false;
      await flushMicrotasks();

      expect(store.context.internalBackdropRef.value).toBe(backdrop);
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

    // `hydrate` also mounts a client-only app. Each of the two apps renders one dialog.
    expect(screen.getAllByRole('dialog')).toHaveLength(2);
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
    ).rejects.toThrow(
      'Vase UI: <Dialog.Portal> is missing. Without it the part cannot know if it stays mounted while the dialog is closed. Put the part inside <Dialog.Portal>.',
    );

    // Vue also warns about the error of `setup`.
    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
