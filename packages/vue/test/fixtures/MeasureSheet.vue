<script setup lang="ts">
import type { PropType } from 'vue';

// A sheet in a `<Transition appear>` with the name `sheet`, while `scene.open`. It emits the end of
// each enter and leave.
defineProps({
  scene: { type: Object as PropType<{ open: boolean; tick: number }>, required: true },
});
defineEmits<{ afterEnter: []; afterLeave: [] }>();
</script>

<template>
  <Transition
    name="sheet"
    appear
    @after-enter="$emit('afterEnter')"
    @after-leave="$emit('afterLeave')"
  >
    <div v-if="scene.open" id="sheet" class="sheet" :data-tick="scene.tick" />
  </Transition>
</template>
