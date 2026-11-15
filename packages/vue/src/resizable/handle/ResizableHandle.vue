<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';

export interface ResizableHandleState {
  /**
   * The orientation of the panels.
   */
  orientation: Orientation;
  /**
   * Whether the handle ignores user interaction.
   */
  disabled: boolean;
  /**
   * Whether the user is dragging the handle.
   */
  dragging: boolean;
}

export interface ResizableHandleProps
  extends
    VaseUIComponentProps<ResizableHandleState>,
    /* @vue-ignore */ WithVaseUIEvent<HTMLAttributes> {
  /**
   * Whether the handle ignores user interaction.
   * @default false
   */
  disabled?: boolean | undefined;
  /**
   * The panel that the handle reports: the panel before the handle, or the panel after it.
   * The value attributes of the handle, `aria-controls` and the keys Home, End, Page Up and Page Down
   * are about this panel.
   * @default 'previous'
   */
  primaryPanel?: 'previous' | 'next' | undefined;
}
</script>

<script setup lang="ts">
import { computed, onDeactivated, onScopeDispose, watch } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { activeElement } from '../../common/shadowDom';
import {
  ARROW_DOWN,
  ARROW_LEFT,
  ARROW_RIGHT,
  ARROW_UP,
  END,
  HOME,
  PAGE_DOWN,
  PAGE_UP,
} from '../../internals/composite/composite';
import { useCompositeListItem } from '../../internals/composite/list/useCompositeListItem';
import {
  createChangeEventDetails,
  createGenericEventDetails,
} from '../../internals/createBaseUIEventDetails';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import type { ComponentRenderFn, HTMLProps } from '../../internals/types';
import { useRenderElement } from '../../internals/useRenderElement';
import { useResizableRootContext } from '../root/ResizableRootContext';
import { createHandleDrag } from '../utils/handleDrag';
import { adjustLayout, areLayoutsEqual, getHandleRange } from '../utils/layout';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableHandleProps>(), {
  as: 'div',
  disabled: false,
  primaryPanel: 'previous',
});

defineSlots<{
  default(props: { state: ResizableHandleState }): unknown;
  render: ComponentRenderFn<HTMLProps, ResizableHandleState>;
}>();

const root = useResizableRootContext();

// The attributes of the handle depend on the panels around it. A server renders the handle after
// the `setup` of the panels that follow it, so the server HTML has the values.
useDeferredServerRender();

const hydrating = useIsHydrating();
const { ref: listItemRef, index } = useCompositeListItem();
const isDisabled = computed(() => root.disabled.value || props.disabled);

// The index in `panels` of the panel before the handle. A handle with no panel on one side has -1.
const pivot = computed(() => {
  const panels = root.panels.value;
  const before = panels.findLastIndex((panel) => panel.index.value < index.value);
  return before < panels.length - 1 ? before : -1;
});
// A handle with no panel on one side moves nothing, so it is not in the tab order.
const isFocusable = computed(() => !isDisabled.value && pivot.value >= 0);
const primary = computed(() =>
  pivot.value < 0
    ? undefined
    : root.constraints.value[pivot.value + (props.primaryPanel === 'next' ? 1 : 0)],
);

const valueAttributes = computed(() => {
  const panel = primary.value;
  if (panel === undefined) {
    return undefined;
  }
  const range = getHandleRange(root.constraints.value, root.shown.value, pivot.value, panel);
  return {
    'aria-controls': panel.id,
    ...(isDisabled.value
      ? undefined
      : {
          // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The panel is in the constraints, so the layout has an entry for its id.
          'aria-valuenow': Math.round(root.shown.value[panel.id]!),
          'aria-valuemin': Math.round(range.min),
          'aria-valuemax': Math.round(range.max),
        }),
  };
});

const drag = createHandleDrag(root, {
  pivot: () => pivot.value,
  disabled: () => isDisabled.value,
  element: () => element.value,
});

