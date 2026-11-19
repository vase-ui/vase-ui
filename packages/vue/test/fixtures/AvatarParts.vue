<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Avatar } from '../../src/avatar';

defineProps({
  root: Object as PropType<Record<string, unknown>>,
  image: Object as PropType<Record<string, unknown>>,
  fallback: Object as PropType<Record<string, unknown>>,
  scene: {
    type: Object as PropType<{ image?: boolean; fallback?: boolean }>,
    default: () => ({}),
  },
});
const rootPart = useTemplateRef('rootPart');
const imagePart = useTemplateRef('imagePart');
const fallbackPart = useTemplateRef('fallbackPart');
defineExpose({ root: rootPart, image: imagePart, fallback: fallbackPart });
</script>

<template>
  <Avatar.Root ref="rootPart" v-bind="root" v-slot="{ state }">
    <b class="status">{{ state.imageLoadingStatus }}</b>
    <Avatar.Image v-if="scene.image !== false" ref="imagePart" v-bind="image" />
    <Avatar.Fallback
      v-if="scene.fallback !== false"
      ref="fallbackPart"
      v-bind="fallback"
      v-slot="{ state: fallbackState }"
      >JD {{ fallbackState.imageLoadingStatus }}</Avatar.Fallback
    >
  </Avatar.Root>
</template>
