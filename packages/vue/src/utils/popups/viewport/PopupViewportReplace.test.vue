<script setup lang="ts">
import PopupViewportPart from '../../../../test/fixtures/PopupViewportPart.vue';

// The viewport that comes first in the template mounts before the other viewport unmounts.
defineProps<{ swapped: boolean }>();
</script>

<template>
  <PopupViewportPart v-if="swapped" key="new" data-testid="new" />
  <PopupViewportPart v-if="!swapped" key="old" data-testid="old" />
</template>
