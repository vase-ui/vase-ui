<script setup lang="ts">
import type { PropType } from 'vue';
import { Toggle } from '../../src/toggle';

defineProps({
  toggles: { type: Array as PropType<Record<string, unknown>[]>, required: true },
  labelFor: String,
});
</script>

<template>
  <form class="Form">
    <!-- WebKit on macOS gives Tab no button, so text inputs stand around the toggles. -->
    <input id="before" aria-label="Before" />
    <div class="Ancestor">
      <Toggle v-for="(attrs, index) in toggles" :key="index" v-slot="{ state }" v-bind="attrs">
        Toggle {{ index }} <span class="State">{{ state.pressed }} {{ state.disabled }}</span>
      </Toggle>
    </div>
    <label v-if="labelFor" id="toggle-label" :for="labelFor">Toggle label</label>
    <input id="after" aria-label="After" />
  </form>
</template>
