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

.v-leave-active {
  position: absolute;
}
</style>
