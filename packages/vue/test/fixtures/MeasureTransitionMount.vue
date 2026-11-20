<script setup lang="ts">
import { provide, type PropType } from 'vue';
import MeasureScenePopup from './MeasureScenePopup.vue';
import MeasureScenePositioner from './MeasureScenePositioner.vue';

// A `<Transition>` in a part that renders by state of its root, and a popup that renders its root
// element by the same state. Both mount in one update with an open.
const props = defineProps({
  appear: Boolean,
  scene: { type: Object as PropType<{ open: boolean }>, required: true },
});
provide('scene', props.scene);
</script>

<template>
  <MeasureScenePositioner>
    <Transition name="m" :appear>
      <MeasureScenePopup />
    </Transition>
  </MeasureScenePositioner>
</template>
