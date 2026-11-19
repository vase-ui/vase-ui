<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Meter } from '../../src/meter';

type Attributes = Record<string, unknown>;

// The attributes of each part. A `label` of `null` renders no label.
defineProps({
  parts: {
    type: Object as PropType<{
      root?: Attributes;
      label?: Attributes | null;
      value?: Attributes;
      track?: Attributes;
      indicator?: Attributes;
    }>,
    required: true,
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
  <Meter.Root ref="rootPart" :value="30" v-bind="parts.root">
    <Meter.Label v-if="parts.label !== null" ref="labelPart" v-bind="parts.label"
      >Battery</Meter.Label
    >
    <Meter.Value ref="valuePart" v-bind="parts.value" />
    <Meter.Track ref="trackPart" v-bind="parts.track">
      <Meter.Indicator ref="indicatorPart" v-bind="parts.indicator" />
    </Meter.Track>
  </Meter.Root>
</template>
