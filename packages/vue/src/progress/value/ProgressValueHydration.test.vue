<script setup lang="ts">
import { defineAsyncComponent } from 'vue';
import { Progress } from '../index';

defineProps<{
  value: number | null;
  max?: number | undefined;
  format?: Intl.NumberFormatOptions | undefined;
  suspense?: boolean | undefined;
}>();

// The value of an async component in `<Suspense>` hydrates after its root.
const AsyncValue = defineAsyncComponent(() => Promise.resolve(Progress.Value));
</script>

<template>
  <Progress.Root :value="value" :max="max" :format="format">
    <Suspense v-if="suspense">
      <AsyncValue data-testid="value" />
    </Suspense>
    <Progress.Value v-else data-testid="value" />
  </Progress.Root>
</template>
