<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs, watch } from 'vue';
import { useElement } from '../common/element';
import { sizeVariables } from '../popup/viewport';
import { injectPositioner, injectPreviewCardRoot } from './root';
import type { PreviewCardPopupProps, PreviewCardPopupState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PreviewCardPopupProps>();
defineSlots<{
  default?(scope: { state: PreviewCardPopupState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PreviewCardPopupState;
  }): unknown;
}>();

const context = injectPreviewCardRoot('Popup');
const placement = injectPositioner('Popup');
const { root } = context;
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

// While the old popup leaves, a new open waits: a second element would keep its enter classes.
const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<PreviewCardPopupState>(() => ({
  open: root.open,
  side: placement.side.value,
  align: placement.align.value,
  instant: root.instant as PreviewCardPopupState['instant'],
}));

watch(element, (popup) => root.setPopup(popup), { flush: 'sync' });
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
      // A press on text in the card moves the focus to the card, and not to `<body>`
      // (test/measurements/preview-card.test.ts).
      tabindex: -1,
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
