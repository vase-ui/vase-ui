<script setup lang="ts">
import PrehydrationScript from '../../internals/PrehydrationScript.vue';
import { useFormRestoreAsInput } from '../../internals/useFormRestore';
import { markChildrenMounted } from '../../internals/useRenderElement';
import { script as prehydrationScript } from './prehydrationScript.min';
import { useSliderThumbContext } from './SliderThumbContext';

defineSlots<{
  default?(): unknown;
}>();

const { inputProps, hasPrehydrationScript, inputElement, getHandledInputValue } =
  useSliderThumbContext();

// This component renders the input, so the hooks of its renders keep a restored value.
useFormRestoreAsInput(inputElement, getHandledInputValue, false);

markChildrenMounted();
</script>

<template>
  <slot />
  <input v-bind="inputProps()" />
  <PrehydrationScript v-if="hasPrehydrationScript" :script="prehydrationScript" />
</template>
