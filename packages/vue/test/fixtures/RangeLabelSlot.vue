<script setup lang="ts">
import { Progress } from '@vase-ui/vue/progress';

defineProps<{ label: string; text: (label: string) => string }>();
</script>

<template>
  <Progress.Root :value="50" aria-labelledby="range-label">
    <template #render="{ props, children }">
      <section v-bind="props" :ref="props.ref">
        <component :is="children">
          <p id="range-label">{{ text(label) }}</p>
        </component>
      </section>
    </template>
  </Progress.Root>
</template>
