<script setup lang="ts">
import PrehydrationScript from '../../internals/PrehydrationScript.vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { script as prehydrationScript } from './prehydrationScript.min';
import { useSliderThumbContext } from './SliderThumbContext';

defineSlots<{
  default?(): unknown;
}>();

const { inputProps, hasPrehydrationScript } = useSliderThumbContext();

markChildrenMounted();
</script>

<template>
  <slot />
  <input v-bind="inputProps()" />
  <PrehydrationScript v-if="hasPrehydrationScript" :script="prehydrationScript" />
</template>
