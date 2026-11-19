<script setup lang="ts">
import { computed, useTemplateRef, watch } from 'vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { useDialogRootContext } from '../root/DialogRootContext';

defineSlots<{
  default?(): unknown;
}>();

const store = useDialogRootContext();

const mounted = computed(() => store.select('mounted'));
const modal = computed(() => store.select('modal'));
const open = computed(() => store.select('open'));

const internalBackdrop = useTemplateRef('internalBackdrop');
watch(
  () => internalBackdrop.value?.element,
  (backdrop, _previous, onCleanup) => {
    if (backdrop) {
      const target = store.context.internalBackdropRef;
      target.value = backdrop;
      onCleanup(() => {
        if (target.value === backdrop) target.value = null;
      });
    }
  },
  { flush: 'sync' },
);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="mounted && modal === true" ref="internalBackdrop" :inert="!open" />
  <slot />
</template>
