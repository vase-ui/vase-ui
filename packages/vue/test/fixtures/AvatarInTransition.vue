<script setup lang="ts">
import type { PropType } from 'vue';
import { Avatar } from '../../src/avatar';

defineProps({ image: Object as PropType<Record<string, unknown>> });
</script>

<template>
  <Avatar.Root class="Root">
    <Transition>
      <Avatar.Image v-bind="image" />
    </Transition>
    <Transition>
      <Avatar.Fallback>JD</Avatar.Fallback>
    </Transition>
  </Avatar.Root>
</template>

<style scoped>
.Root {
  position: relative;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 200ms linear;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

.v-leave-active {
  position: absolute;
}
</style>
