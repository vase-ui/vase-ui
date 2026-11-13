import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { Placement } from '@floating-ui/vue';
import { renderToString } from 'vue/server-renderer';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { provideFloatingTree, useFloatingNodeId } from '../tree/FloatingTree';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { useVaseUIFloating } from './useFloating';

describe('useVaseUIFloating', () => {
  it('writes nothing to the store and to the tree on a server', async () => {
    const tree = new FloatingTreeStore();
    const store = new FloatingRootStore({
      open: false,
      anchorElement: null,
      positionerElement: null,
      triggerElements: new PopupTriggerMap(),
      defaultPopupId: undefined,
      nested: false,
      onOpenChange: undefined,
    });
    const clearPositioning = vi.spyOn(store, 'clearPositioning');
    const positioning = {
      reference: computed(() => null),
      placement: shallowRef<Placement>('bottom'),
    };
    const Positioner = defineComponent({
      setup() {
        const nodeId = useFloatingNodeId();
        useVaseUIFloating({ rootStore: store, mounted: false, positioning, nodeId });
        return () => <div />;
      },
    });
    const Root = defineComponent({
      setup() {
        provideFloatingTree(tree);
        return () => <Positioner />;
      },
    });

    const html = await renderToString(<Root />);

    expect(typeof document).toBe('undefined');
    expect(html).toBe('<div></div>');
    expect(store.context.positioning).toBeUndefined();
    expect(tree.nodesRef.value).toEqual([]);
    expect(clearPositioning).not.toHaveBeenCalled();
  });
});
