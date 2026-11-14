<script setup lang="ts">
import { NumberField } from '@vase-ui/vue/number-field';

// The cursor that comes first in the template mounts before the other cursor unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <NumberField.Root :default-value="0">
    <NumberField.Input />
    <NumberField.ScrubArea data-testid="scrub-area">
      <NumberField.ScrubAreaCursor v-if="swapped" key="new" data-testid="new-cursor" />
      <NumberField.ScrubAreaCursor v-if="!swapped" key="old" data-testid="old-cursor" />
    </NumberField.ScrubArea>
  </NumberField.Root>
</template>
