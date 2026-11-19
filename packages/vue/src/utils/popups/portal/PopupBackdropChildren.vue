<script lang="ts">
import type { InjectionKey, ShallowRef } from 'vue';

interface PopupBackdrop {
  inert: boolean;
  cutout?: Element | null | undefined;
  target?: ShallowRef<HTMLDivElement | null> | null | undefined;
}

export const PopupBackdropContext: InjectionKey<() => PopupBackdrop | null> = Symbol();
</script>

<script setup lang="ts">
import { computed, inject, useTemplateRef, watch } from 'vue';
import { markChildrenMounted } from '../../../internals/useRenderElement';
import InternalBackdrop from '../InternalBackdrop.vue';

defineSlots<{ default?(): unknown }>();

const backdrop = computed(inject(PopupBackdropContext, () => null));
const part = useTemplateRef('part');
watch(
  [() => part.value?.element, () => backdrop.value?.target],
  ([element, target], _previous, onCleanup) => {
    if (element && target) {
      target.value = element;
      onCleanup(() => {
        if (target.value === element) target.value = null;
      });
    }
  },
  { flush: 'sync' },
);
markChildrenMounted();
</script>

<template>
  <InternalBackdrop v-if="backdrop" ref="part" :inert="backdrop.inert" :cutout="backdrop.cutout" />
  <slot />
</template>
