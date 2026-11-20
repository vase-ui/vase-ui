<script setup lang="ts">
import { computed, mergeProps, onUnmounted, useAttrs } from 'vue';
import { useElement } from '../common/element';
import { injectPortal, injectPreviewCardRoot } from './root';
import type { PreviewCardBackdropProps, PreviewCardBackdropState } from './types';

defineOptions({ inheritAttrs: false });

defineProps<PreviewCardBackdropProps>();
defineSlots<{
  default?(scope: { state: PreviewCardBackdropState }): unknown;
  element?(scope: {
    props: Record<string, unknown>;
    elementRef: (target: unknown) => void;
    state: PreviewCardBackdropState;
  }): unknown;
}>();

const { root } = injectPreviewCardRoot('Backdrop');
injectPortal('Backdrop');
const attrs = useAttrs();
const { element, setElement } = useElement<HTMLElement>();

const shown = computed(() => (root.open && !root.leaving) || root.keepMounted);
const state = computed<PreviewCardBackdropState>(() => ({ open: root.open }));
const removeLeaving = root.addLeaving(() => element.value);
onUnmounted(removeLeaving);

function elementProps() {
  const closed = !root.open;
  return mergeProps(
    {
      role: 'presentation',
      hidden: closed ? true : undefined,
      inert: closed ? true : undefined,
      // The page stays in use under a preview card.
      style: { pointerEvents: 'none' },
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
