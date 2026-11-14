<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ContextMenuTriggerState {
  /**
   * Whether the context menu is currently open.
   */
  open: boolean;
}

export interface ContextMenuTriggerProps
  extends
    VaseUIComponentProps<ContextMenuTriggerState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onScopeDispose } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerDocument } from '../../common/owner';
import { contains, getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useMenuRootContext } from '../../menu/root/MenuRootContext';
import { stopEvent } from '../../utils/popups/event';
import { pressableTriggerOpenStateMapping } from '../../utils/popups/popupStateMapping';
import { useContextMenuRootContext } from '../root/ContextMenuRootContext';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ContextMenuTriggerProps>(), {
  as: 'div',
});

defineSlots<{
  default(props: { state: ContextMenuTriggerState }): unknown;
  render: ComponentRenderFn<HTMLProps, ContextMenuTriggerState>;
}>();

const LONG_PRESS_DELAY = 500;
const MOVE_THRESHOLD = 10;

const {
  setAnchor,
  actionsRef,
  internalBackdropRef,
  backdropRef,
  positionerRef,
  allowMouseUpTriggerRef,
  initialCursorPointRef,
} = useContextMenuRootContext(false);

const { store } = useMenuRootContext(false);

const state = computed<ContextMenuTriggerState>(() => ({ open: store.select('open') }));

let pressPosition: { x: number; y: number } | null = null;
const longPressTimeout = useTimeout();
const allowMouseUpTimeout = useTimeout();
let allowMouseUp = false;
let mouseUpAbortController: AbortController | null = null;
let removeDocumentListener: (() => void) | undefined;
// `onActivated` also runs at the first mount.
let deactivated = false;

function handleLongPress(x: number, y: number, event: MouseEvent | TouchEvent) {
  const isTouchEvent = event.type.startsWith('touch');

  initialCursorPointRef.value = { x, y };

  setAnchor({
    getBoundingClientRect() {
      return DOMRect.fromRect({
        width: isTouchEvent ? 10 : 0,
        height: isTouchEvent ? 10 : 0,
        x,
        y,
      });
    },
  });

  allowMouseUp = false;
  actionsRef.value?.setOpen(true, createChangeEventDetails(REASONS.triggerPress, event));

  allowMouseUpTimeout.start(LONG_PRESS_DELAY, () => {
    allowMouseUp = true;
  });
}

function handleContextMenu(event: MouseEvent) {
  if (store.select('disabled')) {
    return;
  }
  allowMouseUpTriggerRef.value = true;
  stopEvent(event);
  handleLongPress(event.clientX, event.clientY, event);
  const doc = ownerDocument(element.value);

  // Abort a listener from a previous trigger that never saw its mouseup, and scope this
  // one to a fresh controller so it's removed on unmount if the mouseup never arrives.
  mouseUpAbortController?.abort();
  const controller = new AbortController();
  mouseUpAbortController = controller;
  doc.addEventListener(
    'mouseup',
    (mouseEvent) => {
      allowMouseUpTriggerRef.value = false;

      if (!allowMouseUp) {
        return;
      }

      allowMouseUpTimeout.clear();
      allowMouseUp = false;

      const mouseUpTarget = getTarget(mouseEvent) as Element | null;

      if (contains(positionerRef.value, mouseUpTarget)) {
        return;
      }

      actionsRef.value?.setOpen(false, createChangeEventDetails(REASONS.cancelOpen, mouseEvent));
    },
    { once: true, signal: controller.signal },
  );
}

function cancelLongPress() {
  longPressTimeout.clear();
  pressPosition = null;
}

function startLongPress(x: number, y: number, event: TouchEvent | PointerEvent) {
  pressPosition = { x, y };
  longPressTimeout.start(LONG_PRESS_DELAY, () => {
    handleLongPress(x, y, event);
  });
}

function cancelLongPressAfterMove(x: number, y: number) {
  if (longPressTimeout.isStarted() && pressPosition) {
    const deltaX = Math.abs(x - pressPosition.x);
    const deltaY = Math.abs(y - pressPosition.y);

    if (deltaX > MOVE_THRESHOLD || deltaY > MOVE_THRESHOLD) {
      cancelLongPress();
    }
  }
}

function handleTouchStart(event: TouchEvent) {
  if (store.select('disabled')) {
    cancelLongPress();
    return;
  }
  allowMouseUpTriggerRef.value = false;
  if (event.touches.length !== 1) {
    cancelLongPress();
    return;
  }

  event.stopPropagation();
  const touch = event.touches[0];
  startLongPress(touch.clientX, touch.clientY, event);
}

function handleTouchMove(event: TouchEvent) {
  if (event.touches.length !== 1) {
    cancelLongPress();
    return;
  }

  const touch = event.touches[0];
  cancelLongPressAfterMove(touch.clientX, touch.clientY);
}

// Some stylus devices send only pointer events for a press, so the long press also starts from
// `pointerdown` of a pen: https://github.com/mui/base-ui/issues/4854
function handlePenDown(event: PointerEvent) {
  if (event.pointerType !== 'pen') {
    return;
  }
  if (store.select('disabled')) {
    cancelLongPress();
    return;
  }
  allowMouseUpTriggerRef.value = false;
  event.stopPropagation();
  startLongPress(event.clientX, event.clientY, event);
}

function handlePenMove(event: PointerEvent) {
  if (event.pointerType === 'pen') {
    cancelLongPressAfterMove(event.clientX, event.clientY);
  }
}

function handlePenEnd(event: PointerEvent) {
  if (event.pointerType === 'pen') {
    cancelLongPress();
  }
}

function handleDocumentContextMenu(event: MouseEvent) {
  if (store.select('disabled')) {
    return;
  }

  const targetElement = getTarget(event) as HTMLElement | null;
  if (
    contains(element.value, targetElement) ||
    contains(internalBackdropRef.value, targetElement) ||
    contains(backdropRef.value, targetElement)
  ) {
    event.preventDefault();
  }
}

function listenToDocument() {
  removeDocumentListener = addEventListener(
    ownerDocument(element.value),
    'contextmenu',
    handleDocumentContextMenu,
  );
}

function release() {
  removeDocumentListener?.();
  removeDocumentListener = undefined;
  // Abort a pending mouseup listener if the trigger unmounts before it fires.
  mouseUpAbortController?.abort();
  mouseUpAbortController = null;
  cancelLongPress();
  allowMouseUpTimeout.clear();
  allowMouseUp = false;
}

onMounted(listenToDocument);
onDeactivated(() => {
  deactivated = true;
  release();
});
onActivated(() => {
  if (deactivated) {
    deactivated = false;
    listenToDocument();
  }
});
onScopeDispose(release);

const { element, elementProps } = useRenderElement('div', props, {
  state,
  props: (attrs) => [
    {
      onContextmenu: handleContextMenu,
      // React adds these two listeners as passive listeners, and the handlers never prevent the default.
      onTouchstartPassive: handleTouchStart,
      onTouchmovePassive: handleTouchMove,
      onTouchend: cancelLongPress,
      onTouchcancel: cancelLongPress,
      onPointerdown: handlePenDown,
      onPointermove: handlePenMove,
      onPointerup: handlePenEnd,
      onPointercancel: handlePenEnd,
      // Stops the callout that Safari on iOS shows for a long press.
      style: {
        '-webkit-touch-callout': 'none',
      },
    },
    attrs,
  ],
  stateAttributesMapping: pressableTriggerOpenStateMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
