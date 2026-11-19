import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick, shallowRef, watch } from 'vue';
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
    const open = shallowRef(false);
    await render(() => (
      <>
        <Tooltip.Trigger handle={handle} id="refused">
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Root handle={handle} open={open.value} onOpenChange={change}>
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Hint</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </>
    ));
    handle.open('refused');
    await nextTick();
    expect(change).toHaveBeenCalledWith(
      true,
      expect.objectContaining({ reason: 'imperative-action' }),
    );
    expect(handle.isOpen).toBe(false);
    expect(screen.getByRole('button')).not.toHaveAttribute('data-popup-open');
    expect(screen.queryByText('Hint')).toBeNull();

    open.value = true;
    expect(await screen.findByText('Hint')).toBeInTheDocument();
  });

  it('registers a detached trigger with the store its handle supplies', async () => {
    const rootHandle = Tooltip.createHandle();
    class TriggerHandle extends Tooltip.Handle<unknown> {
      override get store() {
        return rootHandle.store;
      }
    }

    const triggerHandle = new TriggerHandle();
    await render(
      <>
        <Tooltip.Trigger handle={triggerHandle} id="detached">
          Trigger
        </Tooltip.Trigger>
        <Tooltip.Root handle={rootHandle} />
      </>,
    );

    rootHandle.open('detached');
    await nextTick();
    expect(screen.getByRole('button')).toHaveAttribute('data-popup-open');
  });

  it('mounts and removes the portal when a handle writes the mounted state', async () => {
    const handle = Tooltip.createHandle();
    await render(
      <Tooltip.Root handle={handle}>
        <Tooltip.Portal>Hint</Tooltip.Portal>
      </Tooltip.Root>,
    );

    handle.store.set('mounted', true);
    expect(await screen.findByText('Hint')).toBeInTheDocument();
    handle.store.set('mounted', false);
    await nextTick();
    expect(screen.queryByText('Hint')).toBeNull();
  });

  it('exposes writable actions on the first public handle read', async () => {
    const handle = Tooltip.createHandle();
    const click = vi.fn();
    const keys: string[][] = [];
    const Probe = defineComponent(() => {
      const { store } = useTooltipRootContext();
      watch(
        () => store.state.activeTriggerProps,
        (value) => keys.push(Object.keys(value)),
        {
          immediate: true,
          flush: 'sync',
        },
      );
      return () => null;
    });
    const { user, unmount } = await render(
      <>
        <Tooltip.Trigger handle={handle}>Trigger</Tooltip.Trigger>
        <Tooltip.Root handle={handle} trackCursorAxis="both">
          <Probe />
          <Tooltip.Portal>
            <Tooltip.Positioner>
              <Tooltip.Popup>Hint</Tooltip.Popup>
            </Tooltip.Positioner>
          </Tooltip.Portal>
        </Tooltip.Root>
      </>,
    );
    const trigger = screen.getByRole('button');
    await user.keyboard('[Tab]');
    expect(trigger).toHaveAttribute('data-popup-open');
    await user.keyboard('[Escape]');
    expect(trigger).not.toHaveAttribute('data-popup-open');
    expect(trigger).toHaveFocus();
    expect(keys).toEqual([[]]);
    const store = handle.store;
    expect(store.select('triggerProps', true).onClick).toBeTypeOf('function');
    expect(store.select('triggerProps', false).onClick).toBeTypeOf('function');
    expect(store.select('popupProps').onKeydown).toBeTypeOf('function');
    store.update({ activeTriggerProps: { onClick: click } });
    await nextTick();
    await fireEvent.click(trigger);
    expect(click).toHaveBeenCalledOnce();

    unmount();
    expect(store.state.activeTriggerProps).toEqual({});
    expect(store.state.inactiveTriggerProps).toEqual({});
    expect(store.state.popupProps).toEqual({});
  });
});
