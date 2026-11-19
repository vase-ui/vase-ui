import { describe, expect, it, vi } from 'vitest';
import { createSSRApp, defineComponent } from 'vue';
import { renderToString } from 'vue/server-renderer';
import { NOOP } from '../../common/empty';
import { getEmptyRootStore } from '../../utils/popups/floating-root/getEmptyRootStore';
import {
  useTestCursor,
  useTestDelayGroup as useDelayGroup,
} from '../../../test/fixtures/tooltipInteractions';
import { useTriggerFocus as useFocus } from '../../utils/popups/usePopupTrigger';
import { usePopupHover } from '../../utils/popups/interactions/usePopupHover';
import type { Delay } from '../../utils/popups/types';

// The store of a module is the store of a handle that no root controls. Each request shares it.
const sharedStore = Object.assign(getEmptyRootStore(), { closeForSibling: NOOP });

describe('useDelayGroup on a server', () => {
  it('writes no state to the group of the parts that have no provider', async () => {
    const on = vi.spyOn(sharedStore.context.events, 'on');
    // The member is open, so a write of the group on a server would show.
    const Member = defineComponent({
      setup() {
        const group = useDelayGroup(sharedStore, { open: true });
        const hoverProps = usePopupHover(sharedStore).trigger({ delay: group.delay });
        const focusProps = useFocus(sharedStore);
        const clientPointProps = useTestCursor(sharedStore);
        usePopupHover(sharedStore).popup();
        return () => (
          <button
            {...hoverProps}
            {...focusProps}
            {...clientPointProps}
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
