import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  screen,
  waitFor,
} from '#test-utils';
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import * as Dialog from '../index.parts';
import type { DialogStore } from '../store/DialogStore';

describe('<Dialog.Viewport />', () => {
  const { render } = createRenderer();

  describe('with a test popup', () => {
    describeConformance(<Dialog.Viewport />, () => ({
      refInstanceof: window.HTMLDivElement,
      render: (node) => {
        return render(
          <Dialog.Root open modal={false}>
            <Dialog.Portal>
              {node}
              <DialogPopupPart />
            </Dialog.Portal>
          </Dialog.Root>,
        );
      },
    }));
  });

  it('renders only while the dialog is mounted by default', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Dialog.Root open={open.value} modal={false}>
        <Dialog.Portal>
          <Dialog.Viewport data-testid="viewport">
            <DialogPopupPart data-testid="popup">Content</DialogPopupPart>
          </Dialog.Viewport>
        </Dialog.Portal>
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
        <Dialog.Portal keepMounted>
          <Dialog.Viewport data-testid="viewport">
            <DialogPopupPart />
          </Dialog.Viewport>
        </Dialog.Portal>
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
        <Dialog.Portal>
          <Dialog.Viewport data-testid="parent">
            <Dialog.Root open={nestedOpen.value} modal={false}>
              <Dialog.Portal>
                <Dialog.Viewport data-testid="child" />
              </Dialog.Portal>
            </Dialog.Root>
          </Dialog.Viewport>
        </Dialog.Portal>
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
        <Dialog.Portal>
          <Dialog.Viewport data-testid="viewport" />
        </Dialog.Portal>
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
        <Dialog.Portal>
          {mounted.value ? <Dialog.Viewport data-testid="viewport" /> : null}
        </Dialog.Portal>
      </Dialog.Root>
    ));
    expect(store.select('viewportElement')).toBe(screen.getByTestId('viewport'));

    mounted.value = false;
    await flushMicrotasks();

    expect(store.select('viewportElement')).toBe(null);
  });
});
