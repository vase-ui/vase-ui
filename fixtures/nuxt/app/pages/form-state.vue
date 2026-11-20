<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { TimeField } from '@vase-ui/vue/time-field';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const FRUITS = ['Apple', 'Banana', 'Cherry'];
const CONTROL_STYLE = 'position: relative; width: 200px; height: 10px';
const THUMB_STYLE = 'width: 20px; height: 10px';

const font = ref<string | null>('serif');
const fruit = ref<string | null>(null);
const quantity = ref<number | null>(1);
const code = ref('');
const volume = ref(50);
const range = ref([20, 80]);
const when = shallowRef<Temporal.PlainDate | null>(null);
const alarm = shallowRef<Temporal.PlainTime | null>(null);
const changes = reactive<Record<string, number>>({});
const submits = ref(0);
const completes = ref(0);

function count(name: string) {
  changes[name] = (changes[name] ?? 0) + 1;
}
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent="submits += 1">
      <Select.Root v-model="font" name="font" :items="FONTS" @value-change="count('font')">
        <Select.Trigger data-testid="font-trigger"><Select.Value /></Select.Trigger>
        <Select.Portal>
          <Select.Positioner>
            <Select.Popup>
              <Select.Item v-for="(label, value) in FONTS" :key="value" :value="value">
                <Select.ItemText>{{ label }}</Select.ItemText>
              </Select.Item>
            </Select.Popup>
          </Select.Positioner>
        </Select.Portal>
      </Select.Root>
      <Combobox.Root v-model="fruit" name="fruit" :items="FRUITS" @value-change="count('fruit')">
        <Combobox.Input aria-label="Fruit" data-testid="fruit-input" />
        <Combobox.Portal>
          <Combobox.Positioner>
            <Combobox.Popup>
              <Combobox.List>
                <template #item="{ item }">
                  <Combobox.Item :value="item">{{ item }}</Combobox.Item>
                </template>
              </Combobox.List>
            </Combobox.Popup>
          </Combobox.Positioner>
        </Combobox.Portal>
      </Combobox.Root>
      <NumberField.Root
        v-model="quantity"
        name="quantity"
        locale="en-US"
        @value-change="count('quantity')"
      >
        <NumberField.Input aria-label="Quantity" data-testid="quantity-input" />
      </NumberField.Root>
      <Field.Root>
        <Field.Label>Code</Field.Label>
        <OTPField.Root
          v-model="code"
          name="code"
          :length="4"
          auto-submit
          @value-change="count('code')"
          @value-complete="completes += 1"
        >
          <OTPField.Input v-for="index in 4" :key="index" :data-testid="`code-${index}`" />
        </OTPField.Root>
      </Field.Root>
      <Slider.Root
        v-model="volume"
        name="volume"
        aria-label="Volume"
        @value-change="count('volume')"
      >
        <Slider.Control :style="CONTROL_STYLE">
          <Slider.Thumb :style="THUMB_STYLE" data-testid="volume-thumb" />
        </Slider.Control>
      </Slider.Root>
      <Slider.Root v-model="range" name="range" @value-change="count('range')">
        <Slider.Control :style="CONTROL_STYLE">
          <Slider.Thumb aria-label="Minimum" :style="THUMB_STYLE" data-testid="range-min" />
          <Slider.Thumb aria-label="Maximum" :style="THUMB_STYLE" data-testid="range-max" />
        </Slider.Control>
      </Slider.Root>
      <DateField.Root v-model="when" name="when" locale="en-US" @value-change="count('when')">
        <DateField.Input data-testid="when" />
      </DateField.Root>
      <TimeField.Root
        v-model="alarm"
        name="alarm"
        locale="en-US"
        :hour-cycle="24"
        @value-change="count('alarm')"
      >
        <TimeField.Input data-testid="alarm" />
      </TimeField.Root>
    </form>

    <output data-testid="models">{{
      JSON.stringify({
        font,
        fruit,
        quantity,
        code,
        volume,
        range,
        when: when?.toString() ?? null,
        alarm: alarm?.toString({ smallestUnit: 'minute' }) ?? null,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
    <output data-testid="submits">{{ submits }}</output>
    <output data-testid="completes">{{ completes }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
