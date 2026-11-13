import { describe, expect, it, vi } from 'vitest';
import { defineComponent, nextTick } from 'vue';
import { createRenderer } from '#test-utils';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { PopupTriggerMap } from '../popupTriggerMap';
import { FloatingRootStore } from './FloatingRootStore';

function createStore(options: Partial<ConstructorParameters<typeof FloatingRootStore>[0]> = {}) {
  return new FloatingRootStore({
    open: false,
    anchorElement: null,
    positionerElement: null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: undefined,
    ...options,
  });
}

describe('FloatingRootStore', () => {
  const { render } = createRenderer();

  describe('setOpen', () => {
    it('tells the interaction composables and then the owner, and leaves open to the owner', () => {
      const calls: string[] = [];
      const onOpenChange = vi.fn(() => {
        calls.push('owner');
      });
      const store = createStore({ onOpenChange });
      store.context.events.on('openchange', (details) => {
        calls.push(`interaction ${details.open}`);
      });
      const eventDetails = createChangeEventDetails(REASONS.triggerPress);

      store.setOpen(true, eventDetails);

      expect(calls).toEqual(['interaction true', 'owner']);
      expect(onOpenChange).toHaveBeenCalledWith(true, eventDetails);
      expect(store.select('open')).toBe(false);
    });

    // Vue calls a function ref during the render of the part. A read of the state in the callback
    // would make that render depend on the state.
    it('adds no dependency to the render of a part when its ref callback calls it', async () => {
      const store = createStore();
      let renders = 0;
      const Part = defineComponent(() => () => {
        renders += 1;
        return <div ref={() => store.setOpen(false, createChangeEventDetails(REASONS.none))} />;
      });

      await render(<Part />);
      expect(renders).toBe(1);

      store.set('open', true);
      await nextTick();

      expect(renders).toBe(1);
    });
  });

  it('reads the anchor override before the anchor element', () => {
    const anchorElement = document.createElement('button');
    const anchorOverride = { getBoundingClientRect: () => new DOMRect(1, 2, 3, 4) };
    const store = createStore({ anchorElement });
    expect(store.select('anchor')).toBe(anchorElement);

    store.set('anchorOverride', anchorOverride);

    expect(store.select('anchor')).toBe(anchorOverride);
    expect(store.select('anchorElement')).toBe(anchorElement);
  });

  it('forgets the anchor and the elements on clearPositioning, and keeps the rest', () => {
    const store = createStore({
      open: true,
      anchorElement: document.createElement('button'),
      positionerElement: document.createElement('div'),
      defaultPopupId: 'popup',
    });
    store.set('anchorOverride', { getBoundingClientRect: () => new DOMRect() });

    store.clearPositioning();

    expect({
      anchor: store.select('anchor'),
      anchorElement: store.select('anchorElement'),
      positionerElement: store.select('positionerElement'),
      open: store.select('open'),
      defaultPopupId: store.select('defaultPopupId'),
    }).toEqual({
      anchor: null,
      anchorElement: null,
      positionerElement: null,
      open: true,
      defaultPopupId: 'popup',
    });
  });
});
