import { describe, expect, it, vi } from 'vitest';
import { isReactive } from 'vue';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import { getEmptyRootStore } from './getEmptyRootStore';

describe('getEmptyRootStore', () => {
  it('gives a closed store with no anchor and no element', () => {
    const store = getEmptyRootStore();

    expect({
      open: store.select('open'),
      transitionStatus: store.select('transitionStatus'),
      anchor: store.select('anchor'),
      anchorElement: store.select('anchorElement'),
      positionerElement: store.select('positionerElement'),
      defaultPopupId: store.select('defaultPopupId'),
      nested: store.context.nested,
      triggers: store.context.triggerElements.size,
    }).toEqual({
      open: false,
      transitionStatus: undefined,
      anchor: null,
      anchorElement: null,
      positionerElement: null,
      defaultPopupId: undefined,
      nested: false,
      triggers: 0,
    });
  });

  it('takes no write, and its state and its context are frozen', () => {
    const store = getEmptyRootStore();
    const onOpenChange = vi.fn();
    store.context.events.on('openchange', onOpenChange);

    store.set('anchorElement', document.createElement('button'));
    store.set('anchorOverride', { getBoundingClientRect: () => new DOMRect() });
    store.setOpen(true, createChangeEventDetails(REASONS.imperativeAction));
    store.clearPositioning();

    expect(store.select('anchor')).toBe(null);
    expect(store.select('anchorElement')).toBe(null);
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(isReactive(Reflect.get(store, 'state'))).toBe(false);
    expect(() => {
      store.context.nested = true;
    }).toThrow(TypeError);
  });
});
