<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Button } from '../../src/button';
import StyledButton from './StyledButton.vue';

defineProps({
  scene: {
    type: Object as PropType<{ tag: 'span' | 'a' | 'button' | 'input' | 'styled' | 'wrapped' }>,
    required: true,
  },
  attrs: Object as PropType<Record<string, unknown>>,
});
const button = useTemplateRef('button');
defineExpose({ button });
</script>

<template>
  <form class="Form">
    <div class="Ancestor">
      <Button ref="button" v-bind="attrs">
        <template #element="{ props, elementRef, state }">
          <input
            v-if="scene.tag === 'input'"
            type="submit"
            value="Send"
            v-bind="props"
            :ref="elementRef"
          />
          <span v-else-if="scene.tag === 'wrapped'" class="Wrapper">
            <span v-bind="props" :ref="elementRef">Wrapped</span>
          </span>
          <StyledButton v-else-if="scene.tag === 'styled'" v-bind="props" :ref="elementRef">
            Styled
          </StyledButton>
          <component :is="scene.tag" v-else v-bind="props" :ref="elementRef">
            Save <b class="Child">now</b> <span class="State">{{ state.disabled }}</span>
          </component>
        </template>
      </Button>
    </div>
  </form>
</template>
