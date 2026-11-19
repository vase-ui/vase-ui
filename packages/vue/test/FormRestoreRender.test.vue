<script lang="ts">
// A part of each family whose input Chromium restores and that takes the value of that input at
// the `pageshow` event. A new `revision` renders the part again with the same value, as a render
// before that event does.
export type FormRestoreFamily =
  | 'toolbar'
  | 'toolbar-default'
  | 'select'
  | 'combobox'
  | 'number-field'
  | 'slider'
  | 'range'
  | 'date-field'
  | 'time-field';
</script>

<script setup lang="ts">
import { computed, shallowRef } from 'vue';
import { Combobox } from '@vase-ui/vue/combobox';
import { DateField } from '@vase-ui/vue/date-field';
import { NumberField } from '@vase-ui/vue/number-field';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { TimeField } from '@vase-ui/vue/time-field';
import { Toolbar } from '@vase-ui/vue/toolbar';

const props = defineProps<{
  family: FormRestoreFamily;
  revision: number;
  locale?: string | undefined;
}>();

const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const FRUITS = ['Apple', 'Banana', 'Cherry'];

const text = shallowRef('server');
const font = shallowRef<string | null>('serif');
const fruit = shallowRef<string | null>(null);
const quantity = shallowRef<number | null>(1);
const volume = shallowRef(50);
const range = shallowRef([20, 80]);
const when = shallowRef<Temporal.PlainDate | null>(null);
const alarm = shallowRef<Temporal.PlainTime | null>(null);

const MODELS = {
  toolbar: text,
  'toolbar-default': text,
  select: font,
  combobox: fruit,
  'number-field': quantity,
  slider: volume,
  range,
  'date-field': when,
  'time-field': alarm,
};

const model = computed(() => String(MODELS[props.family].value));
const changes = shallowRef<string[]>([]);

function record(value: unknown, details: { reason: string }) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}

function handleToolbarInput(event: Event) {
  text.value = (event.currentTarget as HTMLInputElement).value;
  changes.value = [...changes.value, `${text.value} (input)`];
}
</script>

<template>
  <form @submit.prevent>
    <Toolbar.Root v-if="family === 'toolbar'">
      <Toolbar.Input
        :value="text"
        name="filter"
        :data-revision="revision"
        @input="handleToolbarInput"
      />
    </Toolbar.Root>
    <Toolbar.Root v-else-if="family === 'toolbar-default'">
      <Toolbar.Input
        default-value="server"
        name="filter"
        :data-revision="revision"
        @input="handleToolbarInput"
      />
    </Toolbar.Root>
    <Select.Root
      v-else-if="family === 'select'"
      v-model="font"
      name="font"
      :items="{ ...FONTS }"
      @value-change="record"
    >
      <Select.Trigger :data-revision="revision"><Select.Value /></Select.Trigger>
      <Select.Portal>
        <Select.Positioner>
          <Select.Popup>
            <Select.Item v-for="(label, key) in FONTS" :key="key" :value="key">
              <Select.ItemText>{{ label }}</Select.ItemText>
            </Select.Item>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
    <Combobox.Root
      v-else-if="family === 'combobox'"
      v-model="fruit"
      name="fruit"
      :items="[...FRUITS]"
      @value-change="record"
    >
      <Combobox.Input aria-label="Fruit" :data-revision="revision" />
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
      v-else-if="family === 'number-field'"
      v-model="quantity"
      name="quantity"
      locale="en-US"
      :data-revision="revision"
      @value-change="record"
    >
      <NumberField.Input aria-label="Quantity" />
    </NumberField.Root>
    <Slider.Root
      v-else-if="family === 'slider'"
      v-model="volume"
      name="volume"
      aria-label="Volume"
      :locale="locale"
      @value-change="record"
    >
      <Slider.Control style="position: relative; width: 200px; height: 10px">
        <Slider.Thumb :data-revision="revision" style="width: 20px; height: 10px" />
      </Slider.Control>
    </Slider.Root>
    <Slider.Root v-else-if="family === 'range'" v-model="range" name="range" @value-change="record">
      <Slider.Control style="position: relative; width: 200px; height: 10px">
        <Slider.Thumb
          aria-label="Minimum"
          :data-revision="revision"
          style="width: 20px; height: 10px"
        />
        <Slider.Thumb
          aria-label="Maximum"
          :data-revision="revision"
          style="width: 20px; height: 10px"
        />
      </Slider.Control>
    </Slider.Root>
    <DateField.Root
      v-else-if="family === 'date-field'"
      v-model="when"
      name="when"
      locale="en-US"
      :data-revision="revision"
      @value-change="record"
    >
      <DateField.Input />
    </DateField.Root>
    <TimeField.Root
      v-else-if="family === 'time-field'"
      v-model="alarm"
      name="alarm"
      locale="en-US"
      :hour-cycle="24"
      :data-revision="revision"
      @value-change="record"
    >
      <TimeField.Input />
    </TimeField.Root>
  </form>
  <output data-testid="model">{{ model }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
