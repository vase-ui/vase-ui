<script setup lang="ts">
import { Avatar } from '@vase-ui/vue/avatar';
</script>

<template>
  <Avatar.Root>
    <Avatar.Fallback>LT</Avatar.Fallback>
    <Avatar.Image keep-mounted src="/avatar.png" width="32" height="32" alt="" loading="lazy" />
  </Avatar.Root>
</template>
