<script setup lang="ts">
import { LocaleProvider } from '../../src/locale-provider';
import { Meter } from '../../src/meter';
import { Progress } from '../../src/progress';
import { Slider } from '../../src/slider';

// The locales of two nested providers, and the `locale` prop of one meter.
defineProps<{ locales: { outer: string; inner: string; meter?: string } }>();

const range = { value: 1234.567, max: 2000, format: { maximumFractionDigits: 2 } };
const slider = { defaultValue: 1234.567, max: 2000, step: 0.001, format: range.format };
</script>

<template>
  <LocaleProvider :locale="locales.outer">
    <Meter.Root aria-label="Meter" v-bind="range">
      <Meter.Value />
    </Meter.Root>
    <Progress.Root aria-label="Progress" v-bind="range">
      <Progress.Value />
    </Progress.Root>
    <Slider.Root aria-label="Slider" v-bind="slider">
      <Slider.Value />
    </Slider.Root>
    <Meter.Root aria-label="Meter with a locale" v-bind="range" :locale="locales.meter">
      <Meter.Value />
    </Meter.Root>
    <LocaleProvider :locale="locales.inner">
      <Meter.Root aria-label="Meter in the inner provider" v-bind="range">
        <Meter.Value />
      </Meter.Root>
    </LocaleProvider>
  </LocaleProvider>
  <Meter.Root aria-label="Meter with no provider" v-bind="range">
    <Meter.Value />
  </Meter.Root>
</template>
