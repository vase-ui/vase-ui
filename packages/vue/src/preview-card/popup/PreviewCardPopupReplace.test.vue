<script setup lang="ts">
import * as PreviewCard from '../index.parts';

// The popup that comes first in the template mounts before the other popup unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <PreviewCard.Popup v-if="swapped" key="new" data-testid="new">New</PreviewCard.Popup>
  <PreviewCard.Popup v-if="!swapped" key="old" data-testid="old">Old</PreviewCard.Popup>
</template>
