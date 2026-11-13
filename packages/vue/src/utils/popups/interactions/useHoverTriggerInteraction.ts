import { computed, onDeactivated, onMounted, onScopeDispose, toValue, watch } from 'vue';
import type { MaybeRefOrGetter, Ref } from 'vue';
import { contains } from '../../../common/shadowDom';
import { createChangeEventDetails } from '../../../internals/createBaseUIEventDetails';
import { REASONS } from '../../../internals/reasons';
import type { FloatingUIOpenChangeDetails, HTMLProps } from '../../../internals/types';
import { useFloatingTree } from '../tree/FloatingTree';
import type { FloatingTreeStore } from '../tree/FloatingTreeStore';
import type { Delay, PopupInteractionStore } from '../types';
import { getHoverIntent } from './hoverIntent';
import type { HoverIntent, HoverIntentTriggerOptions } from './hoverIntent';
import { isHoverOpenEvent } from './useHoverShared';
import type { HandleClose, HandleCloseContextBase } from './useHoverShared';

// A plain `HandleClose` function is not a valid value, because `toValue` calls a function.
type HandleCloseSource =
  null | Readonly<Ref<HandleClose | null | undefined>> | (() => HandleClose | null | undefined);

export interface UseHoverTriggerInteractionProps {
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  handleClose?: HandleCloseSource | undefined;
  restMs?: MaybeRefOrGetter<number | undefined>;
  delay?: MaybeRefOrGetter<Delay | undefined>;
  /**
   * Whether the first `mousemove` that comes with no `mouseenter` counts as an enter.
   * @default true
   */
  move?: MaybeRefOrGetter<boolean | undefined>;
  mouseOnly?: MaybeRefOrGetter<boolean | undefined>;
  externalTree?: MaybeRefOrGetter<FloatingTreeStore | undefined>;
  /**
   * Whether the composable controls the active trigger. A trigger that is not the active trigger
   * does not give its safe polygon options to the popup.
   * @default true
   */
  isActiveTrigger?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * The element of the trigger. The safe polygon and `KeepAlive` close the popup only when this
   * element is the anchor of the store.
   */
  triggerElement?: MaybeRefOrGetter<Element | null | undefined>;
  getHandleCloseContext?: (() => HandleCloseContextBase | null) | undefined;
  /**
   * Called before each hover-driven open attempt (immediate, delayed, and rest-ms
   * paths). Return `false` to veto; any other return value permits the open.
   */
  shouldOpen?: (() => boolean) | undefined;
  /**
   * Regression workaround (https://github.com/mui/base-ui/issues/5152): also cancels a pending
   * hover-open from the `mouseout` of the trigger, backing up a `mouseleave` that Chrome can drop
   * during a fast pointer sweep and leave a submenu stuck open.
   *
   * WARNING: only enable on single-trigger, hover-driven roots (e.g.
   * `Menu.SubmenuTrigger`). It skips the `isClickLikeOpenEvent()` and
   * `isInsideEnabledTrigger()` checks `mouseleave` applies, so on a
   * multi-trigger or click-driven root it cancels legitimate opens/closes.
   * @default false
   */
  guardStaleOpen?: MaybeRefOrGetter<boolean | undefined>;
}

/**
 * Gives the listeners of a trigger that opens and closes a popup on hover. Call it in `setup`.
 * The part puts the object in the `props` of `useRenderElement`, before its own props and its
 * attributes. Each listener returns while the composable is not enabled.
 */
