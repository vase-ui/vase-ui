import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, h } from 'vue';
import type { PropType } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  takeReportedMessages,
} from '#test-utils';
import * as Dialog from '../../dialog/index.parts';
import { useDialogRootContext } from '../../dialog/root/DialogRootContext';
import type { DialogStore } from '../../dialog/store/DialogStore';
import { REASONS } from '../../internals/reasons';
import * as AlertDialog from '../index.parts';
import AlertDialogRootHydration from './AlertDialogRootHydration.test.vue';

type Store = DialogStore<unknown>;

// Gives the store of the root above it to the test, as each part of the family reads it.
const StoreProbe = defineComponent({
  props: { onStore: { type: Function as PropType<(store: Store) => void>, required: true } },
  setup(props) {
    props.onStore(useDialogRootContext());
    return () => null;
  },
});

// The popup element of an alert dialog, with the props and the role that the root gives to its popup.
const PopupElement = defineComponent({
  inheritAttrs: false,
  setup(_, { attrs, slots }) {
    const store = useDialogRootContext();
    return () =>
      store.select('mounted')
        ? h(
            'div',
            {
              ...store.select('popupProps'),
              ...attrs,
              role: store.select('role'),
              ref: (element) => {
                store.context.popupRef.value = element as HTMLElement | null;
                store.set('popupElement', element as HTMLElement | null);
              },
            },
            slots.default?.(),
          )
        : null;
  },
});

// The backdrop element of an alert dialog. The dismissal code reads its element from `backdropRef`.
const BackdropElement = defineComponent({
  setup() {
    const store = useDialogRootContext();
    return () =>
      h('div', {
        'data-testid': 'backdrop',
        ref: (element) => {
          store.context.backdropRef.value = element as HTMLDivElement | null;
        },
      });
  },
});

describe('<AlertDialog.Root />', () => {
  const { render } = createRenderer();

  describe('state of the root in the store', () => {
    it.each([
      { name: 'a root', handle: undefined },
      { name: 'a root with a handle', handle: AlertDialog.createHandle() },
    ])('gives the alert dialog state of $name to the store', async ({ handle }) => {
      let store!: Store;
      await render(() => (
        <AlertDialog.Root handle={handle}>
          <StoreProbe onStore={(value) => (store = value)} />
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
          <StoreProbe onStore={(value) => (dialog = value)} />
          <AlertDialog.Root defaultOpen>
            <StoreProbe onStore={(value) => (alertDialog = value)} />
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
          <StoreProbe onStore={(value) => (store = value)} />
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
          <PopupElement />
        </AlertDialog.Root>
      ));

      root.close();
      await flushMicrotasks();

      expect(calls).toEqual([
        `openChange false ${REASONS.imperativeAction}`,
        'update:open false',
        'openChangeComplete false',
      ]);
      expect(screen.queryByRole('alertdialog')).toBe(null);
    });

    it('keeps the popup mounted after preventUnmountOnClose() until the exposed unmount()', async () => {
      let root!: AlertDialog.Root.Actions;
      await render(() => (
        <AlertDialog.Root
          ref={(instance: unknown) => {
            root = instance as AlertDialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_, eventDetails) => eventDetails.preventUnmountOnClose()}
        >
          <PopupElement />
        </AlertDialog.Root>
      ));

      root.close();
      await flushMicrotasks();
      expect(screen.queryByRole('alertdialog')).not.toBe(null);

      root.unmount();
      await flushMicrotasks();
      expect(screen.queryByRole('alertdialog')).toBe(null);
    });
  });

  describe('handle', () => {
    it('gives the payload of openWithPayload() to the default slot, and isOpen follows the root', async () => {
      const handle = AlertDialog.createHandle<number>();
      const isOpen = computed(() => handle.isOpen);
      await render(() => (
        <AlertDialog.Root handle={handle}>
          {{
            default: ({ payload }: { payload: number | undefined }) => (
              <span data-testid="payload">{String(payload)}</span>
            ),
          }}
        </AlertDialog.Root>
      ));
      expect(isOpen.value).toBe(false);

      handle.openWithPayload(7);
      await flushMicrotasks();
      expect(screen.getByTestId('payload').textContent).toBe('7');
      expect(isOpen.value).toBe(true);

      handle.close();
      await flushMicrotasks();
      expect(isOpen.value).toBe(false);
    });

    it('takes only a handle of Alert Dialog', () => {
      const dialogHandle = Dialog.createHandle<number>();
      const alertDialogHandle = AlertDialog.createHandle<number>();

      // @ts-expect-error A handle of Dialog is not a handle of Alert Dialog.
      const fromDialog: AlertDialog.Handle<number> = dialogHandle;
      const forDialog: Dialog.Handle<number> = alertDialogHandle;

      // @ts-expect-error A root of Alert Dialog takes no handle of Dialog.
      const rootWithDialogHandle = <AlertDialog.Root handle={dialogHandle} />;

      expect(fromDialog).toBeInstanceOf(Dialog.Handle);
      expect(forDialog).toBeInstanceOf(AlertDialog.Handle);
      expect(rootWithDialogHandle.props?.handle).toBe(dialogHandle);
      expect(Object.keys(alertDialogHandle)).toEqual(Object.keys(dialogHandle));
    });
  });

  describe('dismissal', () => {
    it('closes on the Escape key', async () => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <PopupElement />
        </AlertDialog.Root>
      ));

      await fireEvent.keyDown(screen.getByRole('alertdialog'), { key: 'Escape' });

      expect(screen.queryByRole('alertdialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });

    it.each([
      { name: 'outside', target: 'outside', backdrop: false },
      { name: 'on its backdrop', target: 'backdrop', backdrop: true },
    ])('stays open for a press $name', async ({ target, backdrop }) => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <button data-testid="outside">outside</button>
          <AlertDialog.Root defaultOpen onOpenChange={handleOpenChange}>
            {backdrop ? <BackdropElement /> : null}
            <PopupElement />
          </AlertDialog.Root>
        </div>
      ));
      const element = screen.getByTestId(target);

      await fireEvent.pointerDown(element, { pointerType: 'mouse', button: 0 });
      await fireEvent.click(element, { detail: 1 });

      expect(screen.queryByRole('alertdialog')).not.toBe(null);
      expect(handleOpenChange.mock.calls.length).toBe(0);
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
