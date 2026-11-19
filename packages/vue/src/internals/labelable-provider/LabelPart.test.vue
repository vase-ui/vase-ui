<script setup lang="ts">
import { shallowRef } from 'vue';
import type { RegisterId } from './createIdRegistry';
import { useLabel } from './useLabel';

// A native label part that registers its id with `registerLabelId`.
const props = defineProps<{ id?: string | undefined; registerLabelId?: RegisterId | undefined }>();

const element = shallowRef<HTMLElement | null>(null);
const labelProps = useLabel({
  id: () => props.id,
  element,
  native: true,
  registerLabelId: (source, getId) => props.registerLabelId?.(source, getId),
});
</script>

<template>
  <label ref="element" v-bind="labelProps"><slot /></label>
</template>
