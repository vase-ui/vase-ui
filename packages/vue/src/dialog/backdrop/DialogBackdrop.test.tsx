import { describe, expect, it } from 'vitest';
import { shallowRef } from 'vue';
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
import DialogPopupPart from '../../../test/fixtures/DialogPopupPart.vue';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import * as Dialog from '../index.parts';
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
        <DialogPopupPart />
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
    it.each([
      { name: 'by default', forceRender: false, rendered: [true, false, false] },
      { name: 'when forceRender is true', forceRender: true, rendered: [true, true, true] },
    ])('renders the backdrops of nested dialogs $name', async ({ forceRender, rendered }) => {
      await render(
        <Dialog.Root open>
          <Dialog.Backdrop data-testid="level-1" forceRender={forceRender} />
          <Dialog.Root open>
            <Dialog.Backdrop data-testid="level-2" forceRender={forceRender} />
            <Dialog.Root open>
              <Dialog.Backdrop data-testid="level-3" forceRender={forceRender} />
            </Dialog.Root>
          </Dialog.Root>
        </Dialog.Root>,
      );

      expect(
        ['level-1', 'level-2', 'level-3'].map((testId) => screen.queryByTestId(testId) !== null),
      ).toEqual(rendered);
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
