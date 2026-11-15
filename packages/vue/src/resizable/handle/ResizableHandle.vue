<script lang="ts">
import type { HTMLAttributes } from 'vue';
import type { StateAttributesMapping } from '../../internals/getStateAttributesProps';
import type { Orientation, VaseUIComponentProps, WithVaseUIEvent } from '../../internals/types';
import * as ResizableHandleDataAttributes from './ResizableHandleDataAttributes';

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
  /**
   * Whether a press at the pointer drags this handle and a handle or an edge of another root
   * together: the pointer is at the crossing of the two. It is also `true` while the pointer, with
   * no button down, is at such a crossing.
   */
  crossing: boolean;
  /**
   * Whether the handle is at the end of its travel on the left, or at the top in a vertical root:
   * it cannot move that way. The side is a side of the screen, also in a right-to-left root.
   */
  atMin: boolean;
  /**
   * Whether the handle is at the end of its travel on the right, or at the bottom in a vertical
   * root: it cannot move that way. The side is a side of the screen, also in a right-to-left root.
   */
  atMax: boolean;
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
   * The value attributes of the handle, `aria-controls`, the keys Home, End, Page Up, Page Down and
   * Enter, and the double click are about this panel.
   * @default 'previous'
   */
  primaryPanel?: 'previous' | 'next' | undefined;
  /**
   * A string value forwarded to the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the handle.
   * Ignored when `getAriaValueText` is provided.
   * The handle has the attribute only while it has `aria-valuenow`.
   */
  ariaValuetext?: string | undefined;
  /**
   * A function which returns a string value for the [`aria-valuetext`](https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-valuetext) attribute of the handle.
   * This is important for screen reader users.
   * It gets the size of the primary panel: the size in percent as text in the locale of the page,
   * such as `'30%'`, the size in percent as a number, and the details. `pixelSize` is
   * `undefined` until the root has read the page, which comes after the mount.
   * The handle has the attribute only while it has `aria-valuenow`.
   */
  getAriaValueText?:
    | ((
        formattedValue: string,
        value: number,
        details: { collapsed: boolean; pixelSize: number | undefined },
      ) => string)
    | null
    | undefined;
}

const stateAttributesMapping: StateAttributesMapping<ResizableHandleState> = {
  atMin: (value) => (value ? { [ResizableHandleDataAttributes.atMin]: '' } : null),
  atMax: (value) => (value ? { [ResizableHandleDataAttributes.atMax]: '' } : null),
};
</script>

<script setup lang="ts">
import {
  computed,
  onActivated,
  onDeactivated,
  onScopeDispose,
  provide,
  shallowRef,
  watch,
} from 'vue';
import type { Component, CSSProperties } from 'vue';
import { useIsHydrating } from '../../common/hydration';
import { ownerDocument } from '../../common/owner';
import { formatNumber } from '../../common/formatNumber';
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
import { createChangeEventDetails } from '../../internals/createBaseUIEventDetails';
import { useDeferredServerRender } from '../../internals/labelable-provider';
import { REASONS } from '../../internals/reasons';
import type { HTMLProps } from '../../internals/types';
import { isInHeldBranch } from '../../internals/useKeepAliveState';
import { useRenderElement } from '../../internals/useRenderElement';
import { useFormatLocale } from '../../utils/useFormatLocale';
import { useResizableRootContext } from '../root/ResizableRootContext';
import { createHandleDrag } from '../utils/handleDrag';
import { getHandleEnds } from '../utils/handleEnds';
import { createHandlePress } from '../utils/handlePress';
import { registerHandle } from '../utils/handleRegistry';
import { adjustLayout, areLayoutsEqual, getHandleRange, isCollapsed } from '../utils/layout';
import type { PanelConstraints } from '../utils/layout';
import { getPanelSize } from '../utils/measure';
import { getPreviewOffset } from '../utils/previewOffset';
import ResizableHandleChildren from './ResizableHandleChildren.vue';
import { ResizableHandleContext } from './ResizableHandleContext';
import * as ResizableHandleCssVariables from './ResizableHandleCssVariables';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizableHandleProps>(), {
  as: 'div',
  disabled: false,
  primaryPanel: 'previous',
});

defineSlots<{
  default(props: { state: ResizableHandleState }): unknown;
  render(props: { props: HTMLProps; state: ResizableHandleState; children: Component }): unknown;
}>();

const root = useResizableRootContext();

// The attributes of the handle depend on the panels around it. A server renders the handle after
// the `setup` of the panels that follow it, so the server HTML has the values.
useDeferredServerRender();

const hydrating = useIsHydrating();
const { ref: listItemRef, index } = useCompositeListItem({ list: root.list });
const isDisabled = computed(() => root.disabled.value || props.disabled);

