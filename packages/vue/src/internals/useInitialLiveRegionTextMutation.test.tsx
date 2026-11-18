import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  KeepAlive,
  defineComponent,
  nextTick,
  onActivated,
  onDeactivated,
  onMounted,
  shallowRef,
} from 'vue';
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

    expect(screen.getByTestId('status').firstChild).toHaveProperty('nodeValue', 'Ready\u2060');
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

    expect(text.data).toBe('Status\u2060');
    expect(empty.data).toBe('');
  });

  it('removes the live region marker before an ancestor observes the hold', async () => {
    const shown = shallowRef(true);
    const values: string[] = [];
    let region: HTMLElement | null = null;
    const Status = defineComponent(() => {
      const setRegion = useInitialLiveRegionTextMutation<HTMLElement>();
      return () => (
        <p
          ref={(node) => {
            region = node as HTMLElement | null;
            setRegion(region);
          }}
        >
          Ready
        </p>
      );
    });
    const Branch = defineComponent(() => {
      onDeactivated(() => {
        if (region) values.push(region.textContent!);
      });
      onActivated(() => values.push(region!.textContent!));
      return () => <Status />;
    });
    await render(() => <KeepAlive>{shown.value ? <Branch /> : null}</KeepAlive>);
    values.length = 0;
    shown.value = false;
    await nextTick();
    shown.value = true;
    await nextTick();
    expect(values).toEqual(['Ready', 'Ready\u2060']);
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
