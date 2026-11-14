import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { NOOP } from '../../../common/empty';
import { getEmptyRootStore } from '../floating-root/getEmptyRootStore';
import type { Delay } from '../types';
import { useFocus } from '../interactions/useFocus';
import { useHoverPopupInteraction } from '../interactions/useHoverPopupInteraction';
import { useHoverTriggerInteraction } from '../interactions/useHoverTriggerInteraction';
import { useDelayGroup } from './FloatingDelayGroup';

// The store of a module is the store of a handle that no root controls. Each request shares it.
const sharedStore = Object.assign(getEmptyRootStore(), { closeForSibling: NOOP });

describe('useDelayGroup on a server', () => {
  it('writes no state to the group of the parts that have no provider', async () => {
    const on = vi.spyOn(sharedStore.context.events, 'on');
    // The member is open, so a write of the group on a server would show.
    const Member = defineComponent({
      setup() {
        const group = useDelayGroup(sharedStore, { open: true });
        const hoverProps = useHoverTriggerInteraction(sharedStore, { delay: group.delay });
        const focusProps = useFocus(sharedStore);
        useHoverPopupInteraction(sharedStore);
        return () => (
          <button
            {...hoverProps}
            {...focusProps}
            data-instant-phase={group.isInstantPhase.value ? '' : undefined}
          />
        );
      },
    });
    let group: { activeId: string | null | undefined; delay: Delay } | undefined;
    const Probe = defineComponent({
      setup() {
        const { activeId, delay } = useDelayGroup(sharedStore, { open: false });
        group = { activeId: activeId(), delay: delay() };
        return () => null;
      },
    });

    const first = await renderToString(createSSRApp(Member));
    const second = await renderToString(createSSRApp(Member));
    await renderToString(createSSRApp(Probe));

    expect(first).toBe('<button></button>');
    expect(second).toBe(first);
    expect(on).not.toHaveBeenCalled();
    expect(group).toEqual({ activeId: null, delay: 0 });
  });
});
