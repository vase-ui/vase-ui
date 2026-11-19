<script setup lang="ts">
import { useTemplateRef, type PropType } from 'vue';
import { Checkbox } from '../../src/checkbox';
import StyledInput from './StyledInput.vue';

defineProps({ attrs: Object as PropType<Record<string, unknown>> });
const box = useTemplateRef('box');
const styled = useTemplateRef('styled');
defineExpose({ box, styled });
</script>

<template>
  <label>
    <Checkbox ref="box" v-bind="attrs">
      <template #element="{ props, elementRef, state }">
        <span
          class="Box"
          :data-mark="state.indeterminate ? 'mixed' : state.checked ? 'check' : 'none'"
          :data-required="String(state.required)"
        >
          <input v-bind="props" :ref="elementRef" />
        </span>
      </template>
    </Checkbox>
    Mark
  </label>
  <label>
    <Checkbox ref="styled">
      <template #element="{ props, elementRef }">
        <StyledInput v-bind="props" :ref="elementRef" />
      </template>
    </Checkbox>
    Styled
  </label>
</template>
