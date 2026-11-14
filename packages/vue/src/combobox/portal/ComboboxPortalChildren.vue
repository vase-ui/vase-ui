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
const shouldRenderBackdrop = computed(() => store.select('mounted') && store.select('modal'));
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
