<script setup lang="ts">
import { markChildrenMounted } from '../../internals/useRenderElement';
import { useSelectValueContext } from './SelectValueContext';

defineSlots<{ default?(props: { value: any }): unknown }>();

const { value, labels } = useSelectValueContext();

markChildrenMounted();
</script>

<template>
  <slot v-if="$slots.default" :value="value" />
  <template v-else-if="labels.length > 0">
    <template v-for="(label, index) in labels" :key="index">
      <component :is="label" v-if="typeof label === 'function'" />
      <template v-else>{{ label }}</template>
    </template>
  </template>
</template>
