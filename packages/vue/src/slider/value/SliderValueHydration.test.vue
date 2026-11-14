<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Slider } from '@vase-ui/vue/slider';

defineProps<{
  defaultValue: number;
  max?: number | undefined;
  format?: Intl.NumberFormatOptions | undefined;
  suspense?: boolean | undefined;
}>();

// The value of an async component in `<Suspense>` hydrates after its root.
const AsyncValue = defineAsyncComponent(() => Promise.resolve(Slider.Value));
</script>

<template>
  <Slider.Root :default-value="defaultValue" :max="max" :format="format">
    <Suspense v-if="suspense">
      <AsyncValue data-testid="output" />
    </Suspense>
    <Slider.Value v-else data-testid="output" />
  </Slider.Root>
</template>
