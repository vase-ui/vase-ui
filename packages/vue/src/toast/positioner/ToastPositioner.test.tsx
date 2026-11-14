import { afterEach, beforeEach, expect, vi, describe, it } from 'vitest';
import { defineComponent, Fragment, shallowRef } from 'vue';
import type { PropType } from 'vue';
import { Toast } from '@vase-ui/vue/toast';
import {
  createRenderer,
  describeConformance,
  flushMicrotasks,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
  waitSingleFrame,
} from '#test-utils';
import type { ToastManagerAddOptions } from '../useToastManager';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Positioner />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Positioner toast={toast} />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Toast.Provider>{node}</Toast.Provider>);
    },
  }));

  const AnchoredList = defineComponent({
    setup() {
      const { toasts } = Toast.useToastManager();
      return () =>
        toasts.value.map((toastItem) => (
          <Toast.Positioner key={toastItem.id} toast={toastItem} data-testid={toastItem.id}>
            <Toast.Root toast={toastItem}>
              <Toast.Title />
            </Toast.Root>
          </Toast.Positioner>
        ));
    },
  });

  const AddButton = defineComponent({
    props: {
      options: { type: Object as PropType<Partial<ToastManagerAddOptions<any>>> },
    },
    setup(props) {
      const { add } = Toast.useToastManager();
      return () => (
        <button type="button" onClick={() => add({ title: 'title', ...props.options })}>
          add
        </button>
      );
    },
  });

  it.skipIf(isJSDOM)('positions an anchored toast against its anchor element', async () => {
    const App = defineComponent({
      setup() {
        const anchorRef = shallowRef<HTMLButtonElement | null>(null);
        const { add } = Toast.useToastManager();
        return () => (
          <Fragment>
            <button
              type="button"
              ref={anchorRef}
              style={{
                position: 'absolute',
                top: '200px',
                left: '100px',
                width: '80px',
                height: '20px',
              }}
              onClick={() =>
                add({
                  id: 'anchored',
                  title: 'title',
                  positionerProps: { anchor: anchorRef.value, side: 'bottom', sideOffset: 8 },
                })
              }
            >
              anchor
            </button>
            <Toast.Viewport>
              <AnchoredList />
            </Toast.Viewport>
          </Fragment>
        );
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <App />
      </Toast.Provider>,
    );

    const anchor = screen.getByRole('button', { name: 'anchor' });
    await user.click(anchor);

    const positioner = screen.getByTestId('anchored');
    await waitFor(() => expect(positioner).toHaveAttribute('data-side', 'bottom'));

    const anchorRect = anchor.getBoundingClientRect();
    await waitFor(() => {
      expect(positioner.getBoundingClientRect().top).toBeCloseTo(anchorRect.bottom + 8, 0);
    });
  });

  it('falls back to the viewport when no anchor is provided', async () => {
    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <AnchoredList />
        </Toast.Viewport>
        <AddButton options={{ id: 'unanchored' }} />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('unanchored');
    // An unanchored positioner still renders, with the defaults applied.
    expect(positioner).toHaveAttribute('data-side', 'top');
    expect(positioner).toHaveAttribute('data-align', 'center');
    expect(positioner).toHaveTextContent('title');
  });

  it('lets positioner props override the ones carried on the toast', async () => {
    const OverridingList = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Positioner
              key={toastItem.id}
              toast={toastItem}
              data-testid="positioner"
              side="left"
            >
              <Toast.Root toast={toastItem}>
                <Toast.Title />
              </Toast.Root>
            </Toast.Positioner>
          ));
      },
    });

    const { user } = await render(
      <Toast.Provider>
        <Toast.Viewport>
          <OverridingList />
        </Toast.Viewport>
        <AddButton options={{ positionerProps: { side: 'bottom', align: 'end' } }} />
      </Toast.Provider>,
    );

    await user.click(screen.getByRole('button', { name: 'add' }));

    const positioner = screen.getByTestId('positioner');
    expect(positioner).toHaveAttribute('data-side', 'left');
    // Props not set on the element still come from the toast.
    expect(positioner).toHaveAttribute('data-align', 'end');
  });

  describe('--toast-index', () => {
    const { render: renderFakeTimers } = createRenderer();

    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('keeps the DOM index while a toast animates out', async () => {
      const manager = Toast.createToastManager();

      await renderFakeTimers(
        <Toast.Provider toastManager={manager} timeout={0}>
          <Toast.Viewport>
            <AnchoredList />
          </Toast.Viewport>
        </Toast.Provider>,
      );

      manager.add({ id: 'oldest', title: 'oldest' });
      await flushMicrotasks();
      manager.add({ id: 'newest', title: 'newest' });
      await flushMicrotasks();

      const newest = screen.getByTestId('newest');
      const oldest = screen.getByTestId('oldest');

      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('1');

      manager.close('newest');
      await flushMicrotasks();

      // The closing toast is excluded from the visible stack, but it must keep a
      // real index while it animates out rather than collapsing to `-1`.
      expect(newest.style.getPropertyValue('--toast-index')).toBe('0');
      expect(oldest.style.getPropertyValue('--toast-index')).toBe('0');
    });
  });

  it('takes a Boolean prop that the positioner does not set from the toast', async () => {
    const manager = Toast.createToastManager();
    // Vue gives an absent Boolean prop the value `false`, and a prop that is `undefined` keeps it.
    // The positioner of `untracked` thus gets no `disableAnchorTracking` key at all.
    const List = defineComponent({
      setup() {
        const { toasts } = Toast.useToastManager();
        return () =>
          toasts.value.map((toastItem) => (
            <Toast.Positioner
              key={toastItem.id}
              toast={toastItem}
              data-testid={toastItem.id}
              {...(toastItem.id === 'tracking' ? { disableAnchorTracking: false } : {})}
            >
              <Toast.Root toast={toastItem}>
                <Toast.Title />
              </Toast.Root>
            </Toast.Positioner>
          ));
      },
    });

    await render(
      <Toast.Provider toastManager={manager}>
        <button
          type="button"
          data-testid="anchor"
          style={{ position: 'absolute', top: '200px', left: '100px', width: '80px' }}
        >
          anchor
        </button>
        <Toast.Viewport>
          <List />
        </Toast.Viewport>
      </Toast.Provider>,
    );

    const anchor = screen.getByTestId('anchor');
    const positionerProps = { anchor, side: 'bottom', disableAnchorTracking: true } as const;
    manager.add({ id: 'untracked', title: 'untracked', positionerProps });
    manager.add({ id: 'tracking', title: 'tracking', positionerProps });
    await flushMicrotasks();

    const untracked = screen.getByTestId('untracked');
    const tracking = screen.getByTestId('tracking');
    const centerOf = (element: Element) => {
      const rect = element.getBoundingClientRect();
      return rect.left + rect.width / 2;
    };
    const firstCenter = centerOf(anchor);
    await waitFor(() => {
      expect(centerOf(untracked)).toBeCloseTo(firstCenter, 0);
      expect(centerOf(tracking)).toBeCloseTo(firstCenter, 0);
    });

    anchor.style.width = '200px';
    const nextCenter = centerOf(anchor);

    // The positioner that tracks the anchor moves. The browser calls the resize observers of the
    // two positioners in the same frame, so the other one has its final place one frame later.
    await waitFor(() => {
      expect(centerOf(tracking)).toBeCloseTo(nextCenter, 0);
    });
    await waitSingleFrame();
    expect(centerOf(untracked)).toBeCloseTo(firstCenter, 0);
  });

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when rendered outside <Toast.Provider>', async () => {
    await expect(render(<Toast.Positioner toast={toast} />)).rejects.toThrow(
      'Vase UI: No <Toast.Provider> is above this component. `useToastManager` and each part of Toast read the toasts of the provider. Put the component inside <Toast.Provider>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
