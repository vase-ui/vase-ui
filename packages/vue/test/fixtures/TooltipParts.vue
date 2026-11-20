<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Tooltip } from '../../src/tooltip';
import TooltipPart from './TooltipPart.vue';

type Props = Record<string, unknown>;

// Tooltips in a row, in a `Tooltip.Provider` with `provider`. With no `tooltips`, one tooltip with
// the name `t`. An input stands before them, and a button at the bottom right of the view.
defineProps({
  provider: Object as PropType<Props>,
  tooltips: {
    type: Array as PropType<({ name: string } & Props)[]>,
    default: () => [{ name: 't' }],
  },
});
const parts = useTemplateRef<InstanceType<typeof TooltipPart>[]>('parts');
defineExpose({ parts });
</script>

<template>
  <input id="before" aria-label="Before" />
  <Tooltip.Provider v-if="provider" v-bind="provider">
    <TooltipPart v-for="tooltip in tooltips" :key="tooltip.name" ref="parts" v-bind="tooltip" />
  </Tooltip.Provider>
  <template v-else>
    <TooltipPart v-for="tooltip in tooltips" :key="tooltip.name" ref="parts" v-bind="tooltip" />
  </template>
  <button id="outside" style="position: fixed; right: 0; bottom: 0">Outside</button>
</template>

<style>
.tip-enter-active,
.tip-leave-active {
  transition: opacity 10s;
}
.tip-enter-from,
.tip-leave-to {
  opacity: 0;
}
.spin-leave-active {
  animation: tip-out 10s forwards;
}
@keyframes tip-out {
  to {
    opacity: 0;
  }
}
.fade-enter-active,
.fade-leave-active {
  transition: opacity 1s;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
</style>
