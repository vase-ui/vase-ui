<script lang="ts">
export interface MultiPartItemProps {
  value?: string | undefined;
}
</script>

<script setup lang="ts">
import { ref } from 'vue';

const props = defineProps<MultiPartItemProps>();

const emit = defineEmits<{
  select: [event: MouseEvent];
}>();

const element = ref<HTMLButtonElement | null>(null);

defineExpose({ element });
</script>

<template>
  <button
    ref="element"
    type="button"
    data-multi-part-item
    :data-value="props.value"
    @click="emit('select', $event)"
  >
    <slot />
  </button>
</template>