// A positive delta grows the panel before the handle.
function getKeyDelta(event: KeyboardEvent) {
  const horizontal = root.orientation.value === 'horizontal';
  const rtl = root.direction.value === 'rtl';
  const step = event.shiftKey ? root.largeStep.value : root.step.value;
  const growsPrimary = props.primaryPanel === 'next' ? -1 : 1;
  switch (event.key) {
    case ARROW_RIGHT:
      return horizontal ? (rtl ? -step : step) : undefined;
    case ARROW_LEFT:
      return horizontal ? (rtl ? step : -step) : undefined;
    case ARROW_DOWN:
      return horizontal ? undefined : step;
    case ARROW_UP:
      return horizontal ? undefined : -step;
    case PAGE_UP:
      return growsPrimary * root.largeStep.value;
    case PAGE_DOWN:
      return -growsPrimary * root.largeStep.value;
    case END:
      return growsPrimary * 100;
    case HOME:
      return -growsPrimary * 100;
    default:
      return undefined;
  }
}

function onKeydown(event: KeyboardEvent) {
  if (
    event.defaultPrevented ||
    isDisabled.value ||
    pivot.value < 0 ||
    event.ctrlKey ||
    event.altKey ||
    event.metaKey
  ) {
    return;
  }
  const delta = getKeyDelta(event);
  if (delta === undefined) {
    return;
  }
  event.preventDefault();
  // The next move of a drag computes the layout from the start of the drag again, and it would
  // undo the key.
  if (drag.dragging.value) {
    return;
  }
  const next = adjustLayout(root.constraints.value, root.shown.value, pivot.value, delta);
  if (areLayoutsEqual(next, root.shown.value)) {
    return;
  }
  const applied = root.changeLayout(next, createChangeEventDetails(REASONS.keyboard, event));
  if (applied) {
    root.commitLayout(applied, createGenericEventDetails(REASONS.keyboard, event));
  }
}

function onPointerdown(event: PointerEvent) {
  if (drag.start(event)) {
    // The `mousedown` of the press does not focus the handle, as the next function says.
    element.value?.focus({
      preventScroll: true,
      // Prevent a focus ring that a pointer press gives in browsers that support this option.
      // Chrome 144 and later support it.
      focusVisible: false,
    });
  }
}

// WebKit selects the text between the nearest selectable position and the pointer when a drag
// starts on an element with `user-select: none`. Preventing the default of `mousedown` stops the
// selection, and it also stops the focus that the press gives.
function onMousedown(event: MouseEvent) {
  if (drag.dragging.value) {
    event.preventDefault();
  }
}

// Firefox and Safari keep the focus on an element that loses its tab stop: a handle that becomes
// disabled, or that loses the panel on one side.
watch(isFocusable, (focusable) => {
  if (focusable) {
    return;
  }
  drag.end();
  const handle = element.value;
  if (handle && activeElement(ownerDocument(handle)) === handle) {
    handle.blur();
  }
});

// `KeepAlive` takes the handle out of the document and sends no pointer event.
onDeactivated(() => {
  drag.end();
});

onScopeDispose(() => {
  drag.end();
});

const state = computed<ResizableHandleState>(() => ({
  orientation: root.orientation.value,
  disabled: isDisabled.value,
  dragging: drag.dragging.value,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  ref: [listItemRef],
  props: (attrs) => [
    {
      role: 'separator',
      'aria-orientation': root.orientation.value === 'horizontal' ? 'vertical' : 'horizontal',
      'aria-disabled': isDisabled.value ? 'true' : undefined,
      // While the page hydrates, the handle can render before the panel after it registers. Vue
      // compares `tabindex`, so the server HTML and that render give each handle that is not
      // disabled its tab stop.
      tabindex: isFocusable.value || (hydrating.value && !isDisabled.value) ? 0 : undefined,
      ...valueAttributes.value,
      onKeydown,
      onMousedown,
      onPointerdown,
      onPointermove: drag.move,
      onPointerup: drag.end,
      onPointercancel: drag.end,
      onLostpointercapture: drag.end,
      style: {
        touchAction: 'none',
        // A server render writes the key `WebkitUserSelect` as `webkit-user-select`, which no
        // browser knows. The key in its CSS form is right on a server and in a browser.
        '-webkit-user-select': 'none',
        userSelect: 'none',
      },
    },
    attrs,
  ],
});

defineExpose({ element });
</script>

<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" />
  <component :is="as" v-else v-bind="elementProps()"><slot :state="state" /></component>
</template>
