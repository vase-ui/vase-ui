<script setup lang="ts">
import { onMounted, shallowRef, watch } from 'vue';

// A part that hides its own root element with `v-show`, as `Popover.Popup` does. The element shows
// one update after its mount. The content renders in the update that shows the element, or with
// `later` in the update after it.
defineProps({ later: Boolean });
const mounted = shallowRef(false);
onMounted(() => (mounted.value = true));
const entered = shallowRef(false);
watch(mounted, (value) => (entered.value = value), { flush: 'post' });
</script>

<template>
  <div v-show="mounted" class="popup">
    <slot v-if="later ? entered : mounted" />
  </div>
</template>
