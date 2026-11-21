<script setup lang="ts">
import { computed, mergeProps, onScopeDispose, onServerPrefetch, shallowRef, useAttrs } from 'vue';
import { createChangeEventDetails } from '../common/changeEventDetails';
import { useElement, type ElementSlotProps } from '../common/element';
import { useDrag } from './drag';
import {
  adjustLayout,
  areLayoutsEqual,
  getHandleLimits,
  getHandleRange,
  isCollapsed,
} from './layout';
import { injectRoot } from './root';
import type { ResizableHandleProps, ResizableHandleState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableHandleProps>(), {
  primaryPanel: 'previous',
});
defineSlots<{
  default?(scope: { state: ResizableHandleState }): unknown;
  /**
   * Renders your element in place of the element of the handle. Bind `props` with `v-bind` and
   * `elementRef` with `:ref`. End your element with `<span v-bind="targetProps" />`, the pointer
   * target of the handle.
   */
  element?(
    scope: ElementSlotProps<ResizableHandleState> & { targetProps: Record<string, unknown> },
  ): unknown;
}>();

const root = injectRoot('Handle');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();
// A server renders a handle after the `setup` of the parts beside it, so the server HTML has the
// value and the ends.
const onServer = shallowRef(false);
onServerPrefetch(() => {
  onServer.value = true;
});
const handle = {
  get element() {
    return element.value;
  },
};
onScopeDispose(root.addHandle(handle));

const isDisabled = computed(() => root.disabled || props.disabled);
const pivot = computed(() => root.pivotOf(handle));
const canMove = computed(() => !isDisabled.value && pivot.value >= 0);
// Until the root is mounted, the handle does not know whether it has a panel on each side.
const hasTabStop = computed(() => (root.mounted ? canMove.value : !isDisabled.value));
// The index in `panels` and in `constraints` of the primary panel.
const primaryIndex = computed(() =>
  pivot.value < 0 ? -1 : pivot.value + (props.primaryPanel === 'next' ? 1 : 0),
);
const primary = computed(() => root.constraints[primaryIndex.value]);

const { dragging, crossing, previewOffset, listeners } = useDrag({
  root,
  element: () => element.value,
  pivot: () => pivot.value,
  canMove: () => canMove.value,
});

const ends = computed(() => {
  if (isDisabled.value) return { atMin: false, atMax: false };
  if (pivot.value < 0) return { atMin: true, atMax: true };
  // A root with a length that waits has no layout to move.
  if (root.lengths.size > 0) return { atMin: false, atMax: false };
  return getHandleLimits(
    root.constraints,
    root.shown,
    pivot.value,
    root.pushPanels,
    root.orientation === 'horizontal' && root.direction === 'rtl',
  );
});

const state = computed<ResizableHandleState>(() => ({
  orientation: root.orientation,
  disabled: isDisabled.value,
  dragging: dragging.value,
  crossing: crossing.value,
  atMin: root.mounted && ends.value.atMin,
  atMax: root.mounted && ends.value.atMax,
}));

// The attributes that depend on the other parts. Until the root is mounted each one is `null`, so
// that the next render always writes it or removes it.
function layoutAttributes() {
  if (!root.mounted && !onServer.value) {
    return {
      'aria-controls': null,
      'aria-valuenow': null,
      'aria-valuemin': null,
      'aria-valuemax': null,
      'data-at-min': null,
      'data-at-max': null,
    };
  }
  const on = (value: boolean) => (value ? '' : undefined);
  const panel = primary.value;
  const hasValue = panel && canMove.value && root.lengths.size === 0;
  const range = hasValue
    ? getHandleRange(root.constraints, root.shown, pivot.value, panel, root.pushPanels)
    : undefined;
  const whole = (value: number | undefined) =>
    value === undefined ? undefined : Math.round(value);
  return {
    'aria-controls': root.panels[primaryIndex.value]?.id,
    'aria-valuenow': whole(hasValue ? root.shown[panel.id] : undefined),
    'aria-valuemin': whole(range?.min),
    'aria-valuemax': whole(range?.max),
    'data-at-min': on(ends.value.atMin),
    'data-at-max': on(ends.value.atMax),
  };
}

