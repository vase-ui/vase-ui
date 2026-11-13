<script setup lang="ts">
import FloatingPortalLite from './FloatingPortalLite.vue';
</script>

<template>
  <button data-testid="trigger" type="button">trigger</button>
  <FloatingPortalLite data-testid="portal">
    <div data-testid="content">content</div>
  </FloatingPortalLite>
  <button data-testid="after" type="button">after</button>
</template>
