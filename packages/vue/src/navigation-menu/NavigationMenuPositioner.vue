<script setup lang="ts">
import { computed, mergeProps, provide, reactive, shallowRef, toRefs, useAttrs, watch } from 'vue';
import { addEventListener } from '../common/addEventListener';
import { useElement, type ElementSlotProps } from '../common/element';
import { ownerWindow } from '../common/owner';
import { useTimeout } from '../common/useTimeout';
import { usePlacement, type CollisionAvoidance } from '../popup/placement';
import { sizeVariables, type usePopupSizes } from '../popup/viewport';
import { injectNavigationMenuRoot, injectPortal, positionerKey, sizesKey } from './root';
import type { NavigationMenuPositionerProps, NavigationMenuPositionerState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<NavigationMenuPositionerProps>(), {
  side: 'bottom',
  align: 'center',
  sideOffset: 0,
  alignOffset: 0,
  anchor: undefined,
  collisionAvoidance: undefined,
  collisionBoundary: 'clipping-ancestors',
  collisionPadding: 5,
  sticky: false,
  arrowPadding: 5,
  positionMethod: 'absolute',
  disableAnchorTracking: false,
});
defineSlots<{
  default?(scope: { state: NavigationMenuPositionerState }): unknown;
  element?(scope: ElementSlotProps<NavigationMenuPositionerState>): unknown;
}>();

const root = injectNavigationMenuRoot('Positioner');
injectPortal('Positioner');
const { popup } = root;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const placementProps = reactive({
  ...toRefs(props),
  // A nested menu can go to a side of the other axis.
  collisionAvoidance: computed(
    (): CollisionAvoidance =>
      props.collisionAvoidance ?? { fallbackAxisSide: root.nested ? 'end' : 'none' },
  ),
  // While the popup leaves, it stays at the trigger of its content.
  anchor: computed(() =>
    popup.leaving
      ? popup.triggers.find((trigger) => trigger.payload === root.shown)?.element
      : props.anchor,
  ),
});
// The popup changes its size while it is open, so the place is insets from the edge that faces the
// anchor: the popup grows away from it.
const placement = usePlacement(popup, placementProps, {
  positioner: element,
  insets: () => true,
  shiftInLayoutViewport: true,
});
provide(positionerKey, placement);
const sizes = shallowRef<ReturnType<typeof usePopupSizes> | null>(null);
provide(sizesKey, sizes);

// While the window changes its size, and 100 ms after, a style skips its animation. So does the
// first place of an open (test/measurements/navigation-menu.test.ts, "a positioner with a
// transition of its place that $name runs no transition").
const resizing = shallowRef(false);
const opening = shallowRef(popup.open);
watch(
  () => popup.open,
  (open) => {
    if (open) opening.value = true;
  },
  { flush: 'sync' },
);
watch(
  placement.style,
  () => {
    const positioner = element.value;
    if (!opening.value || !popup.open || !placement.placed.value || !positioner) return;
    // The read applies the first place while `data-instant` is on.
    positioner.getBoundingClientRect();
    opening.value = false;
  },
  { flush: 'post' },
);
const resizeTimer = useTimeout();
watch(
  () => (popup.open ? element.value : null),
  (positioner, _, onCleanup) => {
    if (!positioner) return;
    onCleanup(
      addEventListener(ownerWindow(positioner), 'resize', () => {
        resizing.value = true;
        resizeTimer.start(100, () => (resizing.value = false));
      }),
    );
  },
);

const state = computed<NavigationMenuPositionerState>(() => ({
  open: popup.open,
  side: placement.side.value,
  align: placement.align.value,
  anchorHidden: placement.anchorHidden.value,
  instant: resizing.value || opening.value,
}));

function elementProps() {
  return mergeProps(
    {
      style: [placement.style.value, sizeVariables('positioner', sizes.value?.positioner.value)],
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-anchor-hidden': state.value.anchorHidden ? '' : undefined,
      'data-instant': state.value.instant ? '' : undefined,
      hidden: popup.open || popup.leaving ? undefined : true,
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
