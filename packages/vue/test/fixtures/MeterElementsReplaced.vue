<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Meter } from '../../src/meter';

type Attributes = Record<string, unknown>;

// The attributes of each part. Each element of the developer is in a frame, which gets none.
defineProps({
  parts: {
    type: Object as PropType<{
      root?: Attributes;
      label?: Attributes;
      value?: Attributes;
      track?: Attributes;
      indicator?: Attributes;
    }>,
    default: () => ({}),
  },
});
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
  <Meter.Root ref="rootPart" :value="150" :format="{ style: 'decimal' }" v-bind="parts.root">
    <template #element="{ props, elementRef }">
      <div class="frame">
        <section v-bind="props" :ref="elementRef">
          <Meter.Label ref="labelPart" v-bind="parts.label">
            <template #element="{ props: labelProps, elementRef: labelRef }">
              <span class="frame"
                ><strong v-bind="labelProps" :ref="labelRef">Battery</strong></span
              >
            </template>
          </Meter.Label>
          <Meter.Value ref="valuePart" v-bind="parts.value">
            <template #element="{ props: valueProps, elementRef: valueRef, formattedValue, value }">
              <span class="frame">
                <output v-bind="valueProps" :ref="valueRef"
                  >{{ formattedValue }} of {{ value }}</output
                >
              </span>
            </template>
          </Meter.Value>
          <Meter.Track ref="trackPart" v-bind="parts.track">
            <template #element="{ props: trackProps, elementRef: trackRef }">
              <div class="frame">
                <p v-bind="trackProps" :ref="trackRef">
                  <Meter.Indicator ref="indicatorPart" v-bind="parts.indicator">
                    <template #element="{ props: indicatorProps, elementRef: indicatorRef }">
                      <span class="frame"><i v-bind="indicatorProps" :ref="indicatorRef" /></span>
                    </template>
                  </Meter.Indicator>
                </p>
              </div>
            </template>
          </Meter.Track>
        </section>
      </div>
    </template>
  </Meter.Root>
</template>
