<script setup lang="ts">
import { computed } from 'vue';
import { REASONS } from '../../internals/reasons';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineSlots<{
  default?(): unknown;
}>();

const { store, open, mounted, trigger } = usePopoverRootContext();

// Base UI renders the backdrop in the positioner, so it lasts as long as the positioner (`VUE-61`).
const shouldRenderBackdrop = computed(
  () =>
    mounted.value &&
    store.select('positionerElement') !== null &&
    store.state.modal === true &&
    store.state.openChangeReason !== REASONS.triggerHover,
);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="shouldRenderBackdrop" :inert="!open" :cutout="trigger" />
  <slot />
</template>
