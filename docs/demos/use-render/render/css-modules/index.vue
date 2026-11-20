<script setup lang="ts">
import Text from './Text.vue';
</script>

<template>
  <div>
    <Text>Text component rendered as a paragraph tag</Text>
    <Text>
      <template #element="{ props, elementRef }">
        <strong v-bind="props" :ref="elementRef">Text component rendered as a strong tag</strong>
      </template>
    </Text>
  </div>
</template>
