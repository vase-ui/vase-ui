<script setup lang="ts">
import PrehydrationScript from '../../internals/PrehydrationScript.vue';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { script as prehydrationScript } from './prehydrationScript.min';
import { useSliderThumbContext } from '../root/SliderRootContext';

defineSlots<{
  default?(): unknown;
}>();

const { inputProps, setInputElement, hasPrehydrationScript } = useSliderThumbContext();

markChildrenMounted();
</script>

<template>
  <slot />
  <input v-bind="inputProps()" :ref="setInputElement" />
  <PrehydrationScript v-if="hasPrehydrationScript" :script="prehydrationScript" />
</template>
