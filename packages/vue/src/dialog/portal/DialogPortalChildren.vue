<script setup lang="ts">
import { computed, onScopeDispose, useTemplateRef, watch } from 'vue';
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
let internalBackdropElement: HTMLDivElement | null = null;

function releaseInternalBackdrop() {
  const internalBackdropRef = store.context.internalBackdropRef;
  if (internalBackdropElement !== null && internalBackdropRef.value === internalBackdropElement) {
    internalBackdropRef.value = null;
  }
  internalBackdropElement = null;
}

watch(
  () => internalBackdrop.value?.element ?? null,
  (backdrop) => {
    releaseInternalBackdrop();
    if (backdrop) {
      internalBackdropElement = backdrop;
      store.context.internalBackdropRef.value = backdrop;
    }
  },
  { flush: 'sync' },
);

// Vue stops the watcher before it unmounts the backdrop with the portal.
onScopeDispose(releaseInternalBackdrop);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="mounted && modal === true" ref="internalBackdrop" :inert="!open" />
  <slot />
</template>
