<script setup lang="ts">
import { NavigationMenu } from '@vase-ui/vue/navigation-menu';
import { NuxtLink } from '#components';
</script>

<template>
  <NavigationMenu.Link :as="NuxtLink">
    <slot />
  </NavigationMenu.Link>
</template>
