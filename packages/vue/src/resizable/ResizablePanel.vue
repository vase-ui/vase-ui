<script setup lang="ts">
import {
  computed,
  mergeProps,
  onScopeDispose,
  onServerPrefetch,
  shallowRef,
  useAttrs,
  useId,
  watch,
} from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { isCollapsed, isLength, isSize, parseSize } from './layout';
import { injectRoot, type Size } from './root';
import type { ResizablePanelProps, ResizablePanelState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<ResizablePanelProps>(), {
  id: undefined,
  defaultSize: undefined,
  minSize: 0,
  maxSize: 100,
  collapsedSize: 0,
  collapseThreshold: undefined,
  rootResizeBehavior: 'proportional',
  rootResizePriority: 0,
  snapPoints: undefined,
  snapTolerance: '10px',
});
const emit = defineEmits<{
  /** The panel collapses or expands, after the DOM update. Not at the mount. */
  collapsedChange: [collapsed: boolean];
}>();
defineSlots<{
  default?(scope: { state: ResizablePanelState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ResizablePanelState;
  }): unknown;
}>();

const root = injectRoot('Panel');
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();
const panelId = computed(() => givenId(props.id) ?? generatedId);
// A server renders a panel after the `setup` of the parts beside it, so the server HTML has the
// layout of all the parts.
const onServer = shallowRef(false);
onServerPrefetch(() => {
  onServer.value = true;
});

const firstDefaultSize = props.defaultSize;
onScopeDispose(
  root.addPanel({
    get id() {
      return panelId.value;
    },
    get element() {
      return element.value;
    },
    get minSize() {
      return props.minSize;
    },
    get maxSize() {
      return props.maxSize;
    },
    defaultSize: firstDefaultSize,
    get collapsible() {
      return props.collapsible;
    },
    get collapsedSize() {
      return props.collapsedSize;
    },
    get collapseThreshold() {
      return props.collapseThreshold;
    },
    get disabled() {
      return props.disabled;
    },
    get rootResizeBehavior() {
      return props.rootResizeBehavior;
    },
    get rootResizePriority() {
      return props.rootResizePriority;
    },
    get snapPoints() {
      return props.snapPoints;
    },
    get snapTolerance() {
      return props.snapTolerance;
    },
  }),
);

// Until the root is mounted, the panel knows only its own first size. A percent of it is known.
const firstSize = computed<Size | undefined>(() => {
  const given = root.entry(panelId.value) ?? firstDefaultSize;
  return isSize(given) ? given : undefined;
});
const firstPercent = computed(() => parseSize(firstSize.value, undefined));

const size = computed(() => root.shown[panelId.value] ?? 0);
const length = computed(() => root.lengths.get(panelId.value));
// A panel that leaves the layout, such as a panel that `KeepAlive` holds, keeps its collapsed state.
const collapsed = computed<boolean>((previous) => {
  // A panel that waits for its first measurement has no size, and it is not collapsed.
  if (length.value !== undefined) return false;
  const constraints = root.constraints.find((panel) => panel.id === panelId.value);
  return constraints ? isCollapsed(constraints, size.value) : (previous ?? false);
});

const state = computed<ResizablePanelState>(() => {
  if (root.mounted) {
    return {
      orientation: root.orientation,
      size: size.value,
      collapsed: collapsed.value,
      disabled: props.disabled,
    };
  }
  const first = firstPercent.value;
  const collapsedSize = parseSize(props.collapsedSize, undefined);
  return {
    orientation: root.orientation,
    size: first ?? 0,
    collapsed: props.collapsible && first !== undefined && first === collapsedSize,
    disabled: props.disabled,
  };
});

watch(
  () => (root.mounted ? collapsed.value : undefined),
  (next, previous) => {
    if (next !== undefined && previous !== undefined) emit('collapsedChange', next);
  },
  { flush: 'post' },
);

// The size in percent with three decimals at the most.
function format(percent: number) {
  return String(Math.round(percent * 1000) / 1000);
}

function layoutFlex() {
  return length.value === undefined ? `${format(size.value)} 1 0px` : `0 1 ${length.value}`;
}

// A form that the panel knows alone. A panel with no size takes a share of the room.
function firstFlex() {
  const first = firstSize.value;
  if (first === undefined) return '1 0 0px';
  return isLength(first) ? `0 1 ${first.trim()}` : `0 1 ${format(firstPercent.value ?? 0)}%`;
}

function elementProps() {
  const withLayout = root.mounted || onServer.value;
  return mergeProps(
    {
      id: panelId.value,
      'data-orientation': root.orientation,
      'data-disabled': props.disabled ? '' : undefined,
      // `null` before the mount, so that the next render always writes or removes it.
      'data-collapsed': withLayout ? (collapsed.value ? '' : undefined) : null,
      // The server HTML has the layout of all the panels, and the first client render has the
      // first form.
      'data-allow-mismatch': root.mounted ? undefined : 'style',
      // The variable comes last, as the render after the mount adds it.
      style: {
        flex: withLayout ? layoutFlex() : firstFlex(),
        [root.orientation === 'horizontal' ? 'minWidth' : 'minHeight']: 0,
        '--resizable-panel-size':
          withLayout && length.value === undefined ? format(size.value) : undefined,
      },
    },
    attrs,
  );
}

defineExpose({
  element,
  /** Collapses the panel to its `collapsedSize`. No other panel collapses for it. */
  collapse: () => root.collapsePanel(panelId.value),
  /**
   * Gives a collapsed panel the size from before the collapse, else its `minSize`. No other panel
   * collapses for it.
   */
  expand: () => root.expandPanel(panelId.value),
  /** Gives the panel a size, as far as the constraints allow. No other panel collapses for it. */
  resize: (wanted: number | string) => root.resizePanel(panelId.value, wanted),
  isCollapsed: () => state.value.collapsed,
});
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :element-ref="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
