<script setup lang="ts">
import PopupPositionerPart from '../../../test/fixtures/PopupPositionerPart.vue';

// The positioner that comes first in the template mounts before the other positioner unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <PopupPositionerPart v-if="swapped" key="new" data-testid="new" />
  <PopupPositionerPart v-if="!swapped" key="old" data-testid="old" />
</template>
