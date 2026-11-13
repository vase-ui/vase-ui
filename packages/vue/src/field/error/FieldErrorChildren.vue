<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useFieldErrorContext } from './FieldErrorContext';

defineSlots<{
  default?(): unknown;
}>();

const message = useFieldErrorContext();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" />
  <ul v-else-if="Array.isArray(message)">
    <li v-for="item in message" :key="item">{{ item }}</li>
  </ul>
  <template v-else-if="message">{{ message }}</template>
</template>
