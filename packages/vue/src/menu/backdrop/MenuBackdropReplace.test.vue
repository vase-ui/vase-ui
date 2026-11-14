<script setup lang="ts">
import * as Menu from '../index.parts';

// The backdrop that comes first in the template mounts before the other backdrop unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <Menu.Backdrop v-if="swapped" key="new" data-testid="new" />
  <Menu.Backdrop v-if="!swapped" key="old" data-testid="old" />
</template>
