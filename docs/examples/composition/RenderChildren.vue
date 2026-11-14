<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
</script>

<template>
  <Slider.Root :default-value="50">
    <Slider.Control>
      <Slider.Track>
        <Slider.Thumb aria-label="Volume">
          <template #render="{ props, children }">
            <span v-bind="props"><component :is="children" /></span>
          </template>
        </Slider.Thumb>
      </Slider.Track>
    </Slider.Control>
  </Slider.Root>
</template>
