<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../combobox/index.parts';
import * as DatePicker from '../date-picker/index.parts';
import * as DateRangePicker from '../date-range-picker/index.parts';
import * as Menu from '../menu/parts';
import * as TimePicker from '../time-picker/index.parts';
</script>

<template>
  <Combobox.GroupLabel :aria-hidden="null" />
  <Combobox.Popup :aria-describedby="null" />
  <Combobox.Popup :aria-describedby="undefined" />
  <!-- @vue-expect-error `aria-hidden` is a Boolean -->
  <Combobox.GroupLabel :aria-hidden="5" />

  <Combobox.Input :autocomplete="null" />
  <Menu.Input :autocomplete="null" />

  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DatePicker.Field :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DatePicker.TimeField :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DateRangePicker.StartField :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <DateRangePicker.EndField :aria-labelledby="null" />
  <!-- @vue-expect-error `aria-labelledby` takes no `null` -->
  <TimePicker.Field :aria-labelledby="null" />
</template>