// A positive delta grows the panel before the handle.
function keyDelta(event: KeyboardEvent) {
  const horizontal = root.orientation === 'horizontal';
  const rtl = root.readDirection() === 'rtl';
  const step = event.shiftKey ? root.largeStep : root.step;
  const growsPrimary = props.primaryPanel === 'next' ? -1 : 1;
  switch (event.key) {
    case 'ArrowRight':
      return horizontal ? (rtl ? -step : step) : undefined;
    case 'ArrowLeft':
      return horizontal ? (rtl ? step : -step) : undefined;
    case 'ArrowDown':
      return horizontal ? undefined : step;
    case 'ArrowUp':
      return horizontal ? undefined : -step;
    case 'PageUp':
      return growsPrimary * root.largeStep;
    case 'PageDown':
      return -growsPrimary * root.largeStep;
    case 'End':
      return growsPrimary * 100;
    case 'Home':
      return -growsPrimary * 100;
    default:
      return undefined;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (!canMove.value || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.key === 'Enter') {
    toggleCollapse(event);
    return;
  }
  // The steps and the constraints can be lengths, and the page can have changed.
  const measurement = root.measure();
  const delta = keyDelta(event);
  if (delta === undefined) return;
  event.preventDefault();
  // The next move of a drag starts from the layout at the press, and it would undo the key. A
  // root with no room for its panels has no layout to move.
  if (root.dragging || !measurement) return;
  const next = adjustLayout(root.constraints, root.shown, pivot.value, delta, {
    exact: true,
    push: root.pushPanels,
  });
  if (areLayoutsEqual(next, root.shown)) return;
  const applied = root.changeLayout(next, createChangeEventDetails('keyboard', event));
  if (applied) root.commitLayout(applied, 'keyboard', event);
}

// Enter collapses a collapsible primary panel, or gives it its size again. For another panel,
// Enter stays a key of the browser.
function toggleCollapse(event: KeyboardEvent) {
  const panel = primary.value;
  const size = panel && root.shown[panel.id];
  if (!panel || size === undefined || !panel.collapsible || panel.locked) return;
  event.preventDefault();
  if (root.dragging) return;
  const move = { pivot: pivot.value, reason: 'keyboard' as const, event };
  if (isCollapsed(panel, size)) root.expandPanel(panel.id, move);
  else root.collapsePanel(panel.id, move);
}

// A double click gives the primary panel its first size.
function onDblclick(event: MouseEvent) {
  const panel = primary.value;
  if (!canMove.value || !panel || panel.locked) return;
  if (root.resetPanel(panel.id, { pivot: pivot.value, reason: 'reset', event })) {
    event.preventDefault();
  }
}

function elementProps() {
  const horizontal = root.orientation === 'horizontal';
  return mergeProps(
    {
      role: 'separator',
      'aria-orientation': horizontal ? 'vertical' : 'horizontal',
      'aria-disabled': isDisabled.value ? 'true' : undefined,
      tabindex: hasTabStop.value ? 0 : undefined,
      ...layoutAttributes(),
      'data-dragging': dragging.value ? '' : undefined,
      'data-crossing': crossing.value ? '' : undefined,
      style: {
        // The handle is the containing block of its pointer target.
        position: 'relative',
        touchAction: 'none',
        '--resizable-handle-preview-offset': previewOffset.value,
      },
      ...listeners,
      onKeydown,
      onDblclick,
    },
    attrs,
  );
}

// The pointer target takes a press within 5 px of the center of a thin handle, with no CSS. The
// variable `--resizable-handle-hit-area-size` gives another size.
const targetStyle = computed(() => {
  const size = 'max(100%, var(--resizable-handle-hit-area-size, 10px))';
  return {
    position: 'absolute',
    ...(root.orientation === 'horizontal'
      ? { top: 0, bottom: 0, left: '50%', width: size, translate: '-50% 0' }
      : { left: 0, right: 0, top: '50%', height: size, translate: '0 -50%' }),
    zIndex: 1,
    // A press beside a handle that cannot move goes to the content under the target.
    pointerEvents: hasTabStop.value ? undefined : 'none',
  } as const;
});

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :element-ref="setElement"
    :state="state"
    :target-props="{ style: targetStyle }"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" /><span :style="targetStyle" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" /><span :style="targetStyle" />
  </div>
</template>
