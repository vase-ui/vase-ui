<script setup lang="ts">
// A button whose `aria-expanded` the server and the client can render with two values. The parts
// bind their attributes with `v-bind` of an object, as this button does.
defineProps({ expanded: Boolean });
</script>

<template>
  <button v-bind="{ type: 'button', 'aria-expanded': expanded ? 'true' : 'false' }">Trigger</button>
</template>
