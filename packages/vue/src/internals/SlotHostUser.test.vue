<script setup lang="ts">
import { Menubar } from '@vase-ui/vue/menubar';
import SlotHost from './SlotHost.test.vue';
</script>

<template>
  <SlotHost>
    <Menubar :modal="false">content</Menubar>
  </SlotHost>
</template>
