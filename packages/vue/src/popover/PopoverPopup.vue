<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, useId, watch } from 'vue';
import { useElement } from '../common/element';
import { givenId } from '../common/id';
import { sizeVariables } from '../popup/viewport';
import { injectPopoverRoot, injectPositioner } from './root';
import type { PopoverPopupProps, PopoverPopupState } from './types';

defineOptions({ inheritAttrs: false });

const props = withDefaults(defineProps<PopoverPopupProps>(), {
  initialFocus: undefined,
  finalFocus: undefined,
});
defineSlots<{
  default?(scope: { state: PopoverPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PopoverPopupState;
  }): unknown;
}>();

const context = injectPopoverRoot('Popup');
const placement = injectPositioner('Popup');
const { root, layer } = context;
const attrs = useAttrs();
const generatedId = useId();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<PopoverPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  instant: root.instant,
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
watch(
  () => [props.initialFocus, props.finalFocus] as const,
  ([initialFocus, finalFocus]) => (context.popupFocus.value = { initialFocus, finalFocus }),
  { immediate: true },
);
// Vue does not patch an element that leaves in a `<Transition>`, so the close writes its instant.
watch(
  () => root.instant,
  (instant) => {
    if (instant) element.value?.setAttribute('data-instant', instant);
    else element.value?.removeAttribute('data-instant');
  },
  { flush: 'sync' },
);
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(() => {
  removeLeaving();
  if (root.popup === element.value) root.setPopup(null);
});

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      id: givenId(props.id) ?? generatedId,
      role: 'dialog',
      tabindex: -1,
      'aria-labelledby': root.titleId,
      'aria-describedby': root.descriptionId,
      'aria-modal': layer.hide === 'inert' && root.open ? 'true' : undefined,
      'data-side': state.value.side,
      'data-align': state.value.align,
      'data-instant': root.instant,
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
