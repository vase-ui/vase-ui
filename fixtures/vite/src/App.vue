<script setup lang="ts">
import { reactive, ref } from 'vue';
import { Checkbox } from '@vase-ui/vue/checkbox';
import { CheckboxGroup } from '@vase-ui/vue/checkbox-group';
import { Field } from '@vase-ui/vue/field';
import { Radio } from '@vase-ui/vue/radio';
import { RadioGroup } from '@vase-ui/vue/radio-group';
import { Slider } from '@vase-ui/vue/slider';

const SIZES = ['s', 'm', 'l'];

const letters = ref<string[]>([]);
const size = ref('s');
const range = ref([20, 80]);
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
      v-model:value="letters"
      @value-change="(value, details) => record('letters', value, details)"
    >
      <label data-testid="letter-a-label"><Checkbox.Root name="letters" value="a" />A</label>
      <label data-testid="letter-b-label"><Checkbox.Root name="letters" value="b" />B</label>
    </CheckboxGroup>
    <RadioGroup
      v-model:value="size"
      name="size"
      @value-change="(value, details) => record('size', value, details)"
    >
      <label v-for="item in SIZES" :key="item" :data-testid="`size-${item}-label`">
        <Radio.Root :value="item" />{{ item }}
      </label>
    </RadioGroup>
    <Field.Root data-testid="note-field">
      <Field.Label>Note</Field.Label>
      <Field.Control
        name="note"
        data-testid="note"
        @value-change="(value, details) => record('note', value, details)"
      />
    </Field.Root>
    <Slider.Root
      v-model:value="range"
      name="range"
      @value-change="(value, details) => record('range', value, details)"
    >
      <Slider.Control style="position: relative; width: 200px; height: 10px">
        <Slider.Thumb aria-label="Minimum" style="width: 20px; height: 10px" />
        <Slider.Thumb aria-label="Maximum" style="width: 20px; height: 10px" />
      </Slider.Control>
    </Slider.Root>
  </form>
  <output data-testid="models">{{ JSON.stringify({ letters, size, range }) }}</output>
  <output data-testid="changes">{{ JSON.stringify(changes) }}</output>
  <a href="./away.html" data-testid="away">Away</a>
</template>
