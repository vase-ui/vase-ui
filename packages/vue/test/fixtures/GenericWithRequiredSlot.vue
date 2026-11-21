<script setup lang="ts" generic="Value extends string">
// A generic component of an app, with a required slot.
defineProps<{ value?: Value }>();
defineSlots<{ default(scope: { value: Value | undefined }): unknown }>();
</script>

<template>
  <button type="button"><slot :value="value" /></button>
</template>
