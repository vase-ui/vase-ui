<script setup vapor lang="ts">
import { Drawer } from '@vase-ui/vue/drawer';

defineProps<{ open?: boolean | undefined }>();
</script>

<template>
  <Drawer.Root :open="open" />
</template>
