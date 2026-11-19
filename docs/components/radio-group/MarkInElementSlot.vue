<script setup lang="ts">
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
</script>

<template>
  <RadioGroup aria-label="Storage type" default-value="ssd">
    <label v-for="value in ['ssd', 'hdd']" :key="value">
      <Radio :value="value">
        <template #element="{ props, elementRef, state }">
          <span class="box">
            <input v-bind="props" :ref="elementRef" class="radio" />
            <span v-if="state.checked" class="dot" />
          </span>
        </template>
      </Radio>
      {{ value.toUpperCase() }}
    </label>
  </RadioGroup>
</template>

<style scoped>
.box {
  position: relative;
  display: inline-flex;
}

.radio {
  appearance: none;
  width: 1rem;
  height: 1rem;
  margin: 0;
  border: 1px solid;
  border-radius: 50%;
}

.dot {
  position: absolute;
  inset: 0.25rem;
  border-radius: 50%;
  background: currentColor;
  pointer-events: none;
}
</style>
