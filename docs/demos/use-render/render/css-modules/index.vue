<script setup lang="ts">
import Text from './Text.vue';
</script>

<template>
  <div>
    <Text>Text component rendered as a paragraph tag</Text>
    <Text as="strong">Text component rendered as a strong tag</Text>
  </div>
</template>
