import { describe, expect, it } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { useClientPoint } from './useClientPoint';

// The window of the positioner element. It records each listener that the composable adds.
const added: string[] = [];
const popupWindow = {
  addEventListener: (type: string) => added.push(type),
  removeEventListener: () => {},
};
const positionerElement = { ownerDocument: { defaultView: popupWindow } } as unknown as HTMLElement;

// A module holds this store, so each request shares it. The popup is open and has an element, so a
// composable that added its listener in `setup` would add it here.
const sharedStore = new FloatingRootStore({
  open: true,
  anchorElement: null,
  positionerElement,
  triggerElements: new PopupTriggerMap(),
  defaultPopupId: undefined,
  nested: false,
  onOpenChange: undefined,
});

const Trigger = defineComponent({
  setup() {
    const clientPoint = useClientPoint(sharedStore);
    return () => <button {...clientPoint} />;
  },
});

describe('useClientPoint on a server', () => {
  it('adds no listener to the window of a store that two renders share', async () => {
    const first = await renderToString(createSSRApp(Trigger));
    const second = await renderToString(createSSRApp(Trigger));

    expect(added).toEqual([]);
    expect(first).toBe('<button></button>');
    expect(second).toBe(first);
  });
});
