<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Slider } from '../../src/slider';
import StyledDiv from './StyledDiv.vue';
import TestField from './TestField.vue';

// Each part renders the element of the developer in its `element` slot. The input of the second
// thumb goes to `target` with `<Teleport>`.
defineProps({
  root: Object as PropType<Record<string, unknown>>,
  field: Object as PropType<Record<string, unknown>>,
  target: { type: Object as PropType<Element>, required: true },
});
const parts = {
  root: useTemplateRef('root'),
  label: useTemplateRef('label'),
  value: useTemplateRef('value'),
  control: useTemplateRef('control'),
  track: useTemplateRef('track'),
  indicator: useTemplateRef('indicator'),
  thumb: useTemplateRef('thumb'),
};
defineExpose(parts);
</script>

<template>
  <form>
    <TestField :field="field">
      <Slider.Root ref="root" :default-value="[20, 60]" name="volume" v-bind="root">
        <template #element="{ props, elementRef, state }">
          <section v-bind="props" :ref="elementRef" :data-values="state.values.join()">
            <Slider.Label ref="label">
              <template #element="{ props: labelProps, elementRef: labelRef }">
                <label v-bind="labelProps" :ref="labelRef" class="Label">Volume</label>
              </template>
            </Slider.Label>
            <Slider.Value ref="value">
              <template #element="{ props: valueProps, elementRef: valueRef, formattedValues }">
                <output v-bind="valueProps" :ref="valueRef">{{
                  formattedValues.join(' to ')
                }}</output>
              </template>
            </Slider.Value>
            <Slider.Control ref="control">
              <template #element="{ props: controlProps, elementRef: controlRef }">
                <span v-bind="controlProps" :ref="controlRef" class="Control">
                  <Slider.Track ref="track">
                    <template #element="{ props: trackProps, elementRef: trackRef }">
                      <span v-bind="trackProps" :ref="trackRef" class="Track">
                        <Slider.Indicator ref="indicator">
                          <template #element="{ props: indicatorProps, elementRef: indicatorRef }">
                            <StyledDiv v-bind="indicatorProps" :ref="indicatorRef" />
                          </template>
                        </Slider.Indicator>
                        <Slider.Thumb ref="thumb" aria-label="Start">
                          <template
                            #element="{
                              props: thumbProps,
                              elementRef: thumbRef,
                              inputProps,
                              inputRef,
                            }"
                          >
                            <span v-bind="thumbProps" :ref="thumbRef" class="Thumb">
                              <input
                                v-bind="inputProps"
                                :ref="inputRef"
                                id="start-input"
                                class="Input"
                              />
                            </span>
                          </template>
                        </Slider.Thumb>
                        <Slider.Thumb aria-label="End">
                          <template
                            #element="{
                              props: thumbProps,
                              elementRef: thumbRef,
                              inputProps,
                              inputRef,
                            }"
                          >
                            <span v-bind="thumbProps" :ref="thumbRef" class="Thumb">
                              <Teleport :to="target">
                                <input v-bind="inputProps" :ref="inputRef" class="Input" />
                              </Teleport>
                            </span>
                          </template>
                        </Slider.Thumb>
                      </span>
                    </template>
                  </Slider.Track>
                </span>
              </template>
            </Slider.Control>
          </section>
        </template>
      </Slider.Root>
    </TestField>
  </form>
</template>
