<script setup lang="ts">
import { computed } from 'vue';
import { Toggle, type ToggleProps } from '@vase-ui/vue';

// A wrapper that declares the props of the part and one of its own. Vue casts an absent Boolean
// prop to `false`, and a `false` model makes the toggle controlled, so `modelValue` defaults to
// `undefined`.
const props = withDefaults(defineProps<ToggleProps & { size?: 'sm' | 'md' }>(), {
  modelValue: undefined,
});
const emit = defineEmits<{ 'update:modelValue': [pressed: boolean] }>();
const toggleProps = computed(() => {
  const { size: _size, ...forwarded } = props;
  return forwarded;
});
</script>

<template>
  <Toggle
    v-bind="toggleProps"
    :class="`size-${props.size ?? 'md'}`"
    @update:model-value="emit('update:modelValue', $event)"
  >
    <template v-if="$slots.element" #element="scope">
      <slot name="element" v-bind="scope" />
    </template>
    <template #default="scope">
      <slot v-bind="scope" />
    </template>
  </Toggle>
</template>
