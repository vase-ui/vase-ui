<script setup lang="ts">
import { computed } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { useSelectRootContext } from '../root/SelectRootContext';

defineSlots<{
  default?(): unknown;
}>();

const store = useSelectRootContext();

const shouldRenderBackdrop = computed(() => store.select('mounted') && store.select('modal'));
const open = computed(() => store.select('open'));
const triggerElement = computed(() => store.select('triggerElement'));

markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="shouldRenderBackdrop" :inert="!open" :cutout="triggerElement" />
  <slot />
</template>
