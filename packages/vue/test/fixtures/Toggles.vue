<script setup lang="ts">
import type { PropType } from 'vue';
import { Toggle } from '../../src/toggle';

defineProps({
  toggles: { type: Array as PropType<Record<string, unknown>[]>, required: true },
});
</script>

<template>
  <!-- WebKit on macOS gives Tab no button, so text inputs stand around the toggles. -->
  <input id="before" aria-label="Before" />
  <div class="Ancestor">
    <Toggle v-for="(attrs, index) in toggles" :key="index" v-slot="{ state }" v-bind="attrs">
      Toggle {{ index }} <span class="State">{{ state.pressed }} {{ state.disabled }}</span>
    </Toggle>
  </div>
  <input id="after" aria-label="After" />
</template>
