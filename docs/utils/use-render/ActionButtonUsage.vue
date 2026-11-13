<script setup lang="ts">
import ActionButton from './ActionButton.vue';
</script>

<template>
  <ActionButton class="primary">
    <template #render="{ props }">
      <a v-bind="props" href="/submit">Submit</a>
    </template>
  </ActionButton>
</template>
