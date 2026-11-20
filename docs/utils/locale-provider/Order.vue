<script setup lang="ts">
import { LocaleProvider } from '@vase-ui/vue/locale-provider';
import { Meter } from '@vase-ui/vue/meter';
</script>

<template>
  <LocaleProvider locale="de-DE">
    <!-- 42 % -->
    <Meter.Root :value="42" aria-label="Storage">
      <Meter.Value />
    </Meter.Root>
    <!-- 42% -->
    <Meter.Root :value="42" locale="en-US" aria-label="Battery">
      <Meter.Value />
    </Meter.Root>
  </LocaleProvider>
</template>
