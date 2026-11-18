<script setup lang="ts">
import { useInputRender } from './useInputRender';

const props = defineProps<{ value: string }>();
const { valueProps, renderValue } = useInputRender();
</script>

<template>
  <input v-bind="valueProps(props.value)" @input="renderValue" />
</template>
