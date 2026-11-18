import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, watch } from 'vue';
import { Tooltip } from '@vase-ui/vue/tooltip';
import { createRenderer, fireEvent, screen } from '#test-utils';
import { useTooltipRootContext } from './TooltipRootContext';

describe('Tooltip popup owner', () => {
  const { render } = createRenderer();

  it('preserves a synchronous write and publishes the trigger before open', async () => {
    const handle = Tooltip.createHandle<string>();
    const seen: unknown[] = [];
    const Observer = defineComponent(() => {
      const owner = useTooltipRootContext();
      watch(owner.triggerId, () => handle.store.set('closeDelay', 37), { flush: 'sync' });
      watch(owner.open, () => seen.push([owner.triggerId.value, handle.store.state.closeDelay]), {
        flush: 'sync',
      });
      return () => null;
    });

    await render(
      <>
        <Tooltip.Trigger handle={handle} id="first" payload="First">
          First
        </Tooltip.Trigger>
        <Tooltip.Trigger handle={handle} id="second" payload="Second">
          Second
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle}>
          <Observer />
        </Tooltip.Root>
      </>,
    );

    handle.open('second');
    expect(seen).toEqual([['second', 37]]);
    expect(handle.store.select('isOpenedByTrigger', 'first')).toBe(false);
    expect(handle.store.select('isOpenedByTrigger', 'second')).toBe(true);
    await nextTick();
    expect(handle.store.state.payload).toBe('Second');
    expect(screen.getByRole('button', { name: 'First' })).not.toHaveAttribute('data-popup-open');
    expect(screen.getByRole('button', { name: 'Second' })).toHaveAttribute('data-popup-open');
  });

  it('keeps a detached trigger closed when the parent refuses its request', async () => {
    const handle = Tooltip.createHandle();
    const change = vi.fn();
    await render(
      <>
        <Tooltip.Trigger handle={handle} id="refused">
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} open={false} onOpenChange={change}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Hint</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </>,
    );
    handle.open('refused');
    await nextTick();
    expect(change).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'imperative-action' }),
    );
    expect(handle.isOpen).toBe(false);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-popup-open');
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('reads the current trigger action after a handle write', async () => {
    const handle = Tooltip.createHandle();
    const click = vi.fn();
    await render(
      <Tooltip.Root handle={handle} trackCursorAxis="both">
        <Tooltip.Trigger>Trigger</Tooltip.Trigger>
      </Tooltip.Root>,
    );
    expect(handle.store.select('triggerProps', true).onClick).toBeTypeOf('function');
    handle.store.update({ activeTriggerProps: { onClick: click } });
    await nextTick();
    await fireEvent.click(screen.getByRole('button'));
    expect(click).toHaveBeenCalledOnce();
  });
});
