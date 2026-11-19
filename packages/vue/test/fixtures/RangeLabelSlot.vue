<script setup lang="ts">
import { Meter } from '@vase-ui/vue/meter';

defineProps<{ label: string; text: (label: string) => string }>();
</script>

<template>
  <Meter.Root :value="50" aria-labelledby="range-label">
    <template #render="{ props, children }">
      <section v-bind="props" :ref="props.ref">
        <component :is="children">
          <p id="range-label">{{ text(label) }}</p>
        </component>
      </section>
    </template>
  </Meter.Root>
</template>
