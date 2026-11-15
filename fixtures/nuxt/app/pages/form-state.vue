<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Combobox } from '@vase-ui/vue/combobox';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { NumberField } from '@vase-ui/vue/number-field';
import { OTPField } from '@vase-ui/vue/otp-field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Select } from '@vase-ui/vue/select';
import { Slider } from '@vase-ui/vue/slider';
import { Switch } from '@vase-ui/vue/switch';
import { Toolbar } from '@vase-ui/vue/toolbar';

// Each part changes before the hydration, or before a move back in the history. The test reads
// the form data, the model of each part and the count of its change events.
const FONTS = { sans: 'Sans-serif', serif: 'Serif', mono: 'Monospace' };
const FRUITS = ['Apple', 'Banana', 'Cherry'];
const SIZES = ['s', 'm', 'l'];
const CONTROL_STYLE = 'position: relative; width: 200px; height: 10px';
const THUMB_STYLE = 'width: 20px; height: 10px';

const text = ref('');
const filter = ref('');
const agree = ref(false);
const letters = ref<string[]>([]);
const notify = ref(false);
const size = ref('s');
const font = ref<string | null>('serif');
const fruit = ref<string | null>(null);
const quantity = ref<number | null>(1);
const code = ref('');
const volume = ref(50);
const range = ref([20, 80]);
const changes = reactive<Record<string, number>>({});
const submits = ref(0);
const completes = ref(0);

function count(name: string) {
  changes[name] = (changes[name] ?? 0) + 1;
}

function handleFilterInput(event: Event) {
  filter.value = (event.currentTarget as HTMLInputElement).value;
  count('filter');
}
</script>

<template>
  <main>
    <form data-testid="form" @submit.prevent="submits += 1">
      <Field.Root>
        <Field.Label>Note</Field.Label>
        <Field.Control name="note" data-testid="note" @value-change="count('note')" />
      </Field.Root>
      <Input
        v-model:value="text"
        name="text"
        aria-label="Text"
        data-testid="text"
        @value-change="count('text')"
      />
      <Toolbar.Root>
        <Toolbar.Input
          :value="filter"
          name="filter"
          aria-label="Filter"
          data-testid="filter"
          @input="handleFilterInput"
        />
      </Toolbar.Root>

      <label data-testid="agree-label">
        <Checkbox.Root
          v-model:checked="agree"
          name="agree"
          data-testid="agree"
          @checked-change="count('agree')"
        />
        Agree
      </label>
      <Field.Root data-testid="news-field">
        <label data-testid="news-label">
          <Checkbox.Root name="news" data-testid="news" @checked-change="count('news')" />
          News
        </label>
      </Field.Root>
      <CheckboxGroup v-model:value="letters" @value-change="count('letters')">
        <label data-testid="letter-a-label">
          <Checkbox.Root name="letters" value="a" data-testid="letter-a" />A
        </label>
        <label data-testid="letter-b-label">
          <Checkbox.Root name="letters" value="b" data-testid="letter-b" />B
        </label>
      </CheckboxGroup>
      <label data-testid="notify-label">
        <Switch.Root
          v-model:checked="notify"
          name="notify"
          data-testid="notify"
          @checked-change="count('notify')"
        />
        Notify
      </label>
      <RadioGroup v-model:value="size" name="size" @value-change="count('size')">
        <label v-for="item in SIZES" :key="item" :data-testid="`size-${item}-label`">
          <Radio.Root :value="item" :data-testid="`size-${item}`" />{{ item }}
        </label>
      </RadioGroup>

      <Select.Root v-model:value="font" name="font" :items="FONTS" @value-change="count('font')">
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
      <Combobox.Root v-model:value="fruit" name="fruit" :items="FRUITS" @value-change="count('fruit')">
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
        v-model:value="quantity"
        name="quantity"
        locale="en-US"
        @value-change="count('quantity')"
      >
        <NumberField.Input aria-label="Quantity" data-testid="quantity-input" />
      </NumberField.Root>
      <Field.Root>
        <Field.Label>Code</Field.Label>
        <OTPField.Root
          v-model:value="code"
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
        v-model:value="volume"
        name="volume"
        aria-label="Volume"
        @value-change="count('volume')"
      >
        <Slider.Control :style="CONTROL_STYLE">
          <Slider.Thumb :style="THUMB_STYLE" data-testid="volume-thumb" />
        </Slider.Control>
      </Slider.Root>
      <Slider.Root v-model:value="range" name="range" @value-change="count('range')">
        <Slider.Control :style="CONTROL_STYLE">
          <Slider.Thumb aria-label="Minimum" :style="THUMB_STYLE" data-testid="range-min" />
          <Slider.Thumb aria-label="Maximum" :style="THUMB_STYLE" data-testid="range-max" />
        </Slider.Control>
      </Slider.Root>
    </form>

    <output data-testid="models">{{
      JSON.stringify({
        text,
        filter,
        agree,
        letters,
        notify,
        size,
        font,
        fruit,
        quantity,
        code,
        volume,
        range,
      })
    }}</output>
    <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
    <output data-testid="submits">{{ submits }}</output>
    <output data-testid="completes">{{ completes }}</output>

    <a href="/" data-testid="away">Away</a>
  </main>
</template>
