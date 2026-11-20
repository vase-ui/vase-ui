<script setup lang="ts">
import { provide } from 'vue';
import { createProvider, providerKey } from './root';

defineSlots<{ default?(): unknown }>();

provide(providerKey, createProvider());
</script>

<template>
  <slot />
</template>
