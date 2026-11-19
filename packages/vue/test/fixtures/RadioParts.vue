<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Radio } from '../../src/radio';
import { RadioGroup } from '../../src/radio-group';
import StyledInput from './StyledInput.vue';

defineProps({
  group: Object as PropType<Record<string, unknown>>,
  scene: { type: Object as PropType<{ shown: boolean }>, default: () => ({ shown: true }) },
});
const ssd = useTemplateRef('ssd');
const styled = useTemplateRef('styled');
defineExpose({ ssd, styled });
</script>

<template>
  <Transition>
    <RadioGroup v-if="scene.shown" v-bind="group" aria-label="Storage">
      <label>
        <Radio ref="ssd" value="ssd">
          <template #element="{ props, elementRef, state }">
            <span class="Mark" :data-mark="state.checked ? 'on' : 'off'">
              <input v-bind="props" :ref="elementRef" />
            </span>
          </template>
        </Radio>
        SSD
      </label>
      <label>
        <Radio ref="styled" value="hdd">
          <template #element="{ props, elementRef }">
            <StyledInput v-bind="props" :ref="elementRef" />
          </template>
        </Radio>
        HDD
      </label>
    </RadioGroup>
  </Transition>
</template>
