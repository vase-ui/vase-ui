<script setup lang="ts">
import { mergeProps, nextTick, useTemplateRef, watch, type PropType } from 'vue';

// Two blur listeners in the order of a part and of the developer: the first one reads the value
// later, the second one sends the trimmed value. A watcher reads the element when the model changes.
const props = defineProps({
  model: { type: Object as PropType<{ value: string }>, required: true },
});
const emit = defineEmits<{ log: [entry: string]; trim: [value: string] }>();
const input = useTemplateRef<HTMLInputElement>('input');
const listeners = mergeProps(
  {
    onBlur: () => {
      void nextTick(() => emit('log', `nextTick ${input.value!.value}`));
      setTimeout(() => emit('log', `timer ${input.value!.value}`));
    },
  },
  { onBlur: () => emit('trim', props.model.value.trim()) },
);
watch(
  () => props.model.value,
  () => emit('log', `watcher ${input.value!.value}`),
);
</script>

<template>
  <input ref="input" :value="model.value" aria-label="Text" v-bind="listeners" />
</template>
