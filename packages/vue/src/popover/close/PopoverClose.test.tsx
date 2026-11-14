import { describe, expect, it, vi } from 'vitest';
import { defineComponent, shallowRef } from 'vue';
import * as Tooltip from '../../tooltip/index.parts';
import { REASONS } from '../../internals/reasons';
import * as Popover from '../index.parts';
import { createRenderer, describeConformance, fireEvent, flushMicrotasks, screen } from '#test-utils';

describe('<Popover.Close />', () => {
  const { render } = createRenderer();

  describeConformance(<Popover.Close />, () => ({
    refInstanceof: window.HTMLButtonElement,
    testRenderPropWith: 'button',
    button: true,
    async render(node) {
      const result = await render(
        <Popover.Root open>
          <Popover.Trigger>Trigger</Popover.Trigger>
          <Popover.Portal>
            <Popover.Positioner>
              <Popover.Popup>{node}</Popover.Popup>
            </Popover.Positioner>
          </Popover.Portal>
        </Popover.Root>,
      );
      await flushMicrotasks();
      return result;
    },
  }));

  it('renders when popover is closed', async () => {
    await render(
      <Popover.Root>
        <Popover.Close aria-label="Close popover" />
      </Popover.Root>,
    );

    expect(screen.queryByRole('button', { name: 'Close popover' })).not.toBe(null);
  });

  it('should close popover when clicked', async () => {
    await render(
      <Popover.Root defaultOpen>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.queryByText('Content')).not.toBe(null);

    await fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).toBe(null);
  });

  it('keeps the trigger when closing with a tooltip trigger close button', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Popover.Root defaultOpen onOpenChange={handleOpenChange}>
        <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close
                data-testid="close"
                v-slots={{
                  render: ({ props }: { props: Record<string, unknown> }) => (
                    <Tooltip.Root>
                      <Tooltip.Trigger {...props}>Close</Tooltip.Trigger>
                      <Tooltip.Portal>
                        <Tooltip.Positioner>
                          <Tooltip.Popup>Tooltip</Tooltip.Popup>
                        </Tooltip.Positioner>
                      </Tooltip.Portal>
                    </Tooltip.Root>
                  ),
                }}
              />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    expect(screen.queryByText('Content')).not.toBe(null);

    await fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).toBe(null);
    expect(handleOpenChange.mock.calls[0][0]).toBe(false);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger?.id).toBe('trigger-1');
  });

  // `triggerId` can point at a trigger that isn't mounted (for example while a controlled id is
  // being handed over), but the popup is still anchored to the element it opened against, so the
  // close event has to report that element rather than nothing.
  it('falls back to the active trigger element when the active trigger id is unregistered', async () => {
    const handleOpenChange = vi.fn();
    const triggerId = shallowRef<string | null>('trigger-1');

    const App = defineComponent(() => () => (
      <Popover.Root open triggerId={triggerId.value} onOpenChange={handleOpenChange}>
        <Popover.Trigger id="trigger-1">Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>
    ));

    await render(<App />);
    await flushMicrotasks();

    triggerId.value = 'unregistered';
    await flushMicrotasks();

    await fireEvent.click(screen.getByTestId('close'));

    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).toBe(
      screen.getByRole('button', {
        name: 'Trigger',
      }),
    );
  });

  it('reports no trigger when the active trigger id has no mounted trigger', async () => {
    const handleOpenChange = vi.fn();

    await render(
      <Popover.Root defaultOpen defaultTriggerId="never-mounted" onOpenChange={handleOpenChange}>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              Content
              <Popover.Close data-testid="close" />
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();

    await fireEvent.click(screen.getByTestId('close'));

    expect(screen.queryByText('Content')).toBe(null);
    expect(handleOpenChange).toHaveBeenCalledTimes(1);
    expect(handleOpenChange.mock.calls[0][1].reason).toBe(REASONS.closePress);
    expect(handleOpenChange.mock.calls[0][1].trigger).toBe(undefined);
  });

  it('does not close the popover while disabled', async () => {
    const handleOpenChange = vi.fn();
    const { user } = await render(
      <Popover.Root defaultOpen onOpenChange={handleOpenChange}>
        <Popover.Trigger>Trigger</Popover.Trigger>
        <Popover.Portal>
          <Popover.Positioner>
            <Popover.Popup>
              <Popover.Close disabled>Native</Popover.Close>
              <Popover.Close disabled as="span" nativeButton={false}>
                Custom
              </Popover.Close>
            </Popover.Popup>
          </Popover.Positioner>
        </Popover.Portal>
      </Popover.Root>,
    );
    await flushMicrotasks();
    const native = screen.getByRole('button', { name: 'Native' });
    const custom = screen.getByRole('button', { name: 'Custom' });
    expect(native).toBeDisabled();
    expect(custom).toHaveAttribute('aria-disabled', 'true');

    await user.click(native);
    await user.click(custom);

    expect(handleOpenChange).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-open');
  });
});
