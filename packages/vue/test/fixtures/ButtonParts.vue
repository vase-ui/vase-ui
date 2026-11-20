<script setup lang="ts">
import type { PropType } from 'vue';
import ButtonPart from './ButtonPart.vue';

defineProps({
  scene: {
    type: Object as PropType<{ disabled: boolean; click: () => void }>,
    default: () => ({ disabled: false, click() {} }),
  },
});
</script>

<template>
  <ButtonPart>
    <template #element="{ props, elementRef }">
      <button id="button" v-bind="props" :ref="elementRef">Button</button>
    </template>
  </ButtonPart>
  <ButtonPart>
    <template #element="{ props, elementRef }">
      <span id="span" v-bind="props" :ref="elementRef">Span</span>
    </template>
  </ButtonPart>
  <ButtonPart type="submit">
    <template #element="{ props, elementRef }">
      <button id="submit" v-bind="props" :ref="elementRef">Submit</button>
    </template>
  </ButtonPart>
  <ButtonPart :disabled="scene.disabled" :own="{ tabindex: -1, onClick: scene.click }">
    <template #element="{ props, elementRef }">
      <span id="grouped" v-bind="props" :ref="elementRef">Grouped</span>
    </template>
  </ButtonPart>
  <ButtonPart :own="{ tabindex: -1 }" tabindex="0">
    <template #element="{ props, elementRef }">
      <span id="developer" v-bind="props" :ref="elementRef">Developer</span>
    </template>
  </ButtonPart>
</template>