export function useHoverTriggerInteraction(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseHoverTriggerInteractionProps = {},
): Omit<HTMLProps, 'ref'> {
  const enabled = () => toValue(props.enabled) ?? true;
  const isActiveTrigger = () => toValue(props.isActiveTrigger) ?? true;
  const handleClose = () => toValue(props.handleClose) ?? null;
  const move = () => toValue(props.move) ?? true;
  const mouseOnly = () => toValue(props.mouseOnly) ?? false;

  const tree = useFloatingTree(props.externalTree);
  // The intent is made at the first read. A server render reads it in no hook, so it makes none.
  const intent = computed(() => getHoverIntent(toValue(store)));

  let isHoverCloseActive = false;
  // Base UI adds a `mousemove` listener with `once: true` in an effect, so the first `mousemove`
  // counts as an enter.
  let moveCountsAsEnter = true;

  const options: HoverIntentTriggerOptions = {
    delay: () => toValue(props.delay) ?? 0,
    restMs: () => toValue(props.restMs) ?? 0,
    handleClose,
    enabled,
    isHoverCloseActive: () => isHoverCloseActive,
    triggerElement: () => toValue(props.triggerElement) ?? null,
    mouseOnly,
    tree: () => tree.value,
    shouldOpen: () => props.shouldOpen?.() !== false,
    getHandleCloseContext: props.getHandleCloseContext,
  };

  function applyHandleCloseOptions() {
    if (isActiveTrigger()) {
      intent.value.handleCloseOptions = handleClose()?.__options;
    }
  }
  onMounted(applyHandleCloseOptions);
  watch([intent, isActiveTrigger, handleClose], applyHandleCloseOptions);

  function stop(current: HoverIntent) {
    current.cancelPendingOpen();
    current.stopSafePolygon();
  }

  // Vue runs the cleanup of a part in the render of its parent. The cleanup thus reads no
  // reactive state, and it stops the intent that the last run found.
  let stopInFlight: (() => void) | undefined;
  function holdIntent() {
    stopInFlight?.();
    const current = intent.value;
    stopInFlight = () => stop(current);
  }
  onMounted(holdIntent);
  watch(intent, holdIntent);
  onScopeDispose(() => stopInFlight?.());

  watch(enabled, (isEnabled) => {
    if (!isEnabled) {
      stopInFlight?.();
    }
  });

  // `KeepAlive` sends no leave event. A popup that hover opened would then stay open after the
  // activation, with no pointer on its trigger.
  onDeactivated(() => {
    stopInFlight?.();
    const current = toValue(store);
    if (
      current.select('open') &&
      isHoverOpenEvent(current.context.openEvent?.type) &&
      (toValue(props.triggerElement) ?? null) === current.select('anchorElement')
    ) {
      current.setOpen(false, createChangeEventDetails(REASONS.triggerHover));
    }
  });

  // A close with any reason cancels an open that waits.
  function onOpenChangeLocal(details: FloatingUIOpenChangeDetails) {
    if (!details.open) {
      isHoverCloseActive = details.reason === REASONS.triggerHover;
      intent.value.cancel();
    } else {
      isHoverCloseActive = false;
    }
  }
  let stopListening: (() => void) | undefined;
  function listenToOpenChange() {
    stopListening?.();
    stopListening = undefined;
    if (!enabled()) {
      return;
    }
    const { events } = toValue(store).context;
    events.on('openchange', onOpenChangeLocal);
    stopListening = () => events.off('openchange', onOpenChangeLocal);
  }
  onMounted(listenToOpenChange);
  watch([enabled, () => toValue(store).context.events], listenToOpenChange);
  onScopeDispose(() => stopListening?.());

  watch([enabled, move, mouseOnly, tree, intent], () => {
    moveCountsAsEnter = true;
  });

  function setPointerType(event: PointerEvent) {
    if (enabled()) {
      intent.value.pointerType = event.pointerType;
    }
  }

  return {
    onPointerdown: setPointerType,
    onPointerenter: setPointerType,
    onMouseenter(event: MouseEvent) {
      if (enabled()) {
        intent.value.onTriggerMouseEnter(event, options);
      }
    },
    onMouseleave(event: MouseEvent) {
      if (enabled()) {
        intent.value.onTriggerMouseLeave(event, options);
      }
    },
    // Backup cancellation for Chrome's dropped `mouseleave` — see `guardStaleOpen`.
    onMouseout(event: MouseEvent) {
      if (!enabled() || !(toValue(props.guardStaleOpen) ?? false)) {
        return;
      }
      // The pointer moved within the subtree of the trigger.
      if (contains(event.currentTarget as Element, event.relatedTarget as Element | null)) {
        return;
      }
      intent.value.cancelPendingOpen();
    },
    onMousemove(event: MouseEvent) {
      if (!enabled()) {
        return;
      }
      if (move() && moveCountsAsEnter) {
        moveCountsAsEnter = false;
        intent.value.onTriggerMouseEnter(event, options);
      }
      intent.value.onTriggerMouseMove(event, options);
    },
  };
}
