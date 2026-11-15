<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Checkbox from '../src/checkbox/index.parts';
import * as Combobox from '../src/combobox/index.parts';
import * as DateField from '../src/date-field/index.parts';
import * as OTPField from '../src/otp-field/index.parts';
import * as Radio from '../src/radio/index.parts';
import * as Slider from '../src/slider/index.parts';
import * as Switch from '../src/switch/index.parts';
import * as TimeField from '../src/time-field/index.parts';

const id = 'id';
</script>

<template>
  <Checkbox.Root aria-label="x" aria-labelledby="id" />
  <Checkbox.Root :aria-label="id" :aria-labelledby="id" />
  <Checkbox.Root ariaLabel="x" ariaLabelledby="id" />
  <Checkbox.Root :ariaLabel="id" :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Checkbox.Root :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Checkbox.Root :aria-labelledby="5" />

  <DateField.Root aria-labelledby="id" />
  <DateField.Root :aria-labelledby="id" />
  <DateField.Root ariaLabelledby="id" />
  <DateField.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateField.Root :aria-labelledby="5" />

  <OTPField.Root :length="6" aria-labelledby="id" />
  <OTPField.Root :length="6" :aria-labelledby="id" />
  <OTPField.Root :length="6" ariaLabelledby="id" />
  <OTPField.Root :length="6" :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <OTPField.Root :length="6" :aria-labelledby="5" />

  <Radio.Root value="a" aria-label="x" aria-labelledby="id" />
  <Radio.Root value="a" :aria-label="id" :aria-labelledby="id" />
  <Radio.Root value="a" ariaLabel="x" ariaLabelledby="id" />
  <Radio.Root value="a" :ariaLabel="id" :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Radio.Root value="a" :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Radio.Root value="a" :aria-labelledby="5" />

  <Switch.Root aria-label="x" aria-labelledby="id" />
  <Switch.Root :aria-label="id" :aria-labelledby="id" />
  <Switch.Root ariaLabel="x" ariaLabelledby="id" />
  <Switch.Root :ariaLabel="id" :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Switch.Root :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Switch.Root :aria-labelledby="5" />

  <Slider.Root aria-labelledby="id" />
  <Slider.Root :aria-labelledby="id" />
  <Slider.Root ariaLabelledby="id" />
  <Slider.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Root :aria-labelledby="5" />

  <Slider.Thumb aria-label="x" aria-labelledby="id" aria-describedby="id" aria-valuetext="x" />
  <Slider.Thumb
    :aria-label="id"
    :aria-labelledby="id"
    :aria-describedby="id"
    :aria-valuetext="id"
  />
  <Slider.Thumb ariaLabel="x" ariaLabelledby="id" ariaDescribedby="id" ariaValuetext="x" />
  <Slider.Thumb :ariaLabel="id" :ariaLabelledby="id" :ariaDescribedby="id" :ariaValuetext="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <Slider.Thumb :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <Slider.Thumb :aria-labelledby="5" />
  <!-- @vue-expect-error `aria-describedby` is a string -->
  <Slider.Thumb :aria-describedby="5" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Slider.Thumb :aria-valuetext="5" />

  <TimeField.Root aria-labelledby="id" />
  <TimeField.Root :aria-labelledby="id" />
  <TimeField.Root ariaLabelledby="id" />
  <TimeField.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <TimeField.Root :aria-labelledby="5" />

  <Combobox.Chip aria-description="x" />
  <Combobox.Chip :aria-description="id" />
  <Combobox.Input aria-description="x" />
  <!-- @vue-expect-error `aria-descripton` is not an attribute -->
  <Combobox.Chip aria-descripton="x" />
  <!-- @vue-expect-error `aria-description` is a string -->
  <Combobox.Chip :aria-description="5" />
</template>
