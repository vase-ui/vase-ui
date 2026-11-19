<script setup lang="ts">
import { Avatar } from '@vase-ui/vue/avatar';

const photo = 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1';
</script>

<template>
  <Avatar.Root>
    <Avatar.Fallback>LT</Avatar.Fallback>
    <Avatar.Image keep-mounted alt="" width="48" height="48" loading="lazy">
      <template #element="{ props, elementRef }">
        <img
          v-bind="props"
          :ref="elementRef"
          :srcset="`${photo}?w=48&h=48 1x, ${photo}?w=96&h=96 2x`"
          :src="`${photo}?w=48&h=48`"
        />
      </template>
    </Avatar.Image>
  </Avatar.Root>
</template>
