import { describe, expect, it, vi } from 'vitest';
import { defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { createTestPopupStore } from '../../../test/popupStoreTestUtils';
import { useTriggerDataForwarding } from './popupStoreUtils';

describe('useTriggerDataForwarding', () => {
  it('registers no trigger and writes nothing to the store in a server render', async () => {
    const store = createTestPopupStore();
    store.update({ open: true, mounted: true, activeTriggerId: 'trigger' });
    const state = { ...store.state };
    const set = vi.spyOn(store, 'set');
    const update = vi.spyOn(store, 'update');

    const Trigger = defineComponent(() => {
      const { registerTrigger } = useTriggerDataForwarding(
        () => 'trigger',
        () => store,
        () => ({ payload: 'from trigger' }),
      );
      const setElement = (element: unknown) => registerTrigger(element as Element | null);

      return () => <button ref={setElement} />;
    });

    const html = await renderToString(<Trigger />);

    expect(html).toBe('<button></button>');
    expect(store.context.triggerElements.size).toBe(0);
    expect(set).not.toHaveBeenCalled();
    expect(update).not.toHaveBeenCalled();
    expect({ ...store.state }).toEqual(state);
  });
});
