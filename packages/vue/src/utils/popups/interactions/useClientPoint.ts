import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onScopeDispose,
  shallowRef,
  toValue,
  watch,
} from 'vue';
import type { MaybeRefOrGetter } from 'vue';
import { addEventListener } from '../../../common/addEventListener';
import { ownerWindow } from '../../../common/owner';
import { contains, getTarget } from '../../../common/shadowDom';
import type { HTMLProps } from '../../../internals/types';
import type { PopupInteractionContext, PopupInteractionStore } from '../types';
import { isMouseLikePointerType } from '../event';

function createVirtualElement(
  domElement: Element | null | undefined,
  data: {
    axis: 'x' | 'y' | 'both';
    storeContext: Pick<PopupInteractionContext, 'openEvent'>;
    pointerType: string | undefined;
    x: number | null;
    y: number | null;
  },
) {
  let offsetX: number | null = null;
  let offsetY: number | null = null;
  let isAutoUpdateEvent = false;

  return {
    contextElement: domElement ?? undefined,
    getBoundingClientRect() {
      const domRect = domElement?.getBoundingClientRect() ?? {
        width: 0,
        height: 0,
        x: 0,
        y: 0,
      };

      const isXAxis = data.axis === 'x' || data.axis === 'both';
      const isYAxis = data.axis === 'y' || data.axis === 'both';
      const canTrackCursorOnAutoUpdate =
        ['mouseenter', 'mousemove'].includes(data.storeContext.openEvent?.type || '') &&
        data.pointerType !== 'touch';

      const width = data.axis === 'y' ? domRect.width : 0;
      const height = data.axis === 'x' ? domRect.height : 0;
      let x = domRect.x;
      let y = domRect.y;

      if (offsetX == null && data.x && isXAxis) {
        offsetX = domRect.x - data.x;
      }

      if (offsetY == null && data.y && isYAxis) {
        offsetY = domRect.y - data.y;
      }

      x -= offsetX || 0;
      y -= offsetY || 0;

      if (!isAutoUpdateEvent || canTrackCursorOnAutoUpdate) {
        x = isXAxis && data.x != null ? data.x : x;
        y = isYAxis && data.y != null ? data.y : y;
      }

      isAutoUpdateEvent = true;

      return {
        width,
        height,
        x,
        y,
        top: y,
        right: x + width,
        bottom: y + height,
        left: x,
      };
    },
  };
}

function isMouseBasedEvent(event: Event | undefined): event is MouseEvent {
  return event != null && (event as MouseEvent).clientX != null;
}

export interface UseClientPointProps {
  /**
   * Whether the composable is enabled, including all its internal effects and event handlers.
   * @default true
   */
  enabled?: MaybeRefOrGetter<boolean | undefined>;
  /**
   * Whether to restrict the client point to an axis and use the reference
   * element (if it exists) as the other axis. This can be useful if the
   * floating element is also interactive.
   * @default 'both'
   */
  axis?: MaybeRefOrGetter<'x' | 'y' | 'both' | undefined>;
}

/**
 * Positions the floating element relative to a client point (in the viewport),
 * such as the mouse position. By default, it follows the mouse cursor.
 * A root part calls it in `setup` and gives the object to `usePopupInteractionProps` as the props
 * of its triggers. Each listener returns while the composable is not enabled.
 * @see https://floating-ui.com/docs/useClientPoint
 */
