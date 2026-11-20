<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../combobox/index.parts';
import * as DatePicker from '../date-picker/index.parts';
import * as DateRangePicker from '../date-range-picker/index.parts';
import * as Drawer from '../drawer/index.parts';
import * as Menu from '../menu/index.parts';
import * as TimePicker from '../time-picker/index.parts';
</script>

<template>
  <Menu.GroupLabel :aria-hidden="null" />
  <Drawer.Popup :aria-describedby="null" />
  <Drawer.Popup :aria-describedby="undefined" />
  <!-- @vue-expect-error `aria-hidden` is a Boolean -->
  <Menu.GroupLabel :aria-hidden="5" />

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
