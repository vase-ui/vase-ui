import { describe, expect, it } from 'vitest';
import { defineComponent, onMounted, shallowRef, watch } from 'vue';
import type { PropType } from 'vue';
import * as Popover from '../index.parts';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';

type BackdropState = Popover.Backdrop.State;

describe('<Popover.Backdrop />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Backdrop />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Popover.Root open>{node}</Popover.Root>);
    },
  }));

  it.each([false, true])(
    'does not start an entry phase when initially open (controlled=%s)',
    async (controlled) => {
      const statuses = new Set<BackdropState['transitionStatus']>();

      const RecordState = defineComponent({
        props: { state: { type: Object as PropType<BackdropState>, required: true } },
        setup(props) {
          onMounted(() => {
            statuses.add(props.state.transitionStatus);
          });
          watch(
            () => props.state.transitionStatus,
            (transitionStatus) => {
              statuses.add(transitionStatus);
            },
            { flush: 'sync' },
          );
          return () => null;
        },
      });

      await render(
        <Popover.Root open={controlled ? true : undefined} defaultOpen={!controlled}>
          <Popover.Backdrop
            v-slots={{
              render: ({ props, state }: { props: Record<string, unknown>; state: BackdropState }) => (
                <div {...props}>
                  <RecordState state={state} />
                </div>
              ),
            }}
          />
        </Popover.Root>,
      );
      await flushMicrotasks();

      expect(statuses).toEqual(new Set([undefined]));
    },
  );

  it('has the role, the style and the state of the popover, and hides while it is not mounted', async () => {
    const open = shallowRef(false);
    await render(() => (
      <Popover.Root open={open.value}>
        <Popover.Backdrop data-testid="backdrop" />
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup />
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));
    const backdrop = screen.getByTestId('backdrop');
    expect(backdrop).toHaveAttribute('role', 'presentation');
    expect(backdrop).toHaveStyle({ userSelect: 'none' });
    expect(backdrop.style.pointerEvents).toBe('');
    expect(backdrop).toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-closed');

    open.value = true;
    await flushMicrotasks();
    expect(backdrop).not.toHaveAttribute('hidden');
    expect(backdrop).toHaveAttribute('data-open');

    open.value = false;
    await waitFor(() => {
      expect(backdrop).toHaveAttribute('hidden');
    });
    expect(backdrop).toHaveAttribute('data-closed');
  });
});
