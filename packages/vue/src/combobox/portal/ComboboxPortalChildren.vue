<script setup lang="ts">
import { computed } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { useComboboxRootContext } from '../root/ComboboxRootContext';

defineSlots<{
  default?(): unknown;
}>();

const store = useComboboxRootContext();

const open = computed(() => store.select('open'));

// Base UI renders the backdrop in the positioner, so it lasts as long as the positioner (`VUE-61`).
// A list with no positioner is its own positioner element, and it has no backdrop.
const hasPositioner = computed(() => {
  const positionerElement = store.select('positionerElement');
  return positionerElement !== null && positionerElement !== store.select('listElement');
});
const shouldRenderBackdrop = computed(
  () => store.select('mounted') && hasPositioner.value && store.select('modal'),
);
const backdropCutout = computed(
  () =>
    store.select('inputGroupElement') ??
    store.select('inputElement') ??
    store.select('triggerElement'),
);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="shouldRenderBackdrop" :inert="!open" :cutout="backdropCutout" />
  <slot />
</template>
