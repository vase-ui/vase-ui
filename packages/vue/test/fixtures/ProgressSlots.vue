<script setup lang="ts">
import type { PropType } from 'vue';
import { Progress } from '../../src/progress';

// The `element` slot of each part, and the default slot of `Progress.Value`.
defineProps({ scene: { type: Object as PropType<{ value: number | null }>, required: true } });
</script>

<template>
  <Progress.Root :value="scene.value">
    <template #element="{ props, elementRef, state }">
      <section v-bind="props" :ref="elementRef" :data-state="state.status">
        <Progress.Label>
          <template #element="{ props: labelProps, elementRef: labelRef, state: labelState }">
            <strong v-bind="labelProps" :ref="labelRef" :data-state="labelState.status">
              Upload
            </strong>
          </template>
        </Progress.Label>
        <Progress.Value>
          <template
            #element="{ props: valueProps, elementRef: valueRef, formattedValue, value: raw }"
          >
            <output v-bind="valueProps" :ref="valueRef">{{ formattedValue }} {{ raw }}</output>
          </template>
        </Progress.Value>
        <Progress.Value v-slot="{ formattedValue, value: raw, state: valueState }" class="scope">
          {{ JSON.stringify({ formattedValue, value: raw, status: valueState.status }) }}
        </Progress.Value>
        <Progress.Track>
          <template #element="{ props: trackProps, elementRef: trackRef }">
            <p v-bind="trackProps" :ref="trackRef">
              <Progress.Indicator>
                <template #element="{ props: indicatorProps, elementRef: indicatorRef }">
                  <i v-bind="indicatorProps" :ref="indicatorRef" />
                </template>
              </Progress.Indicator>
            </p>
          </template>
        </Progress.Track>
      </section>
    </template>
  </Progress.Root>
</template>
