<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Toggle } from '../../src/toggle';
import StyledButton from './StyledButton.vue';

defineProps({
  scene: { type: Object as PropType<{ tag: 'span' | 'button' | 'styled' }>, required: true },
  attrs: Object as PropType<Record<string, unknown>>,
});
const toggle = useTemplateRef('toggle');
defineExpose({ toggle });
</script>

<template>
  <div class="Ancestor">
    <Toggle ref="toggle" v-bind="attrs">
      <template #element="{ props, elementRef, state }">
        <StyledButton v-if="scene.tag === 'styled'" v-bind="props" :ref="elementRef">
          Styled
        </StyledButton>
        <component :is="scene.tag" v-else v-bind="props" :ref="elementRef">
          Bold <span class="State">{{ state.pressed }} {{ state.disabled }}</span>
        </component>
      </template>
    </Toggle>
  </div>
</template>
