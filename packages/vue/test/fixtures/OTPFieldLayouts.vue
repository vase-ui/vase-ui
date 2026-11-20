<script setup lang="ts">
import type { PropType } from 'vue';
import { OTPField } from '../../src/otp-field';

// Each slot is in a wrapper, with a separator after the third one. `scene.first` adds a slot before
// them with `v-if`. `scene.teleport` moves the root to the end of the body.
defineProps({
  root: { type: Object as PropType<{ length: number; [key: string]: unknown }>, required: true },
  scene: {
    type: Object as PropType<{ count: number; first?: boolean; teleport?: boolean }>,
    required: true,
  },
});
</script>

<template>
  <input id="before" aria-label="Before" />
  <Teleport to="body" :disabled="!scene.teleport">
    <OTPField.Root v-bind="root">
      <span v-if="scene.first" class="Wrapper"><OTPField.Input data-slot="first" /></span>
      <template v-for="n in scene.count" :key="n">
        <span class="Wrapper"><OTPField.Input :data-slot="n" /></span>
        <OTPField.Separator v-if="n === 3" />
      </template>
    </OTPField.Root>
  </Teleport>
  <input id="after" aria-label="After" />
</template>
