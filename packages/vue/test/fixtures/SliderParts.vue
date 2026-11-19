<script setup lang="ts">
import { computed, useTemplateRef, type PropType } from 'vue';
import { Fieldset } from '../../src/fieldset';
import { Slider } from '../../src/slider';
import TestField from './TestField.vue';

type Attrs = Record<string, unknown>;

// A slider in a form, with a control of 100 px and thumbs of 10 px. `thumbs` gives the attributes
// of each thumb. `label` and `value` put a `Slider.Label` and a `Slider.Value` before or after the
// control. `fieldset` puts the slider in a native `<fieldset>` or in a `Fieldset.Root`.
const props = defineProps({
  root: Object as PropType<Attrs>,
  thumbs: { type: Array as PropType<Attrs[]>, default: () => [{}] },
  label: String as PropType<'before' | 'after'>,
  labelAttrs: Object as PropType<Attrs>,
  value: String as PropType<'before' | 'after'>,
  control: Object as PropType<Attrs>,
  field: Object as PropType<Attrs>,
  fieldset: Object as PropType<{ native: boolean; disabled: boolean }>,
});
const vertical = computed(() => props.root?.orientation === 'vertical');
const rootPart = useTemplateRef('rootPart');
const controlPart = useTemplateRef('controlPart');
const thumbParts = useTemplateRef('thumbParts');
defineExpose({ root: rootPart, control: controlPart, thumbs: thumbParts });
</script>

<template>
  <form id="form">
    <input id="before" aria-label="Before" />
    <component
      :is="fieldset ? (fieldset.native ? 'fieldset' : Fieldset.Root) : 'div'"
      :disabled="fieldset?.disabled"
    >
      <component :is="fieldset ? (fieldset.native ? 'legend' : Fieldset.Legend) : 'div'" id="legend">
        Sound
      </component>
      <TestField :field="field">
        <Slider.Root ref="rootPart" v-bind="root">
          <Slider.Label v-if="label === 'before'" v-bind="labelAttrs">Volume</Slider.Label>
          <Slider.Value v-if="value === 'before'" />
          <Slider.Control
            ref="controlPart"
            :style="vertical ? 'width: 10px; height: 100px' : 'width: 100px; height: 10px'"
            v-bind="control"
          >
            <Slider.Track style="width: 100%; height: 100%">
              <Slider.Indicator style="background: gray" />
              <Slider.Thumb
                v-for="(thumb, index) in thumbs"
                :key="String(thumb.key ?? index)"
                ref="thumbParts"
                style="width: 10px; height: 10px; background: black"
                v-bind="thumb"
              />
            </Slider.Track>
          </Slider.Control>
          <Slider.Value v-if="value === 'after'" />
          <Slider.Label v-if="label === 'after'" v-bind="labelAttrs">Volume</Slider.Label>
        </Slider.Root>
      </TestField>
    </component>
    <input id="after" aria-label="After" />
    <button type="submit">Submit</button>
    <button type="reset">Reset</button>
  </form>
</template>