export function useClientPoint(
  store: MaybeRefOrGetter<PopupInteractionStore>,
  props: UseClientPointProps = {},
): Omit<HTMLProps, 'ref'> {
  const enabled = computed(() => toValue(props.enabled) ?? true);
  const axis = () => toValue(props.axis) ?? 'both';

  const open = computed(() => toValue(store).select('open'));
  const floating = computed(() => toValue(store).select('positionerElement'));
  const domReference = computed(() => toValue(store).select('anchorElement'));

  let disabledWhileOpen = false;
  let stopListening: (() => void) | null = null;
  let deactivated = false;
  // Vue runs the cleanup of a part in the render of its parent. The cleanup thus reads no reactive
  // state, and it clears the store of the last run.
  let anchoredStore: PopupInteractionStore | undefined;

  const pointerType = shallowRef<string | undefined>();
  const restartCount = shallowRef(0);

  function resetReference(reference: Element | null) {
    toValue(store).set('anchorOverride', reference);
  }

  function setReference(
    newX: number | null,
    newY: number | null,
    referenceElement?: Element | null,
  ) {
    if (disabledWhileOpen) {
      return;
    }

    const current = toValue(store);
    const storeContext = current.context;

    // A popup that a non-mouse event opened, such as a focus, keeps the anchor of its trigger. The
    // pointer on the trigger then does not move it.
    if (storeContext.openEvent && !isMouseBasedEvent(storeContext.openEvent)) {
      return;
    }

    current.set(
      'anchorOverride',
      createVirtualElement(referenceElement ?? domReference.value, {
        x: newX,
        y: newY,
        axis: axis(),
        storeContext,
        pointerType: pointerType.value,
      }),
    );
  }

  function handleReferenceEnterOrMove(event: MouseEvent) {
    if (!enabled.value) {
      return;
    }

    if (!open.value) {
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
    } else if (!stopListening) {
      // The window listener removes itself when the pointer lands on the popup. The pointer is on
      // the reference again, so the count adds the listener again.
      setReference(event.clientX, event.clientY, event.currentTarget as Element);
      restartCount.value += 1;
    }
  }

  // A mouse-like pointer moves the popup while the popup closes. A touch pointer stops at the
  // close, because the popup would move to the point of the tap that closes it.
  const openCheck = computed(() =>
    isMouseLikePointerType(pointerType.value) ? floating.value : open.value,
  );

  function removeWindowListener() {
    stopListening?.();
    stopListening = null;
  }

  function syncWindowListener() {
    removeWindowListener();

    const current = toValue(store);

    if (anchoredStore !== current) {
      anchoredStore?.set('anchorOverride', null);
      anchoredStore = current;
    }

    if (deactivated) {
      return;
    }

    if (!enabled.value) {
      resetReference(domReference.value);
      return;
    }

    if (!openCheck.value) {
      return;
    }

    const floatingElement = floating.value;
    const win = ownerWindow(floatingElement);

    function handleMouseMove(event: MouseEvent) {
      const target = getTarget(event) as Element | null;

      if (!contains(floatingElement, target)) {
        setReference(event.clientX, event.clientY);
      } else {
        removeWindowListener();
      }
    }

    if (!current.context.openEvent || isMouseBasedEvent(current.context.openEvent)) {
      stopListening = addEventListener(win, 'mousemove', handleMouseMove);
    } else {
      resetReference(domReference.value);
    }
  }

  // A server calls no `onMounted` hook and runs no such `watch`, so a server render adds no
  // listener to a window.
  onMounted(syncWindowListener);
  watch(
    [openCheck, enabled, floating, domReference, () => toValue(store), () => restartCount.value],
    syncWindowListener,
    {
      flush: 'post',
    },
  );
  onDeactivated(() => {
    deactivated = true;
    syncWindowListener();
  });
  // `onActivated` also runs at the first mount in a `KeepAlive`.
  onActivated(() => {
    if (deactivated) {
      deactivated = false;
      syncWindowListener();
    }
  });

  // The unmount clears the cursor anchor. `syncWindowListener` handles a change of `enabled` and a
  // change of the store.
  onScopeDispose(() => {
    removeWindowListener();
    anchoredStore?.set('anchorOverride', null);
  });

  function syncDisabledWhileOpen() {
    if (enabled.value && !floating.value) {
      disabledWhileOpen = false;
    }

    if (!enabled.value && open.value) {
      disabledWhileOpen = true;
    }
  }
  onMounted(syncDisabledWhileOpen);
  watch([enabled, floating, open], syncDisabledWhileOpen, { flush: 'post' });

  function setPointerType(event: PointerEvent) {
    if (enabled.value) {
      pointerType.value = event.pointerType;
    }
  }

  return {
    onPointerdown: setPointerType,
    onPointerenter: setPointerType,
    onMousemove: handleReferenceEnterOrMove,
    onMouseenter: handleReferenceEnterOrMove,
  };
}