// The index in `panels` of the panel before the handle. A handle with no panel on one side has -1.
const pivot = computed(() => {
  const panels = root.panels.value;
  const before = panels.findLastIndex((panel) => panel.index.value < index.value);
  return before < panels.length - 1 ? before : -1;
});
// A handle with no panel on one side moves nothing, so it is not in the tab order.
const isFocusable = computed(() => !isDisabled.value && pivot.value >= 0);
// While the page hydrates, the handle can render before the panel after it registers. Vue compares
// `tabindex` and `style`, so the server HTML and that render give each handle that is not disabled
// its tab stop and a hit area that takes presses.
const hasTabStop = computed(() => isFocusable.value || (hydrating.value && !isDisabled.value));
const primary = computed(() =>
  pivot.value < 0
    ? undefined
    : root.constraints.value[pivot.value + (props.primaryPanel === 'next' ? 1 : 0)],
);

// A panel whose size is a length has no size in percent before the first measurement. The sizes of
// the other panels are not exact either. Until then, no handle of the root has a value.
const hasPendingLengths = computed(() => root.lengthPanels.value.size > 0);

// A server cannot know the locale of the visitor, so the text has `en-US` until the mount.
const formatLocale = useFormatLocale(undefined);

function getValueText(panel: PanelConstraints, value: number) {
  if (typeof props.getAriaValueText !== 'function') {
    return props.ariaValuetext;
  }
  const space = root.measurement.value?.space;
  return props.getAriaValueText(
    formatNumber(value / 100, formatLocale.value, {
      style: 'percent',
      maximumFractionDigits: 0,
    }),
    value,
    {
      collapsed: isCollapsed(panel, value),
      pixelSize: space === undefined ? undefined : getPanelSize(value, space).pixels,
    },
  );
}

const valueAttributes = computed(() => {
  const panel = primary.value;
  if (panel === undefined) {
    return undefined;
  }
  const range = getHandleRange(
    root.constraints.value,
    root.shown.value,
    pivot.value,
    panel,
    root.pushPanels.value,
  );
  // eslint-disable-next-line @typescript-eslint/no-non-null-assertion -- The panel is in the constraints, so the layout has an entry for its id.
  const value = root.shown.value[panel.id]!;
  return {
    'aria-controls': panel.id,
    ...(isDisabled.value || hasPendingLengths.value
      ? undefined
      : {
          'aria-valuenow': Math.round(value),
          'aria-valuemin': Math.round(range.min),
          'aria-valuemax': Math.round(range.max),
          'aria-valuetext': getValueText(panel, value),
        }),
  };
});

const ends = computed(() =>
  isDisabled.value ? { atMin: false, atMax: false } : getHandleEnds(root, pivot.value),
);

const drag = createHandleDrag(root, {
  pivot: () => pivot.value,
  disabled: () => !isFocusable.value,
});
const press = createHandlePress({ drag, orientation: () => root.orientation.value });

// `KeepAlive` takes the handle out of the document. The root then does not count it. A handle that
// mounts while `KeepAlive` holds it gets no `onDeactivated` call.
const deactivated = shallowRef(isInHeldBranch());
root.registerHandle({ index, disabled: () => isDisabled.value, deactivated });

const hitAreaElement = shallowRef<HTMLElement | null>(null);

function setHitAreaElement(value: unknown) {
  hitAreaElement.value = value as HTMLElement | null;
}

const hitAreaStyle = computed<CSSProperties>(() => {
  const size = `max(100%, ${root.hitAreaSize.value}px)`;
  return {
    position: 'absolute',
    ...(root.orientation.value === 'horizontal'
      ? { top: 0, bottom: 0, left: '50%', width: size, translate: '-50% 0' }
      : { left: 0, right: 0, top: '50%', height: size, translate: '0 -50%' }),
    zIndex: 1,
    // A press beside a handle that cannot move goes to the content under the hit area.
    ...(hasTabStop.value ? undefined : { pointerEvents: 'none' }),
  };
});

provide(ResizableHandleContext, { hitAreaStyle, hitAreaRef: setHitAreaElement });

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
  if (event.key === 'Enter') {
    toggleCollapse(event);
    return;
  }
  // The steps and the constraints can be lengths, and the page can have changed since the last read.
  root.measure();
  // A root that waits for a length has no layout to move: a move would lose the length.
  if (hasPendingLengths.value) {
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
  const next = adjustLayout(root.constraints.value, root.shown.value, pivot.value, delta, {
    exact: true,
    push: root.pushPanels.value,
  });
  if (areLayoutsEqual(next, root.shown.value)) {
    return;
  }
  const applied = root.changeLayout(next, createChangeEventDetails(REASONS.keyboard, event));
  if (applied) {
    root.commitLayout(applied, REASONS.keyboard, event);
  }
}

