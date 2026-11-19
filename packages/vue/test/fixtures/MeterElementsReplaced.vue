<script setup lang="ts">
import { useTemplateRef } from 'vue';
import { Meter } from '../../src/meter';

const rootPart = useTemplateRef('rootPart');
const labelPart = useTemplateRef('labelPart');
const valuePart = useTemplateRef('valuePart');
const trackPart = useTemplateRef('trackPart');
const indicatorPart = useTemplateRef('indicatorPart');
defineExpose({
  root: rootPart,
  label: labelPart,
  value: valuePart,
  track: trackPart,
  indicator: indicatorPart,
});
</script>

<template>
  <Meter.Root ref="rootPart" :value="150" :format="{ style: 'decimal' }">
    <template #element="{ props, elementRef }">
      <section v-bind="props" :ref="elementRef">
        <Meter.Label ref="labelPart">
          <template #element="{ props: labelProps, elementRef: labelRef }">
            <strong v-bind="labelProps" :ref="labelRef">Battery</strong>
          </template>
        </Meter.Label>
        <Meter.Value ref="valuePart">
          <template #element="{ props: valueProps, elementRef: valueRef, formattedValue, value }">
            <output v-bind="valueProps" :ref="valueRef">{{ formattedValue }} of {{ value }}</output>
          </template>
        </Meter.Value>
        <Meter.Track ref="trackPart">
          <template #element="{ props: trackProps, elementRef: trackRef }">
            <p v-bind="trackProps" :ref="trackRef">
              <Meter.Indicator ref="indicatorPart">
                <template #element="{ props: indicatorProps, elementRef: indicatorRef }">
                  <i v-bind="indicatorProps" :ref="indicatorRef" />
                </template>
              </Meter.Indicator>
            </p>
          </template>
        </Meter.Track>
      </section>
    </template>
  </Meter.Root>
</template>
