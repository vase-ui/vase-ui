import { describe, expect, it, vi } from 'vitest';
import { shallowRef } from 'vue';
import {
  createHeldBranch,
  createRenderer,
  describeConformance,
  fireEvent,
  firePointer,
  flushMicrotasks,
  hydrate,
  renderOnServer,
  screen,
  waitFor,
} from '#test-utils';
import { DialogStoreProbe } from '../../../test/fixtures/dialogStoreProbe';
import type { DialogStore } from '../dialog/store/DialogStore';
import * as Drawer from '../index.parts';
import DrawerBackdropHydration from './DrawerBackdropHydration.test.vue';
import DrawerBackdropReplacement from './DrawerBackdropReplacement.test.vue';

describe('<Drawer.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Drawer.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render: (node) => {
      return render(
        <Drawer.Root open modal={false}>
          {node}
        </Drawer.Root>,
      );
    },
  }));

  it('uses the dialog state when there is no drawer gesture', async () => {
    await render(
      <Drawer.Root open modal={false}>
        <Drawer.Backdrop data-testid="backdrop" />
      </Drawer.Root>,
    );
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-strength')).toBe('1');
  });

  it('shows the state of the drawer, and takes no pointer event while the drawer is not open', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Drawer.Root open={open.value}>
        <Drawer.Backdrop data-testid="backdrop" />
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup>Drawer</Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-closed');
    expect(backdrop.style.pointerEvents).toBe('none');

    open.value = true;
    await flushMicrotasks();
    expect(backdrop).not.toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-open');
    expect(backdrop.style.pointerEvents).toBe('');

    open.value = false;
    await flushMicrotasks();
    expect(backdrop).toHaveAttribute('data-closed');
    expect(backdrop.style.pointerEvents).toBe('none');
  });

  it('shows the transition status of the drawer', async () => {
    let store!: DialogStore<unknown>;
    await render(
      <Drawer.Root open>
        <DialogStoreProbe onStore={(value) => (store = value)} />
        <Drawer.Backdrop data-testid="backdrop" />
      </Drawer.Root>,
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

  it('gives the swipe variables their start values, and does not let the user select the backdrop', async () => {
    await render(
      <Drawer.Root open>
        <Drawer.Backdrop data-testid="backdrop" />
      </Drawer.Root>,
    );
    const backdrop = screen.getByTestId('backdrop');

    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-strength')).toBe('1');
    expect(backdrop).toHaveStyle({ userSelect: 'none' });
  });

  it('keeps the progress of the current swipe when the backdrop renders again', async () => {
    const label = shallowRef('first');
    await render(() => (
      <Drawer.Root open modal={false}>
        <Drawer.Backdrop data-testid="backdrop" data-label={label.value} />
        <Drawer.Root>
          <Drawer.Backdrop forceRender data-testid="dialog-backdrop" data-label={label.value} />
        </Drawer.Root>
        <Drawer.Portal>
          <Drawer.Viewport>
            <Drawer.Popup
              data-testid="popup"
              style={{ position: 'fixed', inset: 0, height: '100px' }}
            >
              Drawer
            </Drawer.Popup>
          </Drawer.Viewport>
        </Drawer.Portal>
      </Drawer.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    const popup = screen.getByTestId('popup');
    const pointer = { pointerType: 'mouse', pointerId: 1, buttons: 1, clientX: 5 };
    await firePointer.down(popup, { ...pointer, button: 0, clientY: 5, timeStamp: 1 });
    await firePointer.move(popup, { ...pointer, clientY: 6, timeStamp: 20 });
    await firePointer.move(popup, { ...pointer, clientY: 56, timeStamp: 100 });
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');

    label.value = 'second';
    await flushMicrotasks();
    expect(backdrop).toHaveAttribute('data-label', 'second');
    expect(backdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0.5');
    const dialogBackdrop = screen.getByTestId('dialog-backdrop');
    expect(dialogBackdrop).not.toHaveAttribute('data-swiping');
    expect(dialogBackdrop.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
  });

  describe('prop: forceRender', () => {
    it.each([
      { name: 'by default', forceRender: false, rendered: [true, false, false] },
      { name: 'when forceRender is true', forceRender: true, rendered: [true, true, true] },
    ])('renders the backdrops of nested drawers $name', async ({ forceRender, rendered }) => {
      await render(
        <Drawer.Root open>
          <Drawer.Backdrop data-testid="level-1" forceRender={forceRender} />
          <Drawer.Root open>
            <Drawer.Backdrop data-testid="level-2" forceRender={forceRender} />
            <Drawer.Root open>
              <Drawer.Backdrop data-testid="level-3" forceRender={forceRender} />
            </Drawer.Root>
          </Drawer.Root>
        </Drawer.Root>,
      );

      expect(
        ['level-1', 'level-2', 'level-3'].map((testId) => screen.queryByTestId(testId) !== null),
      ).toEqual(rendered);
    });
  });

  // The compiled template of the fixture mounts the new backdrop before it unmounts the old
  // backdrop. A render function in TSX reuses the backdrop component, so it does not show this
  // order.
  it('closes a modal drawer only for a press on the new backdrop when a template replaces the backdrop', async () => {
    const { setProps } = await render(<DrawerBackdropReplacement first />);

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

  it('ends a close while KeepAlive holds a backdrop that mounted in the held branch with no popup part', async () => {
    const handleOpenChangeComplete = vi.fn();
    const open = shallowRef(true);
    let store!: DialogStore<unknown>;
    const { HeldBranch, mountWhileHeld } = createHeldBranch(() => <Drawer.Backdrop />, {
      renderBranch: (part) => part,
    });
    await render(() => (
      <Drawer.Root open={open.value} onOpenChangeComplete={handleOpenChangeComplete}>
        <DialogStoreProbe
          onStore={(value) => {
            store = value;
          }}
        />
        <Drawer.Portal>
          <HeldBranch />
        </Drawer.Portal>
      </Drawer.Root>
    ));
    await mountWhileHeld();
    expect(store.context.backdropRef.value?.isConnected).toBe(false);

    open.value = false;

    await waitFor(() => {
      expect(handleOpenChangeComplete).toHaveBeenCalledWith(false);
    });
  });

  describe('server render', () => {
    it('hydrates the backdrops of an open drawer and of a nested drawer with no message', async () => {
      const serverHtml = await renderOnServer(
        'src/drawer/backdrop/DrawerBackdropHydration.test.vue',
        {},
      );
      const template = document.createElement('template');
      template.innerHTML = serverHtml;
      const backdrop = template.content.querySelector<HTMLElement>('[data-testid="backdrop"]');
      expect(backdrop?.style.getPropertyValue('--drawer-swipe-progress')).toBe('0');
      expect(backdrop?.style.getPropertyValue('--drawer-swipe-strength')).toBe('1');

      await hydrate(DrawerBackdropHydration, { serverHtml });
    });
  });
});
