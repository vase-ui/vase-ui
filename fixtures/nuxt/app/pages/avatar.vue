<script setup lang="ts">
import { Avatar } from '@vase-ui/vue/avatar';

// A data URL needs no network.
const IMAGE_DATA_URL =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
</script>

<template>
  <main>
    <Avatar.Root>
      <Avatar.Image data-testid="image" :src="IMAGE_DATA_URL" />
      <Avatar.Fallback data-testid="fallback">LT</Avatar.Fallback>
    </Avatar.Root>
  </main>
</template>
