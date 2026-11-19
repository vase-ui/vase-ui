<script setup lang="ts">
import { reactive, ref, shallowRef } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { DateField } from '@vase-ui/vue/date-field';
import { Field } from '@vase-ui/vue/field';
import { Input } from '@vase-ui/vue/input';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Slider } from '@vase-ui/vue/slider';

const SIZES = ['s', 'm', 'l'];

const letters = ref<string[]>([]);
// The thumbs and the date field follow the size. The take of the radio group thus renders them
// before their own `pageshow` listeners run.
const size = ref('s');
const range = ref([20, 80]);
const when = shallowRef<Temporal.PlainDate | null>(null);
// For each part, the value and the type of the event of each change.
const changes = reactive<Record<string, string[]>>({});

function record(name: string, value: unknown, details: { event: Event }) {
  (changes[name] ??= []).push(`${String(value)} (${details.event.type})`);
}
</script>

<template>
  <form data-testid="form" @submit.prevent>
    <Field.Root data-testid="news-field">
      <label data-testid="news-label">
        <Checkbox.Root
          name="news"
          @checked-change="(checked, details) => record('news', checked, details)"
        />
        News
      </label>
    </Field.Root>
    <CheckboxGroup
      v-model="letters"
      @value-change="(value, details) => record('letters', value, details)"
    >
      <label data-testid="letter-a-label"><Checkbox.Root name="letters" value="a" />A</label>
      <label data-testid="letter-b-label"><Checkbox.Root name="letters" value="b" />B</label>
    </CheckboxGroup>
    <RadioGroup
      v-model="size"
      name="size"
      @value-change="(value, details) => record('size', value, details)"
    >
      <label v-for="item in SIZES" :key="item" :data-testid="`size-${item}-label`">
        <Radio.Root :value="item" />{{ item }}
      </label>
    </RadioGroup>
    <Field.Root data-testid="note-field">
      <Field.Label>Note</Field.Label>
      <Input
        name="note"
        data-testid="note"
        @value-change="(value, details) => record('note', value, details)"
      />
    </Field.Root>
    <Slider.Root
      v-model="range"
      name="range"
      @value-change="(value, details) => record('range', value, details)"
    >
      <Slider.Control style="position: relative; width: 200px; height: 10px">
        <Slider.Thumb
          aria-label="Minimum"
          :class="`size-${size}`"
          style="width: 20px; height: 10px"
        />
        <Slider.Thumb
          aria-label="Maximum"
          :class="`size-${size}`"
          style="width: 20px; height: 10px"
        />
      </Slider.Control>
    </Slider.Root>
    <DateField.Root
      v-model="when"
      name="when"
      locale="en-US"
      :class="`size-${size}`"
      @value-change="(value, details) => record('when', value, details)"
    >
      <DateField.Input data-testid="when" />
    </DateField.Root>
  </form>
  <output data-testid="models">{{
    JSON.stringify({ letters, size, range, when: when?.toString() ?? null })
  }}</output>
  <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
  <a href="./away.html" data-testid="away">Away</a>
</template>
