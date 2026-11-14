import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { createRenderer, describeConformance, flushMicrotasks, screen, waitFor } from '#test-utils';
import type { HTMLProps } from '../../internals/types';
import { INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY } from '../../internals/useInitialLiveRegionTextMutation';
import * as Combobox from '../index.parts';

describe('<Combobox.Status />', () => {
  const { render } = createRenderer();

  describeConformance(<Combobox.Status />, () => ({
    refInstanceof: window.HTMLDivElement,
    render(node) {
      return render(<Combobox.Root>{node}</Combobox.Root>);
    },
  }));

  it('renders only when open', async () => {
    const { user } = await render(
      <Combobox.Root>
        <Combobox.Input data-testid="input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.Status data-testid="status">Searching…</Combobox.Status>
              <Combobox.List>
                <Combobox.Item value="a">a</Combobox.Item>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>,
    );

    expect(screen.queryByTestId('status')).toBe(null);
    await user.click(screen.getByTestId('input'));
    await waitFor(() => expect(screen.getByTestId('status')).not.toBe(null));
  });

  describe('a11y', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    const StatusTest = defineComponent(
      (props: { text?: string }) => () => (
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status data-testid="status">{props.text}</Combobox.Status>
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>
      ),
      { props: ['text'] },
    );

    it('removes the initial text mutation after the reset delay', async () => {
      await render(<StatusTest text="Searching…" />);
      await flushMicrotasks();

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status').textContent).toBe('Searching…⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
      await flushMicrotasks();

      expect(screen.getByTestId('status').textContent).toBe('Searching…');
    });

    it('updates content immediately after the live region has mounted', async () => {
      const { setProps } = await render(<StatusTest />);
      await flushMicrotasks();

      expect(screen.getByRole('status')).toBe(screen.getByTestId('status'));
      expect(screen.getByTestId('status')).toHaveTextContent('');

      await setProps({ text: 'Searching…' });
      await flushMicrotasks();

      expect(screen.getByTestId('status')).toHaveTextContent('Searching…');
    });

    it('preserves a custom render prop on the visible element', async () => {
      await render(
        <Combobox.Root defaultOpen>
          <Combobox.Input />
          <Combobox.Portal>
            <Combobox.Positioner>
              <Combobox.Popup>
                <Combobox.Status
                  v-slots={{
                    render: ({ props }: { props: HTMLProps }) => (
                      <p {...props} data-testid="custom-status">
                        Searching…
                      </p>
                    ),
                  }}
                />
                <Combobox.List>
                  <Combobox.Item value="a">a</Combobox.Item>
                </Combobox.List>
              </Combobox.Popup>
            </Combobox.Positioner>
          </Combobox.Portal>
        </Combobox.Root>,
      );
      await flushMicrotasks();

      expect(screen.getByTestId('custom-status').tagName).toBe('P');
      expect(screen.getByRole('status')).toBe(screen.getByTestId('custom-status'));
      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…⁠');

      vi.advanceTimersByTime(INITIAL_LIVE_REGION_TEXT_MUTATION_RESET_DELAY);
      await flushMicrotasks();

      expect(screen.getByTestId('custom-status').textContent).toBe('Searching…');
    });

    it('restores the marker before unmounting during the reset delay', async () => {
      const { unmount } = await render(<StatusTest text="Searching…" />);
      await flushMicrotasks();

      const status = screen.getByTestId('status');
      expect(status.textContent).toBe('Searching…⁠');

      unmount();

      expect(status.textContent).toBe('Searching…');
    });
  });
});
