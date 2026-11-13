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
import { onDeactivated, onScopeDispose, watch } from 'vue';
import { clamp } from '../../common/clamp';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { activeElement, contains, getTarget } from '../../common/shadowDom';
import { useAnimationFrame } from '../../common/useAnimationFrame';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useDirection } from '../../internals/direction-context/DirectionContext';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import type {
  SliderRootChangeEventDetails,
  SliderRootCommitEventDetails,
} from '../root/SliderRoot.vue';
import { useSliderRootContext } from '../root/SliderRootContext';
import { sliderStateAttributesMapping } from '../root/stateAttributesMapping';
import { getMidpoint } from '../utils/getMidpoint';
import { resolveThumbCollision } from '../utils/resolveThumbCollision';
import { roundValueToStep } from '../utils/roundValueToStep';
import { validateMinimumDistance } from '../utils/validateMinimumDistance';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<SliderControlProps>(), { as: 'div' });

defineSlots<{
  default(props: { state: SliderControlState }): unknown;
  render: ComponentRenderFn<HTMLProps, SliderControlState>;
}>();

interface Coords {
  x: number;
  y: number;
}

interface FingerState {
  value: number | number[];
  thumbIndex: number;
  didSwap: boolean;
}

const INTENTIONAL_DRAG_COUNT_THRESHOLD = 2;

function getControlOffset(styles: CSSStyleDeclaration | null, vertical: boolean) {
  if (!styles) {
    return { start: 0, end: 0 };
  }

  function parseSize(value: string | null | undefined) {
    const parsed = value != null ? parseFloat(value) : 0;
    return Number.isNaN(parsed) ? 0 : parsed;
  }

  const start = !vertical ? 'InlineStart' : 'Top';
  const end = !vertical ? 'InlineEnd' : 'Bottom';

  return {
    start: parseSize(styles[`border${start}Width`]) + parseSize(styles[`padding${start}`]),
    end: parseSize(styles[`border${end}Width`]) + parseSize(styles[`padding${end}`]),
  };
}

// Treat pen as touch-like to avoid forcing the software keyboard on stylus taps.
// Linux Chrome may emit "pen" historically for mouse usage due to a bug, but the touch path
// still works with minor behavioral differences.
function isTouchLikePointerType(pointerType: string) {
  return pointerType === 'touch' || pointerType === 'pen';
}

