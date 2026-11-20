import { beforeEach, describe, expect, it, onTestFinished, vi } from 'vitest';
import { userEvent } from 'vitest/browser';
import { h, nextTick, shallowRef } from 'vue';
import type { Component } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import { AlertDialog } from '@vase-ui/vue/alert-dialog';
import { Select } from '@vase-ui/vue/select';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
  wait,
  waitFor,
  waitForLaterMillisecond,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import { REASONS } from '../../internals/reasons';
import type { DialogStore } from '../store/DialogStore';
import DialogPortalHydration from './DialogPortalHydration.test.vue';
import DialogPortalInPlaceHydration from './DialogPortalInPlaceHydration.test.vue';
import DialogPortalInPlaceScoped from './DialogPortalInPlaceScoped.test.vue';
import { isScrollLocked } from '../../../test/fixtures/scrollDocument';

const INTERNAL_BACKDROP_SELECTOR = '[role="presentation"][data-vase-ui-inert]';

type RenderSlotProps = { props: Record<string, unknown>; children: Component };

describe('<Dialog.Portal />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Portal />, () => ({
    elementIsRoot: false,
    refInstanceof: window.HTMLDivElement,
    childrenSelector: INTERNAL_BACKDROP_SELECTOR,
    render(node) {
      return render(<Dialog.Root open>{node}</Dialog.Root>);
    },
  }));

  it('VUE-135: keeps the owner free of a role with a portal-owner-role attribute', async () => {
    await render(
      <Dialog.Root defaultOpen modal={false}>
        <Dialog.Portal {...{ 'portal-owner-role': 'presentation' }} data-testid="portal">
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>,
    );

    const portal = await screen.findByTestId('portal');
    const owner = await waitFor(() => {
      const element = document.querySelector(`[aria-owns="${portal.id}"]`);
      expect(element).toBeInstanceOf(HTMLSpanElement);
      return element;
    });
    expect(owner).not.toHaveAttribute('role');
  });

  it('renders only while the dialog is mounted, or always with keepMounted', async () => {
    const open = shallowRef(false);
    const keepMounted = shallowRef(false);
    await render(() => (
      <Dialog.Root open={open.value} modal={false}>
        <Dialog.Portal keepMounted={keepMounted.value} data-testid="portal">
          <Dialog.Viewport data-testid="viewport">
            <Dialog.Popup />
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
              <Dialog.Popup />
            </Dialog.Portal>
          </Dialog.Root>,
        );

        const portal = screen.getByTestId('portal');
        const backdrop = portal.querySelector(INTERNAL_BACKDROP_SELECTOR);
        expect(backdrop !== null).toBe(hasBackdrop);
        // The focus guards of the popup come before the popup, so the backdrop is the first child.
        expect(portal.firstElementChild === backdrop).toBe(hasBackdrop);
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
                      <Dialog.Popup />
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
        // The focus guards of the popup come before the popup, so the backdrop is the first child.
        expect(portal.firstElementChild === backdrop).toBe(hasBackdrop);
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
              <Dialog.Popup />
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
              <Dialog.Popup />
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
            <Dialog.Popup />
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
            <Dialog.Popup />
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

    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  describe('VUE-128: prop: disabled', () => {
    const guards = '[data-vase-ui-focus-guard]';

    function inertOf(...ids: string[]) {
      return ids.map((id) => screen.getByTestId(id).closest('[inert]') !== null);
    }

    function page(
      rootProps: {
        modal?: boolean | 'trap-focus';
        disablePointerDismissal?: boolean;
        onOpenChange?: (open: boolean, details: Dialog.Root.ChangeEventDetails) => void;
      } = {},
    ) {
      return (
        <div data-testid="host">
          <button data-testid="before">Before</button>
          <Dialog.Root defaultOpen modal={false} {...rootProps}>
            <Dialog.Portal disabled data-testid="portal">
              <Dialog.Backdrop
                data-testid="backdrop"
                style={rootProps.modal === true ? 'position:fixed;inset:0' : 'display:none'}
              />
              <Dialog.Popup data-testid="popup" style="position:relative">
                <Dialog.Title>Title</Dialog.Title>
                <button data-testid="inside">Inside</button>
                <Dialog.Close data-testid="close">Close</Dialog.Close>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          <button data-testid="after">After</button>
        </div>
      );
    }

    beforeEach(() => {
      onTestFinished(() => {
        expect(isScrollLocked()).toBe(false);
      });
    });

    it('renders the portal and its parts between the sibling buttons', async () => {
      await render(page());

      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(screen.getByTestId('host'));
      expect(portal.previousElementSibling).toBe(screen.getByTestId('before'));
      expect(portal.nextElementSibling).toBe(screen.getByTestId('after'));
      expect(portal).toContainElement(screen.getByTestId('popup'));
      expect(portal).toContainElement(screen.getByTestId('backdrop'));
    });

    it('does not read the container after the mount', async () => {
      const query = vi.spyOn(document, 'querySelector');
      await render(
        <Dialog.Root defaultOpen modal={false}>
          <Dialog.Portal disabled to="#unused-target">
            <Dialog.Popup />
          </Dialog.Portal>
        </Dialog.Root>,
      );
      await nextTick();
      await nextTick();

      expect(query).not.toHaveBeenCalledWith('#unused-target');
    });

    it.each([
      { name: 'modal', modal: true },
      { name: 'not modal', modal: false },
    ])('hydrates an open dialog in place with no message: $name', async ({ modal }) => {
      const serverHtml = await renderOnServer(
        'src/dialog/portal/DialogPortalInPlaceHydration.test.vue',
        { modal },
      );
      expect(serverHtml).toContain('role="dialog"');
      expect(serverHtml).not.toContain('teleport');

      await hydrate(DialogPortalInPlaceHydration, { serverHtml, props: { modal } });

      const portal = screen.getByTestId('portal');
      expect(portal.parentElement).toBe(screen.getByTestId('host'));
      expect(portal).toContainElement(screen.getByTestId('popup'));
      expect(screen.getByTestId('popup')).toHaveAttribute(
        'aria-labelledby',
        screen.getByTestId('title').id,
      );
    });

    it('keeps the natural tab order with no guards and no owner when not modal', async () => {
      await render(page({ disablePointerDismissal: true }));
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      expect(document.querySelectorAll(guards)).toHaveLength(0);
      expect(document.querySelector('[aria-owns]')).toBe(null);

      screen.getByTestId('before').focus();
      await userEvent.tab();
      expect(screen.getByTestId('inside')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('close')).toHaveFocus();
      await userEvent.tab();
      expect(screen.getByTestId('after')).toHaveFocus();
    });

    it('closes with focus-out when Tab leaves a popup that is not modal', async () => {
      const onOpenChange = vi.fn();
      await render(page({ onOpenChange }));
      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());

      screen.getByTestId('close').focus();
      await userEvent.tab();

      await waitFor(() => expect(popup).not.toBeInTheDocument());
      expect(screen.getByTestId('after')).toHaveFocus();
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: 'focus-out' }),
      );
    });

    it('keeps the content tabbable after focus leaves a popup that stays open', async () => {
      await render(page({ disablePointerDismissal: true }));
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      screen.getByTestId('close').focus();
      await userEvent.tab();
      expect(screen.getByTestId('after')).toHaveFocus();

      await userEvent.tab({ shift: true });

      expect(screen.getByTestId('close')).toHaveFocus();
      expect(screen.getByTestId('popup')).toBeInTheDocument();
    });

    it('updates the marks, focus trap and scroll lock when modal changes while open', async () => {
      const modal = shallowRef<boolean | 'trap-focus'>(false);
      const onOpenChange = vi.fn();
      await render(() => page({ modal: modal.value, disablePointerDismissal: true, onOpenChange }));
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      expect(inertOf('before', 'after', 'portal', 'popup')).toEqual([false, false, false, false]);
      expect(document.querySelectorAll(guards)).toHaveLength(0);
      expect(isScrollLocked()).toBe(false);

      modal.value = true;
      await waitFor(() => expect(inertOf('before', 'after')).toEqual([true, true]));
      expect(inertOf('portal', 'popup', 'backdrop')).toEqual([false, false, true]);
      expect(document.querySelectorAll(guards)).toHaveLength(2);
      await waitFor(() => expect(isScrollLocked()).toBe(true));
      screen.getByTestId('close').focus();
      await userEvent.tab();
      expect(screen.getByTestId('inside')).toHaveFocus();

      modal.value = 'trap-focus';
      await waitFor(() => expect(inertOf('before', 'after')).toEqual([false, false]));
      expect(document.querySelectorAll(guards)).toHaveLength(2);
      await waitFor(() => expect(isScrollLocked()).toBe(false));
      screen.getByTestId('close').focus();
      await userEvent.tab();
      expect(screen.getByTestId('inside')).toHaveFocus();

      modal.value = false;
      await waitFor(() => expect(document.querySelectorAll(guards)).toHaveLength(0));
      expect(inertOf('before', 'after')).toEqual([false, false]);
      expect(screen.getByTestId('before').closest('[aria-hidden]')).toBe(null);
      expect(screen.getByTestId('after').closest('[aria-hidden]')).toBe(null);
      expect(isScrollLocked()).toBe(false);
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'modal', modal: true },
      { name: 'not modal', modal: false },
    ])('closes on Escape: $name', async ({ modal }) => {
      const onOpenChange = vi.fn();
      await render(page({ modal, onOpenChange }));
      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());

      await userEvent.keyboard('{Escape}');

      await waitFor(() => expect(popup).not.toBeInTheDocument());
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: 'escape-key' }),
      );
    });

    it('closes a modal dialog on a real press on the internal backdrop', async () => {
      const onOpenChange = vi.fn();
      await render(page({ modal: true, onOpenChange }));
      const popup = screen.getByTestId('popup');
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      const hit = document.elementFromPoint(5, 300);
      expect(hit).toBe(screen.getByTestId('portal').querySelector(INTERNAL_BACKDROP_SELECTOR));
      expect(hit).not.toBe(null);

      await userEvent.click(document.body, { position: { x: 5, y: 300 } });

      await waitFor(() => expect(popup).not.toBeInTheDocument());
      expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(
        false,
        expect.objectContaining({ reason: 'outside-press' }),
      );
    });

    it('keeps a popup that is not modal open on outside press and Tab with disablePointerDismissal', async () => {
      const onOpenChange = vi.fn();
      await render(page({ disablePointerDismissal: true, onOpenChange }));
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      await userEvent.click(screen.getByTestId('before'));
      await wait(0);
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();

      screen.getByTestId('close').focus();
      await userEvent.tab();
      await wait(0);

      expect(screen.getByTestId('after')).toHaveFocus();
      expect(screen.getByTestId('popup')).toHaveAttribute('data-open');
      expect(onOpenChange).not.toHaveBeenCalled();
    });

    it.each([
      { name: 'in the popup', nested: true },
      { name: 'beside the dialog', nested: false },
    ])('releases modal marks and locks in order for an alert dialog $name', async ({ nested }) => {
      const modal = shallowRef<boolean | 'trap-focus'>(true);
      const alertOpen = shallowRef(false);
      const Alert = () => (
        <AlertDialog.Root
          open={alertOpen.value}
          onOpenChange={(open: boolean) => (alertOpen.value = open)}
        >
          <AlertDialog.Portal data-testid="alert-portal">
            <AlertDialog.Popup data-testid="alert">
              <AlertDialog.Title>Confirm</AlertDialog.Title>
              <AlertDialog.Close data-testid="alert-close">Cancel</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      );
      await render(() => (
        <div data-testid="host">
          <button data-testid="before">Before</button>
          <Dialog.Root defaultOpen modal={modal.value}>
            <Dialog.Portal disabled data-testid="portal">
              <Dialog.Popup data-testid="popup">
                <Dialog.Title>Title</Dialog.Title>
                <button data-testid="inside">Inside</button>
                {nested ? <Alert /> : null}
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
          {nested ? null : <Alert />}
          <button data-testid="after">After</button>
        </div>
      ));
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      expect(inertOf('before', 'after', 'popup')).toEqual([true, true, false]);
      await waitFor(() => expect(isScrollLocked()).toBe(true));

      await waitForLaterMillisecond(() => {
        alertOpen.value = true;
      });
      await waitFor(() => expect(screen.getByTestId('alert-close')).toHaveFocus());
      const alert = screen.getByTestId('alert');
      expect(screen.getByTestId('alert-portal').parentElement).toBe(
        nested ? screen.getByTestId('portal') : document.body,
      );
      expect(inertOf('before', 'after', 'popup', 'alert')).toEqual([true, true, true, false]);
      await waitFor(() => expect(isScrollLocked()).toBe(true));

      await userEvent.keyboard('{Escape}');
      await waitFor(() => expect(alert).not.toBeInTheDocument());
      expect(inertOf('before', 'after', 'popup')).toEqual([true, true, false]);
      await waitFor(() =>
        expect(screen.getByTestId('popup')).toContainElement(document.activeElement as HTMLElement),
      );
      await waitFor(() => expect(isScrollLocked()).toBe(true));

      modal.value = false;
      await waitFor(() =>
        expect(inertOf('before', 'after', 'popup')).toEqual([false, false, false]),
      );
      await waitFor(() => expect(isScrollLocked()).toBe(false));
      expect(document.querySelector('[inert]')).toBe(null);
    });

    // Select is on the popup layer and Dialog is not, so the two do not know each other. The change
    // that moves Dialog to the popup layer restores the case.
    it.skip('keeps a nested Select portal inside the dialog portal and free of inert', async () => {
      await render(
        <Dialog.Root defaultOpen>
          <Dialog.Portal disabled data-testid="portal">
            <Dialog.Popup>
              <Select.Root defaultOpen>
                <Select.Trigger>
                  <Select.Value />
                </Select.Trigger>
                <Select.Portal data-testid="select-portal">
                  <Select.Positioner>
                    <Select.Popup>
                      <Select.Item value="a" data-testid="item">
                        A
                      </Select.Item>
                    </Select.Popup>
                  </Select.Positioner>
                </Select.Portal>
              </Select.Root>
            </Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );
      const item = await screen.findByRole('option');

      expect(screen.getByTestId('select-portal').parentElement).toBe(screen.getByTestId('portal'));
      expect(item.closest('[inert]')).toBe(null);
    });

    it.each([
      { name: 'modal', modal: true },
      { name: 'not modal', modal: false },
    ])(
      'mounts the parts again and keeps the dialog open when disabled changes: $name',
      async ({ modal }) => {
        const disabled = shallowRef(true);
        const onOpenChange = vi.fn();
        await render(() => (
          <div data-testid="host">
            <Dialog.Root
              defaultOpen
              modal={modal}
              disablePointerDismissal
              onOpenChange={onOpenChange}
            >
              <Dialog.Portal disabled={disabled.value} data-testid="portal">
                <Dialog.Popup data-testid="popup">
                  <input data-testid="input" />
                </Dialog.Popup>
              </Dialog.Portal>
            </Dialog.Root>
            <button data-testid="after">After</button>
          </div>
        ));
        await waitFor(() => expect(screen.getByTestId('input')).toHaveFocus());
        const first = screen.getByTestId('popup');
        screen.getByTestId<HTMLInputElement>('input').value = 'typed';

        disabled.value = false;
        await waitFor(() => expect(screen.getByTestId('portal').parentElement).toBe(document.body));
        const second = screen.getByTestId('popup');
        expect(second).not.toBe(first);
        expect(first).not.toBeInTheDocument();
        expect(second).toHaveAttribute('data-open');
        expect(screen.getByTestId('input')).toHaveValue('');
        await waitFor(() => expect(screen.getByTestId('input')).toHaveFocus());
        expect(inertOf('after')).toEqual([modal]);
        expect(document.querySelectorAll(guards)).toHaveLength(modal ? 2 : 4);

        disabled.value = true;
        await waitFor(() =>
          expect(screen.getByTestId('portal').parentElement).toBe(screen.getByTestId('host')),
        );
        const third = screen.getByTestId('popup');
        expect(third).not.toBe(second);
        expect(second).not.toBeInTheDocument();
        expect(third).toHaveAttribute('data-open');
        await waitFor(() => expect(screen.getByTestId('input')).toHaveFocus());
        expect(inertOf('after')).toEqual([modal]);
        expect(document.querySelectorAll(guards)).toHaveLength(modal ? 2 : 0);
        await waitFor(() => expect(isScrollLocked()).toBe(modal));
        expect(onOpenChange).not.toHaveBeenCalled();
      },
    );

    it('takes the popup and the modal marks out of the document with KeepAlive', async () => {
      const { HeldBranch, hide, show } = createHeldBranch(
        () => (
          <Dialog.Root defaultOpen>
            <Dialog.Portal disabled>
              <Dialog.Popup data-testid="popup">
                <button data-testid="inside">Inside</button>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        ),
        { mounted: true },
      );
      await render(
        <div>
          <button data-testid="outside">Outside</button>
          <HeldBranch />
        </div>,
      );
      await waitFor(() => expect(screen.getByTestId('inside')).toHaveFocus());
      const popup = screen.getByTestId('popup');
      expect(inertOf('outside')).toEqual([true]);

      await hide();

      expect(popup).not.toBeInTheDocument();
      expect(inertOf('outside')).toEqual([false]);
      expect(screen.getByTestId('outside').closest('[aria-hidden]')).toBe(null);

      await show();

      expect(screen.getByTestId('popup')).toBe(popup);
      await waitFor(() => expect(inertOf('outside')).toEqual([true]));
      await waitFor(() => expect(popup).toContainElement(document.activeElement as HTMLElement));
    });

    it('renders the consumer element and children of the render slot in place', async () => {
      await render(
        <div data-testid="host">
          <Dialog.Root defaultOpen>
            <Dialog.Portal
              disabled
              v-slots={{
                render: ({ props, children }: RenderSlotProps) => (
                  <section {...props} data-testid="portal">
                    {h(children, null, () => (
                      <Dialog.Popup data-testid="popup" />
                    ))}
                  </section>
                ),
              }}
            />
          </Dialog.Root>
        </div>,
      );
      const portal = screen.getByTestId('portal');

      expect(portal.localName).toBe('section');
      expect(portal.parentElement).toBe(screen.getByTestId('host'));
      expect(portal).toContainElement(screen.getByTestId('popup'));
      expect(portal.querySelector(INTERNAL_BACKDROP_SELECTOR)).not.toBe(null);
    });

    it('gives the portal element the scope id, the directives and the transition of the consumer', async () => {
      const onBeforeLeave = vi.fn();
      const { setProps } = await render(
        <DialogPortalInPlaceScoped visible onBeforeLeave={onBeforeLeave} />,
      );
      const portal = screen.getByTestId('portal');
      expect(portal).toHaveStyle({ outlineStyle: 'dashed' });
      expect(portal).toHaveAttribute('data-marked');
      expect(portal).toBeVisible();

      await setProps({ visible: false });

      expect(portal).toHaveStyle({ display: 'none' });
      expect(portal).not.toBeVisible();
      expect(onBeforeLeave).toHaveBeenCalledExactlyOnceWith(portal);
      await setProps({ visible: true });
      expect(portal).toBeVisible();
    });
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and a later case of the file can then get a warning about a slot.
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
