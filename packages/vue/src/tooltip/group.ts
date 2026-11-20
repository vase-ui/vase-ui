import { inject, onMounted, onScopeDispose, provide, watch, type InjectionKey } from 'vue';
import { Timeout, useTimeout } from '../common/useTimeout';
import type { PopupRoot } from '../popup/root';

/** A tooltip of a group. */
export interface GroupMember {
  readonly root: PopupRoot;
  /** Closes the tooltip, or ends its leave, because another tooltip of its group opened. */
  readonly closeForSibling: () => void;
}

/** The tooltips under one `Tooltip.Provider`, or the tooltips under no provider. */
export interface TooltipGroup {
  /** The group has a `Tooltip.Provider`. */
  readonly provider: boolean;
  delay(): number | undefined;
  closeDelay(): number | undefined;
  timeout(): number;
  /** The tooltip that keeps the group active: it is open, or the timer of its close runs. */
  current: GroupMember | null;
  readonly timer: Timeout;
}

// The tooltips with no provider share one group. A tooltip joins a group only after its mount, so a
// server render writes nothing to it.
const noProvider: TooltipGroup = {
  provider: false,
  delay: () => undefined,
  closeDelay: () => undefined,
  timeout: () => 0,
  current: null,
  timer: Timeout.create(),
};

const groupKey: InjectionKey<TooltipGroup> = Symbol('tooltip group');

/** The group of each trigger element, from the place of the trigger in the tree. */
const triggerGroups = new WeakMap<Element, TooltipGroup>();

export function provideGroup(props: {
  readonly delay?: number | undefined;
  readonly closeDelay?: number | undefined;
  readonly timeout: number;
}) {
  provide(groupKey, {
    provider: true,
    delay: () => props.delay,
    closeDelay: () => props.closeDelay,
    timeout: () => props.timeout,
    current: null,
    timer: useTimeout(),
  });
}

export function injectGroup() {
  return inject(groupKey, noProvider);
}

export function setTriggerGroup(element: Element, group: TooltipGroup) {
  triggerGroups.set(element, group);
}

/** The group is active: a tooltip of it is open, or the timer of its last close runs. */
export function isActive(group: TooltipGroup) {
  return group.current !== null;
}

function end(group: TooltipGroup) {
  group.timer.clear();
  group.current = null;
}

/**
 * Puts the tooltip of the root in the group of its active trigger while it is open. One tooltip of a
 * group is open at a time. `opensInGroup` gets `true` when the tooltip opens while another tooltip of
 * its group keeps the group active.
 */
export function useGroupMember(
  root: PopupRoot,
  fallback: TooltipGroup,
  member: {
    closeForSibling: () => void;
    opensInGroup: (inGroup: boolean) => void;
  },
) {
  const self: GroupMember = { root, closeForSibling: member.closeForSibling };
  let group: TooltipGroup | null = null;

  function join() {
    const trigger = root.activeTrigger;
    group = (trigger && triggerGroups.get(trigger)) ?? fallback;
    // The timer of a close of this tooltip would end the group while it is open again.
    group.timer.clear();
    const previous = group.current;
    group.current = self;
    const inGroup = previous !== null && previous !== self;
    member.opensInGroup(inGroup);
    if (inGroup) previous.closeForSibling();
  }

  function leave() {
    const current = group;
    if (current?.current !== self) return;
    // The next tooltip after one whose active trigger left the page waits for its delay.
    const timeout = root.activeTrigger?.isConnected ? current.timeout() : 0;
    if (timeout <= 0) {
      end(current);
      return;
    }
    current.timer.start(timeout, () => {
      if (current.current === self) end(current);
    });
  }

  onMounted(() => {
    watch(
      () => root.open,
      (open) => (open ? join() : leave()),
      { immediate: true, flush: 'sync' },
    );
  });
  // A closed tooltip that unmounts leaves the timer of its group.
  onScopeDispose(() => {
    if (group?.current === self && root.open) end(group);
  });
}
