<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../src/combobox/index.parts';
import * as DateField from '../src/date-field/index.parts';
import * as DatePicker from '../src/date-picker/index.parts';
import * as DateRangePicker from '../src/date-range-picker/index.parts';
import * as OTPField from '../src/otp-field/index.parts';
import * as Resizable from '../src/resizable/index.parts';
import * as Slider from '../src/slider/index.parts';
import * as TimeClock from '../src/time-clock/index.parts';
import * as TimeField from '../src/time-field/index.parts';
import * as TimePicker from '../src/time-picker/index.parts';

const id = 'id';
</script>

<template>
  <DateField.Root aria-labelledby="id" />
  <DateField.Root :aria-labelledby="id" />
  <DateField.Root ariaLabelledby="id" />
  <DateField.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateField.Root :aria-labelledby="5" />

  <DatePicker.Field aria-labelledby="id" />
  <DatePicker.Field :aria-labelledby="id" />
  <DatePicker.Field ariaLabelledby="id" />
  <DatePicker.Field :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DatePicker.Field :aria-labelledby="5" />

  <DatePicker.TimeField aria-labelledby="id" />
  <DatePicker.TimeField :aria-labelledby="id" />
  <DatePicker.TimeField ariaLabelledby="id" />
  <DatePicker.TimeField :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DatePicker.TimeField :aria-labelledby="5" />

  <DateRangePicker.StartField aria-labelledby="id" />
  <DateRangePicker.StartField :aria-labelledby="id" />
  <DateRangePicker.StartField ariaLabelledby="id" />
  <DateRangePicker.StartField :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateRangePicker.StartField :aria-labelledby="5" />

  <DateRangePicker.EndField aria-labelledby="id" />
  <DateRangePicker.EndField :aria-labelledby="id" />
  <DateRangePicker.EndField ariaLabelledby="id" />
  <DateRangePicker.EndField :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <DateRangePicker.EndField :aria-labelledby="5" />

  <OTPField.Root :length="6" aria-labelledby="id" />
  <OTPField.Root :length="6" :aria-labelledby="id" />
  <OTPField.Root :length="6" ariaLabelledby="id" />
  <OTPField.Root :length="6" :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <OTPField.Root :length="6" :aria-labelledby="5" />

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

  <Resizable.Handle aria-valuetext="x" />
  <Resizable.Handle :aria-valuetext="id" />
  <Resizable.Handle ariaValuetext="x" />
  <Resizable.Handle :ariaValuetext="id" />
  <!-- @vue-expect-error `aria-valuetext` is a string -->
  <Resizable.Handle :aria-valuetext="5" />

  <TimeClock.Face aria-label="x" aria-labelledby="id" aria-describedby="id" />
  <TimeClock.Face :aria-label="id" :aria-labelledby="id" :aria-describedby="id" />
  <TimeClock.Face ariaLabel="x" ariaLabelledby="id" ariaDescribedby="id" />
  <TimeClock.Face :ariaLabel="id" :ariaLabelledby="id" :ariaDescribedby="id" />
  <!-- @vue-expect-error `aria-label` is a string -->
  <TimeClock.Face :aria-label="5" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <TimeClock.Face :aria-labelledby="5" />
  <!-- @vue-expect-error `aria-describedby` is a string -->
  <TimeClock.Face :aria-describedby="5" />

  <TimeField.Root aria-labelledby="id" />
  <TimeField.Root :aria-labelledby="id" />
  <TimeField.Root ariaLabelledby="id" />
  <TimeField.Root :ariaLabelledby="id" />
  <!-- @vue-expect-error `aria-labelledby` is a string -->
  <TimeField.Root :aria-labelledby="5" />

  <TimePicker.Field aria-labelledby="id" />
  <TimePicker.Field :aria-labelledby="id" />
  <TimePicker.Field ariaLabelledby="id" />
  <TimePicker.Field :ariaLabelledby="id" />
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
