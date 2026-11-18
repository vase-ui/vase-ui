<script lang="ts">
import type { HTMLAttributes } from 'vue';
import { ownerWindow } from '../../common/owner';
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

export function getViewportRect(teleportDistance: number | undefined, scrubAreaEl: HTMLElement) {
  const win = ownerWindow(scrubAreaEl);

  if (teleportDistance != null) {
    const rect = scrubAreaEl.getBoundingClientRect();
    return {
      left: rect.left - teleportDistance / 2,
      top: rect.top - teleportDistance / 2,
      right: rect.right + teleportDistance / 2,
      bottom: rect.bottom + teleportDistance / 2,
    };
  }

  const viewport = win.visualViewport;

  if (viewport) {
    return {
      left: viewport.offsetLeft,
      top: viewport.offsetTop,
      right: viewport.offsetLeft + viewport.width,
      bottom: viewport.offsetTop + viewport.height,
    };
  }

  return {
    left: 0,
    top: 0,
    right: win.document.documentElement.clientWidth,
    bottom: win.document.documentElement.clientHeight,
  };
}
</script>

<script setup lang="ts">
import { nextTick, onScopeDispose, provide, shallowRef, watch } from 'vue';
import type { CSSProperties } from 'vue';
import { addEventListener } from '../../common/addEventListener';
import { ownerDocument } from '../../common/owner';
import { platform } from '../../common/platform';
import { getTarget } from '../../common/shadowDom';
import { useTimeout } from '../../common/useTimeout';
import { createGenericEventDetails } from '../../internals/createVaseUIEventDetails';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useKeepAliveState } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import {
  useNumberFieldRootContext,
  stateAttributesMapping,
  NumberFieldScrubAreaContext,
} from '../root/NumberFieldRootContext';
import type { ScrubCursor } from '../root/NumberFieldRootContext';

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
  setEditing,
  getStepAmount,
  onValueCommitted,
  getStepCommitValue,
} = useNumberFieldRootContext();

let didMove = false;
let pointerDownTarget: EventTarget | null = null;
let nativeClickReceived = false;
let virtualCursorCoords = { x: 0, y: 0 };

let cursor: ScrubCursor | null = null;

const exitPointerLockTimeout = useTimeout();
const syntheticClickTimeout = useTimeout();

const isTouchInput = shallowRef(false);
const isPointerLockDenied = shallowRef(false);
const isScrubbing = shallowRef(false);

function onScrub({ movementX, movementY }: PointerEvent) {
  const target = cursor;
  const scrubAreaEl = element.value;

  if (!target || !scrubAreaEl) {
    return;
  }

  const virtualCursor = target.element;
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
    x: wrap(Math.round(coords.x + movementX), virtualCursor.offsetWidth / 2, rect.left, rect.right),
    y: wrap(
      Math.round(coords.y + movementY),
      virtualCursor.offsetHeight / 2,
      rect.top,
      rect.bottom,
    ),
  };

  virtualCursorCoords = newCoords;

  target.place(newCoords.x, newCoords.y);
}

async function onScrubbingChange(scrubbingValue: boolean, { clientX, clientY }: PointerEvent) {
  isScrubbing.value = scrubbingValue;
  setRootScrubbing(scrubbingValue);

  if (!scrubbingValue) {
    return;
  }

  // The cursor mounts in the flush of the write above.
  await nextTick();

  const target = cursor;
  if (!target) {
    return;
  }

  const virtualCursor = target.element;
  const initialCoords = {
    x: clientX - virtualCursor.offsetWidth / 2,
    y: clientY - virtualCursor.offsetHeight / 2,
  };

  virtualCursorCoords = initialCoords;

  target.place(initialCoords.x, initialCoords.y);
}

// A move or release can follow the press in the same task.
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
          onValueCommitted(getStepCommitValue(), createGenericEventDetails(REASONS.scrub, event));

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
          setEditing(false);
          incrementValue(Math.abs(rawAmount), {
            direction: rawAmount >= 0 ? 1 : -1,
            event,
            reason: REASONS.scrub,
          });
        }
      }
    }

    const win = ownerWindow(inputRef.value);
    onCleanup(addEventListener(win, 'pointerup', handleScrubPointerUp, true));
    onCleanup(addEventListener(win, 'pointermove', handleScrubPointerMove, true));
    onCleanup(() => exitPointerLockTimeout.clear());
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

// `KeepAlive` sends no pointer release, and it leaves the teleported cursor in the document. A
// click that waits for its timer would go to an area that is out of the document.
const { isHeld } = useKeepAliveState();
watch(
  isHeld,
  (held) => {
    if (held) {
      syntheticClickTimeout.clear();
      cancelScrub();
    }
  },
  { flush: 'sync' },
);

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

const { element, elementProps, setRef, usesRenderSlot } = useRenderElement('span', props, {
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
  setCursor(element, place) {
    if (element) cursor = { element, place };
    else if (cursor?.place === place) cursor = null;
  },
  scrubAreaElement: element,
});

defineExpose({ element });
</script>

<template>
  <slot v-if="usesRenderSlot()" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()" :ref="setRef">
    <slot :state="state" />
  </component>
</template>
