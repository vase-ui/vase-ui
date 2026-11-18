<script setup lang="ts">
import { Slider } from '@vase-ui/vue/slider';
defineProps<{ target: HTMLElement }>();
</script>

<template>
  <Slider.Thumb>
    <template #render="{ props, children }">
      <div v-bind="props">
        <Teleport :to="target">
          <button>Before input</button>
          <component :is="children" />
          <button>After input</button>
        </Teleport>
      </div>
    </template>
  </Slider.Thumb>
</template>
