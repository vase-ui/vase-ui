<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Separator } from '../../src/separator';
import StyledDiv from './StyledDiv.vue';

defineProps({
  scene: {
    type: Object as PropType<{ shown: boolean }>,
    default: () => ({ shown: true }),
  },
});
const withContent = useTemplateRef('withContent');
const span = useTemplateRef('span');
const styled = useTemplateRef('styled');
defineExpose({ withContent, span, styled });
</script>

<template>
  <Separator ref="withContent" orientation="vertical" v-slot="{ state }">
    {{ state.orientation }}
  </Separator>
  <Separator ref="span" orientation="vertical" aria-label="Span">
    <template #element="{ props, elementRef, state }">
      <span v-bind="props" :ref="elementRef" :data-state="state.orientation" />
    </template>
  </Separator>
  <Separator ref="styled">
    <template #element="{ props, elementRef }">
      <StyledDiv v-bind="props" :ref="elementRef" />
    </template>
  </Separator>
  <Transition>
    <Separator v-if="scene.shown" class="Shown" aria-label="Shown" />
  </Transition>
</template>

<style scoped>
.Shown {
  color: rgb(0, 128, 0);
}
</style>
