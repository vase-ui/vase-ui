import { describe, expect, it } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import { Dialog } from '@vase-ui/vue/dialog';
import {
  createRenderer,
  describeConformance,
  fireEvent,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import type { DialogStore } from '../store/DialogStore';
import DialogBackdropHydration from './DialogBackdropHydration.test.vue';
import DialogBackdropReplacement from './DialogBackdropReplacement.test.vue';

describe('<Dialog.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Dialog.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(
        <Dialog.Root open modal={false}>
          {node}
        </Dialog.Root>,
      );
    },
  }));

  it('has role="presentation"', async () => {
    await render(
      <Dialog.Root open>
        <Dialog.Backdrop data-testid="backdrop" />
      </Dialog.Root>,
    );

    expect(screen.getByTestId('backdrop')).toHaveAttribute('role', 'presentation');
  });

  it('shows the state of the dialog, and hides the backdrop while the dialog is not mounted', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Dialog.Root open={open.value}>
        <Dialog.Backdrop data-testid="backdrop" />
        <Dialog.Portal>
          <Dialog.Popup />
        </Dialog.Portal>
      </Dialog.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-closed');
    expect(backdrop).not.toHaveAttribute('data-open');

    open.value = true;
    await flushMicrotasks();
    expect(backdrop).not.toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop).not.toHaveAttribute('data-closed');

    open.value = false;
    await waitFor(() => {
      expect(backdrop).toHaveAttribute('hidden');
    });
    expect(backdrop).toHaveAttribute('data-closed');
  });

  it('shows the transition status of the dialog', async () => {
    let store!: DialogStore<unknown>;
    await render(
      <Dialog.Root open>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <Dialog.Backdrop data-testid="backdrop" />
      </Dialog.Root>,
    );
    const backdrop = screen.getByTestId('backdrop');

    store.set('transitionStatus', 'starting');
    await flushMicrotasks();
    expect(backdrop).toHaveAttribute('data-starting-style');

    store.set('transitionStatus', 'ending');
    await flushMicrotasks();
    expect(backdrop).toHaveAttribute('data-ending-style');
    expect(backdrop).not.toHaveAttribute('data-starting-style');
  });

  it('does not let the user select the backdrop', async () => {
    await render(
      <Dialog.Root open>
        <Dialog.Backdrop data-testid="backdrop" />
      </Dialog.Root>,
    );

    expect(screen.getByTestId('backdrop')).toHaveStyle({ userSelect: 'none' });
  });

  describe('prop: forceRender', () => {
    it('renders only the root backdrop by default', async () => {
      const App = defineComponent(() => {
        const nestedOpen = shallowRef(true);

        return () => (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="root-backdrop" />
            <Dialog.Portal>
              <Dialog.Popup>
                Root dialog
                <Dialog.Root
                  open={nestedOpen.value}
                  onOpenChange={(value: boolean) => (nestedOpen.value = value)}
                >
                  <Dialog.Backdrop data-testid="nested-backdrop" />
                  <Dialog.Portal>
                    <Dialog.Popup>Nested dialog</Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      });

      await render(<App />);

      expect(screen.getByTestId('root-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('nested-backdrop')).toBe(null);
    });

    it('always renders by default when not nested', async () => {
      await render(
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="backdrop" />
          <Dialog.Portal>
            <Dialog.Popup>Content</Dialog.Popup>
          </Dialog.Portal>
        </Dialog.Root>,
      );

      expect(screen.getByTestId('backdrop')).not.toBe(null);
    });

    // The two cases of Base UI below differ only in `forceRender`.
    function renderThreeLevels(forceRender: boolean | undefined) {
      const App = defineComponent(() => {
        const level2Open = shallowRef(true);
        const level3Open = shallowRef(true);

        return () => (
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="level-1-backdrop" forceRender={forceRender} />
            <Dialog.Portal>
              <Dialog.Popup>
                Level 1 dialog
                <Dialog.Root
                  open={level2Open.value}
                  onOpenChange={(value: boolean) => (level2Open.value = value)}
                >
                  <Dialog.Backdrop data-testid="level-2-backdrop" forceRender={forceRender} />
                  <Dialog.Portal>
                    <Dialog.Popup>
                      Level 2 dialog
                      <Dialog.Root
                        open={level3Open.value}
                        onOpenChange={(value: boolean) => (level3Open.value = value)}
                      >
                        <Dialog.Backdrop data-testid="level-3-backdrop" forceRender={forceRender} />
                        <Dialog.Portal>
                          <Dialog.Popup>Level 3 dialog</Dialog.Popup>
                        </Dialog.Portal>
                      </Dialog.Root>
                    </Dialog.Popup>
                  </Dialog.Portal>
                </Dialog.Root>
              </Dialog.Popup>
            </Dialog.Portal>
          </Dialog.Root>
        );
      });

      return render(<App />);
    }

    it('renders only the root backdrop with multiple nesting levels', async () => {
      await renderThreeLevels(undefined);

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.queryByTestId('level-2-backdrop')).toBe(null);
      expect(screen.queryByTestId('level-3-backdrop')).toBe(null);
    });

    it('always renders when true', async () => {
      await renderThreeLevels(true);

      expect(screen.getByTestId('level-1-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-2-backdrop')).not.toBe(null);
      expect(screen.getByTestId('level-3-backdrop')).not.toBe(null);
    });
  });

  // The compiled template of the fixture mounts the new backdrop before it unmounts the old
  // backdrop. A render function in TSX reuses the backdrop component, so it does not show this
  // order.
  it('closes a modal dialog only for a press on the new backdrop when a template replaces the backdrop', async () => {
    const { setProps } = await render(<DialogBackdropReplacement first />);

    await setProps({ first: false });
    const outside = screen.getByText('outside');
    await fireEvent.pointerDown(outside, { pointerType: 'mouse', button: 0 });
    await fireEvent.click(outside, { detail: 1 });
    expect(screen.queryByRole('dialog')).not.toBe(null);

    const backdrop = screen.getByTestId('second');
    await fireEvent.pointerDown(backdrop, { pointerType: 'mouse', button: 0 });
    await fireEvent.click(backdrop, { detail: 1 });
    expect(screen.queryByRole('dialog')).toBe(null);
  });

  describe('server render', () => {
    it('hydrates the backdrops of an open dialog and of a nested dialog with no message', async () => {
      const serverHtml = await renderOnServer(
        'src/dialog/backdrop/DialogBackdropHydration.test.vue',
        {},
      );

      await hydrate(DialogBackdropHydration, { serverHtml });
    });
  });
});
