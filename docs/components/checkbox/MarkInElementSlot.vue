<script setup lang="ts">
import { Checkbox } from '@vase-ui/vue/checkbox';
</script>

<template>
  <label>
    <Checkbox>
      <template #element="{ props, elementRef, state }">
        <span class="box">
          <input v-bind="props" :ref="elementRef" class="checkbox" />
          <svg v-if="state.checked" class="mark" viewBox="0 0 16 16" aria-hidden="true">
            <path d="m2.5 8.5 4 4 7-9" fill="none" stroke="currentColor" />
          </svg>
        </span>
      </template>
    </Checkbox>
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
  pointer-events: none;
}
</style>
