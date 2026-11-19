<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Progress } from '../../src/progress';

type Attributes = Record<string, unknown>;

// The five parts. `scene` hides the label and shows a second label.
defineProps({
  root: Object as PropType<Attributes>,
  label: Object as PropType<Attributes>,
  indicator: Object as PropType<Attributes>,
  scene: Object as PropType<{ label?: boolean; second?: boolean }>,
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
  <Progress.Root ref="rootPart" v-bind="root">
    <Progress.Label v-if="scene?.label !== false" ref="labelPart" class="label" v-bind="label">
      Upload
    </Progress.Label>
    <Progress.Label v-if="scene?.second" id="second" class="second">Transfer</Progress.Label>
    <Progress.Value ref="valuePart" class="value" />
    <Progress.Track ref="trackPart" class="track">
      <Progress.Indicator ref="indicatorPart" class="indicator" v-bind="indicator" />
    </Progress.Track>
  </Progress.Root>
</template>
