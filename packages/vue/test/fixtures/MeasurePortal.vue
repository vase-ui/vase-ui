<script setup lang="ts">
import { onMounted, shallowRef } from 'vue';

// A teleport to `<body>`. With `afterMount`, it renders after its own mount, as a portal of a popup
// does.
const props = defineProps({ afterMount: Boolean, defer: Boolean });
const mounted = shallowRef(!props.afterMount);
onMounted(() => (mounted.value = true));
</script>

<template>
  <Teleport v-if="mounted" to="body" :defer>
    <slot />
  </Teleport>
</template>
