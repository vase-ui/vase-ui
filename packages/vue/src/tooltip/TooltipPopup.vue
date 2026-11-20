<script setup lang="ts">
import { computed, mergeProps, onBeforeUnmount, onUnmounted, useAttrs, watch } from 'vue';
import { useElement, type ElementSlotProps } from '../common/element';
import { sizeVariables } from '../popup/viewport';
import { injectPositioner, injectTooltipRoot } from './root';
import type { TooltipPopupProps, TooltipPopupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<TooltipPopupProps>();
defineSlots<{
  default?(scope: { state: TooltipPopupState }): unknown;
  element?(scope: ElementSlotProps<TooltipPopupState>): unknown;
}>();

const context = injectTooltipRoot('Popup');
const placement = injectPositioner('Popup');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<TooltipPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  instant: context.instant,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
// Vue stops the watcher before it removes the element of the part, so the part clears the popup of
// the root. The popup of a part that mounted first stays.
onBeforeUnmount(() => {
  if (root.popup === element.value) root.setPopup(null);
});
// Vue does not patch an element that leaves in a `<Transition>`, so the close writes its instant.
watch(
  () => context.instant,
  (instant) => {
    if (instant) element.value?.setAttribute('data-instant', instant);
    else element.value?.removeAttribute('data-instant');
  },
  { flush: 'sync' },
);
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      // A press on the text of the popup keeps the focus in the tooltip
      // (test/measurements/tooltip.test.ts).
      tabindex: -1,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': context.instant,
      // Vue writes `false` as the attribute `hidden="false"` on an element that is not HTML.
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      style: sizeVariables('popup', context.viewport.value?.popup),
    },
    attrs,
  );
}

defineExpose({ element });
</script>

<template>
  <slot
    v-if="shown && $slots.element"
    name="element"
    :props="elementProps()"
    :elementRef="setElement"
    :state="state"
  />
  <component :is="as" v-else-if="shown && as" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </component>
  <div v-else-if="shown" v-bind="elementProps()" :ref="setElement">
    <slot :state="state" />
  </div>
</template>
