<!-- @strictTemplates true -->
<script setup lang="ts">
import * as Checkbox from '../checkbox/index.parts';
import * as DateField from '../date-field/index.parts';
import * as Dialog from '../dialog/index.parts';
import * as Field from '../field/index.parts';
import { Input } from '../input';
import * as Menu from '../menu/index.parts';
import * as OTPField from '../otp-field/index.parts';
import * as Radio from '../radio/index.parts';
import * as Slider from '../slider/index.parts';
import * as Switch from '../switch/index.parts';
import * as TimeClock from '../time-clock/index.parts';
import * as TimeField from '../time-field/index.parts';
</script>

<template>
  <Menu.GroupLabel :aria-hidden="null" />
  <Dialog.Popup :aria-describedby="null" />
  <Dialog.Popup :aria-describedby="undefined" />
  <!-- @vue-expect-error `aria-hidden` is a Boolean -->
  <Menu.GroupLabel :aria-hidden="5" />

  <!-- @vue-expect-error the prop `id` takes no `null` -->
  <Field.Control :id="null" />
  <!-- @vue-expect-error `Input` gives `id` to the prop of `Field.Control` -->
  <Input :id="null" />
  <!-- @vue-expect-error `Input` gives `name` to the prop of `Field.Control` -->
  <Input :name="null" />

  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <Checkbox.Root :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Checkbox.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Checkbox.Root :ariaLabelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <DateField.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <OTPField.Root :length="6" :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <Radio.Root value="a" :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Radio.Root value="a" :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Slider.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <Slider.Thumb :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Slider.Thumb :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaDescribedby` takes no `null` -->
  <Slider.Thumb :aria-describedby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <Switch.Root :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <Switch.Root :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaLabel` takes no `null` -->
  <TimeClock.Face :aria-label="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <TimeClock.Face :aria-labelledby="null" />
  <!-- @vue-expect-error the prop `ariaDescribedby` takes no `null` -->
  <TimeClock.Face :aria-describedby="null" />
  <!-- @vue-expect-error the prop `ariaLabelledby` takes no `null` -->
  <TimeField.Root :aria-labelledby="null" />
</template>
