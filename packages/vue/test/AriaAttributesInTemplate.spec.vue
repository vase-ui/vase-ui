<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../src/combobox/parts';
import * as DatePicker from '../src/date-picker/index.parts';
import * as DateRangePicker from '../src/date-range-picker/index.parts';
import { Resizable } from '../src/resizable';
import * as TimePicker from '../src/time-picker/index.parts';
import { Slider } from '@vase-ui/vue/slider';

const id = 'id';
</script>

<template>
  <DatePicker.Field aria-labelledby="id" />
  <DatePicker.Field :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DatePicker.Field :aria-labelledby="5" />

  <DatePicker.TimeField aria-labelledby="id" />
  <DatePicker.TimeField :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DatePicker.TimeField :aria-labelledby="5" />

  <DateRangePicker.StartField aria-labelledby="id" />
  <DateRangePicker.StartField :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateRangePicker.StartField :aria-labelledby="5" />

  <DateRangePicker.EndField aria-labelledby="id" />
  <DateRangePicker.EndField :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateRangePicker.EndField :aria-labelledby="5" />

  <Slider.Root aria-labelledby="id" />
  <Slider.Root :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Root :aria-labelledby="5" />

  <Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />
  <Slider.Thumb
    :aria-label="id"
    :aria-labelledby="id"
    :aria-describedby="id"
    :aria-valuetext="id"
  />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Slider.Thumb :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Thumb :aria-labelledby="5" />
  <!-- @vue-expect-error `aria-describedby` is a string -->
  <Slider.Thumb :aria-describedby="5" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Slider.Thumb :aria-valuetext="5" />

  <Resizable.Handle aria-valuetext="x" />
  <Resizable.Handle :aria-valuetext="id" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Resizable.Handle :aria-valuetext="5" />

  <TimePicker.Field aria-labelledby="id" />
  <TimePicker.Field :aria-labelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <TimePicker.Field :aria-labelledby="5" />

  <Combobox.Chip aria-description="x" />
  <Combobox.Chip :aria-description="id" />
  <Combobox.Input aria-description="x" />
  <!-- @vue-expect-error `aria-descripton` is not an attribute -->
  <Combobox.Chip aria-descripton="x" />
  <!-- @vue-expect-error `aria-description` is a string -->
  <Combobox.Chip :aria-description="5" />
</template>
