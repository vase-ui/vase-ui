<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../combobox/index.parts';
import * as DatePicker from '../date-picker/index.parts';
import * as DateRangePicker from '../date-range-picker/index.parts';
import * as Dialog from '../dialog/index.parts';
import * as Menu from '../menu/index.parts';
import * as NumberField from '../number-field/index.parts';
import * as OTPField from '../otp-field/index.parts';
import * as Slider from '../slider/index.parts';
import * as TimePicker from '../time-picker/index.parts';
import * as Toolbar from '../toolbar/index.parts';
</script>

<template>
  <Menu.GroupLabel :aria-hidden="null" />
  <Dialog.Popup :aria-describedby="null" />
  <Dialog.Popup :aria-describedby="undefined" />
  <!-- @vue-expect-error `aria-hidden` is a Boolean -->
  <Menu.GroupLabel :aria-hidden="5" />

  <Combobox.Input :autocomplete="null" />
  <Menu.Input :autocomplete="null" />
  <NumberField.Input :autocomplete="null" />
  <OTPField.Input :autocomplete="null" />
  <Toolbar.Input :autocomplete="null" />

  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DatePicker.Field :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DatePicker.TimeField :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DateRangePicker.StartField :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DateRangePicker.EndField :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <OTPField.Root :length="6" :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Slider.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <Slider.Thumb :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Slider.Thumb :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaDescribedby` takes no `null` -->
  <Slider.Thumb :aria-describedby="null" />
  <!-- @vue-expect-error the prop `ariaValuetext` takes no `null` -->
  <Slider.Thumb :aria-valuetext="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <TimePicker.Field :aria-labelledby="null" />
</template>
