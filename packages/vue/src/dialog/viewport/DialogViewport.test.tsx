import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import DialogPortalPart from '../../../test/fixtures/DialogPortalPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';
import DialogViewportReplacement from './DialogViewportReplacement.test.vue';

describe('<Dialog.Viewport />', () => {
  const { render } = createRenderer();

  describe('with a test popup', () => {
    describeConformance(<Dialog.Viewport />, () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node) => {
        return render(
          <Dialog.Root open modal={false}>
            <DialogPortalPart>
              {node}
              <DialogPopupPart />
            </DialogPortalPart>
          </Dialog.Root>,
        );
      },
    }));
  });

  it('renders only while the dialog is mounted by default', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Dialog.Root open={open.value} modal={false}>
        <DialogPortalPart>
          <Dialog.Viewport data-testid="viewport">
            <DialogPopupPart data-testid="popup">Content</DialogPopupPart>
          </Dialog.Viewport>
        </DialogPortalPart>
      </Dialog.Root>
    ));
    expect(screen.queryByTestId('viewport')).toBe(null);

    open.value = true;
    await flushMicrotasks();
    expect(screen.getByTestId('viewport')).toContainElement(screen.getByTestId('popup'));

    open.value = false;
    await flushMicrotasks();
    expect(screen.queryByTestId('viewport')).toBe(null);
  });

  it('stays in the DOM, hidden and with no pointer events, while the dialog is closed and the portal keeps it mounted', async () => {
    const open = shallowRef(true);
    await render(() => (
      <Dialog.Root open={open.value} modal={false}>
        <DialogPortalPart keepMounted>
          <Dialog.Viewport data-testid="viewport">
            <DialogPopupPart />
          </Dialog.Viewport>
        </DialogPortalPart>
      </Dialog.Root>
    ));
    const viewport = screen.getByTestId('viewport');
    expect(viewport).not.toHaveAttribute('hidden');
    expect(viewport).not.toHaveStyle({ pointerEvents: 'none' });
    expect(viewport).toHaveAttribute('role', 'presentation');

    open.value = false;
    await waitFor(() => {
      expect(viewport).toHaveAttribute('hidden');
    });

    expect(screen.getByTestId('viewport')).toBe(viewport);
    expect(viewport).toHaveAttribute('data-closed');
    expect(viewport).toHaveStyle({ pointerEvents: 'none' });
  });

  it('shows whether the dialog is nested and whether it has a nested dialog open', async () => {
    const nestedOpen = shallowRef(true);
    await render(() => (
      <Dialog.Root open modal={false}>
        <DialogPortalPart>
          <Dialog.Viewport data-testid="parent">
            <Dialog.Root open={nestedOpen.value} modal={false}>
              <DialogPortalPart>
                <Dialog.Viewport data-testid="child" />
              </DialogPortalPart>
            </Dialog.Root>
          </Dialog.Viewport>
        </DialogPortalPart>
      </Dialog.Root>
    ));
    const parent = screen.getByTestId('parent');
    const child = screen.getByTestId('child');
    expect(parent).toHaveAttribute('data-open');
    expect(parent).not.toHaveAttribute('data-nested');
    expect(parent).toHaveAttribute('data-nested-dialog-open');
    expect(child).toHaveAttribute('data-open');
    expect(child).toHaveAttribute('data-nested');
    expect(child).not.toHaveAttribute('data-nested-dialog-open');

    nestedOpen.value = false;
    await flushMicrotasks();

    expect(parent).not.toHaveAttribute('data-nested-dialog-open');
  });

  it('shows the transition status of the dialog', async () => {
    let store!: DialogStore<unknown>;
    await render(
      <Dialog.Root open modal={false}>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <DialogPortalPart>
          <Dialog.Viewport data-testid="viewport" />
        </DialogPortalPart>
      </Dialog.Root>,
    );
    const viewport = screen.getByTestId('viewport');

    store.set('transitionStatus', 'starting');
    await flushMicrotasks();
    expect(viewport).toHaveAttribute('data-starting-style');

    store.set('transitionStatus', 'ending');
    await flushMicrotasks();
    expect(viewport).toHaveAttribute('data-ending-style');
    expect(viewport).not.toHaveAttribute('data-starting-style');
  });

  it('gives its element to the store while it is mounted', async () => {
    const mounted = shallowRef(true);
    let store!: DialogStore<unknown>;
    await render(() => (
      <Dialog.Root open modal={false}>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <DialogPortalPart>
          {mounted.value ? <Dialog.Viewport data-testid="viewport" /> : null}
        </DialogPortalPart>
      </Dialog.Root>
    ));
    expect(store.select('viewportElement')).toBe(screen.getByTestId('viewport'));

    mounted.value = false;
    await flushMicrotasks();

    expect(store.select('viewportElement')).toBe(null);
  });

  // The compiled template of the fixture mounts the new viewport before it unmounts the old
  // viewport. A render function in TSX reuses the viewport component, so it does not show this
  // order.
  it('keeps the element of the new viewport in the store when a template replaces the viewport', async () => {
    let store!: DialogStore<unknown>;
    const { setProps } = await render(
      <DialogViewportReplacement first onStore={(value) => (store = value)} />,
    );
    expect(store.select('viewportElement')).toBe(screen.getByTestId('first'));

    await setProps({ first: false });

    expect(store.select('viewportElement')).toBe(screen.getByTestId('second'));
  });

  // This case is the last one of the file. In Vue 3.5.12, a `setup` that throws leaves the current
  // instance set, and each later case of the file then gets a warning about a slot.
  it('throws a descriptive error when rendered outside <Dialog.Portal>', async () => {
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
