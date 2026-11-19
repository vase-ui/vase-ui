<script setup lang="ts">
import { mergeProps, nextTick, useTemplateRef, watch, type PropType } from 'vue';

// Two blur listeners in the order of a part and of the developer: the first one reads the value
// later, the second one trims the model. A watcher reads the element when the model changes.
const props = defineProps({
  model: { type: Object as PropType<{ value: string }>, required: true },
  log: { type: Array as PropType<string[]>, required: true },
});
const input = useTemplateRef<HTMLInputElement>('input');
const listeners = mergeProps(
  {
    onBlur: () => {
      nextTick(() => props.log.push(`nextTick ${input.value!.value}`));
      setTimeout(() => props.log.push(`timer ${input.value!.value}`));
    },
  },
  { onBlur: () => (props.model.value = props.model.value.trim()) },
);
watch(
  () => props.model.value,
  () => props.log.push(`watcher ${input.value!.value}`),
);
</script>

<template>
  <input ref="input" :value="model.value" aria-label="Text" v-bind="listeners" />
</template>
