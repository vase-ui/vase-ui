<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import {
  Slider,
  type SliderRootChangeEventDetails,
  type SliderRootCommitEventDetails,
} from '@vase-ui/vue/slider';

function onVolumeChange(value: number, details: SliderRootChangeEventDetails) {
  return value + details.activeThumbIndex;
}

function onVolumeCommitted(value: number, details: SliderRootCommitEventDetails) {
  return value + details.reason.length;
}
</script>

<template>
  <Slider.Root @value-change="onVolumeChange" />
  <Slider.Root @value-change.once="onVolumeChange" />
  <Slider.Root @value-committed="onVolumeCommitted" />
  <Slider.Root @update:model-value="(value: number) => value" />
  <Slider.Root @value-change="(value) => expectType<number, typeof value>(value)" />
  <Slider.Root :default-value="[25, 75]" @value-change="(value: number[]) => value" />
  <!-- @vue-expect-error With no `model-value` and no `default-value`, the value is `min`, a number. -->
  <Slider.Root @value-change="(value: number[]) => value" />
  <!-- The parts take the attributes of their elements; the attributes of a thumb reach its input. -->
  <Slider.Root id="volume" aria-label="Volume" dir="rtl" name="volume" form="settings" />
  <Slider.Thumb id="start" aria-label="Start" tabindex="-1" :index="0" />
  <Slider.Label id="label" title="Volume" />
  <Slider.Value title="Volume" />
  <Slider.Control title="Volume" />
  <!-- @vue-expect-error `thumbAlignment` has no `edge-client-only`. -->
  <Slider.Root thumb-alignment="edge-client-only" />
  <!-- @vue-expect-error `aria-label` is a string. -->
  <Slider.Thumb :aria-label="5" />
</template>