// Enter collapses a collapsible primary panel, or gives it back its size. For another panel, Enter
// stays a key of the browser.
function toggleCollapse(event: KeyboardEvent) {
  const panel = primary.value;
  const size = panel === undefined ? undefined : root.shown.value[panel.id];
  if (panel === undefined || size === undefined || !panel.collapsible || panel.locked) {
    return;
  }
  event.preventDefault();
  // The next move of a drag would undo the change.
  if (drag.dragging.value) {
    return;
  }
  const handleMove = { pivot: pivot.value, reason: REASONS.keyboard, event };
  if (isCollapsed(panel, size)) {
    root.expandPanel(panel.id, handleMove);
  } else {
    root.collapsePanel(panel.id, handleMove);
  }
}

// A double click gives the primary panel the size that it had at the start.
function onDblclick(event: MouseEvent) {
  const panel = primary.value;
  if (event.defaultPrevented || isDisabled.value || panel === undefined || panel.locked) {
    return;
  }
  if (root.resetPanel(panel.id, { pivot: pivot.value, reason: 'reset', event })) {
    event.preventDefault();
  }
}

function onPointerdown(event: PointerEvent) {
  if (press.start(event)) {
    // The `mousedown` of the press does not focus the handle, as `onMousedown` of the press says.
    element.value?.focus({
      preventScroll: true,
      // Prevent a focus ring that a pointer press gives in browsers that support this option.
      // Chrome 144 and later support it.
      focusVisible: false,
    });
  }
}

// The press that this handle started ends, and so does the drag that the press of another handle
// or edge started on this handle. The other press goes on with its other drags.
function endDrags() {
  press.end();
  drag.end(undefined, false);
}

// Firefox and Safari keep the focus on an element that loses its tab stop: a handle that becomes
// disabled, or that loses the panel on one side.
watch(isFocusable, (focusable) => {
  if (focusable) {
    return;
  }
  endDrags();
  const handle = element.value;
  if (handle && activeElement(ownerDocument(handle)) === handle) {
    handle.blur();
  }
});

// `KeepAlive` takes the handle out of the document and sends no pointer event.
onDeactivated(() => {
  deactivated.value = true;
  endDrags();
});

onActivated(() => {
  deactivated.value = false;
});

onScopeDispose(endDrags);

const previewOffset = computed(() => getPreviewOffset(root, pivot.value, drag.dragging.value));

const state = computed<ResizableHandleState>(() => ({
  orientation: root.orientation.value,
  disabled: isDisabled.value,
  dragging: drag.dragging.value,
  crossing: drag.crossing.value,
  atMin: ends.value.atMin,
  atMax: ends.value.atMax,
}));

const { element, elementProps } = useRenderElement('div', props, {
  state,
  stateAttributesMapping,
  ref: [listItemRef],
  children: true,
  props: (attrs) => [
    {
      role: 'separator',
      'aria-orientation': root.orientation.value === 'horizontal' ? 'vertical' : 'horizontal',
      'aria-disabled': isDisabled.value ? 'true' : undefined,
      tabindex: hasTabStop.value ? 0 : undefined,
      ...valueAttributes.value,
      ...press.listeners,
      onKeydown,
      onDblclick,
      onPointerdown,
      style: {
        // The handle is the containing block of its hit area.
        position: 'relative',
        touchAction: 'none',
        // A server render writes the key `WebkitUserSelect` as `webkit-user-select`, which no
        // browser knows. The key in its CSS form is right on a server and in a browser.
        '-webkit-user-select': 'none',
        userSelect: 'none',
        [ResizableHandleCssVariables.resizableHandlePreviewOffset]: previewOffset.value,
      },
    },
    attrs,
  ],
});

watch(
  [element, hitAreaElement],
  ([handle, hitArea], _previous, onCleanup) => {
    if (handle !== null) {
      onCleanup(
        registerHandle(
          {
            element: handle,
            drag,
            orientation: () => root.orientation.value,
            hitAreaSize: () => root.hitAreaSize.value,
          },
          hitArea,
        ),
      );
    }
  },
  { flush: 'post' },
);

defineExpose({ element });
</script>

<!-- prettier-ignore -->
<template>
  <slot v-if="$slots.render" name="render" :props="elementProps()" :state="state" :children="ResizableHandleChildren" />
  <component :is="as" v-else v-bind="elementProps()"><ResizableHandleChildren><slot :state="state" /></ResizableHandleChildren></component>
</template>
