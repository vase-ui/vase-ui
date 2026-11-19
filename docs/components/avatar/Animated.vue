<script setup lang="ts">
import { Avatar } from '@vase-ui/vue/avatar';
</script>

<template>
  <Avatar.Root class="avatar">
    <Transition>
      <Avatar.Image src="/avatar.png" width="48" height="48" />
    </Transition>
    <Avatar.Fallback>LT</Avatar.Fallback>
  </Avatar.Root>
</template>

<style scoped>
.avatar {
  position: relative;
  display: inline-flex;
}

.v-enter-active,
.v-leave-active {
  transition: opacity 150ms;
}

.v-enter-from,
.v-leave-to {
  opacity: 0;
}

/* Vue keeps the leaving image in the DOM until its leave ends. */
.v-leave-active {
  position: absolute;
}
</style>
