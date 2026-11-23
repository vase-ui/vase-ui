<script setup lang="ts">
import type { PropType } from 'vue';

// A `<Transition>` of 10 s around the part in the slot while `on`. Its hooks write `<name> <hook>`
// in `log`. While `on` is `false`, the part renders with no `<Transition>`.
defineProps({
  on: Boolean,
  name: { type: String, required: true },
  log: { type: Object as PropType<{ add(entry: string): void }>, required: true },
});
</script>

<template>
  <Transition
    v-if="on"
    name="part"
    @after-enter="log.add(`${name} after-enter`)"
    @after-leave="log.add(`${name} after-leave`)"
  >
    <slot />
  </Transition>
  <slot v-else />
</template>

<style>
.part-enter-active,
.part-leave-active {
  transition: opacity 10s linear;
}
.part-enter-from,
.part-leave-to {
  opacity: 0;
}
</style>
