<script setup lang="ts">
import type { Ref } from 'vue';

// A component of the consumer that gives its element an `id` of its own. A change of `ownId`
// renders only this component, not the part whose `#render` slot returns it. The fallthrough `id`
// of the part thus does not replace `ownId`.
defineOptions({ inheritAttrs: false });

defineProps<{
  /** The tag of the element. */
  tag: string;
  /** The `id` of the element. A ref, so that only this component reads its value. */
  ownId: Ref<string>;
}>();
</script>

<template>
  <component :is="tag" v-bind="$attrs" :id="ownId.value"><slot /></component>
</template>
