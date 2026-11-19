<script setup lang="ts">
import PopupPortal from './PopupPortal.vue';
</script>

<template>
  <button data-testid="trigger" type="button">trigger</button>
  <div id="hydrate-target" data-testid="target" />
  <PopupPortal to="#hydrate-target" data-testid="portal">
    <div data-testid="content">content</div>
  </PopupPortal>
  <button data-testid="after" type="button">after</button>
</template>
