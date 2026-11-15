<script setup lang="ts">
import { computed } from 'vue';
import { REASONS } from '../../internals/reasons';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { usePopoverRootContext } from '../root/PopoverRootContext';

defineSlots<{
  default?(): unknown;
}>();

const store = usePopoverRootContext();

// Base UI renders the backdrop in the positioner, so it lasts as long as the positioner (`VUE-61`).
const shouldRenderBackdrop = computed(
  () =>
    store.select('mounted') &&
    store.select('positionerElement') !== null &&
    store.select('modal') === true &&
    store.select('openChangeReason') !== REASONS.triggerHover,
);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop
    v-if="shouldRenderBackdrop"
    :inert="!store.select('open')"
    :cutout="store.select('activeTriggerElement')"
  />
  <slot />
</template>
