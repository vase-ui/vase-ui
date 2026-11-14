<script setup lang="ts">
import { computed, onScopeDispose, useTemplateRef, watch } from 'vue';
import type { ShallowRef } from 'vue';
import { REASONS } from '../../internals/reasons';
import { markChildrenMounted } from '../../internals/useRenderElement';
import InternalBackdrop from '../../utils/popups/InternalBackdrop.vue';
import { useMenuRootContext } from '../root/MenuRootContext';

defineSlots<{
  default?(): unknown;
}>();

const { store } = useMenuRootContext();

const parent = computed(() => store.select('parent'));
const open = computed(() => store.select('open'));

const shouldRenderBackdrop = computed(() => {
  const currentParent = parent.value;
  if (!store.select('mounted')) {
    return false;
  }
  if (currentParent.type === 'menubar') {
    return currentParent.context.modal.value;
  }
  return store.select('modal') && store.select('lastOpenChangeReason') !== REASONS.triggerHover;
});

// cuts a hole in the backdrop to allow pointer interaction with the menubar or dropdown menu trigger element
const backdropCutout = computed(() => {
  const currentParent = parent.value;
  if (currentParent.type === 'menubar') {
    return currentParent.context.contentElement.value;
  }
  if (currentParent.type === undefined) {
    return store.select('activeTriggerElement');
  }
  return null;
});

const parentBackdropRef = computed(() => {
  const currentParent = parent.value;
  return currentParent.type === 'context-menu' ? currentParent.context.internalBackdropRef : null;
});

const internalBackdrop = useTemplateRef('internalBackdrop');
let written: { element: HTMLDivElement; target: ShallowRef<HTMLDivElement | null> } | null = null;

// A ref that another element took since the last write keeps that element.
function releaseInternalBackdrop() {
  if (written !== null && written.target.value === written.element) {
    written.target.value = null;
  }
  written = null;
}

watch(
  [() => internalBackdrop.value?.element ?? null, parentBackdropRef],
  ([backdrop, target]) => {
    releaseInternalBackdrop();
    if (backdrop && target) {
      target.value = backdrop;
      written = { element: backdrop, target };
    }
  },
  { flush: 'sync' },
);

// Vue stops the watcher before it unmounts the backdrop with the portal.
onScopeDispose(releaseInternalBackdrop);

markChildrenMounted();
</script>

<template>
  <InternalBackdrop
    v-if="shouldRenderBackdrop"
    ref="internalBackdrop"
    :inert="!open"
    :cutout="backdropCutout"
  />
  <slot />
</template>
