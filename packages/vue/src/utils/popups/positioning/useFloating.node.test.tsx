import { describe, expect, it, vi } from 'vitest';
import { computed, defineComponent, shallowRef } from 'vue';
import type { Placement } from '@floating-ui/vue';
import { renderToString } from 'vue/server-renderer';
import { FloatingRootStore } from '../floating-root/FloatingRootStore';
import { PopupTriggerMap } from '../popupTriggerMap';
import { provideFloatingTree, useFloatingNodeId } from '../tree/FloatingTree';
import { FloatingTreeStore } from '../tree/FloatingTreeStore';
import { useVaseUIFloating } from './useFloating';

function createPopup() {
  const store = new FloatingRootStore({
    open: false,
    anchorElement: null,
    positionerElement: null,
    triggerElements: new PopupTriggerMap(),
    defaultPopupId: undefined,
    nested: false,
    onOpenChange: undefined,
  });
  const positioning = {
    reference: computed(() => null),
    placement: shallowRef<Placement>('bottom'),
  };
  return { store, positioning };
}

describe('useVaseUIFloating', () => {
  it('writes nothing to the store and to the tree on a server', async () => {
    const tree = new FloatingTreeStore();
    const { store, positioning } = createPopup();
    const clearPositioning = vi.spyOn(store, 'clearPositioning');
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

  it('reads the node id of a getter on a server, and writes nothing', async () => {
    const tree = new FloatingTreeStore();
    const { store, positioning } = createPopup();
    const externalTree = vi.fn(() => tree);
    const Positioner = defineComponent({
      setup() {
        const context = useVaseUIFloating({
          rootStore: store,
          mounted: true,
          positioning,
          nodeId: () => 'node',
          externalTree,
        });
        return () => <div data-node={context.nodeId} />;
      },
    });

    const html = await renderToString(<Positioner />);

    expect(html).toBe('<div data-node="node"></div>');
    expect(store.context.positioning).toBeUndefined();
    expect(tree.nodesRef.value).toEqual([]);
    expect(externalTree).not.toHaveBeenCalled();
  });
});
