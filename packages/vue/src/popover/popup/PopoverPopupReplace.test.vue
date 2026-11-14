<script setup lang="ts">
import * as Popover from '../index.parts';

defineProps<{ swapped: boolean }>();
</script>

<template>
  <Popover.Popup v-if="swapped" data-testid="new">New</Popover.Popup>
  <Popover.Popup v-if="!swapped" data-testid="old">Old</Popover.Popup>
</template>
