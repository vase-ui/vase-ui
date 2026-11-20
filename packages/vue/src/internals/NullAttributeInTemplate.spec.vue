<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Combobox from '../combobox/index.parts';
import * as DateField from '../date-field/index.parts';
import * as DatePicker from '../date-picker/index.parts';
import * as DateRangePicker from '../date-range-picker/index.parts';
import * as Dialog from '../dialog/index.parts';
import * as Menu from '../menu/index.parts';
import * as TimeClock from '../time-clock/index.parts';
import * as TimeField from '../time-field/index.parts';
import * as TimePicker from '../time-picker/index.parts';
import type { EditableDateTimeFieldSegment } from './date-time/field/useDateTimeFieldSegment';

declare const segment: EditableDateTimeFieldSegment;
</script>

<template>
  <Menu.GroupLabel :aria-hidden="null" />
  <Dialog.Popup :aria-describedby="null" />
  <Dialog.Popup :aria-describedby="undefined" />
  <!-- @vue-expect-error `aria-hidden` is a Boolean -->
  <Menu.GroupLabel :aria-hidden="5" />

  <Combobox.Input :autocomplete="null" />
  <DateField.Segment :segment="segment" :autocomplete="null" />
  <Menu.Input :autocomplete="null" />
  <TimeField.Segment :segment="segment" :autocomplete="null" />

  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DateField.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DatePicker.Field :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DatePicker.TimeField :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DateRangePicker.StartField :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DateRangePicker.EndField :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <TimeClock.Face :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <TimeClock.Face :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaDescribedby` takes no `null` -->
  <TimeClock.Face :aria-describedby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <TimeField.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <TimePicker.Field :aria-labelledby="null" />
</template>
