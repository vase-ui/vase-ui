<script setup lang="ts">
import { shallowRef } from 'vue';
import { Slider } from '@vase-ui/vue/slider';
import type { SliderRootChangeEventDetails } from '@vase-ui/vue/slider';

const props = withDefaults(
  defineProps<{
    defaultValue: number | number[];
    // `defaultValue` is then the first value of `v-model:value`.
    controlled?: boolean | undefined;
    min?: number | undefined;
    max?: number | undefined;
    step?: number | undefined;
    minStepsBetweenValues?: number | undefined;
    locale?: string | undefined;
    format?: Intl.NumberFormatOptions | undefined;
    alignment?: 'center' | 'edge' | 'edge-client-only' | undefined;
    orientation?: 'horizontal' | 'vertical' | undefined;
    name?: string | undefined;
    explicitIndex?: boolean | undefined;
  }>(),
  { min: 0, max: 100, step: 1, format: undefined, alignment: 'center', orientation: 'horizontal' },
);

const model = shallowRef(props.defaultValue);
const changes = shallowRef<string[]>([]);

function rootProps() {
  return props.controlled
    ? {
        value: model.value,
        'onUpdate:value': (value: number | number[]) => {
          model.value = value;
        },
      }
    : { defaultValue: props.defaultValue };
}

function handleValueChange(
  value: number | readonly number[],
  details: SliderRootChangeEventDetails,
) {
  changes.value = [...changes.value, `${String(value)} (${details.reason})`];
}
</script>

<template>
  <Slider.Root
    v-bind="rootProps()"
    :min="min"
    :max="max"
    :step="step"
    :min-steps-between-values="minStepsBetweenValues"
    :locale="locale"
    :format="format"
    :thumb-alignment="alignment"
    :orientation="orientation"
    :name="name"
    style="width: 200px"
    @value-change="handleValueChange"
  >
    <Slider.Control style="position: relative; width: 100%; height: 10px">
      <template v-if="Array.isArray(defaultValue)">
        <Slider.Thumb
          v-for="(_, index) in defaultValue"
          :key="index"
          :index="explicitIndex ? index : undefined"
          data-testid="thumb"
          style="width: 40px; height: 10px"
        />
      </template>
      <Slider.Thumb v-else data-testid="thumb" style="width: 40px; height: 10px" />
    </Slider.Control>
  </Slider.Root>
  <output data-testid="model">{{ String(model) }}</output>
  <output data-testid="changes">{{ changes.join('; ') }}</output>
</template>
