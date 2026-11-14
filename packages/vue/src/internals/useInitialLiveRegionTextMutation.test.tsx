import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, onMounted } from 'vue';
import { createRenderer, flushMicrotasks, screen } from '#test-utils';
import {
  INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY,
  useInitialLiveRegionTextMutation,
} from './useInitialLiveRegionTextMutation';

describe('useInitialLiveRegionTextMutation', () => {
  const { render } = createRenderer();

  it('does nothing when its ref is not attached', async () => {
    const Unattached = defineComponent(() => {
      useInitialLiveRegionTextMutation();
      return () => <div data-testid="status">Status</div>;
    });

    await render(<Unattached />);

    expect(screen.getByTestId('status')).toHaveTextContent('Status');
  });

  it('marks the text when the element appears after mount', async () => {
    const Status = defineComponent(
      (props: { present: boolean }) => {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>(() => props.present);
        return () =>
          props.present ? (
            <div ref={(element) => ref(element as HTMLDivElement | null)} data-testid="status">
              Ready
            </div>
          ) : null;
      },
      { props: ['present'] },
    );

    const { setProps } = await render(<Status present={false} />);

    expect(screen.queryByTestId('status')).toBe(null);

    await setProps({ present: true });

    expect(screen.getByTestId('status').firstChild).toHaveProperty('nodeValue', 'Ready⁠');
  });

  it('skips empty text nodes when finding the announcement text', async () => {
    const text = document.createTextNode('Status');
    const empty = document.createTextNode('');

    const Status = defineComponent(() => {
      let element: HTMLDivElement | null = null;
      // A layout effect of React runs before a passive effect, so this hook comes before the
      // hook of the composable.
      onMounted(() => {
        element?.append(text, empty);
      });
      const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();

      return () => (
        <div
          ref={(node) => {
            element = node as HTMLDivElement | null;
            ref(element);
          }}
          data-testid="status"
        />
      );
    });

    await render(<Status />);

    expect(text.data).toBe('Status⁠');
    expect(empty.data).toBe('');
  });

  describe('with fake timers', () => {
    beforeEach(() => {
      vi.useFakeTimers({ shouldAdvanceTime: true });
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('does not overwrite text that changes before the reset', async () => {
      const Status = defineComponent(() => {
        const ref = useInitialLiveRegionTextMutation<HTMLDivElement>();
        return () => (
          <div ref={(element) => ref(element as HTMLDivElement | null)} data-testid="status">
            Status
          </div>
        );
      });

      await render(<Status />);
      const status = screen.getByTestId('status');
      status.firstChild!.nodeValue = 'Updated';

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
      await flushMicrotasks();

      expect(status).toHaveTextContent('Updated');
    });
  });
});
