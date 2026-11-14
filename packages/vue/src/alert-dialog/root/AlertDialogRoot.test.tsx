import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, shallowRef } from 'vue';
import {
  createRenderer,
  detachedTriggersConformanceTests,
  dialogRootSharedTests,
  fireEvent,
  flushMicrotasks,
  hydrate,
  popupConformanceTests,
  renderOnServer,
  screen,
  takeReportedMessages,
  waitFor,
  within,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import * as Dialog from '../../dialog/index.parts';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import * as AlertDialog from '../index.parts';
import AlertDialogRootHydration from './AlertDialogRootHydration.test.vue';

type Store = DialogStore<unknown>;

const AlertDialogState = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs }) {
    const store = useDialogRootContext();
    const modal = computed(() => store.select('modal'));
    const disablePointerDismissal = computed(() => store.select('disablePointerDismissal'));
    const role = computed(() => store.select('role'));

    return () => (
      <div
        {...attrs}
        data-modal={modal.value}
        data-disable-pointer-dismissal={disablePointerDismissal.value}
        data-role={role.value}
      />
    );
  },
});

describe('<AlertDialog.Root />', () => {
  const { render } = createRenderer();

  popupConformanceTests({
    createComponent: (props) => (
      <AlertDialog.Root {...props.root}>
        <AlertDialog.Trigger {...props.trigger}>Open dialog</AlertDialog.Trigger>
        <AlertDialog.Portal {...props.portal}>
          <AlertDialog.Popup {...props.popup}>Dialog</AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>
    ),
    render,
    triggerMouseAction: 'click',
    expectedPopupRole: 'alertdialog',
    expectedAriaHasPopupValue: 'dialog',
  });

  dialogRootSharedTests({ parts: AlertDialog, popupRole: 'alertdialog', render });

  detachedTriggersConformanceTests({
    render,
    createHandle: AlertDialog.createHandle,
    Root: AlertDialog.Root,
    Trigger: AlertDialog.Trigger,
    Portal: AlertDialog.Portal,
    Popup: AlertDialog.Popup,
    Close: AlertDialog.Close,
    openInteractions: ['click'],
    ariaExpanded: true,
    throwOnMissingTrigger: false,
    outsideElementsInert: true,
  });

  it('ARIA attributes', async () => {
    await render(
      <AlertDialog.Root open>
        <AlertDialog.Trigger />
        <AlertDialog.Portal>
          <AlertDialog.Backdrop />
          <AlertDialog.Popup>
            <AlertDialog.Title>title text</AlertDialog.Title>
            <AlertDialog.Description>description text</AlertDialog.Description>
          </AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );
    await flushMicrotasks();

    const popup = screen.queryByRole('alertdialog');
    expect(popup).not.toBe(null);

    expect(screen.getByText('title text').getAttribute('id')).toBe(
      popup?.getAttribute('aria-labelledby'),
    );
    expect(screen.getByText('description text').getAttribute('id')).toBe(
      popup?.getAttribute('aria-describedby'),
    );
  });

  it('synchronizes trigger ARIA attributes when initially open with a handle', async () => {
    const handle = AlertDialog.createHandle();

    await render(
      <AlertDialog.Root handle={handle} defaultOpen defaultTriggerId="trigger">
        <AlertDialog.Trigger id="trigger">Open</AlertDialog.Trigger>
        <AlertDialog.Portal>
          <AlertDialog.Popup>Dialog</AlertDialog.Popup>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );
    await flushMicrotasks();

    const trigger = screen.getByText('Open');
    const popup = screen.getByRole('alertdialog');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
  });

  it('synchronizes detached trigger ARIA attributes when initially open with a handle', async () => {
    const handle = AlertDialog.createHandle();

    await render(
      <>
        <AlertDialog.Trigger handle={handle} id="trigger">
          Open
        </AlertDialog.Trigger>
        <AlertDialog.Root handle={handle} defaultOpen defaultTriggerId="trigger">
          <AlertDialog.Portal>
            <AlertDialog.Popup>Dialog</AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </>,
    );
    await flushMicrotasks();

    const trigger = screen.getByText('Open');
    const popup = screen.getByRole('alertdialog');

    expect(trigger).toHaveAttribute('aria-expanded', 'true');
    expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));
    expect(handle.isOpen).toBe(true);
  });

  it('does not re-render inactive detached triggers when the popup opens and closes', async () => {
    const handle = AlertDialog.createHandle();
    const bystander = { renders: 0 };

    const { user } = await render(
      <div>
        <AlertDialog.Trigger handle={handle} id="trigger-1">
          Trigger 1
        </AlertDialog.Trigger>
        <AlertDialog.Trigger
          handle={handle}
          id="trigger-2"
          v-slots={{
            render: ({ props }: { props: HTMLProps }) => {
              bystander.renders += 1;
              return <button {...props}>Trigger 2</button>;
            },
          }}
        />
        <AlertDialog.Root handle={handle}>
          <AlertDialog.Portal>
            <AlertDialog.Popup data-testid="popup">
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>
      </div>,
    );

    const trigger = screen.getByRole('button', { name: 'Trigger 1' });

    async function openAndClose() {
      await user.click(trigger);
      expect(await screen.findByTestId('popup')).not.toBe(null);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');
      await user.click(screen.getByRole('button', { name: 'Close' }));
      await waitFor(() => {
        expect(screen.queryByTestId('popup')).toBe(null);
      });
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    }

    bystander.renders = 0;
    await openAndClose();
    await openAndClose();
    expect(bystander.renders).toBe(0);
  });

  it('renders a viewport', async () => {
    await render(
      <AlertDialog.Root open>
        <AlertDialog.Portal>
          <AlertDialog.Viewport data-testid="viewport">
            <AlertDialog.Popup>Dialog</AlertDialog.Popup>
          </AlertDialog.Viewport>
        </AlertDialog.Portal>
      </AlertDialog.Root>,
    );
    await flushMicrotasks();

    expect(screen.getByTestId('viewport')).toContain(screen.getByRole('alertdialog'));
  });

  describe('prop: onOpenChange', () => {
    it('does not close when the backdrop is clicked', async () => {
      const handleOpenChange = vi.fn();

      const { user } = await render(
        <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <AlertDialog.Trigger>Open</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );
      await flushMicrotasks();

      await user.click(screen.getByRole('presentation', { hidden: true }));

      expect(handleOpenChange.mock.calls.length).toBe(0);
      expect(screen.queryByRole('alertdialog')).not.toBe(null);
    });

    it('keeps the trigger data-popup-open attribute and handle.isOpen when a controlled close is vetoed', async () => {
      const handle = AlertDialog.createHandle();

      const TestCase = defineComponent(() => {
        const open = shallowRef(false);

        return () => (
          <AlertDialog.Root
            handle={handle}
            open={open.value}
            onOpenChange={(nextOpen) => {
              if (nextOpen) {
                open.value = true;
              }
            }}
          >
            <AlertDialog.Trigger>Open</AlertDialog.Trigger>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Title>Confirm</AlertDialog.Title>
                <AlertDialog.Close>Cancel</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        );
      });

      const { user } = await render(<TestCase />);

      const trigger = screen.getByRole('button', { name: 'Open' });
      await user.click(trigger);

      await screen.findByRole('alertdialog');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('button', { name: 'Cancel' }));

      expect(screen.getByRole('alertdialog')).toHaveAttribute('data-open');
      expect(trigger).toHaveAttribute('data-popup-open');
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('handle-backed roots', () => {
    it('rewires the trigger and keeps pointer dismissal disabled after the root remounts while open', async () => {
      const testDialog = AlertDialog.createHandle();

      const App = defineComponent(() => {
        const mounted = shallowRef(true);

        return () => (
          <div>
            <AlertDialog.Trigger handle={testDialog} id="trigger">
              Trigger
            </AlertDialog.Trigger>
            {!mounted.value && (
              <button type="button" onClick={() => (mounted.value = true)}>
                Remount root
              </button>
            )}

            {mounted.value && (
              <AlertDialog.Root handle={testDialog}>
                <AlertDialog.Portal>
                  <AlertDialog.Popup>
                    Alert dialog content
                    <button type="button" onClick={() => (mounted.value = false)}>
                      Unmount root
                    </button>
                  </AlertDialog.Popup>
                </AlertDialog.Portal>
              </AlertDialog.Root>
            )}
          </div>
        );
      });

      const { user } = await render(<App />);
      const trigger = screen.getByRole('button', { name: 'Trigger' });

      await user.click(trigger);

      let popup = await screen.findByRole('alertdialog');
      expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));

      await user.click(within(popup).getByRole('button', { name: 'Unmount root' }));
      expect(screen.queryByRole('alertdialog')).toBe(null);

      await user.click(screen.getByRole('button', { name: 'Remount root' }));
      expect(screen.queryByRole('alertdialog')).toBe(null);

      await user.click(trigger);

      popup = await screen.findByRole('alertdialog');
      expect(trigger.getAttribute('aria-controls')).toBe(popup.getAttribute('id'));

      await user.click(screen.getByRole('presentation', { hidden: true }));
      await flushMicrotasks();

      expect(screen.queryByRole('alertdialog')).not.toBe(null);
      expect(testDialog.isOpen).toBe(true);
    });

    it('enforces alert dialog state for handle-backed roots', async () => {
      const handle = AlertDialog.createHandle();

      const { user } = await render(
        <>
          <AlertDialog.Trigger handle={handle}>Open</AlertDialog.Trigger>
          <AlertDialog.Root handle={handle}>
            <AlertDialogState data-testid="alert-dialog-state" />
            <AlertDialog.Portal>
              <AlertDialog.Popup>Content</AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </>,
      );

      expect(screen.getByTestId('alert-dialog-state')).toHaveAttribute('data-modal', 'true');
      expect(screen.getByTestId('alert-dialog-state')).toHaveAttribute(
        'data-disable-pointer-dismissal',
        'true',
      );
      expect(screen.getByTestId('alert-dialog-state')).toHaveAttribute('data-role', 'alertdialog');

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(await screen.findByRole('alertdialog')).not.toBe(null);
      expect(handle.isOpen).toBe(true);

      await user.click(screen.getByRole('presentation', { hidden: true }));
      await flushMicrotasks();

      expect(screen.queryByRole('alertdialog')).not.toBe(null);
      expect(handle.isOpen).toBe(true);
    });
  });

  describe('modality', () => {
    it('makes other interactive elements on the page inert when a modal dialog is open', async () => {
      await render(
        <AlertDialog.Root defaultOpen>
          <AlertDialog.Trigger>Open Dialog</AlertDialog.Trigger>
          <AlertDialog.Portal>
            <AlertDialog.Popup>
              <AlertDialog.Close>Close Dialog</AlertDialog.Close>
            </AlertDialog.Popup>
          </AlertDialog.Portal>
        </AlertDialog.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByRole('presentation', { hidden: true })).not.toBe(null);
    });
  });

  describe('state of the root in the store', () => {
    it('gives the alert dialog state to the store', async () => {
      let store!: Store;
      await render(() => (
        <AlertDialog.Root>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </AlertDialog.Root>
      ));

      expect(store.select('role')).toBe('alertdialog');
      expect(store.select('modal')).toBe(true);
      expect(store.select('disablePointerDismissal')).toBe(true);
      expect(store.select('nested')).toBe(false);
    });

    it('counts in the dialog above it, and a dialog counts in it', async () => {
      let dialog!: Store;
      let alertDialog!: Store;
      await render(() => (
        <Dialog.Root defaultOpen>
          <DialogStoreProbe onStore={(value) => (dialog = value)} />
          <AlertDialog.Root defaultOpen>
            <DialogStoreProbe onStore={(value) => (alertDialog = value)} />
            <Dialog.Root defaultOpen />
          </AlertDialog.Root>
        </Dialog.Root>
      ));

      expect(alertDialog.select('nested')).toBe(true);
      expect(alertDialog.select('nestedOpenDialogCount')).toBe(1);
      expect(dialog.select('nestedOpenDialogCount')).toBe(2);
      expect(dialog.select('nestedOpenDrawerCount')).toBe(0);
    });

    it('has no modal prop and no disablePointerDismissal prop', async () => {
      let store!: Store;
      await render(() => (
        <AlertDialog.Root modal={false} disablePointerDismissal={false}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </AlertDialog.Root>
      ));

      expect(store.select('modal')).toBe(true);
      expect(store.select('disablePointerDismissal')).toBe(true);
      expect(takeReportedMessages()).toEqual([
        expect.stringContaining('Extraneous non-props attributes (modal, disablePointerDismissal)'),
      ]);
    });
  });

  describe('open state', () => {
    it('emits openChange, then update:open, then openChangeComplete for the exposed close()', async () => {
      const calls: string[] = [];
      let root!: AlertDialog.Root.Actions;
      await render(() => (
        <AlertDialog.Root
          ref={(instance: unknown) => {
            root = instance as AlertDialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(open, eventDetails) =>
            calls.push(`openChange ${open} ${eventDetails.reason}`)
          }
          {...{ 'onUpdate:open': (open: boolean) => calls.push(`update:open ${open}`) }}
          onOpenChangeComplete={(open) => calls.push(`openChangeComplete ${open}`)}
        >
          <AlertDialog.Portal>
            <AlertDialog.Popup />
          </AlertDialog.Portal>
        </AlertDialog.Root>
      ));
      await flushMicrotasks();
      expect(calls).toEqual(['openChangeComplete true']);
      calls.length = 0;

      root.close();
      await flushMicrotasks();

      expect(calls).toEqual([
        `openChange false ${REASONS.imperativeAction}`,
        'update:open false',
        'openChangeComplete false',
      ]);
      expect(screen.queryByRole('alertdialog')).toBe(null);
    });
  });

  describe('handle', () => {
    it('creates a handle of Alert Dialog that is a handle of Dialog with no property of its own', () => {
      const dialogHandle = Dialog.createHandle<number>();
      const alertDialogHandle = AlertDialog.createHandle<number>();
      const forDialog: Dialog.Handle<number> = alertDialogHandle;

      expect(alertDialogHandle).toBeInstanceOf(AlertDialog.Handle);
      expect(forDialog).toBeInstanceOf(Dialog.Handle);
      expect(Object.keys(alertDialogHandle)).toEqual(Object.keys(dialogHandle));
    });

    it('detaches from its handle and the document while KeepAlive holds it, and attaches again after', async () => {
      const handle = AlertDialog.createHandle();
      const handleOpenChange = vi.fn();
      const show = shallowRef(true);
      const AlertDialogPart = defineComponent({
        name: 'AlertDialogPart',
        setup: () => () => (
          <AlertDialog.Root handle={handle} defaultOpen onOpenChange={handleOpenChange}>
            <AlertDialog.Portal>
              <AlertDialog.Popup>
                <AlertDialog.Close>Close</AlertDialog.Close>
              </AlertDialog.Popup>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        ),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>
          {show.value ? <AlertDialogPart key="alert-dialog" /> : <Other key="other" />}
        </KeepAlive>
      ));
      await flushMicrotasks();
      expect(screen.queryByRole('alertdialog')).not.toBe(null);
      expect(handle.isOpen).toBe(true);

      show.value = false;
      await flushMicrotasks();
      expect(screen.queryByRole('alertdialog')).toBe(null);
      expect(handle.isOpen).toBe(false);
      await fireEvent.keyDown(document.body, { key: 'Escape' });
      expect(handleOpenChange.mock.calls.length).toBe(0);

      show.value = true;
      await flushMicrotasks();
      expect(handle.isOpen).toBe(true);
      await fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });
      expect(screen.queryByRole('alertdialog')).toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(1);
    });
  });

  describe('dismissal', () => {
    it('closes on the Escape key', async () => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <AlertDialog.Portal>
            <AlertDialog.Popup />
          </AlertDialog.Portal>
        </AlertDialog.Root>
      ));
      await flushMicrotasks();

      await fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

      expect(screen.queryByRole('alertdialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });
  });

  describe('server render', () => {
    it('hydrates an open root in an open dialog, with no message', async () => {
      const serverHtml = await renderOnServer(
        'src/alert-dialog/root/AlertDialogRootHydration.test.vue',
        {},
      );

      await hydrate(AlertDialogRootHydration, { serverHtml });
    });
  });
});
