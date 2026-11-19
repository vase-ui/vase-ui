<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
</script>

<template>
  <label class="label">
    <span class="box">
      <Checkbox class="checkbox" />
      <svg class="mark" viewBox="0 0 16 16" aria-hidden="true">
        <path d="m2.5 8.5 4 4 7-9" fill="none" stroke="currentColor" />
      </svg>
    </span>
    Get the newsletter
  </label>
</template>

<style scoped>
.box {
  position: relative;
  display: inline-flex;
}

.checkbox {
  appearance: none;
  width: 1rem;
  height: 1rem;
  margin: 0;
  border: 1px solid;
}

.mark {
  position: absolute;
  inset: 0;
  display: none;
  pointer-events: none;
}

.checkbox:checked + .mark {
  display: block;
}
</style>
