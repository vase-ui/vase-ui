import { inject, onMounted, onScopeDispose, provide, shallowRef, toValue, watch } from 'vue';
import type { InjectionKey, MaybeRefOrGetter, Ref } from 'vue';
import { Timeout, useTimeout } from '../../../common/useTimeout';
import { getDelay } from '../interactions/useHoverShared';
import type { Delay, PopupInteractionStore } from '../types';

interface DelayGroupMember {
  closeForSibling: () => void;
  setIsInstantPhase: (value: boolean) => void;
}

/**
 * The state of a group. No field is reactive, as the refs of the context of Base UI are not, so a
 * change of a field renders no part.
 */
interface DelayGroup {
  hasProvider: boolean;
  timeoutMs: () => number;
  delay: Delay;
  initialDelay: Delay;
  timeout: Timeout;
  currentId: string | null | undefined;
  currentContext: DelayGroupMember | null;
}

/**
 * The parts that have no provider share this group, as they share the default context of Base UI.
 * The group holds state, so a server render must not join it. A server runs no `onMounted` hook
 * and no `watch` of a member.
 */
const DEFAULT_DELAY_GROUP: DelayGroup = {
  hasProvider: false,
  timeoutMs: () => 0,
  delay: 0,
  initialDelay: 0,
  timeout: Timeout.create(),
  currentId: null,
  currentContext: null,
};

const FloatingDelayGroupContext: InjectionKey<DelayGroup> = Symbol();

export interface FloatingDelayGroupOptions {
  /**
   * The delay to use for the group when it is not in the instant phase.
   */
  delay: MaybeRefOrGetter<Delay>;
  /**
   * How long the group stays active after a popup closes. Use it to make the group last longer
   * than the close delay, for example when there is no close delay. A change applies to the next
   * close.
   * @default 0
   */
  timeoutMs?: MaybeRefOrGetter<number | undefined>;
}

/**
 * Provides a group of floating elements that share a `delay`. Once one of them opens, the others
 * open instantly until `timeoutMs` passes after it closes. Call it in `setup`. The members read
 * the group when they need it, so a change of the delay renders no member.
 * Based on `NextFloatingDelayGroup` from `@floating-ui/react`.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function provideFloatingDelayGroup(options: FloatingDelayGroupOptions): void {
  const delay = toValue(options.delay);
  const group: DelayGroup = {
    hasProvider: true,
    timeoutMs: () => toValue(options.timeoutMs) ?? 0,
    delay,
    initialDelay: delay,
    timeout: useTimeout(),
    currentId: null,
    currentContext: null,
  };

  watch(
    () => toValue(options.delay),
    (nextDelay) => {
      group.initialDelay = nextDelay;
      if (!group.currentId) {
        group.delay = nextDelay;
        return;
      }
      group.delay = { open: getDelay(group.delay, 'open'), close: getDelay(nextDelay, 'close') };
    },
  );

  provide(FloatingDelayGroupContext, group);
}

interface UseDelayGroupOptions {
  /**
   * Whether the trigger that calls the composable opened the popup.
   */
  open: MaybeRefOrGetter<boolean>;
}

interface UseDelayGroupReturn {
  /**
   * The id of the popup that keeps the delay group active.
   */
  activeId: () => string | null | undefined;
  /**
   * The delay of the group now. While a popup keeps the group active, its open delay is 0.
   */
  delay: () => Delay;
  /**
   * Whether the popup has no animation. It is `true` for a popup that opens while another popup of
   * the group is open or has just closed, and for that other popup.
   */
  isInstantPhase: Readonly<Ref<boolean>>;
  /**
   * Whether a part above the caller called `provideFloatingDelayGroup`.
   */
  hasProvider: boolean;
}

/**
 * Makes the caller a member of the delay group above it. Call it in `setup`. The store can be a
 * ref or a getter, because a detached trigger moves from the store of its handle to the store of a
 * root.
 * @see https://floating-ui.com/docs/FloatingDelayGroup
 * @internal
 */
export function useDelayGroup(
  store: MaybeRefOrGetter<
    PopupInteractionStore & {
      /**
       * Closes the popup because another popup in the group opened.
       */
      closeForSibling(): void;
    }
  >,
  options: UseDelayGroupOptions,
): UseDelayGroupReturn {
  const group = inject(FloatingDelayGroupContext, DEFAULT_DELAY_GROUP);

  const isInstantPhase = shallowRef(false);
  const member: DelayGroupMember = {
    closeForSibling: () => toValue(store).closeForSibling(),
    setIsInstantPhase: (value) => {
      isInstantPhase.value = value;
    },
  };

  const isOpen = () => toValue(options.open);
  const getPopupId = () => toValue(store).select('defaultPopupId');

  function unset() {
    group.currentContext?.setIsInstantPhase(false);
    group.currentId = null;
    group.currentContext = null;
    group.delay = group.initialDelay;
    group.timeout.clear();
  }

  function onClose(id: string | undefined) {
    if (!group.currentId || group.currentId !== id) {
      return;
    }

    isInstantPhase.value = false;
    const timeoutMs = group.timeoutMs();
    if (!timeoutMs) {
      unset();
      return;
    }

    group.timeout.start(timeoutMs, () => {
      // Another popup took over the group, or this popup is open for another trigger.
      if (toValue(store).select('open') || (group.currentId && group.currentId !== id)) {
        return;
      }
      unset();
    });
  }

  function onOpen(id: string | undefined) {
    const previousContext = group.currentContext;
    const previousId = group.currentId;

    // A popup is opening, so the timer that would end the group must not run.
    group.timeout.clear();
    group.currentContext = member;
    group.currentId = id;
    group.delay = { open: 0, close: getDelay(group.initialDelay, 'close') };

    if (previousId !== null && previousId !== id) {
      isInstantPhase.value = true;
      previousContext?.setIsInstantPhase(true);
      previousContext?.closeForSibling();
    } else {
      isInstantPhase.value = false;
      previousContext?.setIsInstantPhase(false);
    }
  }

  // The values of the last run. Vue runs the cleanup of a part in the render of its parent, so the
  // cleanup must read no reactive state.
  let lastId: string | undefined;
  let lastOpen = false;

  // A popup that unmounts, or that gets a new id, stops being the context of the group. A closed
  // popup does not end the group: the timer of its close does.
  function release() {
    if (group.currentId !== lastId) {
      return;
    }

    group.currentContext = null;
    if (!lastOpen) {
      return;
    }
    group.currentId = null;
    group.delay = group.initialDelay;
    group.timeout.clear();
  }

  function update() {
    const open = isOpen();
    const id = getPopupId();
    if (id !== lastId) {
      release();
    }
    lastId = id;
    lastOpen = open;

    if (open) {
      onOpen(id);
    } else {
      onClose(id);
    }
  }

  // A popup that is open at the mount joins the group, as in Base UI. A server runs neither this
  // hook nor the watcher, so it never writes the group.
  onMounted(update);
  // The default flush runs the watcher before the render of the caller. A popup that the caller
  // renders is then inserted with its instant phase. With `flush: 'post'`, the phase comes after
  // the insert.
  watch([isOpen, getPopupId], update);
  onScopeDispose(release);

  return {
    activeId: () => group.currentId,
    delay: () => group.delay,
    isInstantPhase,
    hasProvider: group.hasProvider,
  };
}
