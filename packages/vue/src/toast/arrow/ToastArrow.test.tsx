import { expect, describe, it } from 'vitest';
import { defineComponent, Fragment, shallowRef } from 'vue';
import { Toast } from '@vase-ui/vue/toast';
import {
  createRenderer,
  describeConformance,
  isJSDOM,
  screen,
  takeReportedMessages,
  waitFor,
} from '#test-utils';

const toast: Toast.Root.ToastObject = {
  id: 'test',
  title: 'Toast title',
};

describe('<Toast.Arrow />', () => {
  const { render } = createRenderer();

  describeConformance(<Toast.Arrow />, () => ({
    refInstanceof: window.Element,
    render(node) {
      return render(
        <Toast.Provider>
          <Toast.Positioner toast={toast}>{node}</Toast.Positioner>
        </Toast.Provider>,
      );
    },
  }));

  it.skipIf(isJSDOM)('mirrors the resolved side of its positioner', async () => {
    const App = defineComponent({
      setup() {
        const anchorRef = shallowRef<HTMLButtonElement | null>(null);
        const { add, toasts } = Toast.useToastManager();
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
                  title: 'title',
                  positionerProps: { anchor: anchorRef.value, side: 'bottom' },
                })
              }
            >
              anchor
            </button>
            <Toast.Viewport>
              {toasts.value.map((toastItem) => (
                <Toast.Positioner key={toastItem.id} toast={toastItem}>
                  <Toast.Root toast={toastItem}>
                    <Toast.Arrow data-testid="arrow" />
                    <Toast.Title />
                  </Toast.Root>
                </Toast.Positioner>
              ))}
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

    await user.click(screen.getByRole('button', { name: 'anchor' }));

    const arrow = screen.getByTestId('arrow');
    await waitFor(() => expect(arrow).toHaveAttribute('data-side', 'bottom'));
    expect(arrow).toHaveAttribute('aria-hidden', 'true');
  });

  // A case that throws in `setup` is the last case of its file.
  it('throws a descriptive error when rendered outside <Toast.Positioner>', async () => {
    await expect(
      render(
        <Toast.Provider>
          <Toast.Arrow />
        </Toast.Provider>,
      ),
    ).rejects.toThrow(
      'Vase UI: <Toast.Arrow> must be inside <Toast.Positioner>. Without a positioner the arrow has no side and no alignment. Put the arrow inside <Toast.Positioner>.',
    );

    expect(takeReportedMessages()).toEqual([
      expect.stringContaining('Unhandled error during execution of setup function'),
    ]);
  });
});
