<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { SliderRootState } from '../root/SliderRoot.vue';

export interface SliderControlState extends SliderRootState {}

export interface SliderControlProps
  extends
    VaseUIComponentProps<SliderControlState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {}
</script>

<script setup lang="ts">
import { isElement } from '@floating-ui/utils/dom';
import { watch } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { clamp } from '../../common/clamp';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import { useListenerSession } from '../../common/useListenerSession';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { isTouchLikePointerType } from '../../internals/usePressAndHold';
import { useRenderElement } from '../../internals/useRenderElement';
import { sliderStateAttributesMapping, useSliderRootContext } from '../root/SliderRootContext';
import {
  getMidpoint,
  resolveThumbCollision,
  roundValueToStep,
  validateMinimumDistance,
} from '../utils/thumbValues';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderControlProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderControlState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderControlState>;
}>();

type Coords = { x: number; y: number };
type FingerState = ReturnType<typeof resolveThumbCollision>;

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return { start: 0, end: 0 };
  }

  const size = (value: string) => parseFloat(value) || 0;
  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start: size(styles[`border${start}Width`]) + size(styles[`padding${start}`]),
    end: size(styles[`border${end}Width`]) + size(styles[`padding${end}`]),
  };
}

const {
  props: rootProps,
  setControlElement,
  disabled,
  inset,
  isArrayValue,
  commitValue,
  renderBeforeHydration,
  setActive,
  setDragging,
  setValue,
  state,
  thumbRefs,
  thumbList,
  values,
  pressedThumb,
  setPressedThumb,
} = useSliderRootContext();

const direction = useDirection();

let control: HTMLElement | null = null;
let styles: CSSStyleDeclaration | null = null;
// A number that uniquely identifies the current finger in the touch session.
let touchId: number | null = null;
// The number of touch/pointermove events that have fired.
let moveCount = 0;
// The offset amount to each side of the control for inset sliders.
// This value should be equal to the radius or half the width/height of the thumb.
let insetThumbOffset = 0;
let initialValues: readonly number[] | undefined;
// A controlled parent can keep its value between two moves.
let lastChange: { value: number | number[]; model: readonly number[] } | null = null;
// Whether `pointerdown` started the current gesture, so the `touchstart` that follows it
// doesn't restart it.
let pointerGesture = false;
const { isHeld } = useKeepAliveState();
const pointerSession = useListenerSession(isHeld);
const touchSession = useListenerSession(isHeld);

function getFingerCoords(event: TouchEvent | PointerEvent): Coords | null {
  if ('changedTouches' in event) {
    // eslint-disable-next-line @typescript-eslint/prefer-for-of -- TouchList supports indexed access in each browser.
    for (let i = 0; i < event.changedTouches.length; i += 1) {
      const touch = event.changedTouches[i];
      if (touch && touch.identifier === touchId) return { x: touch.clientX, y: touch.clientY };
    }
    return null;
  }
  return { x: event.clientX, y: event.clientY };
}

function getThumbInput(el: Element | null | undefined) {
  return el?.isConnected ? thumbList.map.value.get(el)?.getInput() : null;
}

function updatePressedThumb(nextIndex: number) {
  setPressedThumb(nextIndex, thumbRefs.value[nextIndex] ? pressedThumb.centerOffset : null);
}

function isTargetDisabledThumb(target: EventTarget | null) {
  if (!isElement(target)) {
    return false;
  }

  return thumbRefs.value.some((thumbEl) => {
    const input = getThumbInput(thumbEl);
    return (
      (target === input || contains(thumbEl, target)) && (!input || input.matches(':disabled'))
    );
  });
}

