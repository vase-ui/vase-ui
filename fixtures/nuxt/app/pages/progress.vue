<script setup lang="ts">
import { LocaleProvider } from '@vase-ui/vue/locale-provider';
import { Progress } from '@vase-ui/vue/progress';
</script>

<template>
  <main>
    <Progress.Root
      data-testid="currency-root"
      :value="2000"
      :min="1000"
      :max="5000"
      locale="de-DE"
      :format="{ style: 'currency', currency: 'EUR' }"
    >
      <Progress.Label data-testid="currency-label">Budget</Progress.Label>
      <Progress.Value data-testid="currency-value" />
      <Progress.Track>
        <Progress.Indicator data-testid="currency-indicator" />
      </Progress.Track>
    </Progress.Root>
    <Progress.Root data-testid="percent-root" :value="42" aria-label="Storage">
      <Progress.Value data-testid="percent-value" />
    </Progress.Root>
    <LocaleProvider locale="fr-FR">
      <Progress.Root data-testid="provider-root" :value="42" aria-label="Load">
        <Progress.Value data-testid="provider-value" />
      </Progress.Root>
    </LocaleProvider>
  </main>
</template>
