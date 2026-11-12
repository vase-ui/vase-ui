<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Meter } from '../index';

defineProps<{
  value: number;
  max?: number | undefined;
  format?: Intl.NumberFormatOptions | undefined;
  suspense?: boolean | undefined;
}>();

// The value of an async component in `<Suspense>` hydrates after its root.
const AsyncValue = defineAsyncComponent(() => Promise.resolve(Meter.Value));
</script>

<template>
  <Meter.Root :value="value" :max="max" :format="format">
    <Suspense v-if="suspense">
      <AsyncValue data-testid="value" />
    </Suspense>
    <Meter.Value v-else data-testid="value" />
  </Meter.Root>
</template>