function getFingerState(fingerCoords: Coords): FingerState | null {
  const thumbIndex = pressedThumb.index;

  if (!control || thumbIndex < 0 || thumbIndex >= values.value.length) {
    if (thumbIndex >= values.value.length) {
      lastChange = null;
    }
    return null;
  }

  const vertical = rootProps.orientation === 'vertical';
  const { width, height, bottom, left, right } = control.getBoundingClientRect();

  const controlOffset = getControlOffset(styles, vertical);
  const controlSize =
    (vertical ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffset * 2;
  const thumbCenterOffset = pressedThumb.centerOffset ?? 0;
  const fingerX = fingerCoords.x - thumbCenterOffset;
  const fingerY = fingerCoords.y - thumbCenterOffset;

  const valueSize = vertical
    ? bottom - fingerY - controlOffset.end
    : (direction.value === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
  // the value at the finger origin scaled down to fit the range [0, 1]
  const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

  let newValue = (rootProps.max - rootProps.min) * valueRescaled + rootProps.min;
  newValue = roundValueToStep(newValue, rootProps.step, rootProps.min);
  newValue = clamp(newValue, rootProps.min, rootProps.max);

  if (values.value.length <= 1) {
    return {
      value: isArrayValue.value ? [newValue] : newValue,
      thumbIndex,
      didSwap: false,
    };
  }

  return resolveThumbCollision(
    rootProps.thumbCollisionBehavior,
    values.value,
    lastChange?.model === values.value && Array.isArray(lastChange.value)
      ? lastChange.value
      : values.value,
    initialValues,
    thumbIndex,
    newValue,
    rootProps.min,
    rootProps.max,
    rootProps.step,
    rootProps.minStepsBetweenValues,
  );
}

function startPressing(fingerCoords: Coords) {
  const range = values.value.length > 1;
  const vertical = rootProps.orientation === 'vertical';
  initialValues = range ? values.value : undefined;
  lastChange = null;

  const pressedThumbIndex = pressedThumb.index;
  let closestThumbIndex = pressedThumbIndex;

  if (pressedThumbIndex > -1 && pressedThumbIndex < values.value.length) {
    if (values.value[pressedThumbIndex] === rootProps.max) {
      let candidateIndex = pressedThumbIndex;

      while (candidateIndex > 0 && values.value[candidateIndex - 1] === rootProps.max) {
        candidateIndex -= 1;
      }

      closestThumbIndex = candidateIndex;
    }
  } else {
    // pressed on control
    const axis = !vertical ? 'x' : 'y';
    let minDistance: number | undefined;

    closestThumbIndex = -1;

    for (let i = 0; i < thumbRefs.value.length; i += 1) {
      const thumbEl = thumbRefs.value[i];
      const input = getThumbInput(thumbEl);
      if (thumbEl && input && !input.matches(':disabled')) {
        const midpoint = getMidpoint(thumbEl, vertical);
        const distance = Math.abs(fingerCoords[axis] - midpoint);

        if (minDistance === undefined || distance <= minDistance) {
          closestThumbIndex = i;
          minDistance = distance;
        }
      }
    }
  }

  if (closestThumbIndex > -1 && closestThumbIndex !== pressedThumbIndex) {
    updatePressedThumb(closestThumbIndex);
  }

  if (inset.value) {
    const thumbEl = thumbRefs.value[closestThumbIndex];
    if (isElement(thumbEl)) {
      const thumbRect = thumbEl.getBoundingClientRect();
      const side = !vertical ? 'width' : 'height';
      insetThumbOffset = thumbRect[side] / 2;
    }
  }
}

function focusThumb(thumbIndex: number) {
  const input = getThumbInput(thumbRefs.value[thumbIndex]);
  if (!input) {
    return;
  }

  input.focus({
    preventScroll: true,
    // Prevent pointer-driven focus rings in browsers that support this option.
    // Supported in Chrome from 144+.
    focusVisible: false,
  } as FocusOptions);
}

function setValueFromPointer(
  finger: FingerState,
  reason: typeof REASONS.trackPress | typeof REASONS.drag,
  nativeEvent: TouchEvent | PointerEvent,
) {
  const applied = setValue(finger.value, finger.thumbIndex, reason, nativeEvent);
  if (applied) {
    lastChange = { value: finger.value, model: values.value };
    // Only track and focus the swapped thumb once the change is actually applied so a
    // canceled swap doesn't leak the new index into subsequent moves.
    if (finger.didSwap) {
      updatePressedThumb(finger.thumbIndex);
      focusThumb(finger.thumbIndex);
    }
  }
}

function handleTouchMove(nativeEvent: TouchEvent | PointerEvent) {
  const fingerCoords = getFingerCoords(nativeEvent);

  if (fingerCoords == null) {
    return;
  }

  moveCount += 1;

  // Cancel move in case some other element consumed a pointerup event and it was not fired.
  if ('buttons' in nativeEvent && nativeEvent.buttons === 0) {
    handleTouchEnd(nativeEvent);
    return;
  }

  const finger = getFingerState(fingerCoords);

  if (finger == null) {
    return;
  }

  if (validateMinimumDistance(finger.value, rootProps.step, rootProps.minStepsBetweenValues)) {
    if (!state.value.dragging && moveCount > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
      setDragging(true);
    }

    setValueFromPointer(finger, REASONS.drag, nativeEvent);
  }
}

function handleTouchEnd(nativeEvent: TouchEvent | PointerEvent) {
  if (getFingerCoords(nativeEvent) == null) {
    return;
  }

  setActive(-1);
  setDragging(false);

  setPressedThumb(-1, null);
  // A range can gain or lose a thumb before release.
  if (
    lastChange &&
    (!Array.isArray(lastChange.value) || lastChange.value.length === values.value.length)
  ) {
    commitValue(lastChange.value, nativeEvent);
  }

  if ('pointerType' in nativeEvent && control?.hasPointerCapture(nativeEvent.pointerId)) {
    control.releasePointerCapture(nativeEvent.pointerId);
  }

  stopListening();
}

function handlePointerCancel(nativeEvent: PointerEvent) {
  // The browser cancels a touch pointer once it starts panning, but the touch listeners keep
  // tracking the finger until `touchend` or `touchcancel`.
  if (touchId != null) {
    return;
  }

  handleTouchEnd(nativeEvent);
}

function handleTouchStart(nativeEvent: TouchEvent) {
  // Only the `touchstart` right after `pointerdown` belongs to the pointer gesture, so consume
  // the flag here where it can't outlive a cancelled gesture.
  const startedByPointer = pointerGesture;
  pointerGesture = false;

  if (disabled.value || isHeld.value) {
    return;
  }

  if (isTargetDisabledThumb(getTarget(nativeEvent))) {
    setPressedThumb(-1, null);
    return;
  }

  const touch = nativeEvent.changedTouches[0];
  if (touch == null) {
    return;
  }

  touchId = touch.identifier;

  // The pointer handlers already started this gesture. Keep its state and only add the touch
  // listeners, which continue tracking the finger if the browser cancels the pointer.
  if (!startedByPointer) {
    const fingerCoords = { x: touch.clientX, y: touch.clientY };
    startPressing(fingerCoords);

    const finger = getFingerState(fingerCoords);

    if (finger == null) {
      return;
    }

    focusThumb(finger.thumbIndex);
    setValueFromPointer(finger, REASONS.trackPress, nativeEvent);

    moveCount = 0;
  }

  const doc = ownerDocument(control);
  touchSession.start((onCleanup) => {
    onCleanup(addEventListener(doc, 'touchmove', handleTouchMove, { passive: true }));
    onCleanup(addEventListener(doc, 'touchend', handleTouchEnd, { passive: true }));
    onCleanup(addEventListener(doc, 'touchcancel', handleTouchEnd, { passive: true }));
  });
}

function stopListening() {
  pointerSession.stop();
  touchSession.stop();
  touchId = null;
  initialValues = undefined;
  lastChange = null;
  pointerGesture = false;
}

const focusFrame = useAnimationFrame();

function onPointerdown(event: PointerEvent) {
  // Replace a flag left by a cancelled gesture that had no `touchstart` to consume it.
  pointerGesture = false;
  const target = getTarget(event);

  if (
    !control ||
    disabled.value ||
    isHeld.value ||
    event.defaultPrevented ||
    !isElement(target) ||
    // Only handle left clicks
    event.button !== 0
  ) {
    return;
  }

  if (isTargetDisabledThumb(target)) {
    setPressedThumb(-1, null);
    return;
  }

  const fingerCoords = { x: event.clientX, y: event.clientY };
  startPressing(fingerCoords);

  const finger = getFingerState(fingerCoords);

  if (finger == null) {
    return;
  }

  const focused = activeElement(ownerDocument(control));
  const thumb = thumbRefs.value[finger.thumbIndex];
  const pressedOnFocusedThumb = getThumbInput(thumb)?.matches(':focus') || contains(thumb, focused);

  if (pressedOnFocusedThumb) {
    event.preventDefault();
  } else {
    focusFrame.request(() => {
      focusThumb(finger.thumbIndex);
    });
  }

  setDragging(true);

  const pressedOnAnyThumb = pressedThumb.centerOffset != null;
  if (!pressedOnAnyThumb) {
    setValueFromPointer(finger, REASONS.trackPress, event);
  }

  if (event.pointerId) {
    // The method throws for a pointer that the browser does not know, such as the pointer of an
    // event that a script dispatched. The drag then continues with the listeners of the document.
    try {
      control.setPointerCapture(event.pointerId);
    } catch {
      // No capture.
    }
  }

  moveCount = 0;
  // Touch and pen presses can be followed by a compatibility `touchstart` (Apple Pencil).
  pointerGesture = isTouchLikePointerType(event.pointerType);
  const doc = ownerDocument(control);
  pointerSession.start((onCleanup) => {
    onCleanup(addEventListener(doc, 'pointermove', handleTouchMove, { passive: true }));
    onCleanup(addEventListener(doc, 'pointerup', handleTouchEnd, { once: true }));
    onCleanup(addEventListener(doc, 'pointercancel', handlePointerCancel, { once: true }));
  });
}

function setControl(next: HTMLElement | null) {
  if (control) {
    focusFrame.cancel();
    stopListening();
  }
  setControlElement(next, control);
  control = next;
  styles = next ? ownerWindow(next).getComputedStyle(next) : null;
}

watch(disabled, (isDisabled) => {
  if (isDisabled) {
    stopListening();
  }
});

// A held control receives no pointer release.
watch(
  isHeld,
  (held) => {
    if (held) {
      focusFrame.cancel();
      stopListening();
      setDragging(false);
      setPressedThumb(-1, null);
    }
  },
  { flush: 'sync' },
);

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('div', props, {
  state,
  ref: setControl,
  props: (attrs) => [
    {
      'data-vase-ui-slider-control': renderBeforeHydration.value ? '' : undefined,
      onPointerdown,
      onTouchstartPassive: handleTouchStart,
    },
    attrs,
  ],
  stateAttributesMapping: sliderStateAttributesMapping,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
