<script setup lang="ts">
import { Avatar } from '../index';

defineProps<{
  src?: string | undefined;
  alt?: string | undefined;
  keepMounted?: boolean | undefined;
  delay?: number | undefined;
}>();
</script>

<template>
  <Avatar.Root>
    <Avatar.Image data-testid="image" :src="src" :alt="alt" :keep-mounted="keepMounted" />
    <Avatar.Fallback :delay="delay">JD</Avatar.Fallback>
  </Avatar.Root>
</template>
