<!-- @strictTemplates true -->
<script setup lang="ts">
import { expectType } from '#test-utils';
import { Slider } from '@vase-ui/vue/slider';

function onVolumeChange(value: number, eventDetails: Slider.Root.ChangeEventDetails) {
  return value + eventDetails.activeThumbIndex;
}

function onVolumeCommitted(value: number, eventDetails: Slider.Root.CommitEventDetails) {
  return value + eventDetails.reason.length;
}
</script>

<template>
  <Slider.Root @value-change="onVolumeChange" />
  <Slider.Root @value-change.once="onVolumeChange" />
  <Slider.Root @value-committed="onVolumeCommitted" />
  <Slider.Root @update:model-value="(value: number) => value" />
  <Slider.Root @value-change="(value) => expectType<number, typeof value>(value)" />
  <Slider.Root :default-value="[25, 75]" @value-change="(value: number[]) => value" />
  <!-- @vue-expect-error With no `value` and no `default-value`, the value is `min`, a number. -->
  <Slider.Root @value-change="(value: number[]) => value" />
</template>
