<script setup lang="ts">
import { Meter } from '@vase-ui/vue/meter';
import { Progress } from '@vase-ui/vue/progress';

defineProps<{ role: 'meter' | 'progressbar'; label: string; text: (label: string) => string }>();
</script>

<template>
  <component
    :is="role === 'meter' ? Meter.Root : Progress.Root"
    :value="50"
    aria-labelledby="range-label"
  >
    <template #render="{ props, children }">
      <section v-bind="props" :ref="props.ref">
        <component :is="children">
          <p id="range-label">{{ text(label) }}</p>
        </component>
      </section>
    </template>
  </component>
</template>
