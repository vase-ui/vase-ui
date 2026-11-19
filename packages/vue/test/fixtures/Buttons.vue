<script setup lang="ts">
import type { PropType } from 'vue';
import { Button } from '../../src/button';

defineProps({
  buttons: { type: Array as PropType<Record<string, unknown>[]>, required: true },
});
</script>

<template>
  <form class="Form">
    <input aria-label="Text" />
    <div class="Ancestor">
      <Button v-for="(attrs, index) in buttons" :key="index" v-slot="{ state }" v-bind="attrs">
        Button {{ index }} <span class="State">{{ state.disabled }}</span>
      </Button>
    </div>
  </form>
</template>
