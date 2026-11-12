<script setup lang="ts">
import { Meter } from '@vase-ui/vue/meter';
</script>

<template>
  <main>
    <Meter.Root
      data-testid="currency-root"
      :value="2000"
      :min="1000"
      :max="5000"
      locale="de-DE"
      :format="{ style: 'currency', currency: 'EUR' }"
    >
      <Meter.Label data-testid="currency-label">Budget</Meter.Label>
      <Meter.Value data-testid="currency-value" />
      <Meter.Track>
        <Meter.Indicator data-testid="currency-indicator" />
      </Meter.Track>
    </Meter.Root>
    <Meter.Root :value="42">
      <Meter.Value data-testid="percent-value" />
    </Meter.Root>
  </main>
</template>