const {
  controlElement,
  disabled,
  dragging,
  inset,
  isArrayValue,
  lastChangeReasonRef,
  max,
  min,
  minStepsBetweenValues,
  onValueCommitted,
  orientation,
  pressedThumbCenterOffsetRef,
  pressedThumbIndexRef,
  pressedValuesRef,
  renderBeforeHydration,
  setActive,
  setDragging,
  setValue,
  state,
  step,
  thumbCollisionBehavior,
  thumbRefs,
  values,
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
let currentInteractionValue: number | number[] | null = null;
// Whether `pointerdown` started the current gesture, so the `touchstart` that follows it
// doesn't restart it.
let pointerGesture = false;
// The document that has the listeners of the current gesture. With Vue 3.6, a server also runs the
// cleanup of `onScopeDispose`, and a server has no document.
let listenedDocument: Document | null = null;
// The values that the last applied move gave, or else the values of the last change of the slider.
// A controlled parent can leave its own value as it was, and the next move still starts from the
// applied values.
let latestValues = values.value;
watch(
  values,
  (next) => {
    latestValues = next;
  },
  { flush: 'sync' },
);

function getFingerCoords(event: TouchEvent | PointerEvent): Coords | null {
  // The event is TouchEvent
  if (touchId != null && (event as TouchEvent).changedTouches) {
    const touchEvent = event as TouchEvent;
    for (let i = 0; i < touchEvent.changedTouches.length; i += 1) {
      const touch = touchEvent.changedTouches[i];
      if (touch.identifier === touchId) {
        return { x: touch.clientX, y: touch.clientY };
      }
    }

    return null;
  }

  // The event is PointerEvent
  return { x: (event as PointerEvent).clientX, y: (event as PointerEvent).clientY };
}

function getThumbInput(el: Element | null | undefined) {
  return el?.querySelector<HTMLInputElement>('input[type="range"]');
}

function updatePressedThumb(nextIndex: number) {
  pressedThumbIndexRef.value = nextIndex;
  if (!thumbRefs.value[nextIndex]) {
    pressedThumbCenterOffsetRef.value = null;
  }
}

function resetPressedThumb() {
  pressedThumbIndexRef.value = -1;
  pressedThumbCenterOffsetRef.value = null;
}

function isTargetDisabledThumb(target: EventTarget | null) {
  if (!isElement(target)) {
    return false;
  }

  return thumbRefs.value.some((thumbEl) => {
    if (!isElement(thumbEl) || !contains(thumbEl, target)) {
      return false;
    }

    return getThumbInput(thumbEl)?.disabled === true;
  });
}

function getFingerState(fingerCoords: Coords): FingerState | null {
  const thumbIndex = pressedThumbIndexRef.value;

  if (!control || thumbIndex < 0 || thumbIndex >= values.value.length) {
    if (thumbIndex >= values.value.length) {
      currentInteractionValue = null;
    }
    return null;
  }

  const vertical = orientation.value === 'vertical';
  const { width, height, bottom, left, right } = control.getBoundingClientRect();

  const controlOffset = getControlOffset(styles, vertical);
  const controlSize =
    (vertical ? height : width) - controlOffset.start - controlOffset.end - insetThumbOffset * 2;
  const thumbCenterOffset = pressedThumbCenterOffsetRef.value ?? 0;
  const fingerX = fingerCoords.x - thumbCenterOffset;
  const fingerY = fingerCoords.y - thumbCenterOffset;

  const valueSize = vertical
    ? bottom - fingerY - controlOffset.end
    : (direction.value === 'rtl' ? right - fingerX : fingerX - left) - controlOffset.start;
  // the value at the finger origin scaled down to fit the range [0, 1]
  const valueRescaled = clamp((valueSize - insetThumbOffset) / controlSize, 0, 1);

  let newValue = (max.value - min.value) * valueRescaled + min.value;
  newValue = roundValueToStep(newValue, step.value, min.value);
  newValue = clamp(newValue, min.value, max.value);

  if (values.value.length <= 1) {
    return {
      value: isArrayValue.value ? [newValue] : newValue,
      thumbIndex,
      didSwap: false,
    };
  }

  return resolveThumbCollision(
    thumbCollisionBehavior.value,
    values.value,
    latestValues,
    pressedValuesRef.value,
    thumbIndex,
    newValue,
    min.value,
    max.value,
    step.value,
    minStepsBetweenValues.value,
  );
}

function startPressing(fingerCoords: Coords) {
  const range = values.value.length > 1;
  const vertical = orientation.value === 'vertical';
  pressedValuesRef.value = range ? values.value.slice() : null;
  currentInteractionValue = null;
  latestValues = values.value;

  const pressedThumbIndex = pressedThumbIndexRef.value;
  let closestThumbIndex = pressedThumbIndex;

  if (pressedThumbIndex > -1 && pressedThumbIndex < values.value.length) {
    if (values.value[pressedThumbIndex] === max.value) {
      let candidateIndex = pressedThumbIndex;

      while (candidateIndex > 0 && values.value[candidateIndex - 1] === max.value) {
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
      if (isElement(thumbEl) && !getThumbInput(thumbEl)?.disabled) {
        const midpoint = getMidpoint(thumbEl as HTMLElement, vertical);
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
  const input = getThumbInput(thumbRefs.value?.[thumbIndex]);
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
  const applied = setValue(
    finger.value,
    createChangeEventDetails(reason, nativeEvent as PointerEvent, undefined, {
      activeThumbIndex: finger.thumbIndex,
    }) as SliderRootChangeEventDetails,
  );

  if (applied) {
    currentInteractionValue = finger.value;
    latestValues = Array.isArray(finger.value) ? finger.value : [finger.value];

    // Only track and focus the swapped thumb once the change is actually applied so a
    // canceled swap doesn't leak the new index into subsequent moves.
    if (finger.didSwap) {
      updatePressedThumb(finger.thumbIndex);
      focusThumb(finger.thumbIndex);
    }
  }

  return applied;
}

function handleTouchMove(nativeEvent: TouchEvent | PointerEvent) {
  const fingerCoords = getFingerCoords(nativeEvent);

  if (fingerCoords == null) {
    return;
  }

  moveCount += 1;

  // Cancel move in case some other element consumed a pointerup event and it was not fired.
  if (nativeEvent.type === 'pointermove' && (nativeEvent as PointerEvent).buttons === 0) {
    handleTouchEnd(nativeEvent);
    return;
  }

  const finger = getFingerState(fingerCoords);

  if (finger == null) {
    return;
  }

  if (validateMinimumDistance(finger.value, step.value, minStepsBetweenValues.value)) {
    if (!dragging.value && moveCount > INTENTIONAL_DRAG_COUNT_THRESHOLD) {
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

  pressedThumbCenterOffsetRef.value = null;

  // If the value array shrank or grew mid-drag, the cached interaction value no longer
  // matches the current thumbs (the pressed index can still be in range), so dropping it
  // keeps a stale or malformed array from being committed on release.
  if (
    Array.isArray(currentInteractionValue) &&
    currentInteractionValue.length !== values.value.length
  ) {
    currentInteractionValue = null;
  }

  if (currentInteractionValue != null) {
    onValueCommitted(
      currentInteractionValue,
      createGenericEventDetails(
        lastChangeReasonRef.value,
        nativeEvent as PointerEvent,
      ) as SliderRootCommitEventDetails,
    );
  }

  if ('pointerType' in nativeEvent && control?.hasPointerCapture(nativeEvent.pointerId)) {
    control?.releasePointerCapture(nativeEvent.pointerId);
  }

  pressedThumbIndexRef.value = -1;
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

  if (disabled.value) {
    return;
  }

  if (isTargetDisabledThumb(getTarget(nativeEvent))) {
    resetPressedThumb();
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
  listenedDocument = doc;
  doc.addEventListener('touchmove', handleTouchMove, { passive: true });
  doc.addEventListener('touchend', handleTouchEnd, { passive: true });
  doc.addEventListener('touchcancel', handleTouchEnd, { passive: true });
}

function stopListening() {
  const doc = listenedDocument;
  listenedDocument = null;
  if (doc) {
    doc.removeEventListener('pointermove', handleTouchMove);
    doc.removeEventListener('pointerup', handleTouchEnd);
    doc.removeEventListener('pointercancel', handlePointerCancel);
    doc.removeEventListener('touchmove', handleTouchMove);
    doc.removeEventListener('touchend', handleTouchEnd);
    doc.removeEventListener('touchcancel', handleTouchEnd);
  }
  touchId = null;
  pressedValuesRef.value = null;
  currentInteractionValue = null;
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
    event.defaultPrevented ||
    !isElement(target) ||
    // Only handle left clicks
    event.button !== 0
  ) {
    return;
  }

  if (isTargetDisabledThumb(target)) {
    resetPressedThumb();
    return;
  }

  const fingerCoords = { x: event.clientX, y: event.clientY };
  startPressing(fingerCoords);

  const finger = getFingerState(fingerCoords);

  if (finger == null) {
    return;
  }

  const pressedOnFocusedThumb = contains(
    thumbRefs.value[finger.thumbIndex],
    activeElement(ownerDocument(control)),
  );

  if (pressedOnFocusedThumb) {
    event.preventDefault();
  } else {
    focusFrame.request(() => {
      focusThumb(finger.thumbIndex);
    });
  }

  setDragging(true);

  const pressedOnAnyThumb = pressedThumbCenterOffsetRef.value != null;
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
  listenedDocument = doc;
  doc.addEventListener('pointermove', handleTouchMove, { passive: true });
  doc.addEventListener('pointerup', handleTouchEnd, { once: true });
  doc.addEventListener('pointercancel', handlePointerCancel, { once: true });
}

function setControl(element: HTMLElement | null) {
  if (element) {
    control = element;
    controlElement.value = element;
    if (styles == null) {
      styles = ownerWindow(element).getComputedStyle(element);
    }
    return;
  }

  // The listeners are on the document of the control, so they stop before the control goes away.
  focusFrame.cancel();
  stopListening();
  if (controlElement.value === control) {
    controlElement.value = null;
  }
  control = null;
  // The style of a removed element has no values, so the next element reads its own style.
  styles = null;
}

watch(disabled, (isDisabled) => {
  if (isDisabled) {
    stopListening();
  }
});

// `KeepAlive` takes the control out of the document and sends no pointer event.
onDeactivated(() => {
  focusFrame.cancel();
  stopListening();
  setDragging(false);
  resetPressedThumb();
});

onScopeDispose(stopListening);

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [setControl],
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
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
