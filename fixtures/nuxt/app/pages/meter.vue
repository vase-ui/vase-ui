<script setup lang="ts">
import { LocaleProvider } from '@vase-ui/vue/locale-provider';
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
    <Meter.Root data-testid="percent-root" :value="42" aria-label="Storage">
      <Meter.Value data-testid="percent-value" />
    </Meter.Root>
    <LocaleProvider locale="fr-FR">
      <Meter.Root data-testid="provider-root" :value="42" aria-label="Load">
        <Meter.Value data-testid="provider-value" />
      </Meter.Root>
    </LocaleProvider>
  </main>
</template>
