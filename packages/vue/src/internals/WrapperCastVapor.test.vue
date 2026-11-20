<script setup vapor lang="ts">
import { Menu } from '@vase-ui/vue/menu';

defineProps<{ open?: boolean | undefined }>();
</script>

<template>
  <Menu.Root :open="open" />
</template>
