import { describe, expect, it, vi } from 'vitest';
import { KeepAlive, computed, defineComponent, onMounted, shallowRef } from 'vue';
import {
  createRenderer,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  wait,
  waitFor,
} from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import {
  createScrollDocument,
  getScrollLockRegistry,
  isPageLocked,
} from '../../../test/fixtures/scrollDocument';
import type { ScrollDocument } from '../../../test/fixtures/scrollDocument';
import { REASONS } from '../../internals/reasons';
import * as Dialog from '../index.parts';
import { DialogStore } from '../store/DialogStore';
import DialogRootHydration from './DialogRootHydration.test.vue';
import { useDialogInteractions } from './useDialogRoot';

type Store = DialogStore<unknown>;

describe('<Dialog.Root />', () => {
  const { render } = createRenderer();

  it('reports nested drawer counts before passive effects', async () => {
    const childStore = new DialogStore(
      { open: true, mounted: true, modal: false, disablePointerDismissal: false },
      undefined,
    );
    const parentStore = new DialogStore(undefined, undefined);
    let taskAfterMountRan = false;
    let taskAfterUnmountRan = false;
    let mountedBeforeTask: boolean | null = null;
    let unmountedBeforeTask: boolean | null = null;
    let phase: 'mount' | 'teardown' = 'mount';

    Object.assign(parentStore.context, {
      onNestedDialogOpen(dialogCount: number, drawerCount: number) {
        if (drawerCount > 0 && mountedBeforeTask === null) {
          mountedBeforeTask = !taskAfterMountRan;
        }
        if (
          phase === 'teardown' &&
          dialogCount === 0 &&
          drawerCount === 0 &&
          unmountedBeforeTask === null
        ) {
          unmountedBeforeTask = !taskAfterUnmountRan;
        }
      },
    });

    const TaskBoundary = defineComponent({
      setup() {
        onMounted(() => {
          setTimeout(() => {
            taskAfterMountRan = true;
          });
        });
        return () => null;
      },
    });
    const Interactions = defineComponent({
      setup() {
        useDialogInteractions({
          store: childStore,
          parentContext: parentStore.context,
          isDrawer: true,
        });
        return () => null;
      },
    });

    const { unmount } = await render(() => (
      <div>
        <TaskBoundary />
        <Interactions />
      </div>
    ));

    expect(mountedBeforeTask).toBe(true);

    phase = 'teardown';
    setTimeout(() => {
      taskAfterUnmountRan = true;
    });
    unmount();
    await flushMicrotasks();

    expect(unmountedBeforeTask).toBe(true);
  });

  describe('open state', () => {
    it('emits openChange and then update:open', async () => {
      const calls: string[] = [];
      let root!: Dialog.Root.Actions;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(open, eventDetails) =>
            calls.push(`openChange ${open} ${eventDetails.reason}`)
          }
          {...{ 'onUpdate:open': (open: boolean) => calls.push(`update:open ${open}`) }}
          onOpenChangeComplete={(open) => calls.push(`openChangeComplete ${open}`)}
        >
          <DialogPopupPart />
        </Dialog.Root>
      ));

      root.close();
      await flushMicrotasks();

      expect(calls).toEqual([
        `openChange false ${REASONS.imperativeAction}`,
        'update:open false',
        'openChangeComplete false',
      ]);
    });

    it('does not emit update:open for a change that a listener cancels', async () => {
      const handleUpdate = vi.fn();
      let root!: Dialog.Root.Actions;
      let store!: Store;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.cancel()}
          {...{ 'onUpdate:open': handleUpdate }}
        >
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      root.close();
      await flushMicrotasks();

      expect(handleUpdate).not.toHaveBeenCalled();
      expect(store.select('open')).toBe(true);
    });

    it('keeps the popup mounted after preventUnmountOnClose() until the unmount action', async () => {
      const handleComplete = vi.fn();
      let root!: Dialog.Root.Actions;
      let store!: Store;
      await render(() => (
        <Dialog.Root
          ref={(instance: unknown) => {
            root = instance as Dialog.Root.Actions;
          }}
          defaultOpen
          onOpenChange={(_open, eventDetails) => eventDetails.preventUnmountOnClose()}
          onOpenChangeComplete={handleComplete}
        >
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <DialogPopupPart />
        </Dialog.Root>
      ));

      root.close();
      await flushMicrotasks();
      expect(store.select('open')).toBe(false);
      expect(store.select('mounted')).toBe(true);
      expect(handleComplete).not.toHaveBeenCalled();

      root.unmount();
      await flushMicrotasks();
      expect(store.select('mounted')).toBe(false);
      expect(handleComplete.mock.calls).toEqual([[false]]);
    });
  });

  describe('state of the root in the store', () => {
    it.each([
      { name: 'no modal prop', props: {}, modal: true },
      { name: 'a bare modal attribute', props: { modal: '' }, modal: true },
      { name: 'modal false', props: { modal: false }, modal: false },
      { name: 'modal trap-focus', props: { modal: 'trap-focus' }, modal: 'trap-focus' },
    ])('gives $name to the store', async ({ props, modal }) => {
      let store!: Store;
      await render(() => (
        <Dialog.Root {...(props as object)}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      expect(store.select('modal')).toBe(modal);
      expect(store.select('role')).toBe('dialog');
      expect(store.select('nested')).toBe(false);
      expect(store.select('disablePointerDismissal')).toBe(false);
    });

    it('follows a change of modal and of disablePointerDismissal', async () => {
      let store!: Store;
      const modal = shallowRef<boolean | 'trap-focus'>(true);
      const disablePointerDismissal = shallowRef(false);
      await render(() => (
        <Dialog.Root modal={modal.value} disablePointerDismissal={disablePointerDismissal.value}>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));

      modal.value = 'trap-focus';
      disablePointerDismissal.value = true;
      await flushMicrotasks();

      expect(store.select('modal')).toBe('trap-focus');
      expect(store.select('disablePointerDismissal')).toBe(true);
    });

    it('clears the open method when the dialog closes', async () => {
      const handle = Dialog.createHandle();
      let store!: Store;
      await render(() => (
        <Dialog.Root handle={handle} defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
        </Dialog.Root>
      ));
      store.set('openMethod', 'touch');

      handle.close();
      await flushMicrotasks();

      expect(store.select('openMethod')).toBe(null);
    });

    it('gives the popup element as the positioner element', async () => {
      let store!: Store;
      await render(() => (
        <Dialog.Root defaultOpen>
          <DialogStoreProbe onStore={(value) => (store = value)} />
          <DialogPopupPart />
        </Dialog.Root>
      ));

      expect(store.select('positionerElement')).toBe(screen.getByRole('dialog'));
    });
  });

  describe('handle', () => {
    it('gives the payload of openWithPayload() to the default slot, and isOpen follows the root', async () => {
      const handle = Dialog.createHandle<number>();
      // The computed reads `isOpen` before a root attaches. It follows the root only when `isOpen`
      // depends on the pointer of the handle.
      const isOpen = computed(() => handle.isOpen);
      expect(isOpen.value).toBe(false);
      await render(() => (
        <Dialog.Root handle={handle}>
          {{
            default: ({ payload }: { payload: number | undefined }) => (
              <span data-testid="payload">{String(payload)}</span>
            ),
          }}
        </Dialog.Root>
      ));
      expect(screen.getByTestId('payload').textContent).toBe('undefined');
      expect(isOpen.value).toBe(false);

      handle.openWithPayload(7);
      await flushMicrotasks();
      expect(screen.getByTestId('payload').textContent).toBe('7');
      expect(isOpen.value).toBe(true);

      handle.close();
      await flushMicrotasks();
      expect(isOpen.value).toBe(false);
    });

    it('opens with no trigger and warns when open() names an id that no trigger has', async () => {
      const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
      const handle = Dialog.createHandle();
      const handleOpenChange = vi.fn();
      await render(() => <Dialog.Root handle={handle} onOpenChange={handleOpenChange} />);

      handle.open('missing');
      await flushMicrotasks();

      expect(handle.isOpen).toBe(true);
      expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
      expect(warn.mock.calls).toEqual([
        [
          expect.stringContaining(
            'Vase UI: DialogHandle.open: No trigger found with id "missing".',
          ),
        ],
      ]);
    });
  });

  describe('dismissal', () => {
    it('closes on the Escape key', async () => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
          <DialogPopupPart />
        </Dialog.Root>
      ));

      await fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });

      expect(screen.queryByRole('dialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.escapeKey);
    });

    it.each([
      { name: 'a dialog that is not modal', modal: false as const, closesOnPointerdown: false },
      { name: 'a trap-focus dialog', modal: 'trap-focus' as const, closesOnPointerdown: true },
    ])('closes $name on its outside press event', async ({ modal, closesOnPointerdown }) => {
      await render(() => (
        <div>
          <button>outside</button>
          <Dialog.Root defaultOpen modal={modal}>
            <DialogPopupPart />
          </Dialog.Root>
        </div>
      ));
      const outside = screen.getByText('outside');

      await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
      expect(screen.queryByRole('dialog') === null).toBe(closesOnPointerdown);

      await fireEvent.click(outside, { detail: 1 });
      expect(screen.queryByRole('dialog')).toBe(null);
    });

    it.each([
      { name: 'with disablePointerDismissal', props: { disablePointerDismissal: true }, button: 0 },
      { name: 'for another button than the main one', props: {}, button: 2 },
    ])('stays open on an outside press $name', async ({ props, button }) => {
      await render(() => (
        <div>
          <button>outside</button>
          <Dialog.Root defaultOpen modal="trap-focus" {...props}>
            <DialogPopupPart />
          </Dialog.Root>
        </div>
      ));

      await fireEvent.pointerDown(screen.getByText('outside'), { pointerType: 'mouse', button });

      expect(screen.queryByRole('dialog')).not.toBe(null);
    });

    it('closes a modal dialog that has a backdrop only for a press on the backdrop', async () => {
      const handleOpenChange = vi.fn();
      await render(() => (
        <div>
          <button>outside</button>
          <Dialog.Root defaultOpen onOpenChange={handleOpenChange}>
            <Dialog.Backdrop data-testid="backdrop" />
            <DialogPopupPart />
          </Dialog.Root>
        </div>
      ));
      const outside = screen.getByText('outside');
      const backdrop = screen.getByTestId('backdrop');

      await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
      await fireEvent.click(outside, { detail: 1 });
      expect(screen.queryByRole('dialog')).not.toBe(null);

      await fireEvent.pointerDown(backdrop, { pointerType: 'mouse', button: 0 });
      expect(screen.queryByRole('dialog')).not.toBe(null);
      await fireEvent.click(backdrop, { detail: 1 });
      expect(screen.queryByRole('dialog')).toBe(null);
      expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.outsidePress);
    });
  });

  describe('nested dialogs', () => {
    function renderNested(options: { childOpen?: boolean; parentOpen?: boolean } = {}) {
      const stores: { parent?: Store; child?: Store; grandchild?: Store } = {};
      const grandchildOpen = shallowRef(false);
      const result = render(() => (
        <Dialog.Root defaultOpen={options.parentOpen ?? true} modal={false}>
          <DialogStoreProbe onStore={(value) => (stores.parent = value)} />
          <DialogPopupPart data-testid="parent">
            <Dialog.Root defaultOpen={options.childOpen ?? false} modal={false}>
              <DialogStoreProbe onStore={(value) => (stores.child = value)} />
              <DialogPopupPart data-testid="child">
                <Dialog.Root open={grandchildOpen.value} modal={false}>
                  <DialogStoreProbe onStore={(value) => (stores.grandchild = value)} />
                </Dialog.Root>
              </DialogPopupPart>
            </Dialog.Root>
          </DialogPopupPart>
        </Dialog.Root>
      ));
      return { result, stores, grandchildOpen };
    }

    it('marks a root in a root as nested', async () => {
      const { result, stores } = renderNested({ childOpen: true });
      await result;

      expect(stores.parent!.select('nested')).toBe(false);
      expect(stores.child!.select('nested')).toBe(true);
    });

    it('counts the open dialogs below a dialog', async () => {
      const { result, stores, grandchildOpen } = renderNested({ childOpen: true });
      await result;
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(1);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(0);

      grandchildOpen.value = true;
      await flushMicrotasks();
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(2);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(1);

      grandchildOpen.value = false;
      await flushMicrotasks();
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(1);
      expect(stores.child!.select('nestedOpenDialogCount')).toBe(0);
    });

    it('closes only the top dialog on the Escape key, also for a key press in the dialog above', async () => {
      const { result, stores } = renderNested({ childOpen: true });
      await result;

      await fireEvent.keyDown(screen.getByTestId('parent'), { key: 'Escape' });
      expect(screen.queryByTestId('child')).toBe(null);
      expect(screen.queryByTestId('parent')).not.toBe(null);
      expect(stores.parent!.select('nestedOpenDialogCount')).toBe(0);

      await fireEvent.keyDown(screen.getByTestId('parent'), { key: 'Escape' });
      expect(screen.queryByTestId('parent')).toBe(null);
    });

    it('closes one dialog for each outside press, the top one first', async () => {
      const { result } = renderNested({ childOpen: true });
      await result;
      const press = async () => {
        await fireEvent.pointerDown(document.body, { pointerType: 'mouse', button: 0 });
        await fireEvent.click(document.body, { detail: 1 });
      };

      await press();
      expect(screen.queryByTestId('child')).toBe(null);
      expect(screen.queryByTestId('parent')).not.toBe(null);

      await press();
      expect(screen.queryByTestId('parent')).toBe(null);
    });

    it('does not count a nested dialog when it unmounts while it is open', async () => {
      const show = shallowRef(true);
      let parent!: Store;
      await render(() => (
        <Dialog.Root defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          {show.value ? <Dialog.Root defaultOpen modal={false} /> : null}
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      show.value = false;
      await flushMicrotasks();

      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('ignores a nested dialog that opens while the dialog is closed', async () => {
      const handle = Dialog.createHandle();
      const childOpen = shallowRef(false);
      let parent!: Store;
      await render(() => (
        <Dialog.Root handle={handle} modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <Dialog.Root open={childOpen.value} modal={false} />
        </Dialog.Root>
      ));

      childOpen.value = true;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);

      handle.open(null);
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('forgets its count when it closes', async () => {
      const handle = Dialog.createHandle();
      let parent!: Store;
      await render(() => (
        <Dialog.Root handle={handle} defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <DialogPopupPart />
          <Dialog.Root open modal={false} />
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      handle.close();
      await flushMicrotasks();

      expect(parent.select('mounted')).toBe(false);
      expect(parent.select('nestedOpenDialogCount')).toBe(0);
    });

    it('does not count a nested dialog while KeepAlive holds it, and counts it again after', async () => {
      const show = shallowRef(true);
      let parent!: Store;
      const Child = defineComponent({
        name: 'Child',
        setup: () => () => <Dialog.Root defaultOpen modal={false} />,
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <Dialog.Root defaultOpen modal={false}>
          <DialogStoreProbe onStore={(value) => (parent = value)} />
          <KeepAlive>{show.value ? <Child key="child" /> : <Other key="other" />}</KeepAlive>
        </Dialog.Root>
      ));
      expect(parent.select('nestedOpenDialogCount')).toBe(1);

      show.value = false;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(0);

      show.value = true;
      await flushMicrotasks();
      expect(parent.select('nestedOpenDialogCount')).toBe(1);
    });
  });

  describe('scroll lock', () => {
    // The lock and the unlock each wait for a timer of 0 ms. The observers of `waitFor` do not see a
    // document in a frame, so it polls.
    const POLL = { interval: 5, timeout: 3000 };

    function renderModalDialog(scrollDocument: ScrollDocument, rootProps: object = {}) {
      return (
        <Dialog.Root defaultOpen {...rootProps}>
          <Dialog.Portal container={scrollDocument.body}>
            <DialogPopupPart />
          </Dialog.Portal>
        </Dialog.Root>
      );
    }

    it('locks the page while a modal dialog is open, and unlocks it when the dialog closes', async () => {
      const scrollDocument = await createScrollDocument();
      const handle = Dialog.createHandle();
      await render(() => renderModalDialog(scrollDocument, { handle }));
      await waitFor(() => expect(isPageLocked(scrollDocument)).toBe(true), POLL);

      handle.close();
      await waitFor(() => expect(isPageLocked(scrollDocument)).toBe(false), POLL);
      expect(getScrollLockRegistry()?.lockCount).toBe(0);
    });

    it.each([
      { name: 'modal false', modal: false },
      { name: "modal 'trap-focus'", modal: 'trap-focus' as const },
    ])('does not lock the page for $name', async ({ modal }) => {
      const scrollDocument = await createScrollDocument();
      await render(() => renderModalDialog(scrollDocument, { modal }));

      await wait(0);

      expect(isPageLocked(scrollDocument)).toBe(false);
    });

    it('releases the lock while KeepAlive holds the dialog, and takes it back after', async () => {
      const scrollDocument = await createScrollDocument();
      const show = shallowRef(true);
      const ModalDialog = defineComponent({
        name: 'ModalDialog',
        setup: () => () => renderModalDialog(scrollDocument),
      });
      const Other = defineComponent({ name: 'Other', setup: () => () => <p>other</p> });
      await render(() => (
        <KeepAlive>{show.value ? <ModalDialog key="dialog" /> : <Other key="other" />}</KeepAlive>
      ));
      await waitFor(() => expect(isPageLocked(scrollDocument)).toBe(true), POLL);

      show.value = false;
      await waitFor(() => expect(isPageLocked(scrollDocument)).toBe(false), POLL);

      show.value = true;
      await waitFor(() => expect(isPageLocked(scrollDocument)).toBe(true), POLL);
    });
  });

  describe('server render', () => {
    it('hydrates an open root with a nested root, with no message', async () => {
      const serverHtml = await renderOnServer('src/dialog/root/DialogRootHydration.test.vue', {});

      await hydrate(DialogRootHydration, { serverHtml });
    });
  });
});
