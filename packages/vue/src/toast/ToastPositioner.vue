<script setup lang="ts">
import { computed, mergeProps, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { usePlacement, type PlacementProps } from '../popup/placement';
import { injectToastProvider } from './provider';
import { providePositioner } from './root';
import type { ToastPositionerProps, ToastPositionerState } from './types';

defineOptions({ inheritAttrs: false });

// A prop that the part does not get takes the value of `positionerProps` of the toast. So no prop
// has a Vue default: Vue gives an absent Boolean prop `false`.
const props = withDefaults(defineProps<ToastPositionerProps>(), {
  side: undefined,
  align: undefined,
  sideOffset: undefined,
  alignOffset: undefined,
  anchor: undefined,
  collisionAvoidance: undefined,
  collisionBoundary: undefined,
  collisionPadding: undefined,
  sticky: undefined,
  arrowPadding: undefined,
  positionMethod: undefined,
  disableAnchorTracking: undefined,
});
defineSlots<{
  default?(scope: { state: ToastPositionerState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: ToastPositionerState;
  }): unknown;
}>();

const provider = injectToastProvider('<Toast.Positioner>');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

function given<Key extends keyof PlacementProps>(key: Key): PlacementProps[Key] {
  return props[key] ?? props.toast.positionerProps?.[key];
}

const placement = usePlacement(
  { open: true, activeTrigger: null },
  {
    get side() {
      return given('side') ?? 'top';
    },
    get align() {
      return given('align') ?? 'center';
    },
    get sideOffset() {
      return given('sideOffset') ?? 0;
    },
    get alignOffset() {
      return given('alignOffset') ?? 0;
    },
    get anchor() {
      return given('anchor');
    },
    get collisionAvoidance() {
      return given('collisionAvoidance');
    },
    get collisionBoundary() {
      return given('collisionBoundary') ?? 'clipping-ancestors';
    },
    get collisionPadding() {
      return given('collisionPadding') ?? 5;
    },
    get sticky() {
      return given('sticky') ?? false;
    },
    get arrowPadding() {
      return given('arrowPadding') ?? 5;
    },
    get positionMethod() {
      return given('positionMethod') ?? 'absolute';
    },
    get disableAnchorTracking() {
      return given('disableAnchorTracking') ?? false;
    },
  },
  { positioner: element, insets: () => false },
);
providePositioner(placement);

const state = computed<ToastPositionerState>(() => ({
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
}));

function elementProps() {
  const own = props.toast.positionerProps;
  return mergeProps(
    { class: own?.class, style: own?.style },
    {
      style: [placement.style.value, { '--toast-index': provider.place(props.toast.id).index }],
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="$slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
