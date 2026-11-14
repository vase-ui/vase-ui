<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { RouterLink } from 'vue-router';
</script>

<template>
  <NavigationMenu.Link :as="RouterLink">
    <slot />
  </NavigationMenu.Link>
</template>
