<script setup lang="ts">
import * as Menu from '../index.parts';

// The popup that comes first in the template mounts before the other popup unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Menu.Popup v-if="swapped" key="new" data-testid="new">New</Menu.Popup>
  <Menu.Popup v-if="!swapped" key="old" data-testid="old">Old</Menu.Popup>
</template>
