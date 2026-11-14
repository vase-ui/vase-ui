<script setup lang="ts">
import * as Tooltip from '../index.parts';

// The popup that comes first in the template mounts before the other popup unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Tooltip.Popup v-if="swapped" key="new" data-testid="new">New</Tooltip.Popup>
  <Tooltip.Popup v-if="!swapped" key="old" data-testid="old">Old</Tooltip.Popup>
</template>
