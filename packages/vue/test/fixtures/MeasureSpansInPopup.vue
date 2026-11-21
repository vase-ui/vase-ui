<script setup lang="ts">
import type { PropType } from 'vue';
import MeasureCountedSpan from './MeasureCountedSpan.vue';
import MeasureMovedPopup from './MeasureMovedPopup.vue';

// 2,000 spans that count their renders, in the slot of a popup whose style follows
// `scene.movement`. The root reads no state, so only the popup renders again.
defineProps({
  scene: { type: Object as PropType<{ movement: number }>, required: true },
  count: { type: Function as PropType<() => string>, required: true },
});
</script>

<template>
  <MeasureMovedPopup :scene="scene">
    <MeasureCountedSpan v-for="index in 2000" :key="index" :index="index" :count="count" />
  </MeasureMovedPopup>
</template>
