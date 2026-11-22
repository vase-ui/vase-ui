<script setup lang="ts">
import type { PropType } from 'vue';
import { Toast } from '../../src/toast';
import ToastManagerAlone from './ToastManagerAlone.vue';

// A part outside its parent. With `inProvider`, the part is in a provider with no root.
defineProps({
  part: {
    type: String as PropType<
      'Root' | 'Viewport' | 'Positioner' | 'Title' | 'Description' | 'Arrow' | 'useToastManager'
    >,
    required: true,
  },
  inProvider: Boolean,
});
</script>

<template>
  <ToastManagerAlone v-if="part === 'useToastManager'" />
  <Toast.Provider v-else-if="inProvider">
    <component :is="Toast[part as 'Title']" />
  </Toast.Provider>
  <component :is="Toast[part]" v-else :toast="{ id: 'a' }" />
</template>
