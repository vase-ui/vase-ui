<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import type { NumberFieldRootState } from '../root/NumberFieldRoot.vue';

export interface NumberFieldScrubAreaState extends NumberFieldRootState {}

export interface NumberFieldScrubAreaProps
  extends
    VaseUIComponentProps<NumberFieldScrubAreaState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Cursor movement direction in the scrub area.
   * @default 'horizontal'
   */
  direction?: 'horizontal' | 'vertical' | undefined;
  /**
   * Determines how many pixels the cursor must move before the value changes.
   * A higher value will make scrubbing less sensitive.
   * @default 2
   */
  pixelSensitivity?: number | undefined;
  /**
   * If specified, determines the distance that the cursor may move from the center
   * of the scrub area before it will loop back around.
   */
  teleportDistance?: number | undefined;
}
</script>

<script setup lang="ts">
import { nextTick, onDeactivated, onScopeDispose, provide, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { mergeCleanups } from '../../common/mergeCleanups';
import { ownerDocument, ownerWindow } from '../../common/owner';
import { platform } from '../../common/platform';
import { getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { createGenericEventDetails } from '../../internals/createBaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useNumberFieldRootContext } from '../root/NumberFieldRootContext';
import { getViewportRect } from '../utils/getViewportRect';
import { stateAttributesMapping } from '../utils/stateAttributesMapping';
import { NumberFieldScrubAreaContext } from './NumberFieldScrubAreaContext';

const SCRUB_AREA_STYLE: CSSProperties = {
  'touch-action': 'none',
  '-webkit-user-select': 'none',
  'user-select': 'none',
};

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NumberFieldScrubAreaProps>(), {
  as: 'span',
  direction: 'horizontal',
  pixelSensitivity: 2,
});

defineSlots<{
  default(props: { state: NumberFieldScrubAreaState }): unknown;
  render: ComponentRenderFn<HTMLProps, NumberFieldScrubAreaState>;
}>();

const {
  state,
  setIsScrubbing: setRootScrubbing,
  inputRef,
  focusInput,
  incrementValue,
  allowInputSyncRef,
  getStepAmount,
  onValueCommitted,
  lastChangedValueRef,
  valueRef,
} = useNumberFieldRootContext();

let didMove = false;
let pointerDownTarget: EventTarget | null = null;
let nativeClickReceived = false;
let virtualCursorCoords = { x: 0, y: 0 };

const scrubAreaCursorRef = shallowRef<HTMLSpanElement | null>(null);

const exitPointerLockTimeout = useTimeout();
const syntheticClickTimeout = useTimeout();

const isTouchInput = shallowRef(false);
const isPointerLockDenied = shallowRef(false);
const isScrubbing = shallowRef(false);

function updateCursorTransform(virtualCursor: HTMLSpanElement, x: number, y: number) {
  // Invert the visual viewport scale so the cursor matches the OS cursor, which doesn't
  // scale with the content on pinch-zoom.
  const scale = ownerWindow(virtualCursor).visualViewport?.scale ?? 1;
  virtualCursor.style.transform = `translate3d(${x}px,${y}px,0) scale(${1 / scale})`;
}

function onScrub({ movementX, movementY }: PointerEvent) {
  const virtualCursor = scrubAreaCursorRef.value;
  const scrubAreaEl = element.value;

  if (!virtualCursor || !scrubAreaEl) {
    return;
  }

  const rect = getViewportRect(props.teleportDistance, scrubAreaEl);

  const coords = virtualCursorCoords;

  // Wrap the cursor to the opposite edge when its center crosses a viewport bound.
  const wrap = (coord: number, halfSize: number, low: number, high: number) => {
    if (coord + halfSize < low) {
      return high - halfSize;
    }
    if (coord + halfSize > high) {
      return low - halfSize;
    }
    return coord;
  };

  const newCoords = {
    x: wrap(
      Math.round(coords.x + movementX),
      virtualCursor.offsetWidth / 2,
      rect.left,
      rect.right,
    ),
    y: wrap(
      Math.round(coords.y + movementY),
      virtualCursor.offsetHeight / 2,
      rect.top,
      rect.bottom,
    ),
  };

  virtualCursorCoords = newCoords;

  updateCursorTransform(virtualCursor, newCoords.x, newCoords.y);
}

async function onScrubbingChange(scrubbingValue: boolean, { clientX, clientY }: PointerEvent) {
  isScrubbing.value = scrubbingValue;
  setRootScrubbing(scrubbingValue);

  if (!scrubbingValue) {
    return;
  }

  // The cursor mounts in the flush of the write above.
  await nextTick();

  const virtualCursor = scrubAreaCursorRef.value;
  if (!virtualCursor) {
    return;
  }

  const initialCoords = {
    x: clientX - virtualCursor.offsetWidth / 2,
    y: clientY - virtualCursor.offsetHeight / 2,
  };

  virtualCursorCoords = initialCoords;

  updateCursorTransform(virtualCursor, initialCoords.x, initialCoords.y);
}

// React runs the effect of a change from a discrete event before the next event. A `pointermove`
// that comes in the task of the `pointerdown` then reaches the listener. Only a sync watcher
// attaches the listener in time for it.
watch(
  [
    isScrubbing,
    () => state.value.disabled,
    () => state.value.readOnly,
    () => props.direction,
    () => props.pixelSensitivity,
  ],
  ([scrubbing, disabled, readOnly], _, onCleanup) => {
    // Only listen while actively scrubbing; avoids unrelated pointerup events committing.
    if (!inputRef.value || disabled || readOnly || !scrubbing) {
      return;
    }

    let cumulativeDelta = 0;

    function handleScrubPointerUp(event: PointerEvent) {
      function handler() {
        try {
          ownerDocument(element.value).exitPointerLock();
        } catch {
          // Ignore errors.
        } finally {
          onScrubbingChange(false, event);
          onValueCommitted(
            lastChangedValueRef.value ?? valueRef.value,
            createGenericEventDetails(REASONS.scrub, event),
          );

          // Dispatch a click if no movement happened. While the pointer is locked, the
          // browser targets its click at the lock element instead of the scrub area.
          // Without a lock (WebKit, or a denied request) the native click still arrives,
          // and it is dispatched after pointerup in the same task, so wait one task and
          // only synthesize the click if the native one didn't reach the scrub area.
          const target = pointerDownTarget;
          const input = inputRef.value;
          if (!didMove && target != null && input) {
            const MouseEventConstructor = ownerWindow(input).MouseEvent;
            syntheticClickTimeout.start(0, () => {
              if (nativeClickReceived) {
                return;
              }
              target.dispatchEvent(
                new MouseEventConstructor('click', {
                  bubbles: true,
                  cancelable: true,
                }),
              );
            });
          }

          didMove = false;
          pointerDownTarget = null;
        }
      }

      if (platform.engine.gecko) {
        // Firefox needs a small delay here when soft-clicking as the pointer
        // lock will not release otherwise.
        exitPointerLockTimeout.start(20, handler);
      } else {
        handler();
      }
    }

    function handleScrubPointerMove(event: PointerEvent) {
      // Prevent text selection.
      event.preventDefault();

      onScrub(event);

      const { movementX, movementY } = event;

      cumulativeDelta += props.direction === 'vertical' ? movementY : movementX;

      if (Math.abs(cumulativeDelta) >= props.pixelSensitivity) {
        cumulativeDelta = 0;
        didMove = true;
        const dValue = props.direction === 'vertical' ? -movementY : movementX;
        const stepAmount = getStepAmount(event);
        const rawAmount = dValue * stepAmount;

        if (rawAmount !== 0) {
          allowInputSyncRef.value = true;
          incrementValue(Math.abs(rawAmount), {
            direction: rawAmount >= 0 ? 1 : -1,
            event,
            reason: REASONS.scrub,
          });
        }
      }
    }

    const win = ownerWindow(inputRef.value);
    const unsubscribe = mergeCleanups(
      addEventListener(win, 'pointerup', handleScrubPointerUp, true),
      addEventListener(win, 'pointermove', handleScrubPointerMove, true),
    );

    onCleanup(() => {
      exitPointerLockTimeout.clear();
      unsubscribe();
    });
  },
  { flush: 'sync' },
);

// A scrub that ends with no pointer release commits nothing. The pointer lock and the scrubbing
// state of the root must not outlive the area.
function cancelScrub() {
  if (!isScrubbing.value) {
    return;
  }
  isScrubbing.value = false;
  setRootScrubbing(false);
  try {
    ownerDocument(element.value).exitPointerLock();
  } catch {
    // Ignore errors.
  }
}

onScopeDispose(cancelScrub);

// `KeepAlive` sends no pointer release, and it leaves the teleported cursor in the document.
onDeactivated(cancelScrub);

// Prevent scrolling using touch input when scrubbing.
function onTouchstart(event: TouchEvent) {
  if (event.touches.length === 1) {
    event.preventDefault();
  }
}

async function onPointerdown(event: PointerEvent) {
  const { disabled, readOnly } = state.value;
  if (event.defaultPrevented || readOnly || event.button || disabled) {
    return;
  }

  const isTouch = event.pointerType === 'touch';
  isTouchInput.value = isTouch;

  if (event.pointerType === 'mouse') {
    event.preventDefault();
    focusInput();
  }

  didMove = false;
  nativeClickReceived = false;
  syntheticClickTimeout.clear();
  pointerDownTarget = getTarget(event);
  onScrubbingChange(true, event);

  // WebKit causes significant layout shift with the native message, so we can't use it.
  if (!isTouch && !platform.engine.webkit) {
    try {
      // Avoid non-deterministic errors in testing environments. This error sometimes
      // appears:
      // "The root document of this element is not valid for pointer lock."
      await ownerDocument(element.value).body.requestPointerLock();
      isPointerLockDenied.value = false;
    } catch {
      isPointerLockDenied.value = true;
    } finally {
      // Place the cursor again for the result of the pointer lock request.
      if (isScrubbing.value) {
        onScrubbingChange(true, event);
      }
    }
  }
}

const { element, elementProps } = useRenderElement('span', props, {
  state,
  props: (attrs) => [
    {
      role: 'presentation',
      style: SCRUB_AREA_STYLE,
      onClickCapture() {
        nativeClickReceived = true;
      },
      onPointerdown,
      onTouchstart: state.value.disabled || state.value.readOnly ? undefined : onTouchstart,
    },
    attrs,
  ],
  stateAttributesMapping,
});

provide(NumberFieldScrubAreaContext, {
  isScrubbing,
  isTouchInput,
  isPointerLockDenied,
  scrubAreaCursorRef,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
